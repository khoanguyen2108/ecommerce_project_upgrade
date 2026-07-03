import { Injectable } from '@nestjs/common';
import type { AiSizeProfile } from './ai-conversation-memory.service';
import { AiProductContextService, type AiPublicProduct } from './ai-product-context.service';
import type {
  ConversationMemoryDto,
  SizeRecommendationDto,
} from './dto/support.dto';

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
const SIZE_ALIASES: Record<string, string> = {
  XXL: '2XL',
  XXXL: '3XL',
  XXXXL: '4XL',
};

export interface SizeRecommendationRequest {
  currentProductId?: string;
  memory: ConversationMemoryDto;
  productQueries: string[];
  sizeProfile: AiSizeProfile;
}

export interface SizeRecommendationResult {
  recommendation: SizeRecommendationDto;
  product?: AiPublicProduct;
}

@Injectable()
export class AiSizeRecommendationService {
  constructor(private readonly productContext: AiProductContextService) {}

  async recommend(
    request: SizeRecommendationRequest,
  ): Promise<SizeRecommendationResult> {
    const productResult = await this.resolveProduct(request);
    const product = productResult.product;
    const availableSizes = product ? this.getAvailableSizes(product) : [];
    const missingFields: string[] = [];

    if (!product) {
      missingFields.push('product');
    }

    if (!request.sizeProfile.heightCm) {
      missingFields.push('height');
    }

    if (!request.sizeProfile.weightKg) {
      missingFields.push('weight');
    }

    if (!request.memory.preferredFit) {
      missingFields.push('preferredFit');
    }

    if (missingFields.length > 0 || productResult.question) {
      return {
        ...(product ? { product } : {}),
        recommendation: {
          status: 'needs_information',
          ...(product ? { product: this.productContext.toReference(product) } : {}),
          availableSizes,
          missingFields,
          question:
            productResult.question ?? this.buildMissingInformationQuestion(missingFields),
        },
      };
    }

    if (!product) {
      throw new Error('Resolved product is required for size recommendation.');
    }

    if (availableSizes.length === 0) {
      return {
        product,
        recommendation: {
          status: 'unavailable',
          product: this.productContext.toReference(product),
          availableSizes: [],
          missingFields: [],
          reason: 'This product has no active in-stock sizes right now.',
        },
      };
    }

    if (availableSizes.length === 1 && this.normalizeSize(availableSizes[0]) === 'ONE SIZE') {
      return {
        product,
        recommendation: {
          status: 'complete',
          product: this.productContext.toReference(product),
          recommendedSize: availableSizes[0],
          confidence: 65,
          reason:
            'This is the only active in-stock size for the product. No product-specific measurement chart is available, so fit should be treated as an estimate.',
          availableSizes,
          missingFields: [],
        },
      };
    }

    const recognizedSizes = availableSizes
      .map((size) => ({ original: size, normalized: this.normalizeSize(size) }))
      .filter((size) => SIZE_ORDER.includes(size.normalized));

    if (recognizedSizes.length === 0) {
      return {
        product,
        recommendation: {
          status: 'needs_information',
          product: this.productContext.toReference(product),
          availableSizes,
          missingFields: ['productMeasurements'],
          question:
            'This product uses non-letter sizing. Please provide the relevant body measurement for the listed sizes.',
        },
      };
    }

    const targetIndex = this.getTargetSizeIndex(
      request.sizeProfile.heightCm as number,
      request.sizeProfile.weightKg as number,
      request.memory.preferredFit as 'slim' | 'regular' | 'oversized',
      this.productContext.inferFit(product),
    );
    const rankedSizes = [...recognizedSizes].sort((left, right) => {
      const leftDistance = Math.abs(SIZE_ORDER.indexOf(left.normalized) - targetIndex);
      const rightDistance = Math.abs(SIZE_ORDER.indexOf(right.normalized) - targetIndex);
      return leftDistance - rightDistance;
    });
    const recommended = rankedSizes[0];
    const alternative = rankedSizes[1];
    const exactTarget = SIZE_ORDER.indexOf(recommended.normalized) === targetIndex;
    const productFit = this.productContext.inferFit(product);
    const confidence = Math.max(
      60,
      Math.min(93, 83 + (exactTarget ? 5 : -8) + (productFit ? 5 : 0)),
    );
    const fitText = request.memory.preferredFit as string;

    return {
      product,
      recommendation: {
        status: 'complete',
        product: this.productContext.toReference(product),
        recommendedSize: recommended.original,
        confidence,
        reason: `Based on ${request.sizeProfile.heightCm} cm, ${request.sizeProfile.weightKg} kg, and a ${fitText} preference, ${recommended.original} is the closest active in-stock size${productFit ? ` for this product's listed ${productFit.toLocaleLowerCase()} fit` : ''}. No product-specific measurement chart is available, so this is an estimate.`,
        ...(alternative ? { alternativeSize: alternative.original } : {}),
        availableSizes,
        missingFields: [],
      },
    };
  }

  private async resolveProduct(request: SizeRecommendationRequest): Promise<{
    product?: AiPublicProduct;
    question?: string;
  }> {
    if (request.currentProductId) {
      return { product: await this.productContext.getById(request.currentProductId) };
    }

    const productQuery =
      request.productQueries[0] ?? request.memory.lastSelectedProducts.at(-1)?.name;

    if (!productQuery) {
      return {};
    }

    const resolution = await this.productContext.resolveByName(productQuery);

    if (resolution.status === 'resolved') {
      return { product: resolution.product };
    }

    if (resolution.status === 'ambiguous') {
      const names = resolution.matches.map((product) => product.name).join(', ');
      return { question: `Which product did you mean: ${names}?` };
    }

    return { question: `I couldn't find "${productQuery}" in the active catalog. Which product should I size?` };
  }

  private getAvailableSizes(product: AiPublicProduct): string[] {
    return [...new Set(
      product.variants
        .filter((variant) => variant.isActive && variant.stock > 0)
        .map((variant) => variant.size.trim())
        .filter(Boolean),
    )].sort((left, right) => {
      const leftIndex = SIZE_ORDER.indexOf(this.normalizeSize(left));
      const rightIndex = SIZE_ORDER.indexOf(this.normalizeSize(right));

      if (leftIndex >= 0 && rightIndex >= 0) {
        return leftIndex - rightIndex;
      }

      return left.localeCompare(right, undefined, { numeric: true });
    });
  }

  private getTargetSizeIndex(
    heightCm: number,
    weightKg: number,
    preferredFit: 'slim' | 'regular' | 'oversized',
    productFit: string | null,
  ): number {
    const bmi = weightKg / Math.pow(heightCm / 100, 2);
    let target = bmi < 18.5 ? 2 : bmi < 23 ? 3 : bmi < 27 ? 4 : bmi < 31 ? 5 : 6;

    if (heightCm >= 185) {
      target += 1;
    } else if (heightCm < 158) {
      target -= 1;
    }

    const productAlreadyOversized = productFit === 'Oversized';
    const productAlreadyFitted = productFit === 'Slim' || productFit === 'Fitted';

    if (preferredFit === 'oversized' && !productAlreadyOversized) {
      target += 1;
    } else if (preferredFit === 'slim' && !productAlreadyFitted) {
      target -= 1;
    }

    return Math.max(0, Math.min(SIZE_ORDER.length - 1, target));
  }

  private normalizeSize(size: string): string {
    const normalized = size.trim().toLocaleUpperCase().replace(/[\s-]+/g, '');

    if (normalized === 'ONESIZE') {
      return 'ONE SIZE';
    }

    return SIZE_ALIASES[normalized] ?? normalized;
  }

  private buildMissingInformationQuestion(missingFields: string[]): string {
    const questions: string[] = [];

    if (missingFields.includes('product')) {
      questions.push('which product you are considering');
    }

    if (missingFields.includes('height')) {
      questions.push('your height');
    }

    if (missingFields.includes('weight')) {
      questions.push('your weight');
    }

    if (missingFields.includes('preferredFit')) {
      questions.push('your preferred fit: slim, regular, or oversized');
    }

    return `Please tell me ${this.joinList(questions)}.`;
  }

  private joinList(values: string[]): string {
    if (values.length <= 1) {
      return values[0] ?? 'the missing sizing information';
    }

    return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
  }
}

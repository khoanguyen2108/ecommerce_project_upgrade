import { Injectable } from '@nestjs/common';
import type { ConversationMemoryDto, ProductComparisonDto } from './dto/support.dto';
import {
  AiProductContextService,
  type AiProductResolution,
  type AiPublicProduct,
} from './ai-product-context.service';

export interface ProductComparisonRequest {
  currentProductId?: string;
  memory: ConversationMemoryDto;
  productQueries: string[];
}

export interface ProductComparisonResult {
  comparison: ProductComparisonDto;
  products: AiPublicProduct[];
}

@Injectable()
export class AiProductComparisonService {
  constructor(private readonly productContext: AiProductContextService) {}

  async compare(
    request: ProductComparisonRequest,
  ): Promise<ProductComparisonResult> {
    let currentProduct = request.currentProductId
      ? await this.productContext.getById(request.currentProductId)
      : undefined;
    if (
      !currentProduct &&
      request.productQueries.length === 1 &&
      request.memory.lastSelectedProducts.length > 0
    ) {
      const rememberedProduct = request.memory.lastSelectedProducts.at(-1);

      if (rememberedProduct) {
        const rememberedResolution = await this.productContext.resolveByName(
          rememberedProduct.name,
        );

        if (rememberedResolution.status === 'resolved') {
          currentProduct = rememberedResolution.product;
        }
      }
    }
    const queries = this.removeCurrentProductQuery(
      request.productQueries,
      currentProduct,
    );
    const neededQueryCount = currentProduct ? 1 : 2;

    if (queries.length < neededQueryCount) {
      return {
        comparison: {
          status: 'needs_information',
          question: currentProduct
            ? `Which product would you like to compare with ${currentProduct.name}?`
            : 'Which two Belikeme products would you like to compare?',
          ambiguousProducts: [],
        },
        products: currentProduct ? [currentProduct] : [],
      };
    }

    const resolved: AiPublicProduct[] = currentProduct ? [currentProduct] : [];

    for (const query of queries.slice(0, neededQueryCount)) {
      const resolution = await this.productContext.resolveByName(query);

      if (resolution.status !== 'resolved') {
        return this.buildResolutionQuestion(query, resolution, resolved);
      }

      if (resolved.some((product) => product.id === resolution.product.id)) {
        return {
          comparison: {
            status: 'needs_information',
            question: 'Please choose two different products to compare.',
            ambiguousProducts: [],
          },
          products: resolved,
        };
      }

      resolved.push(resolution.product);
    }

    const productA = this.productContext.toComparisonProduct(resolved[0]);
    const productB = this.productContext.toComparisonProduct(resolved[1]);

    return {
      comparison: {
        status: 'complete',
        productA,
        productB,
        recommendation: this.buildRecommendation(productA, productB, request.memory),
        ambiguousProducts: [],
      },
      products: resolved,
    };
  }

  private buildResolutionQuestion(
    query: string,
    resolution: Exclude<AiProductResolution, { status: 'resolved' }>,
    resolved: AiPublicProduct[],
  ): ProductComparisonResult {
    if (resolution.status === 'ambiguous') {
      return {
        comparison: {
          status: 'needs_information',
          question: `Which product did you mean by "${query}"?`,
          ambiguousProducts: resolution.matches,
        },
        products: resolved,
      };
    }

    return {
      comparison: {
        status: 'needs_information',
        question: `I couldn't find "${query}" in the active catalog. Which product did you mean?`,
        ambiguousProducts: [],
      },
      products: resolved,
    };
  }

  private buildRecommendation(
    productA: ReturnType<AiProductContextService['toComparisonProduct']>,
    productB: ReturnType<AiProductContextService['toComparisonProduct']>,
    memory: ConversationMemoryDto,
  ): string {
    const scoreA = this.score(productA, memory);
    const scoreB = this.score(productB, memory);

    if (scoreA.score !== scoreB.score) {
      const winner = scoreA.score > scoreB.score ? productA : productB;
      const winnerScore = scoreA.score > scoreB.score ? scoreA : scoreB;
      const groundedReason = winnerScore.reasons[0] ?? 'its current catalog availability';
      return `${winner.name} is the stronger match based on ${groundedReason}.`;
    }

    if (productA.available !== productB.available) {
      const availableProduct = productA.available ? productA : productB;
      return `${availableProduct.name} is the currently available option.`;
    }

    if (productA.price !== productB.price) {
      const lowerPriced = productA.price < productB.price ? productA : productB;
      return `${lowerPriced.name} has the lower current in-stock price; compare the listed fit, material, style, sizes, and colors for your final choice.`;
    }

    return 'Both products have an equal current price; compare their database-listed fit, material, style, sizes, and colors for your final choice.';
  }

  private score(
    product: ReturnType<AiProductContextService['toComparisonProduct']>,
    memory: ConversationMemoryDto,
  ): { reasons: string[]; score: number } {
    let score = product.available ? 1 : 0;
    const reasons: string[] = [];

    if (
      memory.favoriteColor &&
      product.availableColors.some(
        (color) => color.toLocaleLowerCase() === memory.favoriteColor,
      )
    ) {
      score += 3;
      reasons.push(`your saved ${memory.favoriteColor} color preference`);
    }

    if (
      memory.preferredFit &&
      product.fit?.toLocaleLowerCase().includes(memory.preferredFit)
    ) {
      score += 3;
      reasons.push(`your saved ${memory.preferredFit} fit preference`);
    }

    if (
      memory.preferredStyle &&
      product.style?.toLocaleLowerCase().includes(memory.preferredStyle)
    ) {
      score += 3;
      reasons.push(`your saved ${memory.preferredStyle} style preference`);
    }

    if (
      memory.budget?.currency === 'VND' &&
      product.price <= memory.budget.amount
    ) {
      score += 2;
      reasons.push('your saved VND budget');
    }

    return { reasons, score };
  }

  private removeCurrentProductQuery(
    queries: string[],
    currentProduct: AiPublicProduct | undefined,
  ): string[] {
    if (!currentProduct) {
      return queries;
    }

    const currentName = this.normalize(currentProduct.name);
    return queries.filter((query) => this.normalize(query) !== currentName);
  }

  private normalize(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }
}

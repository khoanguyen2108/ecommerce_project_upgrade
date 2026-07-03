import { Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import type {
  ComparisonProductDto,
  ConversationProductDto,
} from './dto/support.dto';

export type AiPublicProduct = Awaited<
  ReturnType<CatalogService['getPublicProduct']>
>['product'];

export type AiProductResolution =
  | { status: 'resolved'; product: AiPublicProduct }
  | { status: 'not_found'; matches: ConversationProductDto[] }
  | { status: 'ambiguous'; matches: ConversationProductDto[] };

const MATERIAL_PATTERNS: Array<[RegExp, string]> = [
  [/\bcotton blend\b/i, 'Cotton blend'],
  [/\borganic cotton\b/i, 'Organic cotton'],
  [/\bcotton\b/i, 'Cotton'],
  [/\blinen blend\b/i, 'Linen blend'],
  [/\blinen\b/i, 'Linen'],
  [/\bdenim\b/i, 'Denim'],
  [/\bwool blend\b/i, 'Wool blend'],
  [/\bwool\b/i, 'Wool'],
  [/\bpolyester\b/i, 'Polyester'],
  [/\btwill\b/i, 'Twill'],
];
const FIT_PATTERNS: Array<[RegExp, string]> = [
  [/\boversized\b/i, 'Oversized'],
  [/\brelaxed\b/i, 'Relaxed'],
  [/\bslim(?:-fit)?\b/i, 'Slim'],
  [/\bfitted\b/i, 'Fitted'],
  [/\bregular(?:-fit)?\b/i, 'Regular'],
  [/\btapered\b/i, 'Tapered'],
  [/\bcropped\b/i, 'Cropped'],
];
const STYLE_PATTERNS: Array<[RegExp, string]> = [
  [/\bvintage(?:-inspired)?\b/i, 'Vintage'],
  [/\bminimal(?:ist)?\b/i, 'Minimal'],
  [/\bstreetwear\b/i, 'Streetwear'],
  [/\bsmart casual\b/i, 'Smart casual'],
  [/\bclassic\b/i, 'Classic'],
  [/\bsporty\b/i, 'Sporty'],
  [/\bcasual\b/i, 'Casual'],
];

@Injectable()
export class AiProductContextService {
  constructor(private readonly catalogService: CatalogService) {}

  async getById(productId: string): Promise<AiPublicProduct> {
    const result = await this.catalogService.getPublicProduct(productId);
    return result.product;
  }

  async resolveByName(query: string): Promise<AiProductResolution> {
    const normalizedQuery = this.normalize(query);

    if (!normalizedQuery) {
      return { status: 'not_found', matches: [] };
    }

    const result = await this.catalogService.listProducts({
      limit: 5,
      page: 1,
      search: query,
    });
    const exactMatches = result.products.filter(
      (product) => this.normalize(product.name) === normalizedQuery,
    );
    const candidates = exactMatches.length > 0 ? exactMatches : result.products;

    if (candidates.length === 1) {
      return { status: 'resolved', product: candidates[0] };
    }

    const matches = candidates.map((product) => this.toReference(product));

    return candidates.length === 0
      ? { status: 'not_found', matches }
      : { status: 'ambiguous', matches };
  }

  toReference(product: AiPublicProduct): ConversationProductDto {
    return { name: product.name, slug: product.slug };
  }

  toComparisonProduct(product: AiPublicProduct): ComparisonProductDto {
    const availableVariants = product.variants.filter(
      (variant) => variant.isActive && variant.stock > 0,
    );
    const searchableText = [product.name, product.description ?? ''].join(' ');
    const material = this.findFact(searchableText, MATERIAL_PATTERNS);
    const fit = this.findFact(searchableText, FIT_PATTERNS);
    const style = this.findFact(searchableText, STYLE_PATTERNS);
    const prices = availableVariants.map(
      (variant) => variant.priceOverride ?? product.basePrice,
    );
    const price = prices.length > 0 ? Math.min(...prices) : product.basePrice;
    const availableSizes = this.uniqueSorted(
      availableVariants.map((variant) => variant.size),
    );
    const availableColors = this.uniqueSorted(
      availableVariants.map((variant) => variant.color),
    );

    return {
      ...this.toReference(product),
      price,
      currency: 'VND',
      category: product.category.name,
      material,
      fit,
      style,
      availableSizes,
      availableColors,
      available: availableVariants.length > 0,
      bestFor: this.buildBestFor(product.category.name, style, fit, material),
    };
  }

  inferFit(product: AiPublicProduct): string | null {
    return this.findFact(
      [product.name, product.description ?? ''].join(' '),
      FIT_PATTERNS,
    );
  }

  private buildBestFor(
    category: string,
    style: string | null,
    fit: string | null,
    material: string | null,
  ): string {
    const details = [style, fit, material].filter(
      (value): value is string => Boolean(value),
    );

    return details.length > 0 ? details.join(', ') : category;
  }

  private findFact(
    value: string,
    patterns: Array<[RegExp, string]>,
  ): string | null {
    return patterns.find(([pattern]) => pattern.test(value))?.[1] ?? null;
  }

  private uniqueSorted(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
      (left, right) => left.localeCompare(right, undefined, { numeric: true }),
    );
  }

  private normalize(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }
}

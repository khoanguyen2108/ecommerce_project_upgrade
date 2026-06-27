import { Injectable } from '@nestjs/common';
import type { NormalizedRecommendProductsRequest } from './dto/recommend-products.dto';
import type { NormalizedStyleAdviceRequest } from './dto/style-advice.dto';

const MAX_CANDIDATES = 24;
const MAX_CONTEXT_BYTES = 16 * 1024;
const MAX_RECOMMENDATION_CANDIDATES = 30;
const MAX_RECOMMENDATION_CONTEXT_BYTES = 20 * 1024;
const MAX_DESCRIPTION_LENGTH = 240;
const MAX_CATEGORIES = 3;
const MAX_COLORS = 8;
const MAX_SIZES = 8;
const MAX_AVAILABLE_VARIANT_VALUES = 50;
const DISALLOWED_CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

interface AiCategoryRecord {
  name: string;
  slug: string;
}

interface AiVariantRecord {
  color: string;
  size: string;
  priceOverride: number | null;
}

export interface AiCandidateProductRecord {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  category: AiCategoryRecord;
  productCategories: Array<{ category: AiCategoryRecord }>;
  variants: AiVariantRecord[];
}

export interface AiGroundedProductRecord {
  id: string;
  name: string;
  slug: string;
  imageUrls: string[];
  basePrice: number;
  variants: Array<{ priceOverride: number | null }>;
}

export interface AiRecommendationGroundedProductRecord {
  id: string;
  name: string;
  slug: string;
  imageUrls: string[];
  basePrice: number;
  variants: AiVariantRecord[];
}

export interface AiCatalogContextProduct {
  ref: string;
  name: string;
  description?: string;
  categories: AiCategoryRecord[];
  priceMin: number;
  priceMax: number;
  colors: string[];
  sizes: string[];
  inStock: true;
}

export interface AiCatalogCandidate {
  ref: string;
  productId: string;
  context: AiCatalogContextProduct;
}

export interface GroundedProduct {
  productId: string;
  productSlug: string;
  productName: string;
  imageUrl?: string;
  price: number;
}

export interface RecommendationGroundedProduct extends GroundedProduct {
  availableColors: string[];
  availableSizes: string[];
}

@Injectable()
export class AiContextMapper {
  mapCandidates(
    products: AiCandidateProductRecord[],
    request: NormalizedStyleAdviceRequest,
  ): AiCatalogCandidate[] {
    const candidates: AiCatalogCandidate[] = [];

    for (const product of this.diversifyByPrimaryCategory(products)) {
      if (candidates.length >= MAX_CANDIDATES) {
        break;
      }

      const variants = product.variants.filter((variant) =>
        this.variantMatchesRequest(variant, product.basePrice, request),
      );

      if (variants.length === 0) {
        continue;
      }

      const prices = variants.map(
        (variant) => variant.priceOverride ?? product.basePrice,
      );
      const ref = `P${candidates.length + 1}`;
      const description = this.normalizeText(product.description ?? '').slice(
        0,
        MAX_DESCRIPTION_LENGTH,
      );
      const context: AiCatalogContextProduct = {
        ref,
        name: this.normalizeText(product.name),
        ...(description ? { description } : {}),
        categories: this.mapCategories(product),
        priceMin: Math.min(...prices),
        priceMax: Math.max(...prices),
        colors: this.uniqueNormalizedValues(
          variants.map((variant) => variant.color),
          MAX_COLORS,
        ),
        sizes: this.uniqueNormalizedValues(
          variants.map((variant) => variant.size),
          MAX_SIZES,
        ),
        inStock: true,
      };
      const nextCandidates = [
        ...candidates.map((candidate) => candidate.context),
        context,
      ];

      if (
        Buffer.byteLength(JSON.stringify(nextCandidates), 'utf8') >
        MAX_CONTEXT_BYTES
      ) {
        break;
      }

      candidates.push({ ref, productId: product.id, context });
    }

    return candidates;
  }

  mapRecommendationCandidates(
    products: AiCandidateProductRecord[],
    request: NormalizedRecommendProductsRequest,
  ): AiCatalogCandidate[] {
    const candidates: AiCatalogCandidate[] = [];

    for (const product of this.diversifyByPrimaryCategory(products)) {
      if (candidates.length >= MAX_RECOMMENDATION_CANDIDATES) {
        break;
      }

      const variants = product.variants.filter((variant) =>
        this.variantMatchesRecommendationRequest(
          variant,
          product.basePrice,
          request,
        ),
      );

      if (variants.length === 0) {
        continue;
      }

      const prices = variants.map(
        (variant) => variant.priceOverride ?? product.basePrice,
      );
      const ref = `P${candidates.length + 1}`;
      const description = this.normalizeText(product.description ?? '').slice(
        0,
        MAX_DESCRIPTION_LENGTH,
      );
      const context: AiCatalogContextProduct = {
        ref,
        name: this.normalizeText(product.name),
        ...(description ? { description } : {}),
        categories: this.mapCategories(product),
        priceMin: Math.min(...prices),
        priceMax: Math.max(...prices),
        colors: this.uniqueNormalizedValues(
          variants.map((variant) => variant.color),
          MAX_COLORS,
        ),
        sizes: this.uniqueNormalizedValues(
          variants.map((variant) => variant.size),
          MAX_SIZES,
        ),
        inStock: true,
      };
      const nextCandidates = [
        ...candidates.map((candidate) => candidate.context),
        context,
      ];

      if (
        Buffer.byteLength(JSON.stringify(nextCandidates), 'utf8') >
        MAX_RECOMMENDATION_CONTEXT_BYTES
      ) {
        break;
      }

      candidates.push({ ref, productId: product.id, context });
    }

    return candidates;
  }

  private diversifyByPrimaryCategory(
    products: AiCandidateProductRecord[],
  ): AiCandidateProductRecord[] {
    const groups = new Map<string, AiCandidateProductRecord[]>();

    for (const product of products) {
      const categoryKey = this.normalizeComparable(product.category.slug);
      const group = groups.get(categoryKey) ?? [];

      group.push(product);
      groups.set(categoryKey, group);
    }

    const result: AiCandidateProductRecord[] = [];
    let groupIndex = 0;
    let addedProduct = true;

    while (addedProduct) {
      addedProduct = false;

      for (const group of groups.values()) {
        const product = group[groupIndex];

        if (product) {
          result.push(product);
          addedProduct = true;
        }
      }

      groupIndex += 1;
    }

    return result;
  }

  mapGroundedProduct(product: AiGroundedProductRecord): GroundedProduct {
    const prices = product.variants.map(
      (variant) => variant.priceOverride ?? product.basePrice,
    );

    return {
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      ...(product.imageUrls[0] ? { imageUrl: product.imageUrls[0] } : {}),
      price: Math.min(...prices),
    };
  }

  mapRecommendationGroundedProduct(
    product: AiRecommendationGroundedProductRecord,
    request: NormalizedRecommendProductsRequest,
  ): RecommendationGroundedProduct | undefined {
    const variants = product.variants.filter((variant) =>
      this.variantMatchesRecommendationRequest(
        variant,
        product.basePrice,
        request,
      ),
    );

    if (variants.length === 0) {
      return undefined;
    }

    const prices = variants.map(
      (variant) => variant.priceOverride ?? product.basePrice,
    );

    return {
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      ...(product.imageUrls[0] ? { imageUrl: product.imageUrls[0] } : {}),
      price: Math.min(...prices),
      availableColors: this.uniqueNormalizedValues(
        product.variants.map((variant) => variant.color),
        MAX_AVAILABLE_VARIANT_VALUES,
      ),
      availableSizes: this.uniqueNormalizedValues(
        product.variants.map((variant) => variant.size),
        MAX_AVAILABLE_VARIANT_VALUES,
      ),
    };
  }

  private variantMatchesRequest(
    variant: AiVariantRecord,
    basePrice: number,
    request: NormalizedStyleAdviceRequest,
  ): boolean {
    const normalizedColor = this.normalizeComparable(variant.color);
    const normalizedSize = this.normalizeComparable(variant.size);
    const matchesColor =
      request.preferredColors.length === 0 ||
      request.preferredColors.some(
        (color) => this.normalizeComparable(color) === normalizedColor,
      );
    const matchesSize =
      request.preferredSizes.length === 0 ||
      request.preferredSizes.some(
        (size) => this.normalizeComparable(size) === normalizedSize,
      );
    const price = variant.priceOverride ?? basePrice;
    const matchesBudget = request.budget === undefined || price <= request.budget;

    return matchesColor && matchesSize && matchesBudget;
  }

  private variantMatchesRecommendationRequest(
    variant: AiVariantRecord,
    basePrice: number,
    request: NormalizedRecommendProductsRequest,
  ): boolean {
    const normalizedColor = this.normalizeComparable(variant.color);
    const normalizedSize = this.normalizeComparable(variant.size);
    const matchesColor =
      request.colors.length === 0 ||
      request.colors.some(
        (color) => this.normalizeComparable(color) === normalizedColor,
      );
    const matchesSize =
      request.sizes.length === 0 ||
      request.sizes.some(
        (size) => this.normalizeComparable(size) === normalizedSize,
      );
    const price = variant.priceOverride ?? basePrice;
    const matchesMinimum =
      request.minBudget === undefined || price >= request.minBudget;
    const matchesMaximum =
      request.maxBudget === undefined || price <= request.maxBudget;

    return matchesColor && matchesSize && matchesMinimum && matchesMaximum;
  }

  private mapCategories(product: AiCandidateProductRecord): AiCategoryRecord[] {
    const categories = [
      product.category,
      ...product.productCategories.map((membership) => membership.category),
    ];
    const seen = new Set<string>();
    const result: AiCategoryRecord[] = [];

    for (const category of categories) {
      const key = this.normalizeComparable(category.slug);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push({
        name: this.normalizeText(category.name),
        slug: this.normalizeText(category.slug),
      });

      if (result.length >= MAX_CATEGORIES) {
        break;
      }
    }

    return result;
  }

  private uniqueNormalizedValues(values: string[], limit: number): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
      const normalized = this.normalizeText(value);
      const comparable = this.normalizeComparable(normalized);

      if (!normalized || seen.has(comparable)) {
        continue;
      }

      seen.add(comparable);
      result.push(normalized);

      if (result.length >= limit) {
        break;
      }
    }

    return result;
  }

  private normalizeText(value: string): string {
    return value
      .replace(DISALLOWED_CONTROL_CHARACTERS, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private normalizeComparable(value: string): string {
    return this.normalizeText(value).toLocaleLowerCase();
  }
}

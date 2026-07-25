import { describe, expect, it } from "vitest";

import {
  formatOptional,
  getBooleanFilterValue,
  normalizeNullableText,
  parseActiveFilter,
} from "@/components/admin/admin-format";
import { formatPrice, getVariantSummary } from "@/features/catalog/format";
import {
  getImplicitSelectableVariant,
  getOnlySelectableColor,
  getSizesForColor,
  getVariantUnitPrice,
  hasSelectableColor,
  hasSelectableCombination,
  isVariantSelectable,
  productRequiresSize,
  resolveSelectedVariant,
} from "@/features/catalog/variant-selection";
import {
  isImplicitAccessoryOption,
  isNoSize,
  isShoeSize,
  isStandardSize,
  sortSizesByStandardOrder,
} from "@/features/catalog/sizes";
import type { Product, ProductVariant } from "@/features/catalog/types";
import { getPostLoginRedirectPath, isAdminUser } from "@/features/auth/roles";
import { isLocale } from "@/features/i18n/locale";
import {
  getReturnReasonLabel,
  getReturnStatusLabel,
} from "@/features/returns/format";
import type {
  ReturnReason,
  ReturnRequestStatus,
} from "@/features/returns/types";
import { buildQueryString, withQuery } from "@/lib/api/query";

const range = (length: number) => Array.from({ length }, (_, index) => index);

function variant(
  overrides: Partial<ProductVariant> = {},
): ProductVariant {
  return {
    id: "variant-1",
    productId: "product-1",
    sku: null,
    size: "M",
    color: "Black",
    stock: 5,
    priceOverride: null,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-1",
    categoryId: "category-1",
    name: "Test product",
    slug: "test-product",
    description: null,
    basePrice: 100_000,
    imageUrls: [],
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    category: { id: "category-1", name: "Tops", slug: "tops" },
    categories: [{ id: "category-1", name: "Tops", slug: "tops" }],
    variants: [],
    ...overrides,
  };
}

describe("query serialization (20 cases)", () => {
  it.each(range(20))("serializes query scenario %i", (index) => {
    const query = {
      page: index + 1,
      search: index % 2 === 0 ? `tee ${index}` : "",
      active: index % 3 === 0,
      omitted: index % 4 === 0 ? undefined : null,
    };
    const params = new URLSearchParams(buildQueryString(query));

    expect(params.get("page")).toBe(String(index + 1));
    expect(params.get("search")).toBe(index % 2 === 0 ? `tee ${index}` : null);
    expect(params.get("active")).toBe(String(index % 3 === 0));
    expect(params.has("omitted")).toBe(false);
  });
});

describe("query URL composition (20 cases)", () => {
  it.each(range(20))("composes URL scenario %i", (index) => {
    const path = `/products/${index}`;
    const query = index % 2 === 0 ? { page: index + 1 } : {};

    expect(withQuery(path, query)).toBe(
      index % 2 === 0 ? `${path}?page=${index + 1}` : path,
    );
  });
});

describe("size classification (20 cases)", () => {
  const inputs = [
    "XS", "S", "M", "L", "XL",
    "35", "36", "37", "38", "39",
    "40", "41", "42", "43", "44",
    "45", "46", "ONE_SIZE", "", "XXL",
  ];

  it.each(inputs)("classifies %j", (size) => {
    expect(isStandardSize(size)).toBe(["XS", "S", "M", "L", "XL"].includes(size));
    expect(isShoeSize(size)).toBe(/^(3[5-9]|4[0-6])$/.test(size));
    expect(isNoSize(size)).toBe(size === "ONE_SIZE" || size === "");
  });
});

describe("stable size ordering (20 cases)", () => {
  it.each(range(20))("orders and deduplicates scenario %i", (index) => {
    const customA = `CUSTOM_${index}`;
    const customB = `OTHER_${index}`;
    const input = index % 2
      ? [customA, "XL", "S", customB, "S", "M"]
      : ["46", "35", customA, "40", "35", customB];
    const result = sortSizesByStandardOrder(input);

    expect(new Set(result).size).toBe(result.length);
    expect(result.at(-2)).toBe(customA);
    expect(result.at(-1)).toBe(customB);
    if (index % 2) {
      expect(result.slice(0, 3)).toEqual(["S", "M", "XL"]);
    } else {
      expect(result.slice(0, 3)).toEqual(["35", "40", "46"]);
    }
  });
});

describe("variant availability (20 cases)", () => {
  it.each(range(20))("evaluates stock scenario %i", (index) => {
    const active = index % 2 === 0;
    const stock = index % 5;
    const candidate = variant({ isActive: active, stock });
    const expected = active && stock > 0;

    expect(isVariantSelectable(candidate)).toBe(expected);
    expect(hasSelectableColor([candidate], "Black")).toBe(expected);
    expect(hasSelectableCombination([candidate], "Black", "M")).toBe(expected);
    expect(hasSelectableCombination([candidate], "White", "M")).toBe(false);
  });
});

describe("variant selection (20 cases)", () => {
  it.each(range(20))("resolves selection scenario %i", (index) => {
    const color = `Color ${index}`;
    const candidates = [
      variant({ id: "sold-out", color, size: "S", stock: 0 }),
      variant({ id: "wanted", color, size: "M" }),
      variant({ id: "other", color: "Other", size: "M" }),
    ];

    expect(getOnlySelectableColor(candidates)).toBeUndefined();
    expect(getSizesForColor(candidates, color)).toEqual(["S", "M"]);
    expect(productRequiresSize(candidates)).toBe(true);
    expect(resolveSelectedVariant({ color, size: "M", variants: candidates })?.id)
      .toBe("wanted");
  });
});

describe("accessory and pricing rules (20 cases)", () => {
  it.each(range(20))("handles accessory scenario %i", (index) => {
    const priceOverride = index % 2 === 0 ? 120_000 + index : null;
    const accessory = variant({
      color: index % 3 === 0 ? " default " : "Default",
      size: index % 4 === 0 ? "" : "ONE_SIZE",
      priceOverride,
    });

    expect(isImplicitAccessoryOption(accessory)).toBe(true);
    expect(getImplicitSelectableVariant([accessory])).toBe(accessory);
    expect(getVariantUnitPrice(product(), accessory)).toBe(
      priceOverride ?? 100_000,
    );
  });
});

describe("locale, auth, and return labels (20 cases)", () => {
  const reasons: ReturnReason[] = [
    "WRONG_SIZE", "WRONG_ITEM", "DAMAGED", "CHANGED_MIND", "OTHER",
  ];
  const statuses: ReturnRequestStatus[] = ["PENDING", "APPROVED", "REJECTED"];

  it.each(range(20))("returns localized values scenario %i", (index) => {
    const locale = index % 2 === 0 ? "en" : "vi";
    const reason = reasons[index % reasons.length];
    const status = statuses[index % statuses.length];
    const role = index % 4 === 0 ? "ADMIN" : index % 3 === 0 ? "STAFF" : "CUSTOMER";

    expect(isLocale(locale)).toBe(true);
    expect(isAdminUser({ role })).toBe(role === "ADMIN");
    expect(getPostLoginRedirectPath({ role }, "/account")).toBe(
      role === "ADMIN" ? "/admin" : "/account",
    );
    expect(getReturnReasonLabel(reason, locale)).toBeTruthy();
    expect(getReturnStatusLabel(status, locale)).toBeTruthy();
  });
});

describe("admin filter helpers (20 cases)", () => {
  it.each(range(20))("normalizes admin input scenario %i", (index) => {
    const value = index % 3 === 0 ? "true" : index % 3 === 1 ? "false" : "all";
    const parsed = parseActiveFilter(value);
    const text = index % 2 === 0 ? `  value ${index}  ` : "   ";

    expect(parsed).toBe(value === "true" ? true : value === "false" ? false : undefined);
    expect(getBooleanFilterValue(parsed)).toBe(value === "all" ? "" : value);
    expect(normalizeNullableText(text)).toBe(
      index % 2 === 0 ? `value ${index}` : null,
    );
    expect(formatOptional(text, "en")).toBe(
      index % 2 === 0 ? text : "Not set",
    );
  });
});

describe("catalog display formatting (20 cases)", () => {
  it.each(range(20))("formats catalog scenario %i", (index) => {
    const value = index * 10_000;
    const colors = [`Color ${index}`, `Color ${index}`, "Black"];
    const sizes = index % 2 === 0 ? ["M", "L"] : ["ONE_SIZE"];
    const summary = getVariantSummary(
      colors.flatMap((color) => sizes.map((size) => ({ color, size }))),
    );

    expect(formatPrice(value)).toContain(String(value).replace(/\B(?=(\d{3})+(?!\d))/g, "."));
    expect(summary).toContain(`Color ${index}`);
    expect(summary).toContain("Black");
    expect(summary).toContain(sizes[0]);
  });
});

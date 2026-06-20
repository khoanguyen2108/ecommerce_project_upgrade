export const CLOTHING_SIZE_ORDER = ["XS", "S", "M", "L", "XL"] as const;
export const SHOE_SIZE_ORDER = [
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
] as const;
export const ONE_SIZE = "ONE_SIZE";
export const SIZE_ORDER = CLOTHING_SIZE_ORDER;

export type StandardSize = (typeof SIZE_ORDER)[number];

const SIZE_RANK = new Map<string, number>(
  [...CLOTHING_SIZE_ORDER, ...SHOE_SIZE_ORDER].map((size, index) => [size, index]),
);

export function isStandardSize(size: string): size is StandardSize {
  return (SIZE_ORDER as readonly string[]).includes(size);
}

export function sortSizesByStandardOrder(sizes: Iterable<string>): string[] {
  return Array.from(new Set(sizes))
    .map((size, originalIndex) => ({ originalIndex, size }))
    .sort((left, right) => {
      const rankDifference =
        (SIZE_RANK.get(left.size) ?? SIZE_RANK.size) -
        (SIZE_RANK.get(right.size) ?? SIZE_RANK.size);

      return rankDifference || left.originalIndex - right.originalIndex;
    })
    .map(({ size }) => size);
}

export function isShoeSize(size: string): boolean {
  return (SHOE_SIZE_ORDER as readonly string[]).includes(size);
}

export function isNoSize(size: string): boolean {
  return size === ONE_SIZE || size.trim() === "";
}

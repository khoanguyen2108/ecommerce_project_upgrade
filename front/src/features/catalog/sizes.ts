export const SIZE_ORDER = ["XS", "S", "M", "L", "XL"] as const;

export type StandardSize = (typeof SIZE_ORDER)[number];

const SIZE_RANK = new Map<string, number>(
  SIZE_ORDER.map((size, index) => [size, index]),
);

export function isStandardSize(size: string): size is StandardSize {
  return (SIZE_ORDER as readonly string[]).includes(size);
}

export function sortSizesByStandardOrder(sizes: Iterable<string>): string[] {
  return Array.from(new Set(sizes))
    .map((size, originalIndex) => ({ originalIndex, size }))
    .sort((left, right) => {
      const rankDifference =
        (SIZE_RANK.get(left.size) ?? SIZE_ORDER.length) -
        (SIZE_RANK.get(right.size) ?? SIZE_ORDER.length);

      return rankDifference || left.originalIndex - right.originalIndex;
    })
    .map(({ size }) => size);
}

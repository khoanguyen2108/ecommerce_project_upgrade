export type QueryValue = string | number | boolean | null | undefined;

export function buildQueryString(query: object = {}): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query) as [string, QueryValue][]) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    params.set(key, String(value));
  }

  return params.toString();
}

export function withQuery(path: string, query: object = {}): string {
  const queryString = buildQueryString(query);

  return queryString ? `${path}?${queryString}` : path;
}

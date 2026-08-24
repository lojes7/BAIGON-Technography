import JSONbig from "json-bigint";

const parser = JSONbig({ storeAsString: true });

export function parseJson(text: string): unknown {
  return parser.parse(text);
}

export function stringifyNumericIdBody(obj: unknown, idKeys: string[]): string {
  const pattern = idKeys
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  if (!pattern) return JSON.stringify(obj);
  return JSON.stringify(obj).replace(
    new RegExp(`"(${pattern})":"(\\d+)"`, "g"),
    '"$1":$2',
  );
}

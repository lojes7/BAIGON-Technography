import JSONbig from "json-bigint";

const parser = JSONbig({ storeAsString: true });
const NULL_LITERALS = new Set(["null", "undefined", "NaN", ""]);
export function sanitizeNode(node: unknown): unknown {
  if (typeof node === "string") {
    return NULL_LITERALS.has(node) ? null : node;
  }
  if (Array.isArray(node)) return node.map(sanitizeNode);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(node)) out[k] = sanitizeNode((node as Record<string, unknown>)[k]);
    return out;
  }
  return node;
}

export function parseJson(text: string): unknown {
  return sanitizeNode(parser.parse(text));
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

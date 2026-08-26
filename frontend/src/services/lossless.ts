import JSONbig from "json-bigint";

const parser = JSONbig({ storeAsString: true });
const serializer = JSONbig({ useNativeBigInt: true });

export function parseJson(text: string): unknown {
  return parser.parse(text);
}

export function stringifyNumericIdBody(
  obj: unknown,
  idKeys: string[],
  idArrayKeys: string[] = [],
): string {
  const scalarKeySet = new Set(idKeys);
  const arrayKeySet = new Set(idArrayKeys);
  const toRawId = (value: unknown) => (
    typeof value === "string" && /^\d+$/.test(value) ? BigInt(value) : value
  );

  // 使用原生 BigInt 交给 json-bigint 输出数字字面量，避免雪花 ID 经 Number 丢失精度。
  return serializer.stringify(obj, (key, value) => {
    if (scalarKeySet.has(key)) return toRawId(value);
    if (arrayKeySet.has(key) && Array.isArray(value)) return value.map(toRawId);
    return value;
  });
}

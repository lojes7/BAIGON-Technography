import type { CatalogItem, CatalogPage } from "../types/api";

type RuntimeCatalogItem<T extends CatalogItem> = Omit<T, "id"> & {
  id: string | number;
};

/**
 * lossless JSON 只会把超出安全整数范围的 ID 转成字符串；目录种子 ID 仍可能是 number。
 * 在服务边界统一转换，保证前端受控选择器始终使用字符串 ID。
 */
export function normalizeCatalogPageIds<T extends CatalogItem>(
  page: CatalogPage<RuntimeCatalogItem<T>>,
): CatalogPage<T> {
  return {
    ...page,
    items: page.items.map((item) => ({
      ...item,
      id: String(item.id),
    }) as T),
  };
}

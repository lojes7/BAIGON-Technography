// 百工谱 — 七级目录批量详情公共校验与缺失 ID 计算
package com.baigon.occupation.service.catalog;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

public final class CatalogLookupSupport {

    private static final int MAX_LOOKUP_IDS = 200;

    private CatalogLookupSupport() {
    }

    /** 单次仓储查询解析 1 到 200 个 ID，去重后按首次请求顺序返回。 */
    public static <T> CatalogLookupResult resolve(
            Collection<Long> values,
            Function<Collection<Long>, List<T>> loader,
            Function<T, CatalogDetail> mapper) {
        LinkedHashSet<Long> ids = normalizedIds(values);
        Map<Long, CatalogDetail> loadedById = new LinkedHashMap<>();
        loader.apply(ids).stream().map(mapper)
                .forEach(item -> loadedById.put(item.id(), item));
        List<CatalogDetail> items = ids.stream()
                .map(loadedById::get)
                .filter(java.util.Objects::nonNull)
                .toList();
        List<Long> missingIds = ids.stream()
                .filter(id -> !loadedById.containsKey(id))
                .toList();
        return new CatalogLookupResult(List.copyOf(items), List.copyOf(missingIds));
    }

    public static long positiveId(Long value) {
        if (value == null || value <= 0) {
            throw new IllegalArgumentException("id must be > 0");
        }
        return value;
    }

    private static LinkedHashSet<Long> normalizedIds(Collection<Long> values) {
        if (values == null || values.isEmpty() || values.size() > MAX_LOOKUP_IDS) {
            throw new IllegalArgumentException("ids must contain between 1 and 200 ids");
        }
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        for (Long value : values) ids.add(positiveId(value));
        return ids;
    }
}

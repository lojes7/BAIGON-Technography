// 百工谱 — 七级目录批量详情公共语义测试
package com.baigon.occupation.service.catalog;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CatalogLookupSupportTest {

    @Test
    void resolveShouldDeduplicateAndKeepFirstRequestOrderForItemsAndMissingIds() {
        CatalogDetail first = new CatalogDetail(10L, "10", "十", null, false, "");
        CatalogDetail third = new CatalogDetail(30L, "30", "三十", null, false, "");

        CatalogLookupResult result = CatalogLookupSupport.resolve(
                List.of(30L, 99L, 10L, 30L, 88L),
                ids -> {
                    assertEquals(List.of(30L, 99L, 10L, 88L), new ArrayList<>(ids));
                    // 模拟仓储按自身规则返回，业务层仍必须恢复请求顺序。
                    return List.of(first, third);
                },
                Function.identity());

        assertEquals(List.of(30L, 10L), result.items().stream().map(CatalogDetail::id).toList());
        assertEquals(List.of(99L, 88L), result.missingIds());
    }

    @Test
    void resolveShouldRejectMoreThanTwoHundredRawIdsBeforeDeduplication() {
        assertThrows(IllegalArgumentException.class, () -> CatalogLookupSupport.resolve(
                Collections.nCopies(201, 1L), ignored -> List.of(), Function.identity()));
    }
}

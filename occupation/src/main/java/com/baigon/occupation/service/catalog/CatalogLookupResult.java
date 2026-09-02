// 百工谱 — 七级目录批量详情结果
package com.baigon.occupation.service.catalog;

import java.util.List;

public record CatalogLookupResult(List<CatalogDetail> items, List<Long> missingIds) {
}

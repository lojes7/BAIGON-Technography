// 百工谱 — 七级目录单条详情的内部统一投影
package com.baigon.occupation.service.catalog;

/** Gateway 会按具体目录类型裁剪字段，不把统一投影直接暴露给前端。 */
public record CatalogDetail(long id,
                            String code,
                            String name,
                            Long parentId,
                            boolean embed,
                            String description) {
}

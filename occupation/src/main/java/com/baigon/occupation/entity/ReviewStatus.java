// 百工谱 — 通用人工审核状态
package com.baigon.occupation.entity;

/** 与 PostgreSQL review_status 枚举保持一致，供各业务实体复用。 */
public enum ReviewStatus {
    PASSED,
    REJECTED,
    PENDING
}

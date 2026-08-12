// 百工谱 — 单条目录数据的向量化状态
package com.baigon.occupation.entity;

/** 与 PostgreSQL task_status 枚举保持一致，不表示后台任务运行态。 */
public enum EmbeddingStatus {
    SUCCESS,
    FAILED,
    PENDING
}

// 百工谱 — 通用任务状态
package com.baigon.occupation.entity;

/** 与 PostgreSQL task_status 枚举保持一致，可用于向量化和岗位分析任务。 */
public enum TaskStatus {
    SUCCESS,
    FAILED,
    PENDING
}

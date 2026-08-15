// 百工谱 — 单条岗位技能分析结果的人工审核动作
package com.baigon.occupation.entity.jobanalysis;

/** 审核动作与 gateway/protobuf 契约保持一致。 */
public enum JobAnalysisReviewAction {
    APPROVE,
    APPROVE_WITH_EDIT,
    REJECT
}

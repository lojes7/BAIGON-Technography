// 百工谱 — pgvector 规范技能候选查询投影
package com.baigon.occupation.repository.skill;

public interface SkillCandidateProjection {
    Long getId();
    String getName();
    Double getSimilarity();
}

// 百工谱 — pgvector 职业候选查询投影
package com.baigon.occupation.repository.occupation;

public interface OccupationCandidateProjection {
    Long getId();
    String getName();
    Double getSimilarity();
}

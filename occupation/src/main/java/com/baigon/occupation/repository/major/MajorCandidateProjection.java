// 百工谱 — pgvector 专业候选查询投影
package com.baigon.occupation.repository.major;

public interface MajorCandidateProjection {
    Long getId();
    String getName();
    Double getSimilarity();
}

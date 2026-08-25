// 百工谱 — 规范技能批量向量化数据服务测试
package com.baigon.occupation.service.skill;

import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.repository.skill.SkillRepository;
import com.baigon.occupation.service.EmbeddingDataService;
import com.baigon.occupation.service.EmbeddingDataService.EmbeddingCandidate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SkillEmbeddingDataServiceTest {

    private SkillRepository repository;
    private SkillEmbeddingDataService service;

    @BeforeEach
    void setUp() {
        repository = mock(SkillRepository.class);
        service = new SkillEmbeddingDataService(repository);
    }

    @Test
    void progressUsesSuccessfulSkillsAsEmbeddedCount() {
        when(repository.countByDeletedAtIsNull()).thenReturn(120L);
        when(repository.countByDeletedAtIsNullAndEmbeddingStatus(TaskStatus.SUCCESS))
                .thenReturn(95L);

        EmbeddingDataService.Progress progress = service.getProgress();

        assertEquals(95L, progress.embedded());
        assertEquals(120L, progress.total());
    }

    @Test
    void successWritesPgvectorLiteral() {
        when(repository.markSuccess(1L, "[0.1,0.2]")).thenReturn(1);

        service.markSuccess(
                List.of(new EmbeddingCandidate(1L, "向量数据库")),
                List.of(List.of(0.1F, 0.2F)));

        verify(repository).markSuccess(1L, "[0.1,0.2]");
    }

    @Test
    void responseCountMustMatchInputCount() {
        assertThrows(IllegalArgumentException.class, () -> service.markSuccess(
                List.of(new EmbeddingCandidate(1L, "向量数据库")),
                List.of()));
    }
}

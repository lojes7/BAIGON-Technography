// 百工谱 — 职业向量化进度测试
package com.baigon.occupation.service.occupation;

import com.baigon.occupation.entity.EmbeddingStatus;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import com.baigon.occupation.service.EmbeddingDataService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OccupationEmbeddingDataServiceTest {

    private OccupationRepository repository;
    private OccupationEmbeddingDataService service;

    @BeforeEach
    void setUp() {
        repository = mock(OccupationRepository.class);
        service = new OccupationEmbeddingDataService(repository);
    }

    @Test
    void progressUsesSuccessStatusAsEmbeddedCount() {
        when(repository.countByDeletedAtIsNull()).thenReturn(1635L);
        when(repository.countByDeletedAtIsNullAndEmbeddingStatus(EmbeddingStatus.SUCCESS))
                .thenReturn(180L);

        EmbeddingDataService.Progress progress = service.getProgress();

        assertEquals(180L, progress.embedded());
        assertEquals(1635L, progress.total());
    }
}

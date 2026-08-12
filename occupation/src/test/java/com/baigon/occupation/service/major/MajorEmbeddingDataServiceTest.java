// 百工谱 — 专业向量写库事务参数测试
package com.baigon.occupation.service.major;

import com.baigon.occupation.repository.major.MajorRepository;
import com.baigon.occupation.service.EmbeddingDataService.EmbeddingCandidate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MajorEmbeddingDataServiceTest {

    private MajorRepository repository;
    private MajorEmbeddingDataService service;

    @BeforeEach
    void setUp() {
        repository = mock(MajorRepository.class);
        service = new MajorEmbeddingDataService(repository);
    }

    @Test
    void successWritesPgvectorLiteral() {
        when(repository.markSuccess(1L, "[0.1,0.2]")).thenReturn(1);

        service.markSuccess(
                List.of(new EmbeddingCandidate(1L, "哲学")),
                List.of(List.of(0.1F, 0.2F)));

        verify(repository).markSuccess(1L, "[0.1,0.2]");
    }

    @Test
    void responseCountMustMatchInputCount() {
        assertThrows(IllegalArgumentException.class, () -> service.markSuccess(
                List.of(new EmbeddingCandidate(1L, "哲学")),
                List.of()));
    }
}

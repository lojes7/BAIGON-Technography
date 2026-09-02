// 百工谱 — 专业目录分页参数校验测试
package com.baigon.occupation.service.major;

import com.baigon.occupation.repository.major.DisciplineCategoryRepository;
import com.baigon.occupation.repository.major.MajorCategoryRepository;
import com.baigon.occupation.repository.major.MajorRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class MajorCatalogServiceTest {

    private MajorCatalogService service;

    @BeforeEach
    void setUp() {
        service = new MajorCatalogService(
                mock(DisciplineCategoryRepository.class),
                mock(MajorCategoryRepository.class),
                mock(MajorRepository.class));
    }

    @Test
    void zeroPageSizeUsesDefault() {
        assertEquals(20, service.normalizedPageSize(0));
    }

    @Test
    void pageSizeOverOneHundredIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.normalizedPageSize(101));
    }

    @Test
    void majorQueryWithoutParentShouldSearchAllForGraphSelection() {
        MajorRepository repository = mock(MajorRepository.class);
        service = new MajorCatalogService(
                mock(DisciplineCategoryRepository.class),
                mock(MajorCategoryRepository.class), repository);

        service.listMajors(0, 0, 20, "软件");

        verify(repository).searchAll(
                org.mockito.ArgumentMatchers.eq("软件"),
                org.mockito.ArgumentMatchers.any());
    }
}

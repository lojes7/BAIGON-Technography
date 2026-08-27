// 百工谱 — 职业目录分页参数校验测试
package com.baigon.occupation.service.occupation;

import com.baigon.occupation.repository.occupation.OccupationCategoryRepository;
import com.baigon.occupation.repository.occupation.OccupationMajorCategoryRepository;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import com.baigon.occupation.repository.occupation.OccupationSubCategoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class OccupationCatalogServiceTest {

    private OccupationCatalogService service;

    @BeforeEach
    void setUp() {
        service = new OccupationCatalogService(
                mock(OccupationMajorCategoryRepository.class),
                mock(OccupationSubCategoryRepository.class),
                mock(OccupationCategoryRepository.class),
                mock(OccupationRepository.class));
    }

    @Test
    void zeroPageSizeUsesDefault() {
        assertEquals(20, service.normalizedPageSize(0));
    }

    @Test
    void occupationQueryWithoutParentShouldSearchAllForGraphSelection() {
        OccupationRepository repository = mock(OccupationRepository.class);
        service = new OccupationCatalogService(
                mock(OccupationMajorCategoryRepository.class),
                mock(OccupationSubCategoryRepository.class),
                mock(OccupationCategoryRepository.class), repository);

        service.listOccupations(0, 0, 20, "Java");

        verify(repository).searchAll(
                org.mockito.ArgumentMatchers.eq("Java"),
                org.mockito.ArgumentMatchers.any());
    }
}

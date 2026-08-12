// 百工谱 — 职业目录分页参数校验测试
package com.baigon.occupation.service.occupation;

import com.baigon.occupation.repository.occupation.OccupationCategoryRepository;
import com.baigon.occupation.repository.occupation.OccupationMajorCategoryRepository;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import com.baigon.occupation.repository.occupation.OccupationSubCategoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

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
    void childQueryRequiresPositiveParentId() {
        assertThrows(IllegalArgumentException.class,
                () -> service.listOccupations(0, 0, 20, ""));
    }
}

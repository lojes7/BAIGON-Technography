// 百工谱 — 审计日志动态筛选谓词回归测试
package com.baigon.occupation.repository.audit;

import com.baigon.occupation.entity.Log;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

class AuditLogQueryRepositoryTest {

    @Test
    @SuppressWarnings("unchecked")
    void emptyFiltersDoNotGenerateNullableComparisonPredicates() {
        var specification = AuditLogQueryRepository.filters(null, null, null, null, null);
        Root<Log> root = mock(Root.class);
        CriteriaQuery<?> query = mock(CriteriaQuery.class);
        CriteriaBuilder criteriaBuilder = mock(CriteriaBuilder.class);
        Path<Object> deletedAt = mock(Path.class);
        Predicate notDeleted = mock(Predicate.class);
        Predicate combined = mock(Predicate.class);

        when(root.get("deletedAt")).thenReturn(deletedAt);
        when(criteriaBuilder.isNull(deletedAt)).thenReturn(notDeleted);
        when(criteriaBuilder.and(org.mockito.ArgumentMatchers.<Predicate[]>any())).thenReturn(combined);

        Predicate result = specification.toPredicate(root, query, criteriaBuilder);

        assertSame(combined, result);
        verify(root).get("deletedAt");
        verify(criteriaBuilder).isNull(deletedAt);
        verify(criteriaBuilder).and(notDeleted);
        verifyNoMoreInteractions(root, criteriaBuilder);
        verifyNoInteractions(query);
    }
}

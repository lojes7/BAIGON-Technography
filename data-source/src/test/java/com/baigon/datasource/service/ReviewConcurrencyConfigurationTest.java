// 百工谱 — 审核并发配置测试

package com.baigon.datasource.service;

import com.baigon.datasource.entity.CleanedJobSource;
import com.baigon.datasource.repository.CleanedJobSourceRepository;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class ReviewConcurrencyConfigurationTest {

    @Test
    void reviewQueryShouldUsePessimisticWriteLock() throws NoSuchMethodException {
        Method method = CleanedJobSourceRepository.class.getMethod("findByIdForReview", Long.class);
        Lock lock = method.getAnnotation(Lock.class);

        assertNotNull(lock);
        assertEquals(LockModeType.PESSIMISTIC_WRITE, lock.value());
    }

    @Test
    void reviewMethodShouldOpenTransaction() throws NoSuchMethodException {
        Method method = CleanedJobSourceService.class.getMethod(
                "review",
                Long.class,
                CleanedJobSourceService.ReviewAction.class,
                CleanedJobSource.class,
                Long.class,
                String.class);

        assertNotNull(method.getAnnotation(Transactional.class));
    }
}

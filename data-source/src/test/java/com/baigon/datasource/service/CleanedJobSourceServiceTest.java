// 百工谱 — 清洗岗位审核工作流单元测试

package com.baigon.datasource.service;

import cn.hutool.core.lang.Snowflake;
import com.baigon.datasource.entity.CleanedJobSource;
import com.baigon.datasource.entity.ReviewedCleanedJobSource;
import com.baigon.datasource.error.ApiException;
import com.baigon.datasource.repository.CleanedJobSourceRepository;
import com.baigon.datasource.repository.ReviewedCleanedJobSourceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CleanedJobSourceServiceTest {

    private Optional<CleanedJobSource> lockedResult;
    private CleanedJobSource savedSource;
    private ReviewedCleanedJobSource savedReviewed;
    private int reviewedSaveCount;
    private CleanedJobSourceService service;

    @BeforeEach
    void setUp() {
        lockedResult = Optional.empty();
        savedSource = null;
        savedReviewed = null;
        reviewedSaveCount = 0;

        CleanedJobSourceRepository cleanedRepository = repositoryProxy(
                CleanedJobSourceRepository.class, (methodName, args) -> switch (methodName) {
                    case "findByIdForReview" -> lockedResult;
                    case "save" -> {
                        savedSource = (CleanedJobSource) args[0];
                        yield savedSource;
                    }
                    default -> defaultValue(methodName);
                });
        ReviewedCleanedJobSourceRepository reviewedRepository = repositoryProxy(
                ReviewedCleanedJobSourceRepository.class, (methodName, args) -> {
                    if ("save".equals(methodName)) {
                        savedReviewed = (ReviewedCleanedJobSource) args[0];
                        reviewedSaveCount++;
                        return savedReviewed;
                    }
                    return defaultValue(methodName);
                });

        service = new CleanedJobSourceService(
                cleanedRepository,
                reviewedRepository,
                new NoOpLogService(),
                new Snowflake(1, 1));
    }

    @Test
    void approveShouldUpdateReviewFieldsAndStoreSnapshotWithSameTraceId() {
        CleanedJobSource source = pendingSource();
        lockedResult = Optional.of(source);

        Optional<CleanedJobSourceService.ReviewResult> result = service.review(
                source.getId(), CleanedJobSourceService.ReviewAction.APPROVE,
                null, 7L, "reviewer");

        assertTrue(result.isPresent());
        assertEquals(CleanedJobSource.ReviewStatus.PASSED, source.getReviewStatus());
        assertEquals(7L, source.getReviewedBy());
        assertNotNull(source.getReviewedAt());
        assertNotNull(savedReviewed.getId());
        assertEquals(source.getTraceId(), savedReviewed.getTraceId());
        assertEquals("原岗位", savedReviewed.getJobName());
        assertEquals("原薪资", savedReviewed.getSalary());
        assertEquals(source, savedSource);
        assertEquals(1, reviewedSaveCount);
    }

    @Test
    void approveWithEditShouldOnlyEditReviewedSnapshot() {
        CleanedJobSource source = pendingSource();
        CleanedJobSource edited = new CleanedJobSource();
        edited.setJobName("编辑后岗位");
        edited.setSalary("编辑后薪资");
        lockedResult = Optional.of(source);

        CleanedJobSourceService.ReviewResult result = service.review(
                source.getId(), CleanedJobSourceService.ReviewAction.APPROVE_WITH_EDIT,
                edited, 8L, "reviewer").orElseThrow();

        // 原始清洗数据只更新审核参数，业务字段不得被覆盖。
        assertEquals("原岗位", source.getJobName());
        assertEquals("原薪资", source.getSalary());
        assertEquals(CleanedJobSource.ReviewStatus.PASSED, source.getReviewStatus());

        ReviewedCleanedJobSource snapshot = result.approvedVersion();
        assertEquals("编辑后岗位", snapshot.getJobName());
        assertEquals("编辑后薪资", snapshot.getSalary());
        assertEquals("原公司", snapshot.getCompanyName());
        assertEquals(source.getTraceId(), snapshot.getTraceId());
    }

    @Test
    void rejectShouldNotStoreReviewedSnapshot() {
        CleanedJobSource source = pendingSource();
        lockedResult = Optional.of(source);

        CleanedJobSourceService.ReviewResult result = service.review(
                source.getId(), CleanedJobSourceService.ReviewAction.REJECT,
                null, 9L, "reviewer").orElseThrow();

        assertEquals(CleanedJobSource.ReviewStatus.REJECTED, source.getReviewStatus());
        assertNull(result.approvedVersion());
        assertNull(savedReviewed);
        assertEquals(0, reviewedSaveCount);
        assertEquals(source, savedSource);
    }

    @Test
    void reviewedSourceShouldReturnConfiguredBusinessError() {
        CleanedJobSource source = pendingSource();
        source.setReviewStatus(CleanedJobSource.ReviewStatus.PASSED);
        lockedResult = Optional.of(source);

        ApiException exception = assertThrows(ApiException.class, () -> service.review(
                source.getId(), CleanedJobSourceService.ReviewAction.REJECT,
                null, 9L, "reviewer"));

        assertEquals(ApiException.ErrorCode.ALREADY_REVIEWED, exception.getErrorCode());
        assertEquals(40301, exception.getErrorCode().getResponseCode());
        assertNull(savedSource);
        assertNull(savedReviewed);
    }

    @Test
    void approveWithEditShouldRequireEditedPayload() {
        CleanedJobSource source = pendingSource();
        lockedResult = Optional.of(source);

        ApiException exception = assertThrows(ApiException.class, () -> service.review(
                source.getId(), CleanedJobSourceService.ReviewAction.APPROVE_WITH_EDIT,
                null, 9L, "reviewer"));

        assertEquals(ApiException.ErrorCode.BAD_REQUEST, exception.getErrorCode());
        assertEquals(CleanedJobSource.ReviewStatus.PENDING, source.getReviewStatus());
        assertNull(savedSource);
        assertNull(savedReviewed);
    }

    @Test
    void missingSourceShouldReturnEmptyResult() {
        Optional<CleanedJobSourceService.ReviewResult> result = service.review(
                404L, CleanedJobSourceService.ReviewAction.APPROVE,
                null, 7L, "reviewer");

        assertTrue(result.isEmpty());
        assertNull(savedReviewed);
    }

    private CleanedJobSource pendingSource() {
        CleanedJobSource source = new CleanedJobSource();
        source.setId(1001L);
        source.setTraceId(2001L);
        source.setSourcePlatform("测试平台");
        source.setJobNumber("JOB-1");
        source.setJobName("原岗位");
        source.setCompanyName("原公司");
        source.setSalary("原薪资");
        source.setReviewStatus(CleanedJobSource.ReviewStatus.PENDING);
        return source;
    }

    /** 使用 JDK 动态代理构造轻量仓库桩，兼容本机高版本 JDK。 */
    @SuppressWarnings("unchecked")
    private <T> T repositoryProxy(Class<T> repositoryType, RepositoryCall call) {
        return (T) Proxy.newProxyInstance(
                repositoryType.getClassLoader(),
                new Class<?>[]{repositoryType},
                (proxy, method, args) -> {
                    if (method.getDeclaringClass() == Object.class) {
                        return switch (method.getName()) {
                            case "toString" -> repositoryType.getSimpleName() + "TestProxy";
                            case "hashCode" -> System.identityHashCode(proxy);
                            case "equals" -> proxy == args[0];
                            default -> null;
                        };
                    }
                    return call.invoke(method.getName(), args == null ? new Object[0] : args);
                });
    }

    private Object defaultValue(String methodName) {
        if (methodName.startsWith("find")) {
            return Optional.empty();
        }
        return null;
    }

    @FunctionalInterface
    private interface RepositoryCall {
        Object invoke(String methodName, Object[] args);
    }

    /** 审核测试不关心日志落库，只保留服务调用边界。 */
    private static class NoOpLogService extends LogService {
        NoOpLogService() {
            super(null, null);
        }

        @Override
        public void info(Long traceId, Long userId, String userName, String userIp, String detail) {
            // 测试桩：不写数据库。
        }

        @Override
        public void warning(Long traceId, Long userId, String userName, String userIp,
                            String errorMsg, String detail) {
            // 测试桩：不写数据库。
        }
    }
}

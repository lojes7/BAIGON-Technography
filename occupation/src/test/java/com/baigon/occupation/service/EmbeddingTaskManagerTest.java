// 百工谱 — 专业/职业并行向量化任务状态机测试
package com.baigon.occupation.service;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.grpc.client.ai.AIGrpcClient;
import com.baigon.occupation.grpc.client.ai.AIGrpcClient.EmbeddingCall;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.service.EmbeddingDataService.EmbeddingCandidate;
import com.baigon.occupation.service.EmbeddingTaskManager.Resource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmbeddingTaskManagerTest {

    private EmbeddingDataService majorDataService;
    private EmbeddingDataService occupationDataService;
    private AIGrpcClient aiClient;
    private LogService logService;
    private ExecutorService executor;
    private EmbeddingTaskManager manager;

    @BeforeEach
    void setUp() {
        majorDataService = mock(EmbeddingDataService.class);
        occupationDataService = mock(EmbeddingDataService.class);
        when(majorDataService.resource()).thenReturn(Resource.MAJOR);
        when(occupationDataService.resource()).thenReturn(Resource.OCCUPATION);
        aiClient = mock(AIGrpcClient.class);
        logService = mock(LogService.class);
        Snowflake snowflake = mock(Snowflake.class);
        executor = Executors.newFixedThreadPool(2);
        when(aiClient.getConfiguredBatchSize()).thenReturn(2);
        manager = new EmbeddingTaskManager(
                List.of(majorDataService, occupationDataService),
                aiClient,
                logService,
                snowflake,
                executor);
    }

    @AfterEach
    void tearDown() {
        executor.shutdownNow();
    }

    @Test
    void majorAndOccupationTasksCanRunInParallel() throws Exception {
        when(majorDataService.findCandidates())
                .thenReturn(List.of(new EmbeddingCandidate(1L, "计算机科学与技术")));
        when(occupationDataService.findCandidates())
                .thenReturn(List.of(new EmbeddingCandidate(2L, "软件工程师")));

        EmbeddingCall majorCall = mock(EmbeddingCall.class);
        EmbeddingCall occupationCall = mock(EmbeddingCall.class);
        CountDownLatch entered = new CountDownLatch(2);
        CountDownLatch release = new CountDownLatch(1);
        when(majorCall.await()).thenAnswer(ignored -> awaitAndReturn(entered, release));
        when(occupationCall.await()).thenAnswer(ignored -> awaitAndReturn(entered, release));
        when(aiClient.startBatch(anyList(), any(AuditContext.class)))
                .thenReturn(majorCall, occupationCall);

        manager.start(Resource.MAJOR, audit(1001L));
        manager.start(Resource.OCCUPATION, audit(1002L));

        assertTrue(entered.await(2, TimeUnit.SECONDS), "两类任务应同时进入 AI 调用");
        assertEquals("running", manager.getStatus(Resource.MAJOR).status());
        assertEquals("running", manager.getStatus(Resource.OCCUPATION).status());
        release.countDown();

        awaitStatus(Resource.MAJOR, "success");
        awaitStatus(Resource.OCCUPATION, "success");
        verify(majorDataService).markSuccess(anyList(), anyList());
        verify(occupationDataService).markSuccess(anyList(), anyList());
    }

    @Test
    void sameResourceCannotStartTwice() throws Exception {
        when(majorDataService.findCandidates())
                .thenReturn(List.of(new EmbeddingCandidate(1L, "哲学")));
        EmbeddingCall call = mock(EmbeddingCall.class);
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        when(call.await()).thenAnswer(ignored -> awaitAndReturn(entered, release));
        when(aiClient.startBatch(anyList(), any(AuditContext.class))).thenReturn(call);

        manager.start(Resource.MAJOR, audit(1001L));
        assertTrue(entered.await(2, TimeUnit.SECONDS));
        ApiException exception = assertThrows(ApiException.class,
                () -> manager.start(Resource.MAJOR, audit(1002L)));
        assertEquals(ApiException.ErrorCode.TASK_ALREADY_RUNNING, exception.getErrorCode());

        release.countDown();
        awaitStatus(Resource.MAJOR, "success");
    }

    @Test
    void failedBatchDoesNotBlockLaterBatch() throws Exception {
        when(majorDataService.findCandidates()).thenReturn(List.of(
                new EmbeddingCandidate(1L, "专业一"),
                new EmbeddingCandidate(2L, "专业二"),
                new EmbeddingCandidate(3L, "专业三")));
        EmbeddingCall failedCall = mock(EmbeddingCall.class);
        EmbeddingCall successCall = mock(EmbeddingCall.class);
        when(failedCall.await()).thenThrow(new IllegalStateException("ai unavailable"));
        when(successCall.await()).thenReturn(List.of(List.of(0.1F)));
        when(aiClient.startBatch(anyList(), any(AuditContext.class)))
                .thenReturn(failedCall, successCall);

        manager.start(Resource.MAJOR, audit(1001L));
        EmbeddingTaskSnapshot snapshot = awaitStatus(Resource.MAJOR, "failed");

        assertEquals(3, snapshot.processed());
        assertEquals(1, snapshot.succeeded());
        assertEquals(2, snapshot.failed());
        verify(majorDataService).markFailed(List.of(1L, 2L), "ai unavailable");
        verify(majorDataService).markSuccess(
                org.mockito.ArgumentMatchers.argThat(batch -> batch.size() == 1 && batch.get(0).id() == 3L),
                anyList());
    }

    @Test
    void stopCancelsOnlyCurrentResourceCall() throws Exception {
        when(majorDataService.findCandidates())
                .thenReturn(List.of(new EmbeddingCandidate(1L, "哲学")));
        EmbeddingCall call = mock(EmbeddingCall.class);
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch cancelled = new CountDownLatch(1);
        when(call.await()).thenAnswer(ignored -> {
            entered.countDown();
            cancelled.await();
            throw new CancellationException("cancelled");
        });
        doAnswer(ignored -> {
            cancelled.countDown();
            return null;
        }).when(call).cancel();
        when(aiClient.startBatch(anyList(), any(AuditContext.class))).thenReturn(call);

        manager.start(Resource.MAJOR, audit(1001L));
        assertTrue(entered.await(2, TimeUnit.SECONDS));
        String stopStatus = manager.stop(Resource.MAJOR, audit(2001L)).status();
        // 取消非常快时，后台线程可能在 Stop 响应取快照前已经完成收尾。
        assertTrue("stopping".equals(stopStatus) || "stopped".equals(stopStatus));

        EmbeddingTaskSnapshot snapshot = awaitStatus(Resource.MAJOR, "stopped");
        assertEquals(0, snapshot.processed());
        verify(call).cancel();
    }

    private List<List<Float>> awaitAndReturn(CountDownLatch entered,
                                             CountDownLatch release) throws InterruptedException {
        entered.countDown();
        release.await();
        return List.of(List.of(0.1F));
    }

    private EmbeddingTaskSnapshot awaitStatus(Resource resource,
                                              String expected) throws InterruptedException {
        long deadline = System.nanoTime() + Duration.ofSeconds(3).toNanos();
        EmbeddingTaskSnapshot snapshot;
        do {
            snapshot = manager.getStatus(resource);
            if (expected.equals(snapshot.status())) {
                return snapshot;
            }
            Thread.sleep(10);
        } while (System.nanoTime() < deadline);
        throw new AssertionError("任务未进入期望状态 " + expected + "，实际 " + snapshot.status());
    }

    private AuditContext audit(long traceId) {
        return new AuditContext(traceId, 1L, "admin", "127.0.0.1", "POST", "/test");
    }
}

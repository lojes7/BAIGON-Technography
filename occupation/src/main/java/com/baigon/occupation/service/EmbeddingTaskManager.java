// 百工谱 — 专业/职业名称向量化后台任务管理器
package com.baigon.occupation.service;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.grpc.AIGrpcClient;
import com.baigon.occupation.grpc.AIGrpcClient.EmbeddingCall;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.service.EmbeddingDataService.EmbeddingCandidate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutorService;

/**
 * 专业和职业拥有独立状态与停止信号，可并行；同一资源同一时间只允许一个任务。
 * 状态只保存在本进程，服务重启后回到 idle，数据库记录仍可继续处理。
 */
@Service
public class EmbeddingTaskManager {

    /** 由同一任务管理器协调的两类名称向量化资源。 */
    public enum Resource {
        MAJOR,
        OCCUPATION
    }

    private static final Logger logger = LoggerFactory.getLogger(EmbeddingTaskManager.class);

    private final Map<Resource, EmbeddingDataService> dataServices;
    private final AIGrpcClient aiClient;
    private final LogService logService;
    private final Snowflake snowflake;
    private final ExecutorService executor;
    private final Map<Resource, TaskTracker> trackers = new EnumMap<>(Resource.class);

    public EmbeddingTaskManager(List<EmbeddingDataService> dataServices,
                                AIGrpcClient aiClient,
                                LogService logService,
                                Snowflake snowflake,
                                @Qualifier("embeddingExecutor") ExecutorService embeddingExecutor) {
        this.dataServices = new EnumMap<>(Resource.class);
        for (EmbeddingDataService dataService : dataServices) {
            EmbeddingDataService previous = this.dataServices.put(dataService.resource(), dataService);
            if (previous != null) {
                throw new IllegalArgumentException("duplicate embedding data service: " + dataService.resource());
            }
        }
        for (Resource resource : Resource.values()) {
            if (!this.dataServices.containsKey(resource)) {
                throw new IllegalArgumentException("missing embedding data service: " + resource);
            }
        }
        this.aiClient = aiClient;
        this.logService = logService;
        this.snowflake = snowflake;
        this.executor = embeddingExecutor;
        trackers.put(Resource.MAJOR, new TaskTracker());
        trackers.put(Resource.OCCUPATION, new TaskTracker());
    }

    public EmbeddingTaskSnapshot start(Resource resource, AuditContext requestAudit) {
        long traceId = requestAudit.traceId() == null ? snowflake.nextId() : requestAudit.traceId();
        AuditContext taskAudit = requestAudit.withTraceId(traceId);
        TaskTracker tracker = tracker(resource);
        tracker.begin(String.valueOf(traceId));
        try {
            executor.submit(() -> runTask(resource, tracker, taskAudit));
        } catch (RuntimeException exception) {
            tracker.failFatal(exception.getMessage());
            throw exception;
        }
        logService.info(taskAudit, "start " + label(resource) + " embedding task");
        return tracker.snapshot();
    }

    public EmbeddingTaskSnapshot getStatus(Resource resource) {
        return tracker(resource).snapshot();
    }

    public EmbeddingDataService.Progress getProgress(Resource resource) {
        return dataService(resource).getProgress();
    }

    public EmbeddingTaskSnapshot stop(Resource resource, AuditContext audit) {
        TaskTracker tracker = tracker(resource);
        tracker.requestStop();
        logService.warning(audit, "stop " + label(resource) + " embedding requested");
        return tracker.snapshot();
    }

    private void runTask(Resource resource, TaskTracker tracker, AuditContext audit) {
        try {
            EmbeddingDataService dataService = dataService(resource);
            List<EmbeddingCandidate> candidates = dataService.findCandidates();
            tracker.setTotal(candidates.size());
            int batchSize = aiClient.getConfiguredBatchSize();
            for (int offset = 0; offset < candidates.size(); offset += batchSize) {
                if (tracker.isStopRequested()) {
                    break;
                }
                List<EmbeddingCandidate> batch = candidates.subList(
                        offset, Math.min(offset + batchSize, candidates.size()));
                processBatch(resource, dataService, tracker, audit, batch);
            }
            tracker.finish();
            EmbeddingTaskSnapshot snapshot = tracker.snapshot();
            if ("failed".equals(snapshot.status())) {
                logService.error(audit, snapshot.message(),
                        label(resource) + " embedding completed with failed batches");
            } else if ("stopped".equals(snapshot.status())) {
                logService.warning(audit, label(resource) + " embedding stopped");
            } else {
                logService.info(audit, label(resource) + " embedding success: " + snapshot.succeeded());
            }
        } catch (Exception exception) {
            logger.error("{} 向量化后台任务失败", label(resource), exception);
            tracker.failFatal(safeMessage(exception));
            logService.error(audit, safeMessage(exception), label(resource) + " embedding failed");
        }
    }

    private void processBatch(Resource resource,
                              EmbeddingDataService dataService,
                              TaskTracker tracker,
                              AuditContext audit,
                              List<EmbeddingCandidate> batch) {
        List<Long> ids = batch.stream().map(EmbeddingCandidate::id).toList();
        dataService.markAttemptStarted(ids);
        EmbeddingCall call = null;
        try {
            call = aiClient.startBatch(batch.stream().map(EmbeddingCandidate::name).toList(), audit);
            tracker.setActiveCall(call);
            List<List<Float>> vectors = call.await();
            if (tracker.isStopRequested()) {
                return;
            }
            dataService.markSuccess(batch, vectors);
            tracker.batchSucceeded(batch.size());
        } catch (CancellationException exception) {
            if (!tracker.isStopRequested()) {
                markBatchFailed(resource, dataService, tracker, audit, ids, exception);
            }
        } catch (Exception exception) {
            if (!tracker.isStopRequested()) {
                markBatchFailed(resource, dataService, tracker, audit, ids, exception);
            }
        } finally {
            tracker.clearActiveCall(call);
        }
    }

    private void markBatchFailed(Resource resource,
                                 EmbeddingDataService dataService,
                                 TaskTracker tracker,
                                 AuditContext audit,
                                 List<Long> ids,
                                 Exception exception) {
        String message = safeMessage(exception);
        dataService.markFailed(ids, message);
        tracker.batchFailed(ids.size(), message);
        logService.error(audit, message, label(resource) + " embedding batch failed");
    }

    private TaskTracker tracker(Resource resource) {
        return trackers.get(resource);
    }

    private EmbeddingDataService dataService(Resource resource) {
        EmbeddingDataService dataService = dataServices.get(resource);
        if (dataService == null) {
            throw new IllegalArgumentException("unsupported embedding resource: " + resource);
        }
        return dataService;
    }

    private String label(Resource resource) {
        return resource == Resource.MAJOR ? "major" : "occupation";
    }

    private String safeMessage(Exception exception) {
        String message = exception.getMessage();
        return message == null || message.isBlank() ? exception.getClass().getSimpleName() : message;
    }

    /** 单个资源自己的同步状态机；两个实例之间互不阻塞。 */
    private static final class TaskTracker {
        private String status = "idle";
        private String traceId = "";
        private long total;
        private long processed;
        private long succeeded;
        private long failed;
        private String message = "";
        private OffsetDateTime startedAt;
        private OffsetDateTime finishedAt;
        private boolean stopRequested;
        private EmbeddingCall activeCall;

        synchronized void begin(String newTraceId) {
            if ("running".equals(status) || "stopping".equals(status)) {
                throw new ApiException(
                        ApiException.ErrorCode.TASK_ALREADY_RUNNING,
                        "an embedding task of the same type is already running");
            }
            status = "running";
            traceId = newTraceId;
            total = 0;
            processed = 0;
            succeeded = 0;
            failed = 0;
            message = "";
            startedAt = OffsetDateTime.now();
            finishedAt = null;
            stopRequested = false;
            activeCall = null;
        }

        synchronized void setTotal(long value) {
            total = value;
        }

        synchronized boolean isStopRequested() {
            return stopRequested;
        }

        synchronized void setActiveCall(EmbeddingCall call) {
            activeCall = call;
            if (stopRequested && activeCall != null) {
                activeCall.cancel();
            }
        }

        synchronized void clearActiveCall(EmbeddingCall call) {
            if (activeCall == call) {
                activeCall = null;
            }
        }

        synchronized void batchSucceeded(long count) {
            processed += count;
            succeeded += count;
        }

        synchronized void batchFailed(long count, String error) {
            processed += count;
            failed += count;
            message = error;
        }

        synchronized void requestStop() {
            if ("running".equals(status)) {
                status = "stopping";
                stopRequested = true;
                if (activeCall != null) {
                    activeCall.cancel();
                }
            }
        }

        synchronized void finish() {
            if (stopRequested) {
                status = "stopped";
                message = "stopped by user";
            } else if (failed > 0) {
                status = "failed";
                if (message.isBlank()) {
                    message = "one or more embedding batches failed";
                }
            } else {
                status = "success";
                message = "";
            }
            finishedAt = OffsetDateTime.now();
            activeCall = null;
        }

        synchronized void failFatal(String error) {
            status = "failed";
            message = error == null ? "embedding task failed" : error;
            finishedAt = OffsetDateTime.now();
            activeCall = null;
        }

        synchronized EmbeddingTaskSnapshot snapshot() {
            return new EmbeddingTaskSnapshot(status, traceId, total, processed, succeeded, failed,
                    message, startedAt, finishedAt);
        }
    }
}

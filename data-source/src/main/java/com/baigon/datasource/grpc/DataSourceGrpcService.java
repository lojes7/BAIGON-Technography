// 百工谱 — DataSourceService gRPC 实现
// 提供清洗数据查询与人工复核接口（gateway REST → gRPC 转发到此）

package com.baigon.datasource.grpc;

import com.baigon.crawler.GetJobSourceByTraceIdResponse;
import com.baigon.datasource.DataSourceServiceGrpc;
import com.baigon.datasource.CleanedJobDetail;
import com.baigon.datasource.CleanedJobSummary;
import com.baigon.datasource.GetCleanedJobRequest;
import com.baigon.datasource.GetCleanedJobResponse;
import com.baigon.datasource.GetSourceJobRequest;
import com.baigon.datasource.GetSourceJobResponse;
import com.baigon.datasource.ListCleanedJobsRequest;
import com.baigon.datasource.ListCleanedJobsResponse;
import com.baigon.datasource.ReviewJobRequest;
import com.baigon.datasource.ReviewJobResponse;
import com.baigon.datasource.SourceJobDetail;
import com.baigon.datasource.entity.CleanedJobSource;
import com.baigon.datasource.entity.ReviewedCleanedJobSource;
import com.baigon.datasource.error.ApiException;
import com.baigon.datasource.service.CleanedJobSourceService;
import com.baigon.datasource.service.LogService;
import io.grpc.stub.StreamObserver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class DataSourceGrpcService extends DataSourceServiceGrpc.DataSourceServiceImplBase {

    private static final Logger log = LoggerFactory.getLogger(DataSourceGrpcService.class);

    private final CleanedJobSourceService cleanedJobSourceService;
    private final LogService logService;
    private final CrawlerGrpcClient crawlerGrpcClient;

    public DataSourceGrpcService(CleanedJobSourceService cleanedJobSourceService,
                                 LogService logService,
                                 CrawlerGrpcClient crawlerGrpcClient) {
        this.cleanedJobSourceService = cleanedJobSourceService;
        this.logService = logService;
        this.crawlerGrpcClient = crawlerGrpcClient;
        log.info("DataSourceGrpcService 初始化完成");
    }

    /** 分页查询清洗后岗位列表 */
    @Override
    public void listCleanedJobs(ListCleanedJobsRequest request,
                                StreamObserver<ListCleanedJobsResponse> responseObserver) {
        try {
            OffsetDateTime from = parseDate(request.getPublishDateFrom());
            OffsetDateTime to = parseDate(request.getPublishDateTo());
            int page = request.getPage();
            int pageSize = request.getPageSize() <= 0 ? 20 : request.getPageSize();
            String reviewStatus = request.getReviewStatus().isBlank() ? null : request.getReviewStatus();

            Page<CleanedJobSource> result = cleanedJobSourceService.list(
                    page, pageSize, reviewStatus, from, to);

            // 组装摘要（仅岗位名/公司名/来源/发布时间/获取时间/复核状态）
            List<CleanedJobSummary> items = new ArrayList<>();
            for (CleanedJobSource job : result.getContent()) {
                items.add(CleanedJobSummary.newBuilder()
                        .setId(job.getId())
                        .setJobName(orEmpty(job.getJobName()))
                        .setCompanyName(orEmpty(job.getCompanyName()))
                        .setSourcePlatform(orEmpty(job.getSourcePlatform()))
                        .setPublishDate(job.getPublishDate() != null ? job.getPublishDate().toString() : "")
                        .setCreatedAt(job.getCreatedAt() != null ? job.getCreatedAt().toString() : "")
                        .setReviewStatus(job.getReviewStatus() != null ? job.getReviewStatus().name() : "")
                        .build());
            }

            ListCleanedJobsResponse resp = ListCleanedJobsResponse.newBuilder()
                    .addAllItems(items)
                    .setTotal(result.getTotalElements())
                    .setPage(page)
                    .setPageSize(pageSize)
                    .build();

            // 写业务日志（用户上下文来自请求审计字段）
            logService.info(parseLong(request.getTraceId()), request.getUserId(),
                    orDefault(request.getUserName(), "system"), request.getUserIp(),
                    "list cleaned jobs: total=" + result.getTotalElements());

            responseObserver.onNext(resp);
            responseObserver.onCompleted();
        } catch (IllegalArgumentException e) {
            // review_status 枚举不合法
            responseObserver.onError(ApiException.grpcException(
                    ApiException.ErrorCode.BAD_REQUEST, e.getMessage()));
        } catch (Exception e) {
            log.error("分页查询清洗数据失败", e);
            responseObserver.onError(ApiException.grpcException(
                    ApiException.ErrorCode.INTERNAL_ERROR, "server error"));
        }
    }

    /** 查询清洗后岗位详情（全字段） */
    @Override
    public void getCleanedJob(GetCleanedJobRequest request,
                              StreamObserver<GetCleanedJobResponse> responseObserver) {
        try {
            Optional<CleanedJobSource> opt = cleanedJobSourceService.findById(request.getId());
            if (opt.isEmpty()) {
                responseObserver.onError(ApiException.grpcException(
                        ApiException.ErrorCode.NOT_FOUND, "job not found"));
                return;
            }
            CleanedJobSource job = opt.get();
            responseObserver.onNext(GetCleanedJobResponse.newBuilder()
                    .setJob(toDetail(job))
                    .build());
            responseObserver.onCompleted();

            logService.info(job.getTraceId(), request.getUserId(),
                    orDefault(request.getUserName(), "system"), request.getUserIp(),
                    "get cleaned job detail: " + job.getJobName());
        } catch (Exception e) {
            log.error("查询清洗数据详情失败", e);
            responseObserver.onError(ApiException.grpcException(
                    ApiException.ErrorCode.INTERNAL_ERROR, "server error"));
        }
    }

    /** 查询清洗后岗位的原始记录（内部调 crawler-service） */
    @Override
    public void getSourceJob(GetSourceJobRequest request,
                             StreamObserver<GetSourceJobResponse> responseObserver) {
        try {
            Optional<CleanedJobSource> opt = cleanedJobSourceService.findById(request.getId());
            if (opt.isEmpty()) {
                responseObserver.onError(ApiException.grpcException(
                        ApiException.ErrorCode.NOT_FOUND, "job not found"));
                return;
            }
            CleanedJobSource job = opt.get();

            // 经 crawler gRPC 查询 job_sources 原始记录（按 trace_id 关联）
            GetJobSourceByTraceIdResponse crawlerResp =
                    crawlerGrpcClient.getJobSourceByTraceId(job.getTraceId());
            if (crawlerResp == null) {
                responseObserver.onError(ApiException.grpcException(
                        ApiException.ErrorCode.SERVICE_UNAVAILABLE, "crawler service unavailable"));
                return;
            }

            SourceJobDetail source = SourceJobDetail.newBuilder()
                    .setId(crawlerResp.getId())
                    .setTraceId(crawlerResp.getTraceId())
                    .setPublishDate(crawlerResp.getPublishDate())
                    .setSourcePlatform(orEmpty(crawlerResp.getSourcePlatform()))
                    .setSourceUrl(orEmpty(crawlerResp.getSourceUrl()))
                    .setCity(orEmpty(crawlerResp.getCity()))
                    .setTags(orEmpty(crawlerResp.getTags()))
                    .setMajor(orEmpty(crawlerResp.getMajor()))
                    .setNature(orEmpty(crawlerResp.getNature()))
                    .setSalary(orEmpty(crawlerResp.getSalary()))
                    .setJobName(orEmpty(crawlerResp.getJobName()))
                    .setCompanyName(orEmpty(crawlerResp.getCompanyName()))
                    .setCompanySize(orEmpty(crawlerResp.getCompanySize()))
                    .setProvince(orEmpty(crawlerResp.getProvince()))
                    .setEducation(orEmpty(crawlerResp.getEducation()))
                    .setExperience(orEmpty(crawlerResp.getExperience()))
                    .setJobDescription(orEmpty(crawlerResp.getJobDescription()))
                    .setCleanStatus(orEmpty(crawlerResp.getCleanStatus()))
                    .build();

            responseObserver.onNext(GetSourceJobResponse.newBuilder().setSource(source).build());
            responseObserver.onCompleted();

            logService.info(job.getTraceId(), request.getUserId(),
                    orDefault(request.getUserName(), "system"), request.getUserIp(),
                    "get source job: " + source.getJobName());
        } catch (Exception e) {
            log.error("查询原始记录失败", e);
            responseObserver.onError(ApiException.grpcException(
                    ApiException.ErrorCode.INTERNAL_ERROR, "server error"));
        }
    }

    /** 人工复核：通过 / 拒绝 / 修改后通过 */
    @Override
    public void reviewJob(ReviewJobRequest request,
                          StreamObserver<ReviewJobResponse> responseObserver) {
        try {
            CleanedJobSourceService.ReviewAction action = switch (request.getAction()) {
                case APPROVE -> CleanedJobSourceService.ReviewAction.APPROVE;
                case REJECT -> CleanedJobSourceService.ReviewAction.REJECT;
                case APPROVE_WITH_EDIT -> CleanedJobSourceService.ReviewAction.APPROVE_WITH_EDIT;
                case UNRECOGNIZED -> throw new IllegalArgumentException("unknown review action");
            };
            CleanedJobSource edited = request.hasEdited() ? toEntity(request.getEdited()) : null;

            Optional<CleanedJobSourceService.ReviewResult> opt = cleanedJobSourceService.review(
                    request.getId(), action, edited,
                    request.getUserId(), orDefault(request.getUserName(), "system"));
            if (opt.isEmpty()) {
                responseObserver.onError(ApiException.grpcException(
                        ApiException.ErrorCode.NOT_FOUND, "job not found"));
                return;
            }

            responseObserver.onNext(ReviewJobResponse.newBuilder()
                    .setJob(toDetail(opt.get()))
                    .build());
            responseObserver.onCompleted();
        } catch (ApiException e) {
            responseObserver.onError(e.asGrpcException());
        } catch (IllegalArgumentException e) {
            responseObserver.onError(ApiException.grpcException(
                    ApiException.ErrorCode.BAD_REQUEST, e.getMessage()));
        } catch (Exception e) {
            log.error("人工复核失败", e);
            responseObserver.onError(ApiException.grpcException(
                    ApiException.ErrorCode.INTERNAL_ERROR, "server error"));
        }
    }

    // ==================== 工具方法 ====================

    /** 实体 → gRPC 详情 */
    private CleanedJobDetail toDetail(CleanedJobSource job) {
        return CleanedJobDetail.newBuilder()
                .setId(job.getId())
                .setTraceId(job.getTraceId() != null ? job.getTraceId() : 0)
                .setPublishDate(job.getPublishDate() != null ? job.getPublishDate().toString() : "")
                .setSourcePlatform(orEmpty(job.getSourcePlatform()))
                .setSourceUrl(orEmpty(job.getSourceUrl()))
                .setCity(orEmpty(job.getCity()))
                .setTags(orEmpty(job.getTags()))
                .setMajor(orEmpty(job.getMajor()))
                .setNature(orEmpty(job.getNature()))
                .setSalary(orEmpty(job.getSalary()))
                .setJobName(orEmpty(job.getJobName()))
                .setCompanyName(orEmpty(job.getCompanyName()))
                .setCompanySize(orEmpty(job.getCompanySize()))
                .setProvince(orEmpty(job.getProvince()))
                .setEducation(orEmpty(job.getEducation()))
                .setExperience(orEmpty(job.getExperience()))
                .setJobDescription(orEmpty(job.getJobDescription()))
                .setReviewStatus(job.getReviewStatus() != null ? job.getReviewStatus().name() : "")
                .setReviewedAt(job.getReviewedAt() != null ? job.getReviewedAt().toString() : "")
                .setReviewedBy(job.getReviewedBy() != null ? job.getReviewedBy() : 0)
                .build();
    }

    /** 审核响应：保留 cleaned_job_sources 的标识与审核状态，业务字段返回最终审核版本。 */
    private CleanedJobDetail toDetail(CleanedJobSourceService.ReviewResult result) {
        CleanedJobDetail.Builder builder = toDetail(result.source()).toBuilder();
        ReviewedCleanedJobSource approved = result.approvedVersion();
        if (approved == null) {
            return builder.build();
        }
        return builder
                .setPublishDate(approved.getPublishDate() != null ? approved.getPublishDate().toString() : "")
                .setSourcePlatform(orEmpty(approved.getSourcePlatform()))
                .setSourceUrl(orEmpty(approved.getSourceUrl()))
                .setCity(orEmpty(approved.getCity()))
                .setTags(orEmpty(approved.getTags()))
                .setMajor(orEmpty(approved.getMajor()))
                .setNature(orEmpty(approved.getNature()))
                .setSalary(orEmpty(approved.getSalary()))
                .setJobName(orEmpty(approved.getJobName()))
                .setCompanyName(orEmpty(approved.getCompanyName()))
                .setCompanySize(orEmpty(approved.getCompanySize()))
                .setProvince(orEmpty(approved.getProvince()))
                .setEducation(orEmpty(approved.getEducation()))
                .setExperience(orEmpty(approved.getExperience()))
                .setJobDescription(orEmpty(approved.getJobDescription()))
                .build();
    }

    /** gRPC 编辑字段 → 实体（仅业务字段） */
    private CleanedJobSource toEntity(CleanedJobDetail detail) {
        CleanedJobSource job = new CleanedJobSource();
        job.setJobName(emptyToNull(detail.getJobName()));
        job.setCompanyName(emptyToNull(detail.getCompanyName()));
        job.setSalary(emptyToNull(detail.getSalary()));
        job.setCity(emptyToNull(detail.getCity()));
        job.setEducation(emptyToNull(detail.getEducation()));
        job.setExperience(emptyToNull(detail.getExperience()));
        job.setJobDescription(emptyToNull(detail.getJobDescription()));
        return job;
    }

    /** ISO 字符串 → OffsetDateTime（空/非法返回 null） */
    private OffsetDateTime parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(value);
        } catch (DateTimeParseException e) {
            log.warn("解析日期失败: {}", value);
            return null;
        }
    }

    /** 字符串 → Long（空返回 null） */
    private Long parseLong(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String orEmpty(String value) {
        return value == null ? "" : value;
    }

    private String orDefault(String value, String def) {
        return (value == null || value.isBlank()) ? def : value;
    }

    private String emptyToNull(String value) {
        return (value == null || value.isBlank()) ? null : value;
    }
}

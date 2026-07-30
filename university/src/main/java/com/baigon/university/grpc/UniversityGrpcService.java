package com.baigon.university.grpc;

import com.baigon.university.*;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 院校服务 gRPC 接口实现（骨架桩）
 * <p>
 * 覆盖 proto/university/university.proto 中 UniversityService 的所有 RPC 方法。
 * 当前为骨架实现，所有方法返回空响应或默认值，后续逐步填充业务逻辑。
 * </p>
 */
@GrpcService
public class UniversityGrpcService extends UniversityServiceGrpc.UniversityServiceImplBase {

    private static final Logger log = LoggerFactory.getLogger(UniversityGrpcService.class);

    // ==================== 院校管理 ====================

    /**
     * 根据院校ID查询单一院校详情
     */
    @Override
    public void getUniversity(GetUniversityRequest request, StreamObserver<GetUniversityResponse> responseObserver) {
        log.info("[gRPC] GetUniversity — universityId={}, traceId={}",
                request.getUniversityId(),
                request.hasTrace() ? request.getTrace().getTraceId() : "N/A");

        // TODO: 实现院校查询逻辑
        GetUniversityResponse response = GetUniversityResponse.newBuilder()
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    /**
     * 分页列出院校，可按地区筛选
     */
    @Override
    public void listUniversities(ListUniversitiesRequest request, StreamObserver<ListUniversitiesResponse> responseObserver) {
        log.info("[gRPC] ListUniversities — region={}, page={}",
                request.getRegion(),
                request.hasPage() ? request.getPage().getPage() : 1);

        // TODO: 实现院校列表查询逻辑
        ListUniversitiesResponse response = ListUniversitiesResponse.newBuilder()
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    // ==================== 课程管理 ====================

    /**
     * 管理课程（新建或更新）
     */
    @Override
    public void manageCurriculum(ManageCurriculumRequest request, StreamObserver<ManageCurriculumResponse> responseObserver) {
        log.info("[gRPC] ManageCurriculum — curriculumId={}, universityId={}, courseName={}",
                request.getCurriculumId(),
                request.getUniversityId(),
                request.getCourseName());

        // TODO: 实现课程增改逻辑
        ManageCurriculumResponse response = ManageCurriculumResponse.newBuilder()
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    /**
     * 分页列出某院校某专业下的课程
     */
    @Override
    public void listCurriculums(ListCurriculumsRequest request, StreamObserver<ListCurriculumsResponse> responseObserver) {
        log.info("[gRPC] ListCurriculums — universityId={}, major={}",
                request.getUniversityId(),
                request.getMajor());

        // TODO: 实现课程列表查询逻辑
        ListCurriculumsResponse response = ListCurriculumsResponse.newBuilder()
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    // ==================== 分析 ====================

    /**
     * 课程能力覆盖分析 — 评估课程体系对目标岗位技能需求的覆盖程度
     */
    @Override
    public void analyzeCoverage(AnalyzeCoverageRequest request, StreamObserver<AnalyzeCoverageResponse> responseObserver) {
        log.info("[gRPC] AnalyzeCoverage — universityId={}, major={}, targetOccupationCount={}",
                request.getUniversityId(),
                request.getMajor(),
                request.getTargetOccupationIdsCount());

        // TODO: 实现课程覆盖分析逻辑
        AnalyzeCoverageResponse response = AnalyzeCoverageResponse.newBuilder()
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    /**
     * 培养方案评估 — 对指定院校专业的培养方案给出优化建议
     */
    @Override
    public void evaluateProgram(EvaluateProgramRequest request, StreamObserver<EvaluateProgramResponse> responseObserver) {
        log.info("[gRPC] EvaluateProgram — universityId={}, major={}",
                request.getUniversityId(),
                request.getMajor());

        // TODO: 实现培养方案评估逻辑
        EvaluateProgramResponse response = EvaluateProgramResponse.newBuilder()
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    // ==================== 学生聚合 ====================

    /**
     * 学生群体能力画像聚合 — 统计某院校专业学生的技能分布
     */
    @Override
    public void getStudentAggregation(GetStudentAggregationRequest request,
                                       StreamObserver<GetStudentAggregationResponse> responseObserver) {
        log.info("[gRPC] GetStudentAggregation — universityId={}, major={}",
                request.getUniversityId(),
                request.getMajor());

        // TODO: 实现学生能力聚合查询逻辑
        GetStudentAggregationResponse response = GetStudentAggregationResponse.newBuilder()
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }
}

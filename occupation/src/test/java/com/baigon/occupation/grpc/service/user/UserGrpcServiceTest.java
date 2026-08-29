// 百工谱 — UserService gRPC 契约测试
package com.baigon.occupation.grpc.service.user;

import com.baigon.occupation.entity.user.User;
import com.baigon.occupation.entity.user.resume.ResumeSource;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.service.LogService;
import com.baigon.occupation.service.user.AuthService;
import com.baigon.occupation.service.user.UserService;
import com.baigon.occupation.service.user.admin.AdminUserService;
import com.baigon.occupation.service.user.analysis.UserAnalysisService;
import com.baigon.occupation.service.user.resume.ResumeService;
import com.baigon.user.AnalyzeMyResumeSkillsRequest;
import com.baigon.user.AnalyzeMyResumeSkillsResponse;
import com.baigon.user.BatchGetMySkillsRequest;
import com.baigon.user.BatchGetMySkillsResponse;
import com.baigon.user.BatchGetUsersRequest;
import com.baigon.user.BatchGetUsersResponse;
import com.baigon.user.BlockUserRequest;
import com.baigon.user.BlockUserResponse;
import com.baigon.user.CompleteResumeUploadRequest;
import com.baigon.user.CompleteResumeUploadResponse;
import com.baigon.user.CreateResumeUploadRequest;
import com.baigon.user.CreateResumeUploadResponse;
import com.baigon.user.EditMyResumeRequest;
import com.baigon.user.EditMyResumeResponse;
import com.baigon.user.GetLatestMyJobMatchRequest;
import com.baigon.user.GetMySkillRequest;
import com.baigon.user.GetMySkillResponse;
import com.baigon.user.GetUserRequest;
import com.baigon.user.GetUserResponse;
import com.baigon.user.GetMyResumeRequest;
import com.baigon.user.GetMyResumeResponse;
import com.baigon.user.ListMySkillsRequest;
import com.baigon.user.ListMySkillsResponse;
import com.baigon.user.ListUsersRequest;
import com.baigon.user.ListUsersResponse;
import com.baigon.user.LoginRequest;
import com.baigon.user.LoginResponse;
import com.baigon.user.MatchMyResumeToJobRequest;
import com.baigon.user.MatchMyResumeToJobResponse;
import com.baigon.user.OrganizationListRequest;
import com.baigon.user.OrganizationListResponse;
import com.baigon.user.OrganizationBatchRequest;
import com.baigon.user.OrganizationBatchResponse;
import com.baigon.user.UnlockUserRequest;
import com.baigon.user.UnlockUserResponse;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserGrpcServiceTest {

    private AuthService authService;
    private UserService userService;
    private AdminUserService adminUserService;
    private ResumeService resumeService;
    private UserAnalysisService userAnalysisService;
    private LogService logService;
    private UserGrpcService service;

    @BeforeEach
    void setUp() {
        authService = mock(AuthService.class);
        userService = mock(UserService.class);
        adminUserService = mock(AdminUserService.class);
        resumeService = mock(ResumeService.class);
        userAnalysisService = mock(UserAnalysisService.class);
        logService = mock(LogService.class);
        service = new UserGrpcService(
                authService, userService, adminUserService, resumeService,
                userAnalysisService, logService);
    }

    @Test
    void loginShouldPreserveResponseContract() {
        when(authService.login("admin", "123456")).thenReturn(
                new AuthService.AuthResult(7L, "admin", "管理员", "ADMIN", "jwt-token"));
        @SuppressWarnings("unchecked")
        StreamObserver<LoginResponse> observer = mock(StreamObserver.class);

        service.login(request(), observer);

        ArgumentCaptor<LoginResponse> response = ArgumentCaptor.forClass(LoginResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        verify(observer, never()).onError(any());
        assertEquals("jwt-token", response.getValue().getToken());
        assertEquals(7L, response.getValue().getUserId());
        assertEquals(List.of("token", "user_id"), response.getValue()
                .getDescriptorForType().getFields().stream().map(field -> field.getName()).toList());
        verify(logService).info(any(), eq("login success"));
    }

    @Test
    void loginShouldMapAuthFailureToUnauthenticated() {
        when(authService.login("admin", "123456"))
                .thenThrow(new AuthService.AuthException(401, "uid or password error"));
        @SuppressWarnings("unchecked")
        StreamObserver<LoginResponse> observer = mock(StreamObserver.class);

        service.login(request(), observer);

        ArgumentCaptor<Throwable> error = ArgumentCaptor.forClass(Throwable.class);
        verify(observer).onError(error.capture());
        verify(observer, never()).onCompleted();
        assertEquals(Status.Code.UNAUTHENTICATED,
                Status.fromThrowable(error.getValue()).getCode());
        verify(logService).error(any(), eq("uid or password error"), eq("login failed"));
    }

    @Test
    void loginShouldMapLockedUserToPermissionDenied() {
        when(authService.login("admin", "123456"))
                .thenThrow(new AuthService.AuthException(403, "your are locked!"));
        @SuppressWarnings("unchecked")
        StreamObserver<LoginResponse> observer = mock(StreamObserver.class);

        service.login(request(), observer);

        ArgumentCaptor<Throwable> error = ArgumentCaptor.forClass(Throwable.class);
        verify(observer).onError(error.capture());
        assertEquals(Status.Code.PERMISSION_DENIED,
                Status.fromThrowable(error.getValue()).getCode());
    }

    @Test
    void listUsersShouldReturnOnlyUserIdsAndPagination() {
        var user = new AdminUserService.UserData(
                8L, "student01", "张三", "STUDENT", "NORMAL",
                1L, 2L, 3L);
        when(adminUserService.normalizedPageSize(20)).thenReturn(20);
        when(adminUserService.listUsers(eq(0), eq(20), any()))
                .thenReturn(new PageImpl<>(List.of(user)));
        @SuppressWarnings("unchecked")
        StreamObserver<ListUsersResponse> observer = mock(StreamObserver.class);

        service.listUsers(ListUsersRequest.newBuilder()
                .setPage(0)
                .setPageSize(20)
                .setName("张")
                .setUniversityId(1L)
                .setSchoolId(2L)
                .setDepartmentId(3L)
                .setUserId(1L)
                .setUserName("admin")
                .setRequestMethod("POST")
                .setRequestUrl("/api/auth/users")
                .build(), observer);

        ArgumentCaptor<ListUsersResponse> response = ArgumentCaptor.forClass(ListUsersResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(List.of(8L), response.getValue().getUserIdsList());
        assertEquals(null, response.getValue().getDescriptorForType().findFieldByName("items"));
        assertEquals(20, response.getValue().getPageSize());
        verify(logService).info(any(), eq("list users: total=1"));
    }

    @Test
    void listUsersShouldMapInvalidFilterToInvalidArgument() {
        when(adminUserService.normalizedPageSize(20)).thenReturn(20);
        when(adminUserService.listUsers(eq(0), eq(20), any()))
                .thenThrow(new IllegalArgumentException("invalid role"));
        @SuppressWarnings("unchecked")
        StreamObserver<ListUsersResponse> observer = mock(StreamObserver.class);

        service.listUsers(ListUsersRequest.newBuilder()
                .setPageSize(20)
                .setRole("ROOT")
                .build(), observer);

        ArgumentCaptor<Throwable> error = ArgumentCaptor.forClass(Throwable.class);
        verify(observer).onError(error.capture());
        assertEquals(Status.Code.INVALID_ARGUMENT,
                Status.fromThrowable(error.getValue()).getCode());
        verify(logService).error(any(), eq("invalid role"), eq("list users failed"));
    }

    @Test
    void batchGetUsersShouldKeepStableOrderAndReportMissingIds() {
        var first = new UserService.UserData(
                9L, "student09", "九号", User.Role.STUDENT, User.UserStatus.NORMAL,
                1L, 2L, 3L);
        var second = new UserService.UserData(
                3L, "student03", "三号", User.Role.STUDENT, User.UserStatus.NORMAL,
                1L, 2L, 3L);
        when(userService.batchGetUsers(List.of(9L, 3L, 9L, 8L)))
                .thenReturn(List.of(first, second));
        @SuppressWarnings("unchecked")
        StreamObserver<BatchGetUsersResponse> observer = mock(StreamObserver.class);

        service.batchGetUsers(BatchGetUsersRequest.newBuilder()
                .addAllIds(List.of(9L, 3L, 9L, 8L))
                .build(), observer);

        ArgumentCaptor<BatchGetUsersResponse> response =
                ArgumentCaptor.forClass(BatchGetUsersResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(List.of(9L, 3L), response.getValue().getItemsList().stream()
                .map(com.baigon.user.UserData::getId).toList());
        assertEquals(List.of(8L), response.getValue().getMissingIdsList());
        assertEquals(null, response.getValue().getItems(0).getDescriptorForType()
                .findFieldByName("university_name"));
    }

    @Test
    void getUserShouldReturnOrganizationIdsWithoutNames() {
        var user = new UserService.UserData(
                8L, "student01", "张三", User.Role.STUDENT, User.UserStatus.NORMAL,
                1L, 2L, 3L);
        when(userService.getUser(8L)).thenReturn(Optional.of(user));
        @SuppressWarnings("unchecked")
        StreamObserver<GetUserResponse> observer = mock(StreamObserver.class);

        service.getUser(GetUserRequest.newBuilder()
                .setId(8L)
                .setUserId(8L)
                .setRequestMethod("GET")
                .setRequestUrl("/api/auth/me")
                .build(), observer);

        ArgumentCaptor<GetUserResponse> response = ArgumentCaptor.forClass(GetUserResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(1L, response.getValue().getUser().getUniversityId());
        assertEquals(2L, response.getValue().getUser().getSchoolId());
        assertEquals(3L, response.getValue().getUser().getDepartmentId());
        assertEquals(null, response.getValue().getUser().getDescriptorForType()
                .findFieldByName("university_name"));
        assertEquals(null, response.getValue().getUser().getDescriptorForType()
                .findFieldByName("school_name"));
        assertEquals(null, response.getValue().getUser().getDescriptorForType()
                .findFieldByName("department_name"));
        verify(logService).info(any(), eq("get user: id=8"));
    }

    @Test
    void getUserShouldMapMissingUserToNotFound() {
        when(userService.getUser(99L)).thenReturn(Optional.empty());
        @SuppressWarnings("unchecked")
        StreamObserver<GetUserResponse> observer = mock(StreamObserver.class);

        service.getUser(GetUserRequest.newBuilder().setId(99L).build(), observer);

        ArgumentCaptor<Throwable> error = ArgumentCaptor.forClass(Throwable.class);
        verify(observer).onError(error.capture());
        assertEquals(Status.Code.NOT_FOUND,
                Status.fromThrowable(error.getValue()).getCode());
        verify(logService).error(any(), eq("user not found"), eq("get user failed"));
    }

    @Test
    void createResumeUploadShouldReturnDirectMinioUploadContract() {
        when(resumeService.createUpload(8L, "张三.pdf", 128L))
                .thenReturn(new ResumeService.ResumeUploadData(
                        101L,
                        "http://localhost:9000/resumes/signed",
                        "PUT",
                        "application/pdf",
                        OffsetDateTime.parse("2026-08-17T09:10:00+08:00")));
        @SuppressWarnings("unchecked")
        StreamObserver<CreateResumeUploadResponse> observer = mock(StreamObserver.class);

        service.createResumeUpload(CreateResumeUploadRequest.newBuilder()
                .setFileName("张三.pdf")
                .setFileSize(128L)
                .setUserId(8L)
                .setRequestMethod("POST")
                .setRequestUrl("/api/auth/resumes/upload-url")
                .build(), observer);

        ArgumentCaptor<CreateResumeUploadResponse> response =
                ArgumentCaptor.forClass(CreateResumeUploadResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(101L, response.getValue().getUploadId());
        assertEquals("http://localhost:9000/resumes/signed", response.getValue().getUploadUrl());
        assertEquals("PUT", response.getValue().getMethod());
        assertEquals("application/pdf", response.getValue().getContentType());
        verify(logService).info(any(), eq("create resume upload: id=101"));
    }

    @Test
    void completeResumeUploadShouldReturnOnlyResumeId() {
        when(resumeService.completeUpload(eq(8L), eq(101L), eq("张三.pdf"), any()))
                .thenReturn(new ResumeService.ResumeData(
                        101L, "张三.pdf", 128L, "OCR 简历正文",
                        OffsetDateTime.parse("2026-08-17T10:00:00+08:00"),
                        resumeFieldsJson(), ResumeSource.SYSTEM));
        @SuppressWarnings("unchecked")
        StreamObserver<CompleteResumeUploadResponse> observer = mock(StreamObserver.class);

        service.completeResumeUpload(CompleteResumeUploadRequest.newBuilder()
                .setUploadId(101L)
                .setFileName("张三.pdf")
                .setUserId(8L)
                .setRequestMethod("POST")
                .setRequestUrl("/api/auth/resumes/upload-complete")
                .build(), observer);

        ArgumentCaptor<CompleteResumeUploadResponse> response =
                ArgumentCaptor.forClass(CompleteResumeUploadResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(101L, response.getValue().getResumeId());
        assertEquals(1, response.getValue().getDescriptorForType().getFields().size());
        verify(logService).info(any(),
                eq("complete resume upload and analyze content: id=101"));
    }

    @Test
    void getMyResumeShouldReturnContentAndStructuredFields() {
        when(resumeService.getMyResume(8L)).thenReturn(Optional.of(
                new ResumeService.ResumeData(
                        101L, "张三.pdf", 128L, "OCR 简历正文",
                        OffsetDateTime.parse("2026-08-17T10:00:00+08:00"),
                        resumeFieldsJson(), ResumeSource.SYSTEM)));
        @SuppressWarnings("unchecked")
        StreamObserver<GetMyResumeResponse> observer = mock(StreamObserver.class);

        service.getMyResume(GetMyResumeRequest.newBuilder()
                .setUserId(8L)
                .setRequestMethod("GET")
                .setRequestUrl("/api/auth/resumes")
                .build(), observer);

        ArgumentCaptor<GetMyResumeResponse> response =
                ArgumentCaptor.forClass(GetMyResumeResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals("OCR 简历正文", response.getValue().getResume().getContent());
        assertEquals(resumeFieldsJson(), response.getValue().getResume().getFieldsJson());
        assertEquals("SYSTEM", response.getValue().getResume().getSource());
    }

    @Test
    void editMyResumeShouldForwardCheckedJsonAndReturnOnlyResumeId() {
        when(resumeService.editMyResume(eq(8L), isNull(), eq(resumeFieldsJson())))
                .thenReturn(new ResumeService.ResumeData(
                        102L, null, null, null,
                        OffsetDateTime.parse("2026-08-18T10:00:00+08:00"),
                        resumeFieldsJson(), ResumeSource.EDITED));
        @SuppressWarnings("unchecked")
        StreamObserver<EditMyResumeResponse> observer = mock(StreamObserver.class);

        service.editMyResume(EditMyResumeRequest.newBuilder()
                .setFieldsJson(resumeFieldsJson())
                .setUserId(8L)
                .setRequestMethod("PUT")
                .setRequestUrl("/api/auth/resumes")
                .build(), observer);

        ArgumentCaptor<EditMyResumeResponse> response =
                ArgumentCaptor.forClass(EditMyResumeResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(102L, response.getValue().getResumeId());
        assertEquals(1, response.getValue().getDescriptorForType().getFields().size());
        verify(logService).info(any(), eq("edit my resume: id=102"));
    }

    @Test
    void analyzeMyResumeSkillsShouldReturnOnlyResumeAndSkillRecordIds() {
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-08-20T10:00:00+08:00");
        when(userAnalysisService.analyzeMyResumeSkills(eq(8L), any())).thenReturn(
                new UserAnalysisService.SkillAnalysisData(
                        101L,
                        List.of(new UserAnalysisService.UserSkillData(
                                501L, 101L, "Java", "ADVANCED",
                                "负责 Java 后端开发", createdAt))));
        @SuppressWarnings("unchecked")
        StreamObserver<AnalyzeMyResumeSkillsResponse> observer = mock(StreamObserver.class);

        service.analyzeMyResumeSkills(AnalyzeMyResumeSkillsRequest.newBuilder()
                .setUserId(8L)
                .setRequestMethod("POST")
                .setRequestUrl("/api/auth/resumes/analyze-skills")
                .build(), observer);

        ArgumentCaptor<AnalyzeMyResumeSkillsResponse> response =
                ArgumentCaptor.forClass(AnalyzeMyResumeSkillsResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(101L, response.getValue().getResumeId());
        assertEquals(List.of(501L), response.getValue().getUserSkillRecordIdsList());
        assertEquals(null, response.getValue().getDescriptorForType().findFieldByName("skills"));
    }

    @Test
    void listMySkillsShouldReturnStableIdPage() {
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-08-20T10:00:00+08:00");
        var skill = new UserAnalysisService.UserSkillData(
                501L, 101L, "Java", "ADVANCED", "Java 开发经验", createdAt);
        when(userAnalysisService.normalizedSkillPageSize(20)).thenReturn(20);
        when(userAnalysisService.listMySkills(8L, 1, 20)).thenReturn(
                new PageImpl<>(List.of(skill), PageRequest.of(1, 20), 21));
        @SuppressWarnings("unchecked")
        StreamObserver<ListMySkillsResponse> observer = mock(StreamObserver.class);

        service.listMySkills(ListMySkillsRequest.newBuilder()
                .setUserId(8L)
                .setPage(1)
                .setPageSize(20)
                .setRequestMethod("GET")
                .setRequestUrl("/api/auth/me/skills")
                .build(), observer);

        ArgumentCaptor<ListMySkillsResponse> response =
                ArgumentCaptor.forClass(ListMySkillsResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(List.of(501L), response.getValue().getUserSkillRecordIdsList());
        assertEquals(21L, response.getValue().getTotal());
        assertEquals(1, response.getValue().getPage());
        assertEquals(20, response.getValue().getPageSize());
        assertEquals(null, response.getValue().getDescriptorForType().findFieldByName("items"));
    }

    @Test
    void getMySkillShouldReturnOwnedFlatSkillDetail() {
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-08-20T10:00:00+08:00");
        when(userAnalysisService.getMySkill(8L, 501L)).thenReturn(
                new UserAnalysisService.UserSkillData(
                        501L, 101L, "Java", "ADVANCED", "Java 开发经验", createdAt));
        @SuppressWarnings("unchecked")
        StreamObserver<GetMySkillResponse> observer = mock(StreamObserver.class);

        service.getMySkill(GetMySkillRequest.newBuilder()
                .setId(501L)
                .setUserId(8L)
                .build(), observer);

        ArgumentCaptor<GetMySkillResponse> response =
                ArgumentCaptor.forClass(GetMySkillResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(501L, response.getValue().getSkill().getId());
        assertEquals("Java", response.getValue().getSkill().getSkillName());
    }

    @Test
    void batchGetMySkillsShouldKeepStableOrderAndReportMissingIds() {
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-08-20T10:00:00+08:00");
        var first = new UserAnalysisService.UserSkillData(
                502L, 101L, "Go", "ADVANCED", "Go 开发经验", createdAt);
        var second = new UserAnalysisService.UserSkillData(
                501L, 101L, "Java", "ADVANCED", "Java 开发经验", createdAt);
        when(userAnalysisService.batchGetMySkills(
                8L, List.of(502L, 501L, 502L, 999L)))
                .thenReturn(List.of(first, second));
        @SuppressWarnings("unchecked")
        StreamObserver<BatchGetMySkillsResponse> observer = mock(StreamObserver.class);

        service.batchGetMySkills(BatchGetMySkillsRequest.newBuilder()
                .setUserId(8L)
                .addAllIds(List.of(502L, 501L, 502L, 999L))
                .build(), observer);

        ArgumentCaptor<BatchGetMySkillsResponse> response =
                ArgumentCaptor.forClass(BatchGetMySkillsResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(List.of(502L, 501L), response.getValue().getItemsList().stream()
                .map(com.baigon.user.UserSkillData::getId).toList());
        assertEquals(List.of(999L), response.getValue().getMissingIdsList());
    }

    @Test
    void matchMyResumeToJobShouldReturnScoreAndSuggestions() {
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-08-20T11:00:00+08:00");
        when(userAnalysisService.matchMyResumeToJob(eq(8L), eq(201L), any())).thenReturn(
                new UserAnalysisService.JobMatchData(
                        301L,
                        101L,
                        201L,
                        82,
                        "核心后端经验匹配，云原生经验仍需补足。",
                        List.of(new UserAnalysisService.LearningSuggestionData(
                                "Kubernetes", "岗位要求容器编排", "完成一次集群部署实践")),
                        List.of("补充项目量化结果"),
                        createdAt));
        @SuppressWarnings("unchecked")
        StreamObserver<MatchMyResumeToJobResponse> observer = mock(StreamObserver.class);

        service.matchMyResumeToJob(MatchMyResumeToJobRequest.newBuilder()
                .setJobId(201L)
                .setUserId(8L)
                .setRequestMethod("POST")
                .setRequestUrl("/api/jobs/201/match")
                .build(), observer);

        ArgumentCaptor<MatchMyResumeToJobResponse> response =
                ArgumentCaptor.forClass(MatchMyResumeToJobResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(301L, response.getValue().getId());
        assertEquals(101L, response.getValue().getResumeId());
        assertEquals(201L, response.getValue().getJobId());
        assertEquals(82, response.getValue().getScore());
        assertEquals("Kubernetes",
                response.getValue().getSkillsToLearn(0).getSkillName());
        assertEquals("补充项目量化结果", response.getValue().getActionSuggestions(0));
        assertEquals(createdAt.toString(), response.getValue().getCreatedAt());
    }

    @Test
    void getLatestMyJobMatchShouldReturnLatestResultForJob() {
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-08-20T11:00:00+08:00");
        when(userAnalysisService.getLatestMyJobMatch(8L, 201L)).thenReturn(
                new UserAnalysisService.JobMatchData(
                        301L,
                        101L,
                        201L,
                        82,
                        "核心后端经验匹配，云原生经验仍需补足。",
                        List.of(new UserAnalysisService.LearningSuggestionData(
                                "Kubernetes", "岗位要求容器编排", "完成一次集群部署实践")),
                        List.of("补充项目量化结果"),
                        createdAt));
        @SuppressWarnings("unchecked")
        StreamObserver<MatchMyResumeToJobResponse> observer = mock(StreamObserver.class);

        service.getLatestMyJobMatch(GetLatestMyJobMatchRequest.newBuilder()
                .setJobId(201L)
                .setUserId(8L)
                .setRequestMethod("GET")
                .setRequestUrl("/api/jobs/201/match")
                .build(), observer);

        ArgumentCaptor<MatchMyResumeToJobResponse> response =
                ArgumentCaptor.forClass(MatchMyResumeToJobResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        verify(userAnalysisService).getLatestMyJobMatch(8L, 201L);
        assertEquals(301L, response.getValue().getId());
        assertEquals(101L, response.getValue().getResumeId());
        assertEquals(201L, response.getValue().getJobId());
        assertEquals(82, response.getValue().getScore());
        assertEquals("Kubernetes", response.getValue().getSkillsToLearn(0).getSkillName());
        assertEquals("补充项目量化结果", response.getValue().getActionSuggestions(0));
        assertEquals(createdAt.toString(), response.getValue().getCreatedAt());
    }

    @Test
    void getLatestMyJobMatchNotFoundShouldRemain404WithoutErrorLog() {
        when(userAnalysisService.getLatestMyJobMatch(8L, 201L)).thenThrow(
                new ApiException(ApiException.ErrorCode.NOT_FOUND, "job match not found"));
        @SuppressWarnings("unchecked")
        StreamObserver<MatchMyResumeToJobResponse> observer = mock(StreamObserver.class);

        service.getLatestMyJobMatch(GetLatestMyJobMatchRequest.newBuilder()
                .setJobId(201L)
                .setUserId(8L)
                .setRequestMethod("GET")
                .setRequestUrl("/api/jobs/201/match")
                .build(), observer);

        ArgumentCaptor<Throwable> error = ArgumentCaptor.forClass(Throwable.class);
        verify(observer).onError(error.capture());
        verify(observer, never()).onCompleted();
        assertEquals(Status.Code.NOT_FOUND, Status.fromThrowable(error.getValue()).getCode());
        verify(logService).info(any(),
                eq("get latest my job match: no saved result, job_id=201"));
        verify(logService, never()).error(any(), any(), any());
    }

    @Test
    void blockUserShouldReturnLockedUser() {
        var user = new AdminUserService.UserData(
                8L, "student01", "张三", "STUDENT", "LOCKED",
                1L, 2L, 3L);
        when(adminUserService.blockUser(8L)).thenReturn(Optional.of(user));
        @SuppressWarnings("unchecked")
        StreamObserver<BlockUserResponse> observer = mock(StreamObserver.class);

        service.blockUser(BlockUserRequest.newBuilder()
                .setId(8L)
                .setUserId(1L)
                .setUserName("admin")
                .setRequestMethod("POST")
                .setRequestUrl("/api/auth/users/8/block")
                .build(), observer);

        ArgumentCaptor<BlockUserResponse> response =
                ArgumentCaptor.forClass(BlockUserResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(8L, response.getValue().getUserId());
        assertEquals(1, response.getValue().getDescriptorForType().getFields().size());
        verify(logService).info(any(), eq("block user: id=8"));
    }

    @Test
    void blockUserShouldMapMissingUserToNotFound() {
        when(adminUserService.blockUser(99L)).thenReturn(Optional.empty());
        @SuppressWarnings("unchecked")
        StreamObserver<BlockUserResponse> observer = mock(StreamObserver.class);

        service.blockUser(BlockUserRequest.newBuilder().setId(99L).build(), observer);

        ArgumentCaptor<Throwable> error = ArgumentCaptor.forClass(Throwable.class);
        verify(observer).onError(error.capture());
        assertEquals(Status.Code.NOT_FOUND,
                Status.fromThrowable(error.getValue()).getCode());
        verify(logService).error(any(), eq("user not found"), eq("block user failed"));
    }

    @Test
    void unlockUserShouldReturnNormalUser() {
        var user = new AdminUserService.UserData(
                8L, "student01", "张三", "STUDENT", "NORMAL",
                1L, 2L, 3L);
        when(adminUserService.unlockUser(8L)).thenReturn(Optional.of(user));
        @SuppressWarnings("unchecked")
        StreamObserver<UnlockUserResponse> observer = mock(StreamObserver.class);

        service.unlockUser(UnlockUserRequest.newBuilder()
                .setId(8L)
                .setUserId(1L)
                .setUserName("admin")
                .setRequestMethod("POST")
                .setRequestUrl("/api/auth/users/8/unlock")
                .build(), observer);

        ArgumentCaptor<UnlockUserResponse> response =
                ArgumentCaptor.forClass(UnlockUserResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(8L, response.getValue().getUserId());
        assertEquals(1, response.getValue().getDescriptorForType().getFields().size());
        verify(logService).info(any(), eq("unlock user: id=8"));
    }

    @Test
    void unlockUserShouldMapMissingUserToNotFound() {
        when(adminUserService.unlockUser(99L)).thenReturn(Optional.empty());
        @SuppressWarnings("unchecked")
        StreamObserver<UnlockUserResponse> observer = mock(StreamObserver.class);

        service.unlockUser(UnlockUserRequest.newBuilder().setId(99L).build(), observer);

        ArgumentCaptor<Throwable> error = ArgumentCaptor.forClass(Throwable.class);
        verify(observer).onError(error.capture());
        assertEquals(Status.Code.NOT_FOUND,
                Status.fromThrowable(error.getValue()).getCode());
        verify(logService).error(any(), eq("user not found"), eq("unlock user failed"));
    }

    @Test
    void listSchoolsShouldForwardOptionalParentAndReturnOnlyIds() {
        var school = new AdminUserService.OrganizationSummary(
                2L, "计算机信息工程学院", 1L);
        when(adminUserService.normalizedPageSize(20)).thenReturn(20);
        when(adminUserService.listSchools(1L, 0, 20, "计算机"))
                .thenReturn(new PageImpl<>(List.of(school)));
        @SuppressWarnings("unchecked")
        StreamObserver<OrganizationListResponse> observer = mock(StreamObserver.class);

        service.listSchools(OrganizationListRequest.newBuilder()
                .setPageSize(20)
                .setParentId(1L)
                .setKeyword("计算机")
                .build(), observer);

        ArgumentCaptor<OrganizationListResponse> response =
                ArgumentCaptor.forClass(OrganizationListResponse.class);
        verify(observer).onNext(response.capture());
        assertEquals(List.of(2L), response.getValue().getOrganizationIdsList());
        assertEquals(null, response.getValue().getDescriptorForType().findFieldByName("items"));
        verify(logService).info(any(), eq("list schools: total=1"));
    }

    @Test
    void batchGetSchoolsShouldKeepStableOrderAndReportMissingIds() {
        when(adminUserService.batchGetSchools(List.of(9L, 3L, 9L, 8L)))
                .thenReturn(List.of(
                        new AdminUserService.OrganizationSummary(9L, "九号学院", 1L),
                        new AdminUserService.OrganizationSummary(3L, "三号学院", 2L)));
        @SuppressWarnings("unchecked")
        StreamObserver<OrganizationBatchResponse> observer = mock(StreamObserver.class);

        service.batchGetSchools(OrganizationBatchRequest.newBuilder()
                .addAllIds(List.of(9L, 3L, 9L, 8L))
                .build(), observer);

        ArgumentCaptor<OrganizationBatchResponse> response =
                ArgumentCaptor.forClass(OrganizationBatchResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(List.of(9L, 3L), response.getValue().getItemsList().stream()
                .map(com.baigon.user.OrganizationData::getId).toList());
        assertEquals(List.of(1L, 2L), response.getValue().getItemsList().stream()
                .map(com.baigon.user.OrganizationData::getParentId).toList());
        assertEquals(List.of(8L), response.getValue().getMissingIdsList());
    }

    private LoginRequest request() {
        return LoginRequest.newBuilder()
                .setUid("admin")
                .setPassword("123456")
                .build();
    }

    private String resumeFieldsJson() {
        return """
                {"education_experience":[],"work_experience":[],"project_experience":[],"professional_skills":[{"skill_name":"Java","proficiency":"Advanced"}],"awards":[]}""";
    }
}

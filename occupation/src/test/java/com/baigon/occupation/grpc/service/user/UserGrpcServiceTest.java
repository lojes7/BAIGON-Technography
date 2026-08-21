// 百工谱 — UserService gRPC 契约测试
package com.baigon.occupation.grpc.service.user;

import com.baigon.occupation.entity.user.User;
import com.baigon.occupation.entity.user.resume.ResumeSource;
import com.baigon.occupation.service.LogService;
import com.baigon.occupation.service.user.AuthService;
import com.baigon.occupation.service.user.UserService;
import com.baigon.occupation.service.user.admin.AdminUserService;
import com.baigon.occupation.service.user.analysis.UserAnalysisService;
import com.baigon.occupation.service.user.resume.ResumeService;
import com.baigon.user.AnalyzeMyResumeSkillsRequest;
import com.baigon.user.AnalyzeMyResumeSkillsResponse;
import com.baigon.user.BlockUserRequest;
import com.baigon.user.BlockUserResponse;
import com.baigon.user.CompleteResumeUploadRequest;
import com.baigon.user.CompleteResumeUploadResponse;
import com.baigon.user.CreateResumeUploadRequest;
import com.baigon.user.CreateResumeUploadResponse;
import com.baigon.user.EditMyResumeRequest;
import com.baigon.user.EditMyResumeResponse;
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
import com.baigon.user.UnlockUserRequest;
import com.baigon.user.UnlockUserResponse;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;

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
        assertEquals("admin", response.getValue().getUid());
        assertEquals("管理员", response.getValue().getName());
        assertEquals("ADMIN", response.getValue().getRole());
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
    void listUsersShouldReturnUserDataAndPagination() {
        var user = new AdminUserService.UserData(
                8L, "student01", "张三", "STUDENT", "NORMAL",
                1L, 2L, 3L, "百工大学", "计算机学院", "软件工程系");
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
        assertEquals(1, response.getValue().getItemsCount());
        assertEquals("student01", response.getValue().getItems(0).getUid());
        assertEquals(1L, response.getValue().getItems(0).getUniversityId());
        assertEquals(2L, response.getValue().getItems(0).getSchoolId());
        assertEquals(3L, response.getValue().getItems(0).getDepartmentId());
        assertEquals("百工大学", response.getValue().getItems(0).getUniversityName());
        assertEquals("计算机学院", response.getValue().getItems(0).getSchoolName());
        assertEquals("软件工程系", response.getValue().getItems(0).getDepartmentName());
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
    void getUserShouldReturnOrganizationIdsAndNames() {
        var user = new UserService.UserData(
                8L, "student01", "张三", User.Role.STUDENT, User.UserStatus.NORMAL,
                1L, 2L, 3L, "百工大学", "计算机学院", "软件工程系");
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
        assertEquals("百工大学", response.getValue().getUser().getUniversityName());
        assertEquals("计算机学院", response.getValue().getUser().getSchoolName());
        assertEquals("软件工程系", response.getValue().getUser().getDepartmentName());
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
    void completeResumeUploadShouldReturnExtractedContentWithoutStorageFields() {
        when(resumeService.completeUpload(8L, 101L, "张三.pdf"))
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
        assertEquals(101L, response.getValue().getResume().getId());
        assertEquals("OCR 简历正文", response.getValue().getResume().getContent());
        assertEquals("张三.pdf", response.getValue().getResume().getFileName());
        assertEquals(ResumeSource.SYSTEM.name(), response.getValue().getResume().getSource());
        assertEquals(resumeFieldsJson(), response.getValue().getResume().getFieldsJson());
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
    void editMyResumeShouldForwardCheckedJsonAndReturnEditedSource() {
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
        assertEquals(102L, response.getValue().getResume().getId());
        assertEquals("EDITED", response.getValue().getResume().getSource());
        assertEquals(false, response.getValue().getResume().hasFileName());
        assertEquals(false, response.getValue().getResume().hasFileSize());
        assertEquals(false, response.getValue().getResume().hasContent());
        verify(logService).info(any(), eq("edit my resume: id=102"));
    }

    @Test
    void analyzeMyResumeSkillsShouldReturnPersistedSkillSnapshot() {
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
        assertEquals(1, response.getValue().getSkillsCount());
        assertEquals("Java", response.getValue().getSkills(0).getSkillName());
        assertEquals("ADVANCED", response.getValue().getSkills(0).getProficiency());
        assertEquals(createdAt.toString(), response.getValue().getSkills(0).getCreatedAt());
    }

    @Test
    void listMySkillsShouldReturnStableEmptyItems() {
        when(userAnalysisService.listMySkills(8L)).thenReturn(List.of());
        @SuppressWarnings("unchecked")
        StreamObserver<ListMySkillsResponse> observer = mock(StreamObserver.class);

        service.listMySkills(ListMySkillsRequest.newBuilder()
                .setUserId(8L)
                .setRequestMethod("GET")
                .setRequestUrl("/api/auth/me/skills")
                .build(), observer);

        ArgumentCaptor<ListMySkillsResponse> response =
                ArgumentCaptor.forClass(ListMySkillsResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(0, response.getValue().getItemsCount());
    }

    @Test
    void matchMyResumeToJobShouldReturnScoreAndSuggestions() {
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-08-20T11:00:00+08:00");
        when(userAnalysisService.matchMyResumeToJob(eq(8L), eq(201L), any())).thenReturn(
                new UserAnalysisService.JobMatchData(
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
        assertEquals(101L, response.getValue().getResumeId());
        assertEquals(201L, response.getValue().getJobId());
        assertEquals(82, response.getValue().getScore());
        assertEquals("Kubernetes",
                response.getValue().getSkillsToLearn(0).getSkillName());
        assertEquals("补充项目量化结果", response.getValue().getActionSuggestions(0));
        assertEquals(createdAt.toString(), response.getValue().getCreatedAt());
    }

    @Test
    void blockUserShouldReturnLockedUser() {
        var user = new AdminUserService.UserData(
                8L, "student01", "张三", "STUDENT", "LOCKED",
                1L, 2L, 3L, "百工大学", "计算机学院", "软件工程系");
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
        assertEquals("LOCKED", response.getValue().getUser().getStatus());
        assertEquals(1L, response.getValue().getUser().getUniversityId());
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
                1L, 2L, 3L, "百工大学", "计算机学院", "软件工程系");
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
        assertEquals("NORMAL", response.getValue().getUser().getStatus());
        assertEquals(1L, response.getValue().getUser().getUniversityId());
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
    void listSchoolsShouldForwardOptionalParentAndReturnCatalog() {
        var school = new AdminUserService.OrganizationSummary(2L, "计算机信息工程学院");
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
        assertEquals(1, response.getValue().getItemsCount());
        assertEquals("计算机信息工程学院", response.getValue().getItems(0).getName());
        verify(logService).info(any(), eq("list schools: total=1"));
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

// 百工谱 — UserService gRPC 实现（桩）

package com.baigon.user.grpc;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * UserService gRPC 桩实现
 *
 * TODO: 当 proto stub 生成后，继承 UserServiceGrpc.UserServiceImplBase
 * 并实现所有 RPC 方法
 */
@Service
public class UserGrpcService {

    private static final Logger log = LoggerFactory.getLogger(UserGrpcService.class);

    public UserGrpcService() {
        log.info("UserGrpcService 初始化完成（桩模式）");
    }

    // TODO: 实现以下 gRPC 方法:
    // ==================== 认证 ====================
    // - Register()              → 用户注册
    // - Login()                 → 用户登录
    // - RefreshToken()          → 刷新令牌
    //
    // ==================== 用户信息 ====================
    // - GetProfile()            → 获取用户资料
    // - UpdateProfile()         → 更新用户资料
    //
    // ==================== 简历管理 ====================
    // - UploadResume()          → 上传简历
    // - GetResume()             → 获取简历详情
    // - ParseResume()           → 解析简历（异步任务）
    //
    // ==================== 人岗匹配 ====================
    // - MatchJob()              → 人岗匹配诊断
    // - GetGapAnalysis()        → 获取能力差距分析
    //
    // ==================== 学习路径 ====================
    // - GenerateLearningPath()  → 生成个性化学习路径
}

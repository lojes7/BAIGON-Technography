// 百工谱 — OccupationService gRPC 实现（桩）

package com.baigon.occupation.grpc;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * OccupationService gRPC 桩实现
 *
 * TODO: 当 proto stub 生成后，继承 OccupationServiceGrpc.OccupationServiceImplBase
 * 并实现所有 RPC 方法
 */
@Service
public class OccupationGrpcService {

    private static final Logger log = LoggerFactory.getLogger(OccupationGrpcService.class);

    public OccupationGrpcService() {
        log.info("OccupationGrpcService 初始化完成（桩模式）");
    }

    // TODO: 实现以下 gRPC 方法:
    // - GetOccupation()           → 获取单个岗位详情
    // - ListOccupations()        → 分页列出岗位列表
    // - SearchOccupations()      → 语义搜索岗位
    // - GetEvolution()           → 获取岗位演化历史
    // - GetVersionDiff()         → 比较两个版本的岗位差异
    // - GetEmergingJobs()        → 获取新兴岗位检测结果
    // - GetCandidateJobDetail()  → 获取候选岗位详情
    // - GetKnowledgeGraph()      → 获取岗位知识图谱
    // - GetSkillRelations()      → 获取技能关系网络
    // - UpsertOccupation()       → 创建或更新岗位
    // - UpsertSkill()            → 创建或更新技能
    // - MergeSkills()            → 合并重复技能
}

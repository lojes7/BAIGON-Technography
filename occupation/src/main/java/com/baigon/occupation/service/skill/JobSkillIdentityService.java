// 百工谱 — 正式岗位技能身份判定入口
package com.baigon.occupation.service.skill;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.job.JobSkill;
import com.baigon.occupation.entity.skill.JobSkillResolutionTask;
import com.baigon.occupation.entity.skill.Skill;
import com.baigon.occupation.entity.skill.SkillAlias;
import com.baigon.occupation.entity.skill.SkillResolutionTaskStatus;
import com.baigon.occupation.repository.job.JobSkillRepository;
import com.baigon.occupation.repository.skill.JobSkillResolutionTaskRepository;
import com.baigon.occupation.repository.skill.SkillAliasRepository;
import com.baigon.occupation.repository.skill.SkillRepository;
import com.baigon.occupation.service.AuditContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;

/** job_skills 落库时先精确命中别名，未命中才创建独立人工解析任务。 */
@Service
public class JobSkillIdentityService {

    private final JobSkillRepository jobSkillRepository;
    private final SkillAliasRepository aliasRepository;
    private final SkillRepository skillRepository;
    private final JobSkillResolutionTaskRepository taskRepository;
    private final SkillRelationService relationService;
    private final SkillResolutionAnalysisService analysisService;
    private final Snowflake snowflake;

    public JobSkillIdentityService(JobSkillRepository jobSkillRepository,
                                   SkillAliasRepository aliasRepository,
                                   SkillRepository skillRepository,
                                   JobSkillResolutionTaskRepository taskRepository,
                                   SkillRelationService relationService,
                                   SkillResolutionAnalysisService analysisService,
                                   Snowflake snowflake) {
        this.jobSkillRepository = jobSkillRepository;
        this.aliasRepository = aliasRepository;
        this.skillRepository = skillRepository;
        this.taskRepository = taskRepository;
        this.relationService = relationService;
        this.analysisService = analysisService;
        this.snowflake = snowflake;
    }

    @Transactional
    public void saveAndResolve(Job job,
                               JobSkill jobSkill,
                               Long traceId,
                               AuditContext audit,
                               OffsetDateTime now) {
        String skillName = jobSkill.getSkillName() == null
                ? "" : jobSkill.getSkillName().trim();
        if (skillName.isEmpty()) {
            throw new IllegalArgumentException("job skill name is empty");
        }
        jobSkill.setSkillName(skillName);

        Optional<Skill> exactSkill = aliasRepository
                .findActiveByNormalizedAliasName(skillName)
                .flatMap(this::activeTarget);
        if (exactSkill.isPresent()) {
            jobSkill.setSkillId(exactSkill.get().getId());
            jobSkillRepository.save(jobSkill);
            relationService.link(job, exactSkill.get().getId());
            return;
        }

        // 先写正式岗位技能，解析任务通过外键与其一一对应。
        jobSkillRepository.save(jobSkill);
        JobSkillResolutionTask task = new JobSkillResolutionTask();
        task.setId(snowflake.nextId());
        task.setTraceId(traceId);
        task.setJobSkillId(jobSkill.getId());
        task.setSkillName(skillName);
        task.setTaskStatus(SkillResolutionTaskStatus.PENDING);
        task.setReviewStatus(ReviewStatus.PENDING);
        task.setAttempts(0);
        task.setCreatedAt(now);
        task.setUpdatedAt(now);
        taskRepository.save(task);
        analysisService.submitAfterCommit(task.getId(), audit.withTraceId(traceId));
    }

    private Optional<Skill> activeTarget(SkillAlias alias) {
        return skillRepository.findByIdAndDeletedAtIsNull(alias.getSkillId());
    }
}

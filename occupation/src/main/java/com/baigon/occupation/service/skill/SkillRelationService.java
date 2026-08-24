// 百工谱 — 规范技能与职业、专业聚合关系维护
package com.baigon.occupation.service.skill;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.major.Major;
import com.baigon.occupation.repository.major.MajorRepository;
import com.baigon.occupation.repository.skill.MajorSkillRepository;
import com.baigon.occupation.repository.skill.OccupationSkillRepository;
import com.baigon.occupation.service.job.JobMajorPolicy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 在岗位技能身份确定的同一事务中，幂等维护两个聚合关系。 */
@Service
public class SkillRelationService {

    private final OccupationSkillRepository occupationSkillRepository;
    private final MajorSkillRepository majorSkillRepository;
    private final MajorRepository majorRepository;
    private final Snowflake snowflake;

    public SkillRelationService(OccupationSkillRepository occupationSkillRepository,
                                MajorSkillRepository majorSkillRepository,
                                MajorRepository majorRepository,
                                Snowflake snowflake) {
        this.occupationSkillRepository = occupationSkillRepository;
        this.majorSkillRepository = majorSkillRepository;
        this.majorRepository = majorRepository;
        this.snowflake = snowflake;
    }

    @Transactional
    public void link(Job job, long skillId) {
        if (job.getOccupationId() == null) {
            throw new IllegalStateException("job occupation is not ascertained");
        }
        occupationSkillRepository.insertIfAbsent(
                snowflake.nextId(), job.getOccupationId(), skillId);

        if (job.getMajorId() == null) {
            throw new IllegalStateException("job major is not ascertained");
        }
        Major major = majorRepository.findByIdAndDeletedAtIsNull(job.getMajorId())
                .orElseThrow(() -> new IllegalStateException("job major not found"));
        // “其他”(999999) 只是不形成专业技能聚合；职业技能关系始终写入。
        if (!JobMajorPolicy.OTHER_MAJOR_CODE.equals(major.getCode())) {
            majorSkillRepository.insertIfAbsent(
                    snowflake.nextId(), major.getId(), skillId);
        }
    }
}

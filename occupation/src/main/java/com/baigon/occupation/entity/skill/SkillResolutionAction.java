// 百工谱 — 岗位技能人工归一动作
package com.baigon.occupation.entity.skill;

/** 候选命中、候选外已有技能或新建规范技能三种人工决定。 */
public enum SkillResolutionAction {
    SELECT_CANDIDATE,
    SELECT_EXISTING,
    CREATE_NEW
}

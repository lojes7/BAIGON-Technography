// 百工谱 — 技能解析候选生成状态
package com.baigon.occupation.entity.skill;

/** RUNNING 用于数据库条件更新原子领取任务，防止重复 worker 同时生成候选。 */
public enum SkillResolutionTaskStatus {
    PENDING,
    RUNNING,
    SUCCESS,
    FAILED
}

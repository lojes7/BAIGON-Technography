// 百工谱 — 规范技能父子层次查询与维护
package com.baigon.occupation.service.skill;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.skill.Skill;
import com.baigon.occupation.entity.skill.SkillRelation;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.repository.skill.SkillRelationGraphWriteLock;
import com.baigon.occupation.repository.skill.SkillRelationRepository;
import com.baigon.occupation.repository.skill.SkillRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;

@Service
@Transactional(readOnly = true)
public class SkillHierarchyService {

    public static final int MAX_PARENT_SKILLS = 20;
    private static final int MAX_LOOKUP_SKILLS = 200;

    private final SkillRepository skillRepository;
    private final SkillRelationRepository relationRepository;
    private final SkillRelationGraphWriteLock graphWriteLock;
    private final Snowflake snowflake;

    public SkillHierarchyService(SkillRepository skillRepository,
                                 SkillRelationRepository relationRepository,
                                 SkillRelationGraphWriteLock graphWriteLock,
                                 Snowflake snowflake) {
        this.skillRepository = skillRepository;
        this.relationRepository = relationRepository;
        this.graphWriteLock = graphWriteLock;
        this.snowflake = snowflake;
    }

    /** 查询活动技能本体，不附带任何关系。 */
    public Optional<Skill> getSkill(Long skillId) {
        long id = positiveId(skillId, "skill_id");
        return skillRepository.findByIdAndDeletedAtIsNull(id);
    }

    /** 查询指定技能的一跳父子 ID；关系 ID 始终按数值升序返回。 */
    public Optional<DirectRelations> getDirectRelations(Long skillId) {
        long id = positiveId(skillId, "skill_id");
        return skillRepository.findByIdAndDeletedAtIsNull(id)
                .map(ignored -> directRelations(List.of(id)).get(id));
    }

    /** 批量解析活动技能本体，并显式返回不存在或已软删除的 ID。 */
    public SkillLookup lookupSkills(Collection<Long> skillIds) {
        if (skillIds == null || skillIds.isEmpty() || skillIds.size() > MAX_LOOKUP_SKILLS) {
            throw new IllegalArgumentException("skill_ids must contain between 1 and 200 ids");
        }
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        for (Long skillId : skillIds) ids.add(positiveId(skillId, "skill_ids"));
        Map<Long, Skill> loadedById = new LinkedHashMap<>();
        skillRepository.findByIdInAndDeletedAtIsNullOrderByIdAsc(ids)
                .forEach(skill -> loadedById.put(skill.getId(), skill));
        List<Skill> skills = ids.stream()
                .map(loadedById::get)
                .filter(java.util.Objects::nonNull)
                .toList();
        List<Long> missingIds = ids.stream()
                .filter(id -> !loadedById.containsKey(id))
                .toList();
        return new SkillLookup(List.copyOf(skills), List.copyOf(missingIds));
    }

    /**
     * 批量映射每个目标技能的一跳父子关系。一次仓储查询覆盖全部技能，
     * 并保留指向目标集合之外技能的直接关系，供前端再按 ID 批量解析名称。
     */
    public Map<Long, DirectRelations> directRelations(Collection<Long> skillIds) {
        TreeSet<Long> ids = normalizedIds(skillIds, "skill_ids");
        if (ids.isEmpty()) return Map.of();

        Map<Long, MutableRelations> grouped = new LinkedHashMap<>();
        ids.forEach(id -> grouped.put(id, new MutableRelations()));
        for (SkillRelation relation : relationRepository.findDirectRelations(ids)) {
            MutableRelations parent = grouped.get(relation.getParentSkillId());
            if (parent != null) parent.childSkillIds.add(relation.getChildSkillId());
            MutableRelations child = grouped.get(relation.getChildSkillId());
            if (child != null) child.parentSkillIds.add(relation.getParentSkillId());
        }

        Map<Long, DirectRelations> result = new LinkedHashMap<>();
        grouped.forEach((id, relations) -> result.put(id, new DirectRelations(
                List.copyOf(relations.parentSkillIds),
                List.copyOf(relations.childSkillIds))));
        return Map.copyOf(result);
    }

    /** 新增一条父子边；相同活动边重复提交保持幂等。 */
    @Transactional
    public void addRelation(Long parentSkillId, Long childSkillId) {
        addParents(positiveId(childSkillId, "child_skill_id"),
                List.of(positiveId(parentSkillId, "parent_skill_id")));
    }

    /** CREATE_NEW 可在同一事务中一次关联最多 20 个活动父技能。 */
    @Transactional
    public void addParents(Long childSkillId, Collection<Long> parentSkillIds) {
        long childId = positiveId(childSkillId, "child_skill_id");
        TreeSet<Long> parents = normalizedIds(parentSkillIds, "parent_skill_ids");
        if (parents.size() > MAX_PARENT_SKILLS) {
            throw new IllegalArgumentException("parent_skill_ids must contain at most 20 ids");
        }
        if (parents.isEmpty()) return;
        if (parents.contains(childId)) {
            throw new IllegalArgumentException("skill relation must not reference itself");
        }

        // 全部新增边先竞争同一个事务级锁，避免不相交端点并发提交后共同组成环。
        graphWriteLock.acquire();
        TreeSet<Long> lockedIds = new TreeSet<>(parents);
        lockedIds.add(childId);
        lockAllActive(lockedIds);

        for (Long parentId : parents) {
            if (relationRepository.existsByParentSkillIdAndChildSkillIdAndDeletedAtIsNull(
                    parentId, childId)) {
                continue;
            }
            // 新边 parent -> child 会在 child 已能到达 parent 时形成间接环。
            if (relationRepository.hasActivePath(childId, parentId)) {
                throw new ApiException(ApiException.ErrorCode.CONFLICT,
                        "skill relation would create a cycle");
            }
            int inserted = relationRepository.insertIfAbsent(
                    snowflake.nextId(), parentId, childId);
            if (inserted == 0 && !relationRepository
                    .existsByParentSkillIdAndChildSkillIdAndDeletedAtIsNull(parentId, childId)) {
                throw new ApiException(ApiException.ErrorCode.CONFLICT,
                        "skill relation was created concurrently");
            }
        }
    }

    /** 软删除一条父子边；相同删除重复提交保持幂等。 */
    @Transactional
    public void deleteRelation(Long parentSkillId, Long childSkillId) {
        long parentId = positiveId(parentSkillId, "parent_skill_id");
        long childId = positiveId(childSkillId, "child_skill_id");
        if (parentId == childId) {
            throw new IllegalArgumentException("skill relation must not reference itself");
        }
        lockAllActive(new TreeSet<>(List.of(parentId, childId)));
        relationRepository.softDelete(parentId, childId);
    }

    private void lockAllActive(Set<Long> ids) {
        List<Skill> locked = skillRepository.findActiveByIdsForUpdate(ids);
        if (locked.size() != ids.size()) {
            throw new ApiException(ApiException.ErrorCode.NOT_FOUND, "skill not found");
        }
        // 仓储查询已 ORDER BY id，这里再校验一次，避免未来改查询时破坏稳定锁顺序。
        List<Long> actual = locked.stream().map(Skill::getId).toList();
        if (!actual.equals(new ArrayList<>(ids))) {
            throw new IllegalStateException("skills were not locked in stable order");
        }
    }

    private TreeSet<Long> normalizedIds(Collection<Long> values, String field) {
        TreeSet<Long> ids = new TreeSet<>();
        if (values == null) return ids;
        for (Long value : values) ids.add(positiveId(value, field));
        return ids;
    }

    private long positiveId(Long value, String field) {
        if (value == null || value <= 0) {
            throw new IllegalArgumentException(field + " must be > 0");
        }
        return value;
    }

    private static final class MutableRelations {
        private final TreeSet<Long> parentSkillIds = new TreeSet<>();
        private final TreeSet<Long> childSkillIds = new TreeSet<>();
    }

    public record DirectRelations(List<Long> parentSkillIds, List<Long> childSkillIds) {
        public static DirectRelations empty() {
            return new DirectRelations(List.of(), List.of());
        }
    }

    public record SkillLookup(List<Skill> skills, List<Long> missingSkillIds) {
    }
}

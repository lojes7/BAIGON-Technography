// 百工谱 — 职业/专业技能时间图谱聚合查询仓储
package com.baigon.occupation.repository.skill.graph;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;

/**
 * 时间条件只在参数存在时拼接，避免 PostgreSQL 对 nullable timestamptz 参数报 42P18。
 * 表名与范围列只来自受控枚举，不接收外部字符串。
 */
@Repository
public class SkillGraphQueryRepository {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public SkillGraphQueryRepository(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public long countJobs(ScopeType scope,
                          long scopeId,
                          OffsetDateTime publishedFrom,
                          OffsetDateTime publishedTo) {
        StringBuilder sql = new StringBuilder("""
                SELECT COUNT(*)
                FROM jobs job
                WHERE job.deleted_at IS NULL
                """);
        sql.append(" AND job.").append(scope.scopeColumn()).append(" = :scopeId");
        MapSqlParameterSource parameters = parameters(scopeId);
        appendTimeline(sql, parameters, "job.publish_date", publishedFrom, publishedTo);
        Long count = jdbcTemplate.queryForObject(sql.toString(), parameters, Long.class);
        return count == null ? 0 : count;
    }

    /** 返回时间窗内由岗位直接贡献的技能 ID，不读取技能父子关系。 */
    public List<Long> findDirectSkillIds(ScopeType scope,
                                         long scopeId,
                                         OffsetDateTime publishedFrom,
                                         OffsetDateTime publishedTo) {
        StringBuilder sql = new StringBuilder("""
                SELECT relation.skill_id,
                       COUNT(DISTINCT relation.job_id) AS job_count
                FROM %s relation
                JOIN skills skill
                  ON skill.id = relation.skill_id
                 AND skill.deleted_at IS NULL
                JOIN jobs job
                  ON job.id = relation.job_id
                 AND job.deleted_at IS NULL
                 AND job.%s = relation.%s
                WHERE relation.deleted_at IS NULL
                  AND relation.%s = :scopeId
                """.formatted(
                scope.relationTable(), scope.scopeColumn(), scope.scopeColumn(), scope.scopeColumn()));
        MapSqlParameterSource parameters = parameters(scopeId);
        appendTimeline(sql, parameters, "relation.publish_date", publishedFrom, publishedTo);
        sql.append("""
                GROUP BY relation.skill_id
                ORDER BY job_count DESC, relation.skill_id ASC
                """);
        return jdbcTemplate.query(sql.toString(), parameters,
                (resultSet, rowNum) -> resultSet.getLong("skill_id"));
    }

    /** 批量返回请求技能与范围之间的直接关系指标。 */
    public List<SkillMetricAggregate> findMetrics(ScopeType scope,
                                                  long scopeId,
                                                  Collection<Long> skillIds,
                                                  OffsetDateTime publishedFrom,
                                                  OffsetDateTime publishedTo) {
        StringBuilder sql = new StringBuilder("""
                SELECT relation.skill_id,
                       COUNT(DISTINCT relation.job_id) AS job_count
                FROM %s relation
                JOIN skills skill
                  ON skill.id = relation.skill_id
                 AND skill.deleted_at IS NULL
                JOIN jobs job
                  ON job.id = relation.job_id
                 AND job.deleted_at IS NULL
                 AND job.%s = relation.%s
                WHERE relation.deleted_at IS NULL
                  AND relation.%s = :scopeId
                  AND relation.skill_id IN (:skillIds)
                """.formatted(
                scope.relationTable(), scope.scopeColumn(), scope.scopeColumn(), scope.scopeColumn()));
        MapSqlParameterSource parameters = parameters(scopeId).addValue("skillIds", skillIds);
        appendTimeline(sql, parameters, "relation.publish_date", publishedFrom, publishedTo);
        sql.append("""
                GROUP BY relation.skill_id
                ORDER BY job_count DESC, relation.skill_id ASC
                """);
        return jdbcTemplate.query(sql.toString(), parameters, (resultSet, rowNum) ->
                new SkillMetricAggregate(
                        resultSet.getLong("skill_id"),
                        resultSet.getLong("job_count")));
    }

    /** 统计指定直接技能在范围和时间窗内的岗位证据数量。 */
    public long countEvidenceJobs(ScopeType scope,
                                  long scopeId,
                                  long skillId,
                                  OffsetDateTime publishedFrom,
                                  OffsetDateTime publishedTo) {
        StringBuilder sql = new StringBuilder("""
                SELECT COUNT(DISTINCT relation.job_id)
                FROM %s relation
                JOIN skills skill
                  ON skill.id = relation.skill_id
                 AND skill.deleted_at IS NULL
                JOIN jobs job
                  ON job.id = relation.job_id
                 AND job.deleted_at IS NULL
                 AND job.%s = relation.%s
                WHERE relation.deleted_at IS NULL
                  AND relation.%s = :scopeId
                  AND relation.skill_id = :skillId
                """.formatted(
                scope.relationTable(), scope.scopeColumn(), scope.scopeColumn(), scope.scopeColumn()));
        MapSqlParameterSource parameters = parameters(scopeId).addValue("skillId", skillId);
        appendTimeline(sql, parameters, "relation.publish_date", publishedFrom, publishedTo);
        Long count = jdbcTemplate.queryForObject(sql.toString(), parameters, Long.class);
        return count == null ? 0 : count;
    }

    /** 分页返回岗位证据 ID；详情由岗位 detail/batch-detail API 解析。 */
    public List<Long> findEvidenceJobIds(ScopeType scope,
                                         long scopeId,
                                         long skillId,
                                         OffsetDateTime publishedFrom,
                                         OffsetDateTime publishedTo,
                                         int page,
                                         int pageSize) {
        StringBuilder sql = new StringBuilder("""
                SELECT relation.job_id
                FROM %s relation
                JOIN skills skill
                  ON skill.id = relation.skill_id
                 AND skill.deleted_at IS NULL
                JOIN jobs job
                  ON job.id = relation.job_id
                 AND job.deleted_at IS NULL
                 AND job.%s = relation.%s
                WHERE relation.deleted_at IS NULL
                  AND relation.%s = :scopeId
                  AND relation.skill_id = :skillId
                """.formatted(
                scope.relationTable(), scope.scopeColumn(), scope.scopeColumn(), scope.scopeColumn()));
        MapSqlParameterSource parameters = parameters(scopeId)
                .addValue("skillId", skillId)
                .addValue("pageSize", pageSize)
                .addValue("offset", (long) page * pageSize);
        appendTimeline(sql, parameters, "relation.publish_date", publishedFrom, publishedTo);
        sql.append("""
                ORDER BY relation.publish_date DESC NULLS LAST, relation.job_id DESC
                LIMIT :pageSize OFFSET :offset
                """);
        return jdbcTemplate.query(sql.toString(), parameters,
                (resultSet, rowNum) -> resultSet.getLong("job_id"));
    }

    private MapSqlParameterSource parameters(long scopeId) {
        return new MapSqlParameterSource().addValue("scopeId", scopeId);
    }

    private void appendTimeline(StringBuilder sql,
                                MapSqlParameterSource parameters,
                                String column,
                                OffsetDateTime publishedFrom,
                                OffsetDateTime publishedTo) {
        if (publishedFrom != null) {
            sql.append(" AND ").append(column).append(" >= :publishedFrom");
            parameters.addValue("publishedFrom", publishedFrom);
        }
        if (publishedTo != null) {
            sql.append(" AND ").append(column).append(" < :publishedTo");
            parameters.addValue("publishedTo", publishedTo);
        }
    }

    public enum ScopeType {
        OCCUPATION("occupation_skills", "occupation_id"),
        MAJOR("major_skills", "major_id");

        private final String relationTable;
        private final String scopeColumn;

        ScopeType(String relationTable, String scopeColumn) {
            this.relationTable = relationTable;
            this.scopeColumn = scopeColumn;
        }

        public String relationTable() { return relationTable; }
        public String scopeColumn() { return scopeColumn; }
    }

    public record SkillMetricAggregate(long skillId, long jobCount) {
    }
}

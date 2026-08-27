// 百工谱 — 职业/专业技能时间图谱聚合查询仓储
package com.baigon.occupation.repository.skill.graph;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
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

    public List<SkillAggregate> findSkills(ScopeType scope,
                                           long scopeId,
                                           OffsetDateTime publishedFrom,
                                           OffsetDateTime publishedTo) {
        StringBuilder sql = new StringBuilder("""
                SELECT skill.id AS skill_id,
                       skill.name AS skill_name,
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
                GROUP BY skill.id, skill.name
                ORDER BY job_count DESC, skill.name ASC, skill.id ASC
                """);
        return jdbcTemplate.query(sql.toString(), parameters, (resultSet, rowNum) ->
                new SkillAggregate(
                        resultSet.getLong("skill_id"),
                        resultSet.getString("skill_name"),
                        resultSet.getLong("job_count")));
    }

    public List<JobEvidence> findEvidence(ScopeType scope,
                                          long scopeId,
                                          OffsetDateTime publishedFrom,
                                          OffsetDateTime publishedTo,
                                          int evidenceLimit) {
        StringBuilder sql = new StringBuilder("""
                WITH ranked_evidence AS (
                    SELECT relation.skill_id,
                           job.id AS job_id,
                           job.name AS job_name,
                           job.company_name,
                           job.source_platform,
                           job.source_url,
                           relation.publish_date,
                           ROW_NUMBER() OVER (
                               PARTITION BY relation.skill_id
                               ORDER BY relation.publish_date DESC NULLS LAST, job.id DESC
                           ) AS evidence_rank
                    FROM %s relation
                    JOIN jobs job
                      ON job.id = relation.job_id
                     AND job.deleted_at IS NULL
                     AND job.%s = relation.%s
                    WHERE relation.deleted_at IS NULL
                      AND relation.%s = :scopeId
                """.formatted(
                scope.relationTable(), scope.scopeColumn(), scope.scopeColumn(), scope.scopeColumn()));
        MapSqlParameterSource parameters = parameters(scopeId)
                .addValue("evidenceLimit", evidenceLimit);
        appendTimeline(sql, parameters, "relation.publish_date", publishedFrom, publishedTo);
        sql.append("""
                )
                SELECT skill_id, job_id, job_name, company_name,
                       source_platform, source_url, publish_date
                FROM ranked_evidence
                WHERE evidence_rank <= :evidenceLimit
                ORDER BY skill_id ASC, evidence_rank ASC
                """);
        return jdbcTemplate.query(sql.toString(), parameters, (resultSet, rowNum) ->
                new JobEvidence(
                        resultSet.getLong("skill_id"),
                        resultSet.getLong("job_id"),
                        resultSet.getString("job_name"),
                        resultSet.getString("company_name"),
                        resultSet.getString("source_platform"),
                        resultSet.getString("source_url"),
                        resultSet.getObject("publish_date", OffsetDateTime.class)));
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

    public record SkillAggregate(long skillId, String skillName, long jobCount) {
    }

    public record JobEvidence(long skillId,
                              long jobId,
                              String jobName,
                              String companyName,
                              String sourcePlatform,
                              String sourceUrl,
                              OffsetDateTime publishDate) {
    }
}

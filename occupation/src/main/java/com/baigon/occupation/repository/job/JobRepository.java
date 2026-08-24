// 百工谱 — 已审核岗位数据访问层
package com.baigon.occupation.repository.job;

import com.baigon.occupation.entity.job.Job;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface JobRepository extends JpaRepository<Job, Long> {

    /**
     * jobs 分页筛选。文本字段使用忽略大小写的包含匹配，空字符串表示不筛选。
     * company 参数对应数据库字段 company_name。
     */
    @Query("""
            SELECT job FROM Job job
            WHERE job.deletedAt IS NULL
              AND (:name = '' OR LOWER(COALESCE(job.name, '')) LIKE LOWER(CONCAT('%', :name, '%')))
              AND (:occupationId IS NULL OR job.occupationId = :occupationId)
              AND (:majorId IS NULL OR job.majorId = :majorId)
              AND (:major = '' OR LOWER(COALESCE(job.major, '')) LIKE LOWER(CONCAT('%', :major, '%')))
              AND (:city = '' OR LOWER(COALESCE(job.city, '')) LIKE LOWER(CONCAT('%', :city, '%')))
              AND (:province = '' OR LOWER(COALESCE(job.province, '')) LIKE LOWER(CONCAT('%', :province, '%')))
              AND (:salary = '' OR LOWER(COALESCE(job.salary, '')) LIKE LOWER(CONCAT('%', :salary, '%')))
              AND (:company = '' OR LOWER(COALESCE(job.companyName, '')) LIKE LOWER(CONCAT('%', :company, '%')))
              AND (:education = '' OR LOWER(COALESCE(job.education, '')) LIKE LOWER(CONCAT('%', :education, '%')))
              AND (:nature = '' OR LOWER(COALESCE(job.nature, '')) LIKE LOWER(CONCAT('%', :nature, '%')))
              AND (:companySize = '' OR LOWER(COALESCE(job.companySize, '')) LIKE LOWER(CONCAT('%', :companySize, '%')))
            """)
    Page<Job> search(@Param("name") String name,
                     @Param("occupationId") Long occupationId,
                     @Param("majorId") Long majorId,
                     @Param("major") String major,
                     @Param("city") String city,
                     @Param("province") String province,
                     @Param("salary") String salary,
                     @Param("company") String company,
                     @Param("education") String education,
                     @Param("nature") String nature,
                     @Param("companySize") String companySize,
                     Pageable pageable);

    Optional<Job> findByTraceIdAndDeletedAtIsNull(Long traceId);

    Optional<Job> findByIdAndDeletedAtIsNull(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT job FROM Job job WHERE job.id = :id AND job.deletedAt IS NULL")
    Optional<Job> findByIdForUpdate(@Param("id") Long id);
}

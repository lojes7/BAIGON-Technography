// 百工谱 — 用户简历数据访问层
package com.baigon.occupation.repository.user.resume;

import com.baigon.occupation.entity.user.Resume;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ResumeRepository extends JpaRepository<Resume, Long> {

    Optional<Resume> findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(long userId);

    Optional<Resume> findByIdAndUserIdAndDeletedAtIsNull(long id, long userId);
}

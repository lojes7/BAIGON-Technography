// 百工谱 — 简历实体，映射 resumes 表
package com.baigon.occupation.entity.user;

import com.baigon.occupation.entity.BaseEntity;
import com.baigon.occupation.entity.ReviewStatus;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "resumes")
public class Resume extends BaseEntity {

    @Column(name = "user_id")
    private Long userId;
    @Column(name = "file_key", length = 512)
    private String fileKey;
    @Column(name = "bucket_name", length = 64)
    private String bucketName;
    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;
    @Column(name = "file_size", nullable = false)
    private Long fileSize;
    @Column(columnDefinition = "text")
    private String content;
    @Column(length = 64)
    private String md5;

    // JSONB 字段保持结构化映射，避免业务层自行解析字符串。
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "education_experiences", columnDefinition = "jsonb")
    private JsonNode educationExperiences;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "work_experiences", columnDefinition = "jsonb")
    private JsonNode workExperiences;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "project_experiences", columnDefinition = "jsonb")
    private JsonNode projectExperiences;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "professional_skills", columnDefinition = "jsonb")
    private JsonNode professionalSkills;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private JsonNode awards;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "review_status", nullable = false, columnDefinition = "review_status")
    private ReviewStatus reviewStatus;
    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getFileKey() { return fileKey; }
    public void setFileKey(String fileKey) { this.fileKey = fileKey; }
    public String getBucketName() { return bucketName; }
    public void setBucketName(String bucketName) { this.bucketName = bucketName; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getMd5() { return md5; }
    public void setMd5(String md5) { this.md5 = md5; }
    public JsonNode getEducationExperiences() { return educationExperiences; }
    public void setEducationExperiences(JsonNode value) { this.educationExperiences = value; }
    public JsonNode getWorkExperiences() { return workExperiences; }
    public void setWorkExperiences(JsonNode value) { this.workExperiences = value; }
    public JsonNode getProjectExperiences() { return projectExperiences; }
    public void setProjectExperiences(JsonNode value) { this.projectExperiences = value; }
    public JsonNode getProfessionalSkills() { return professionalSkills; }
    public void setProfessionalSkills(JsonNode value) { this.professionalSkills = value; }
    public JsonNode getAwards() { return awards; }
    public void setAwards(JsonNode awards) { this.awards = awards; }
    public ReviewStatus getReviewStatus() { return reviewStatus; }
    public void setReviewStatus(ReviewStatus reviewStatus) { this.reviewStatus = reviewStatus; }
    public OffsetDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(OffsetDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
}

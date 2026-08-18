// 百工谱 — 与 format.json 一致的简历分析 DTO
package com.baigon.occupation.service.user.resume.analysis;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record ResumeAnalysisResult(
        @JsonProperty("education_experience")
        List<EducationExperience> educationExperience,
        @JsonProperty("work_experience")
        List<WorkExperience> workExperience,
        @JsonProperty("project_experience")
        List<ProjectExperience> projectExperience,
        @JsonProperty("professional_skills")
        List<ProfessionalSkill> professionalSkills,
        @JsonProperty("awards")
        List<Award> awards) {

    public record EducationExperience(
            @JsonProperty("major") String major,
            @JsonProperty("university_name") String universityName,
            @JsonProperty("start_date") String startDate,
            @JsonProperty("end_date") String endDate,
            @JsonProperty("description") String description) {
    }

    public record WorkExperience(
            @JsonProperty("occupation_name") String occupationName,
            @JsonProperty("company") String company,
            @JsonProperty("start_date") String startDate,
            @JsonProperty("end_date") String endDate,
            @JsonProperty("description") String description) {
    }

    public record ProjectExperience(
            @JsonProperty("project_name") String projectName,
            @JsonProperty("start_date") String startDate,
            @JsonProperty("end_date") String endDate,
            @JsonProperty("description") String description) {
    }

    public record ProfessionalSkill(
            @JsonProperty("skill_name") String skillName,
            @JsonProperty("proficiency") String proficiency) {
    }

    public record Award(
            @JsonProperty("award_name") String awardName,
            @JsonProperty("date") String date,
            @JsonProperty("description") String description) {
    }
}

// 百工谱 — 简历 AI JSON 二次校验测试
package com.baigon.occupation.service.user.resume.analysis;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ResumeAnalysisValidatorTest {

    private ResumeAnalysisValidator validator;

    @BeforeEach
    void setUp() {
        validator = new ResumeAnalysisValidator(new ObjectMapper());
    }

    @Test
    void validGroundedJsonShouldPass() {
        String json = completeJson("Advanced", "2022-12-01");
        String content = "2022年12月1日获得优秀员工奖。熟练使用 Java。";

        ResumeAnalysisResult result = validator.parseAndValidate(json, content);

        assertEquals("Advanced", result.professionalSkills().getFirst().proficiency());
        assertEquals("2022-12-01", result.awards().getFirst().date());
        var storedSkills = validator.toJsonArray(result.professionalSkills());
        assertEquals("Java", storedSkills.get(0).get("skill_name").asText());
        assertFalse(storedSkills.get(0).has("skillName"));
    }

    @Test
    void yearAndYearMonthDatesShouldKeepSourcePrecision() {
        ResumeAnalysisResult yearResult = validator.parseAndValidate(
                completeJson("", "2022"),
                "2022 年获得优秀员工奖，技能 Java");
        ResumeAnalysisResult monthResult = validator.parseAndValidate(
                completeJson("", "2022-12"),
                "2022.12 获得优秀员工奖，技能 Java");

        assertEquals("2022", yearResult.awards().getFirst().date());
        assertEquals("2022-12", monthResult.awards().getFirst().date());
    }

    @Test
    void unknownFieldsAndMissingArraysShouldFail() {
        String unknown = completeJson("", "")
                .replace("\"awards\":", "\"summary\":\"generated\",\"awards\":");
        assertThrows(IllegalArgumentException.class,
                () -> validator.parseAndValidate(unknown, "Java 优秀员工奖"));

        assertThrows(IllegalArgumentException.class,
                () -> validator.parseAndValidate("{\"awards\":[]}", "简历正文"));
    }

    @Test
    void wrongScalarTypeAndDuplicateKeysShouldFail() {
        String wrongType = completeJson("", "")
                .replace("\"skill_name\":\"Java\"", "\"skill_name\":123");
        assertThrows(IllegalArgumentException.class,
                () -> validator.parseAndValidate(wrongType, "Java 优秀员工奖"));

        String duplicate = completeJson("", "")
                .replace("\"awards\":", "\"awards\":[],\"awards\":");
        assertThrows(IllegalArgumentException.class,
                () -> validator.parseAndValidate(duplicate, "Java 优秀员工奖"));
    }

    @Test
    void invalidOrUngroundedProficiencyShouldFail() {
        assertThrows(IllegalArgumentException.class,
                () -> validator.parseAndValidate(
                        completeJson("Skilled", ""), "熟练使用 Java"));
        assertThrows(IllegalArgumentException.class,
                () -> validator.parseAndValidate(
                        completeJson("Expert", ""), "技能：Java"));
    }

    @Test
    void generatedTextAndOverPreciseDateShouldFail() {
        assertThrows(IllegalArgumentException.class,
                () -> validator.parseAndValidate(
                        completeJson("", "2022-12-01"),
                        "2022年12月获得优秀员工奖，技能 Java"));
        assertThrows(IllegalArgumentException.class,
                () -> validator.parseAndValidate(
                        completeJson("", "").replace("Java", "Python"),
                        "技能 Java，获得优秀员工奖"));
    }

    @Test
    void descriptionLinesShouldIgnoreLayoutWhitespaceButRejectGeneratedText() {
        String description = """
                基于 Go语言实现的 Web办公助手软件
                主要工作：
                • AI服务设计：集成 qwen3-vl-embedding模型""";
        String content = """
                项目甲
                基于 Go 语言实现的 Web 办公助手软件
                主要工作：
                • AI 服务设计：集成 qwen3-vl-embedding 模型""";

        ResumeAnalysisResult result = validator.parseAndValidate(
                projectDescriptionJson(description), content);

        assertEquals(description, result.projectExperience().getFirst().description());
        assertThrows(IllegalArgumentException.class,
                () -> validator.parseAndValidate(
                        projectDescriptionJson(description + "\n• 虚构功能：自动生成周报"),
                        content));
    }

    @Test
    void emptyArraysAreValid() {
        ResumeAnalysisResult result = validator.parseAndValidate("""
                {
                  "education_experience": [],
                  "work_experience": [],
                  "project_experience": [],
                  "professional_skills": [],
                  "awards": []
                }
                """, "简历正文");

        assertEquals(0, result.professionalSkills().size());
    }

    @Test
    void editedJsonShouldAllowNullableStringsWithoutOcrGrounding() {
        ResumeAnalysisResult result = validator.parseEdited("""
                {
                  "education_experience": [],
                  "work_experience": [],
                  "project_experience": [{
                    "project_name": "人工项目", "start_date": null,
                    "end_date": null, "description": null
                  }],
                  "professional_skills": [{"skill_name":"Rust","proficiency":null}],
                  "awards": []
                }
                """);

        assertEquals("人工项目", result.projectExperience().getFirst().projectName());
        assertEquals(null, result.projectExperience().getFirst().description());
        assertEquals(null, result.professionalSkills().getFirst().proficiency());
        assertEquals("Rust", validator.fromStored(
                validator.emptyArray(), validator.emptyArray(),
                validator.toJsonArray(result.projectExperience()),
                validator.toJsonArray(result.professionalSkills()),
                validator.emptyArray(), null, false)
                .professionalSkills().getFirst().skillName());
    }

    @Test
    void editedJsonShouldStillRejectInvalidProficiency() {
        assertThrows(IllegalArgumentException.class,
                () -> validator.parseEdited(completeJson("Skilled", "")));
    }

    @Test
    void dateRangeShouldRespectUnknownLowerPrecisionParts() {
        ResumeAnalysisResult allowed = validator.parseEdited(
                projectJson("2024-12", "2024"));

        assertEquals("2024", allowed.projectExperience().getFirst().endDate());
        assertThrows(IllegalArgumentException.class,
                () -> validator.parseEdited(projectJson("2025", "2024-12")));
    }

    private String completeJson(String proficiency, String date) {
        return """
                {
                  "education_experience": [],
                  "work_experience": [],
                  "project_experience": [],
                  "professional_skills": [
                    {"skill_name":"Java","proficiency":"%s"}
                  ],
                  "awards": [
                    {"award_name":"优秀员工奖","date":"%s","description":""}
                  ]
                }
                """.formatted(proficiency, date);
    }

    private String projectJson(String startDate, String endDate) {
        return """
                {
                  "education_experience": [],
                  "work_experience": [],
                  "project_experience": [{
                    "project_name":"项目甲",
                    "start_date":"%s",
                    "end_date":"%s",
                    "description":""
                  }],
                  "professional_skills": [],
                  "awards": []
                }
                """.formatted(startDate, endDate);
    }

    private String projectDescriptionJson(String description) {
        String escaped = description
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n");
        return """
                {
                  "education_experience": [],
                  "work_experience": [],
                  "project_experience": [{
                    "project_name":"项目甲",
                    "start_date":"",
                    "end_date":"",
                    "description":"%s"
                  }],
                  "professional_skills": [],
                  "awards": []
                }
                """.formatted(escaped);
    }
}

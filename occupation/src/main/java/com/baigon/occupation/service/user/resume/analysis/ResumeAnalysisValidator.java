// 百工谱 — AI 简历 JSON 的独立格式与原文来源校验
package com.baigon.occupation.service.user.resume.analysis;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.Year;
import java.time.YearMonth;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;

@Component
public class ResumeAnalysisValidator {

    private static final int MAX_ITEMS = 100;
    private static final int MAX_NAME_LENGTH = 200;
    private static final int MAX_DESCRIPTION_LENGTH = 2_000;
    private static final Pattern DATE_PATTERN = Pattern.compile(
            "^\\d{4}(?:-\\d{2}(?:-\\d{2})?)?$");
    private static final Pattern CLAUSE_SEPARATOR = Pattern.compile("[。！？!?；;，,\\r\\n]+");

    private final ObjectMapper objectMapper;
    private final ObjectReader strictReader;

    public ResumeAnalysisValidator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        ObjectMapper strictMapper = JsonMapper.builder(JsonFactory.builder()
                        .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
                        .build())
                .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .disable(MapperFeature.ALLOW_COERCION_OF_SCALARS)
                .build();
        this.strictReader = strictMapper.readerFor(ResumeAnalysisResult.class);
    }

    /** JSON 通过全部格式和来源校验后，才返回可持久化的强类型对象。 */
    public ResumeAnalysisResult parseAndValidate(String json, String content) {
        return parse(json, content, true);
    }

    /** 人工编辑数据不要求能在 OCR 原文中找到，且允许可选字符串显式为 null。 */
    public ResumeAnalysisResult parseEdited(String json) {
        return parse(json, "", false);
    }

    private ResumeAnalysisResult parse(String json, String content, boolean requireGrounding) {
        if (json == null || json.isBlank()) {
            throw new IllegalArgumentException("resume analysis JSON is empty");
        }
        try {
            return validate(
                    strictReader.readValue(json),
                    content == null ? "" : content,
                    requireGrounding);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("invalid resume analysis JSON", exception);
        }
    }

    /** 读取已入库 JSONB 时使用同一契约，旧记录的 null 数组按空数组返回。 */
    public ResumeAnalysisResult fromStored(
            JsonNode education,
            JsonNode work,
            JsonNode project,
            JsonNode skills,
            JsonNode awards,
            String content,
            boolean requireGrounding) {
        ObjectNode root = objectMapper.createObjectNode();
        root.set("education_experience", arrayOrEmpty(education));
        root.set("work_experience", arrayOrEmpty(work));
        root.set("project_experience", arrayOrEmpty(project));
        root.set("professional_skills", arrayOrEmpty(skills));
        root.set("awards", arrayOrEmpty(awards));
        return requireGrounding
                ? parseAndValidate(root.toString(), content)
                : parseEdited(root.toString());
    }

    public JsonNode toJsonArray(List<?> values) {
        return objectMapper.valueToTree(values);
    }

    public ArrayNode emptyArray() {
        return objectMapper.createArrayNode();
    }

    /** 返回字段顺序和命名均与 format.json 一致的规范 JSON。 */
    public String toCanonicalJson(ResumeAnalysisResult result) {
        try {
            return objectMapper.writeValueAsString(result);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("failed to serialize resume fields", exception);
        }
    }

    private ResumeAnalysisResult validate(
            ResumeAnalysisResult result,
            String content,
            boolean requireGrounding) {
        if (result == null) {
            throw new IllegalArgumentException("resume analysis root must be an object");
        }
        List<ResumeAnalysisResult.EducationExperience> education = immutableList(
                "education_experience", result.educationExperience());
        List<ResumeAnalysisResult.WorkExperience> work = immutableList(
                "work_experience", result.workExperience());
        List<ResumeAnalysisResult.ProjectExperience> project = immutableList(
                "project_experience", result.projectExperience());
        List<ResumeAnalysisResult.ProfessionalSkill> skills = immutableList(
                "professional_skills", result.professionalSkills());
        List<ResumeAnalysisResult.Award> awards = immutableList("awards", result.awards());

        education.forEach(item -> {
            requireIdentity("education_experience", item.major(), item.universityName());
            validateText("major", item.major(), MAX_NAME_LENGTH, content, requireGrounding);
            validateText("university_name", item.universityName(), MAX_NAME_LENGTH,
                    content, requireGrounding);
            validateDates(item.startDate(), item.endDate(), content, requireGrounding);
            validateDescription(item.description(), content, requireGrounding);
        });
        work.forEach(item -> {
            requireIdentity("work_experience", item.occupationName(), item.company());
            validateText("occupation_name", item.occupationName(), MAX_NAME_LENGTH,
                    content, requireGrounding);
            validateText("company", item.company(), MAX_NAME_LENGTH, content, requireGrounding);
            validateDates(item.startDate(), item.endDate(), content, requireGrounding);
            validateDescription(item.description(), content, requireGrounding);
        });
        project.forEach(item -> {
            requireIdentity("project_experience", item.projectName());
            validateText("project_name", item.projectName(), MAX_NAME_LENGTH,
                    content, requireGrounding);
            validateDates(item.startDate(), item.endDate(), content, requireGrounding);
            validateDescription(item.description(), content, requireGrounding);
        });
        skills.forEach(item -> validateSkill(item, content, requireGrounding));
        awards.forEach(item -> {
            requireIdentity("awards", item.awardName());
            validateText("award_name", item.awardName(), MAX_NAME_LENGTH,
                    content, requireGrounding);
            validateDate("date", item.date(), content, requireGrounding);
            validateDescription(item.description(), content, requireGrounding);
        });

        rejectDuplicate("education_experience", education, Function.identity());
        rejectDuplicate("work_experience", work, Function.identity());
        rejectDuplicate("project_experience", project, Function.identity());
        rejectDuplicate("awards", awards, Function.identity());
        rejectDuplicate("professional_skills", skills,
                item -> item.skillName().toLowerCase(Locale.ROOT));
        return new ResumeAnalysisResult(education, work, project, skills, awards);
    }

    private void validateSkill(
            ResumeAnalysisResult.ProfessionalSkill skill,
            String content,
            boolean requireGrounding) {
        requireIdentity("professional_skills", skill.skillName());
        validateText("skill_name", skill.skillName(), MAX_NAME_LENGTH, content, requireGrounding);
        requireString("proficiency", skill.proficiency(), MAX_NAME_LENGTH, !requireGrounding);
        if (skill.proficiency() != null && !skill.proficiency().isEmpty()) {
            if (!ResumeProficiency.allows(skill.proficiency())) {
                throw new IllegalArgumentException("invalid resume proficiency");
            }
            if (requireGrounding
                    && !proficiencyGrounded(skill.skillName(), skill.proficiency(), content)) {
                throw new IllegalArgumentException("resume proficiency is not grounded");
            }
        }
    }

    private void validateDates(
            String startDate,
            String endDate,
            String content,
            boolean requireGrounding) {
        validateDate("start_date", startDate, content, requireGrounding);
        validateDate("end_date", endDate, content, requireGrounding);
        if (startDate != null && endDate != null
                && !startDate.isEmpty() && !endDate.isEmpty()
                && lowerDateBound(startDate).isAfter(upperDateBound(endDate))) {
            throw new IllegalArgumentException("start_date is after end_date");
        }
    }

    private void validateDate(
            String field,
            String value,
            String content,
            boolean requireGrounding) {
        requireString(field, value, 10, !requireGrounding);
        if (value == null || value.isEmpty()) {
            return;
        }
        if (!DATE_PATTERN.matcher(value).matches()) {
            throw new IllegalArgumentException(
                    field + " must use YYYY, YYYY-MM, or YYYY-MM-DD");
        }
        try {
            lowerDateBound(value);
        } catch (DateTimeException exception) {
            throw new IllegalArgumentException(field + " is not a calendar date", exception);
        }
        if (requireGrounding && !dateGrounded(value, content)) {
            throw new IllegalArgumentException(field + " is not grounded in resume content");
        }
    }

    private void validateText(
            String field,
            String value,
            int maxLength,
            String content,
            boolean requireGrounding) {
        requireString(field, value, maxLength, !requireGrounding);
        if (requireGrounding && value != null && !value.isEmpty()
                && !normalize(content).contains(normalize(value))) {
            throw new IllegalArgumentException(field + " is not grounded in resume content");
        }
    }

    /** 描述逐行核对并忽略排版空白，避免 PDF 换行或中英文空格导致整段误判。 */
    private void validateDescription(
            String value,
            String content,
            boolean requireGrounding) {
        requireString("description", value, MAX_DESCRIPTION_LENGTH, !requireGrounding);
        if (requireGrounding && value != null && !value.isEmpty()
                && !descriptionGrounded(value, content)) {
            throw new IllegalArgumentException("description is not grounded in resume content");
        }
    }

    private boolean descriptionGrounded(String value, String content) {
        String normalizedContent = normalizeDescription(content);
        return value.lines()
                .map(String::strip)
                .filter(line -> !line.isEmpty())
                .map(this::normalizeDescription)
                .allMatch(normalizedContent::contains);
    }

    private String normalizeDescription(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFKC)
                .replaceAll("\\s+", "");
    }

    private void requireString(String field, String value, int maxLength, boolean allowNull) {
        if (value == null) {
            if (allowNull) {
                return;
            }
            throw new IllegalArgumentException(field + " must not be null");
        }
        if (value.length() > maxLength) {
            throw new IllegalArgumentException(field + " exceeds length limit");
        }
        if (!value.equals(value.strip())) {
            throw new IllegalArgumentException(field + " contains outer whitespace");
        }
    }

    private void requireIdentity(String section, String... values) {
        for (String value : values) {
            if (value != null && !value.isEmpty()) {
                return;
            }
        }
        throw new IllegalArgumentException(section + " contains an empty record");
    }

    private boolean dateGrounded(String value, String content) {
        String normalizedContent = normalize(content);
        String[] parts = value.split("-");
        int year = Integer.parseInt(parts[0]);
        Pattern sourceDate;
        if (parts.length == 1) {
            sourceDate = Pattern.compile("(?<!\\d)" + year + "(?!\\d)");
        } else if (parts.length == 2) {
            int month = Integer.parseInt(parts[1]);
            sourceDate = Pattern.compile(
                    "(?<!\\d)" + year
                            + "\\s*(?:年|[-/.])\\s*0?" + month
                            + "\\s*月?(?!\\d)");
        } else {
            int month = Integer.parseInt(parts[1]);
            int day = Integer.parseInt(parts[2]);
            sourceDate = Pattern.compile(
                    "(?<!\\d)" + year
                            + "\\s*(?:年|[-/.])\\s*0?" + month
                            + "\\s*(?:月|[-/.])\\s*0?" + day
                            + "\\s*日?(?!\\d)");
        }
        return sourceDate.matcher(normalizedContent).find();
    }

    /** 返回当前日期精度可能覆盖的最早日期。 */
    private LocalDate lowerDateBound(String value) {
        String[] parts = value.split("-");
        int year = parseYear(parts[0]);
        if (parts.length == 1) {
            return Year.of(year).atDay(1);
        }
        int month = Integer.parseInt(parts[1]);
        if (parts.length == 2) {
            return YearMonth.of(year, month).atDay(1);
        }
        return LocalDate.of(year, month, Integer.parseInt(parts[2]));
    }

    /** 返回当前日期精度可能覆盖的最晚日期。 */
    private LocalDate upperDateBound(String value) {
        String[] parts = value.split("-");
        int year = parseYear(parts[0]);
        if (parts.length == 1) {
            return Year.of(year).atMonth(12).atEndOfMonth();
        }
        int month = Integer.parseInt(parts[1]);
        if (parts.length == 2) {
            return YearMonth.of(year, month).atEndOfMonth();
        }
        return LocalDate.of(year, month, Integer.parseInt(parts[2]));
    }

    private int parseYear(String value) {
        int year = Integer.parseInt(value);
        if (year < 1) {
            throw new DateTimeException("year must be greater than zero");
        }
        return year;
    }

    private boolean proficiencyGrounded(String skillName, String proficiency, String content) {
        String normalizedSkill = normalize(skillName).toLowerCase(Locale.ROOT);
        List<String> terms = switch (proficiency) {
            case "Basic" -> List.of("basic", "了解", "基础");
            case "Familiar" -> List.of("familiar", "熟悉", "使用经验", "有经验");
            case "Advanced" -> List.of("advanced", "熟练", "擅长", "丰富实践经验");
            case "Expert" -> List.of("expert", "精通", "专家级", "专家");
            default -> List.of();
        };
        for (String rawClause : CLAUSE_SEPARATOR.split(
                Normalizer.normalize(content, Normalizer.Form.NFKC))) {
            String clause = normalize(rawClause).toLowerCase(Locale.ROOT);
            if (clause.contains(normalizedSkill)
                    && terms.stream().anyMatch(clause::contains)) {
                return true;
            }
        }
        return false;
    }

    private String normalize(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFKC)
                .replaceAll("\\s+", " ")
                .strip();
    }

    private <T> List<T> immutableList(String field, List<T> values) {
        if (values == null) {
            throw new IllegalArgumentException(field + " must be an array");
        }
        if (values.size() > MAX_ITEMS || values.stream().anyMatch(item -> item == null)) {
            throw new IllegalArgumentException(field + " contains invalid items");
        }
        return List.copyOf(values);
    }

    private <T, K> void rejectDuplicate(String field, List<T> values, Function<T, K> keyMapper) {
        Set<K> keys = new HashSet<>();
        for (T value : values) {
            if (!keys.add(keyMapper.apply(value))) {
                throw new IllegalArgumentException(field + " contains duplicate items");
            }
        }
    }

    private JsonNode arrayOrEmpty(JsonNode value) {
        return value == null || value.isNull() ? objectMapper.createArrayNode() : value;
    }
}

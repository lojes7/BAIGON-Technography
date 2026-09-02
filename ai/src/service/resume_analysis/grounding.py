"""对模型结果执行确定性的简历原文来源校验。"""

from copy import deepcopy
import re
import unicodedata

from src.service.resume_analysis.models import ResumeAnalysisResult

TEXT_FIELDS = {
    "education_experience": ("major", "university_name", "description"),
    "work_experience": ("occupation_name", "company", "description"),
    "project_experience": ("project_name", "description"),
    "professional_skills": ("skill_name",),
    "awards": ("award_name", "description"),
}
DATE_FIELDS = {
    "education_experience": ("start_date", "end_date"),
    "work_experience": ("start_date", "end_date"),
    "project_experience": ("start_date", "end_date"),
    "awards": ("date",),
}
IDENTITY_FIELDS = {
    "education_experience": ("major", "university_name"),
    "work_experience": ("occupation_name", "company"),
    "project_experience": ("project_name",),
    "professional_skills": ("skill_name",),
    "awards": ("award_name",),
}
PROFICIENCY_TERMS = {
    "Basic": ("basic", "了解", "基础"),
    "Familiar": ("familiar", "熟悉", "使用经验", "有经验"),
    "Advanced": ("advanced", "熟练", "擅长", "丰富实践经验"),
    "Expert": ("expert", "精通", "专家级", "专家"),
}
CLAUSE_SEPARATOR = re.compile(r"[。！？!?；;，,\r\n]+")


def normalize_for_match(value: str) -> str:
    """只归一化 Unicode 等价形式和空白，不做语义替换。"""
    normalized = unicodedata.normalize("NFKC", value)
    return re.sub(r"\s+", " ", normalized).strip()


def text_is_grounded(value: str, content: str) -> bool:
    """非空文本必须是归一化后仍连续存在的原文片段。"""
    normalized_value = normalize_for_match(value)
    return not normalized_value or normalized_value in normalize_for_match(content)


def normalize_layout_for_match(value: str) -> str:
    """来源匹配忽略 PDF/OCR 排版空白，但不忽略任何实际文本字符。"""
    normalized = unicodedata.normalize("NFKC", value)
    return re.sub(r"\s+", "", normalized)


def layout_text_is_grounded(value: str, content: str) -> bool:
    """允许原文和模型结果仅在排版空白上存在差异。"""
    normalized_value = normalize_layout_for_match(value)
    return not normalized_value or normalized_value in normalize_layout_for_match(content)


def ground_description(value: str, content: str) -> str:
    """逐行保留能在原文中找到的描述，避免一处排版差异清空整段。"""
    normalized_content = normalize_layout_for_match(content)
    grounded_lines: list[str] = []
    for raw_line in value.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        normalized_line = normalize_layout_for_match(line)
        if normalized_line and normalized_line in normalized_content:
            grounded_lines.append(line)
    return "\n".join(grounded_lines)


def date_is_grounded(value: str, content: str) -> bool:
    """按年、年月或完整日期精度检查标准化结果是否来自原文。"""
    if not value:
        return True
    normalized_content = normalize_for_match(content)
    parts = [int(part) for part in value.split("-")]
    year = parts[0]
    if len(parts) == 1:
        pattern = re.compile(rf"(?<!\d){year}(?!\d)")
    elif len(parts) == 2:
        month = parts[1]
        pattern = re.compile(
            rf"(?<!\d){year}\s*(?:年|[-/.])\s*0?{month}\s*月?(?!\d)"
        )
    else:
        month, day = parts[1], parts[2]
        pattern = re.compile(
            rf"(?<!\d){year}\s*(?:年|[-/.])\s*0?{month}"
            rf"\s*(?:月|[-/.])\s*0?{day}\s*日?(?!\d)"
        )
    return pattern.search(normalized_content) is not None


def proficiency_is_grounded(
    skill_name: str,
    proficiency: str,
    content: str,
) -> bool:
    """熟练度必须与技能共同出现在同一原文分句中。"""
    if not proficiency:
        return True
    normalized_skill = normalize_for_match(skill_name).casefold()
    if not normalized_skill:
        return False
    expected_terms = PROFICIENCY_TERMS[proficiency]
    normalized_content = unicodedata.normalize("NFKC", content)
    for raw_clause in CLAUSE_SEPARATOR.split(normalized_content):
        clause = normalize_for_match(raw_clause).casefold()
        if normalized_skill in clause and any(term.casefold() in clause for term in expected_terms):
            return True
    return False


def ground_resume_analysis(
    analysis: ResumeAnalysisResult,
    content: str,
) -> ResumeAnalysisResult:
    """清空无来源字段、移除无身份记录，并再次执行完整模型校验。"""
    cleaned = deepcopy(analysis.model_dump())

    for section_name, records in cleaned.items():
        grounded_records: list[dict] = []
        seen: set[tuple] = set()
        for record in records:
            for field_name in TEXT_FIELDS[section_name]:
                if field_name == "description" and record[field_name]:
                    record[field_name] = ground_description(record[field_name], content)
                elif record[field_name] and not text_is_grounded(record[field_name], content):
                    record[field_name] = ""
            for field_name in DATE_FIELDS.get(section_name, ()):
                if record[field_name] and not date_is_grounded(record[field_name], content):
                    record[field_name] = ""

            if section_name == "professional_skills":
                if record["proficiency"] and not proficiency_is_grounded(
                    record["skill_name"], record["proficiency"], content
                ):
                    record["proficiency"] = ""

            if not any(record[field] for field in IDENTITY_FIELDS[section_name]):
                continue

            # 来源清洗后再次去重，避免两个模型结果收敛为同一条记录。
            key = tuple(record.values())
            if section_name == "professional_skills":
                key = (record["skill_name"].casefold(),)
            if key in seen:
                continue
            seen.add(key)
            grounded_records.append(record)
        cleaned[section_name] = grounded_records

    return ResumeAnalysisResult.model_validate(cleaned)

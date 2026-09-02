"""简历结构化结果的严格数据契约。"""

from calendar import monthrange
from datetime import date
import re
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    model_validator,
)

MAX_RESUME_CONTENT_LENGTH = 50_000
MAX_RESUME_ITEMS = 100
MAX_NAME_LENGTH = 200
MAX_DESCRIPTION_LENGTH = 2_000

DATE_PATTERN = re.compile(r"^\d{4}(?:-\d{2}(?:-\d{2})?)?$")
MODEL_DATE_PATTERN = re.compile(
    r"^(\d{4})(?:[./-](\d{2})(?:[./-](\d{2}))?)?$"
)
ResumeProficiency = Literal["", "Basic", "Familiar", "Advanced", "Expert"]


def normalize_model_date_value(value: object) -> object:
    """保留模型返回的日期精度，仅把常见分隔符规范化为连字符。"""
    if not isinstance(value, str):
        return value
    stripped = value.strip()
    if stripped == "":
        return stripped
    match = MODEL_DATE_PATTERN.fullmatch(stripped)
    if match is None:
        return stripped
    parts = (match.group(1), match.group(2), match.group(3))
    return "-".join(part for part in parts if part)


def validate_date_value(value: str) -> str:
    """日期允许为空、年、年月或完整 ISO 日期，并校验日历合法性。"""
    if value == "":
        return value
    if not DATE_PATTERN.fullmatch(value):
        raise ValueError("日期必须为空或使用 YYYY、YYYY-MM、YYYY-MM-DD")
    try:
        parts = [int(part) for part in value.split("-")]
        year = parts[0]
        if len(parts) == 1:
            date(year, 1, 1)
        elif len(parts) == 2:
            date(year, parts[1], 1)
        else:
            date(year, parts[1], parts[2])
    except ValueError as exception:
        raise ValueError("日期不是合法日历日期") from exception
    return value


DateValue = Annotated[
    str,
    BeforeValidator(normalize_model_date_value),
    Field(max_length=10),
    AfterValidator(validate_date_value),
]


class ResumeModel(BaseModel):
    """所有简历对象都拒绝额外字段并去除首尾空白。"""

    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True)


def date_bounds(value: str) -> tuple[date, date]:
    """把不同精度日期转换为其可能覆盖的最早和最晚日期。"""
    parts = [int(part) for part in value.split("-")]
    year = parts[0]
    if len(parts) == 1:
        return date(year, 1, 1), date(year, 12, 31)
    month = parts[1]
    if len(parts) == 2:
        return date(year, month, 1), date(year, month, monthrange(year, month)[1])
    exact = date(year, month, parts[2])
    return exact, exact


def validate_date_range(start_date: str, end_date: str) -> None:
    """只有开始日期确定晚于结束日期的最大可能值时才拒绝。"""
    if start_date and end_date and date_bounds(start_date)[0] > date_bounds(end_date)[1]:
        raise ValueError("start_date 不能晚于 end_date")


class EducationExperience(ResumeModel):
    major: str = Field(max_length=MAX_NAME_LENGTH)
    university_name: str = Field(max_length=MAX_NAME_LENGTH)
    start_date: DateValue
    end_date: DateValue
    description: str = Field(max_length=MAX_DESCRIPTION_LENGTH)

    @model_validator(mode="after")
    def validate_dates(self) -> "EducationExperience":
        validate_date_range(self.start_date, self.end_date)
        return self


class WorkExperience(ResumeModel):
    occupation_name: str = Field(max_length=MAX_NAME_LENGTH)
    company: str = Field(max_length=MAX_NAME_LENGTH)
    start_date: DateValue
    end_date: DateValue
    description: str = Field(max_length=MAX_DESCRIPTION_LENGTH)

    @model_validator(mode="after")
    def validate_dates(self) -> "WorkExperience":
        validate_date_range(self.start_date, self.end_date)
        return self


class ProjectExperience(ResumeModel):
    project_name: str = Field(max_length=MAX_NAME_LENGTH)
    start_date: DateValue
    end_date: DateValue
    description: str = Field(max_length=MAX_DESCRIPTION_LENGTH)

    @model_validator(mode="after")
    def validate_dates(self) -> "ProjectExperience":
        validate_date_range(self.start_date, self.end_date)
        return self


class ProfessionalSkill(ResumeModel):
    skill_name: str = Field(max_length=MAX_NAME_LENGTH)
    proficiency: ResumeProficiency


class Award(ResumeModel):
    award_name: str = Field(max_length=MAX_NAME_LENGTH)
    date: DateValue
    description: str = Field(max_length=MAX_DESCRIPTION_LENGTH)


class ResumeAnalysisResult(ResumeModel):
    """与根目录 format.json 完全一致的五数组结果。"""

    education_experience: list[EducationExperience] = Field(
        max_length=MAX_RESUME_ITEMS
    )
    work_experience: list[WorkExperience] = Field(max_length=MAX_RESUME_ITEMS)
    project_experience: list[ProjectExperience] = Field(max_length=MAX_RESUME_ITEMS)
    professional_skills: list[ProfessionalSkill] = Field(max_length=MAX_RESUME_ITEMS)
    awards: list[Award] = Field(max_length=MAX_RESUME_ITEMS)

    @model_validator(mode="after")
    def validate_duplicates(self) -> "ResumeAnalysisResult":
        """拒绝重复经历和重复技能，避免把模型噪声写入数据库。"""
        for field_name in (
            "education_experience",
            "work_experience",
            "project_experience",
            "awards",
        ):
            items = getattr(self, field_name)
            keys = [tuple(item.model_dump().values()) for item in items]
            if len(keys) != len(set(keys)):
                raise ValueError(f"{field_name} 不能包含重复记录")

        skill_names = [item.skill_name.casefold() for item in self.professional_skills]
        if len(skill_names) != len(set(skill_names)):
            raise ValueError("professional_skills 不能包含重复技能")
        return self

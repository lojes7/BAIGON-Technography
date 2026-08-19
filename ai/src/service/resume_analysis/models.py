"""简历结构化结果的严格数据契约。"""

from datetime import date
import re
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

MAX_RESUME_CONTENT_LENGTH = 50_000
MAX_RESUME_ITEMS = 100
MAX_NAME_LENGTH = 200
MAX_DESCRIPTION_LENGTH = 2_000

DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ResumeProficiency = Literal["", "Basic", "Familiar", "Advanced", "Expert"]


def validate_date_value(value: str) -> str:
    """日期只能为空，或为真实存在的完整 ISO 日期。"""
    if value == "":
        return value
    if not DATE_PATTERN.fullmatch(value):
        raise ValueError("日期必须为空或使用 YYYY-MM-DD")
    try:
        date.fromisoformat(value)
    except ValueError as exception:
        raise ValueError("日期不是合法日历日期") from exception
    return value


DateValue = Annotated[
    str,
    Field(max_length=10),
    AfterValidator(validate_date_value),
]


class ResumeModel(BaseModel):
    """所有简历对象都拒绝额外字段并去除首尾空白。"""

    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True)


def validate_date_range(start_date: str, end_date: str) -> None:
    """仅在两个日期都存在时检查先后关系。"""
    if start_date and end_date and start_date > end_date:
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

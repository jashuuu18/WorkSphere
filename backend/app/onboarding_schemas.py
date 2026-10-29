
from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import OnboardingStatus


class OnboardingCreate(BaseModel):
    employee_id: int = Field(gt=0)
    task_name: str = Field(min_length=2, max_length=200)
    due_date: date

    @field_validator("task_name")
    @classmethod
    def validate_task_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Task name must contain at least 2 characters")
        return value


class OnboardingResponse(BaseModel):
    id: int
    employee_id: int
    task_name: str
    status: OnboardingStatus
    due_date: date

    model_config = ConfigDict(from_attributes=True)


class OnboardingProgress(BaseModel):
    employee_id: int
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    progress_percentage: float

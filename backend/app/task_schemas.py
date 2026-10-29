
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import TaskStatus


class TaskCreate(BaseModel):
    assigned_to: int = Field(gt=0)
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=10000)
    due_date: date

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Task title must contain at least 3 characters")
        return value

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        return value.strip()


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


class TaskResponse(BaseModel):
    id: int
    assigned_to: int
    title: str
    description: str
    due_date: date
    status: TaskStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

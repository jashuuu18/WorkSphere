
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class FeedbackCreate(BaseModel):
    message: str = Field(min_length=5, max_length=5000)
    rating: int = Field(ge=1, le=5)

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 5:
            raise ValueError("Feedback must contain at least 5 characters.")
        return value


class FeedbackResponse(BaseModel):
    id: int
    employee_id: int
    message: str
    rating: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

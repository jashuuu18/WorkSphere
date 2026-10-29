
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=5, max_length=10000)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Title must contain at least 3 characters")
        return value

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 5:
            raise ValueError("Message must contain at least 5 characters")
        return value


class AnnouncementResponse(BaseModel):
    id: int
    title: str
    message: str
    created_by: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

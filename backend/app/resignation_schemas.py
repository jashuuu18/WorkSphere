
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import ResignationStatus


class ResignationCreate(BaseModel):
    reason: str = Field(min_length=5, max_length=5000)
    notice_period: int = Field(ge=0, le=365)

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 5:
            raise ValueError("Reason must contain at least 5 characters")
        return value


class ResignationDecision(BaseModel):
    status: Literal["APPROVED", "REJECTED"]


class ResignationResponse(BaseModel):
    id: int
    employee_id: int
    reason: str
    notice_period: int
    status: ResignationStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

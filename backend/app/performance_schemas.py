
from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class PerformanceReviewCreate(BaseModel):
    employee_id: int = Field(gt=0)
    rating: float = Field(ge=1, le=5)
    strengths: str = Field(min_length=1, max_length=5000)
    areas_for_improvement: str = Field(min_length=1, max_length=5000)
    feedback: str = Field(min_length=1, max_length=5000)
    review_period: str = Field(min_length=1, max_length=50)
    review_date: date | None = None


class PerformanceReviewUpdate(BaseModel):
    rating: float | None = Field(default=None, ge=1, le=5)
    strengths: str | None = Field(default=None, min_length=1, max_length=5000)
    areas_for_improvement: str | None = Field(
        default=None, min_length=1, max_length=5000
    )
    feedback: str | None = Field(default=None, min_length=1, max_length=5000)
    review_period: str | None = Field(default=None, min_length=1, max_length=50)
    review_date: date | None = None


class PerformanceReviewResponse(BaseModel):
    id: int
    employee_id: int
    reviewer_id: int
    rating: float
    strengths: str
    areas_for_improvement: str
    feedback: str
    review_period: str
    review_date: date

    model_config = ConfigDict(from_attributes=True)

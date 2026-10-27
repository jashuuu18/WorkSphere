
from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ShiftCreate(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    start_time: time
    end_time: time

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Shift name must contain at least 2 characters")
        return value

    @model_validator(mode="after")
    def validate_shift_times(self):
        if self.start_time == self.end_time:
            raise ValueError(
                "Start and end times cannot be identical. "
                "For a 24-hour shift, a different duration rule is needed."
            )
        return self


class ShiftResponse(BaseModel):
    id: int
    name: str
    start_time: time
    end_time: time

    model_config = ConfigDict(from_attributes=True)


class EmployeeShiftAssign(BaseModel):
    employee_id: int = Field(gt=0)
    shift_id: int = Field(gt=0)


class EmployeeShiftResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    department: str
    shift_id: int
    shift_name: str
    start_time: time
    end_time: time
    assigned_at: datetime
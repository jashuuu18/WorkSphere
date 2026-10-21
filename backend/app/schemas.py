
from datetime import date, datetime
from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)
from typing import Literal
from app.models import EmployeeStatus, LeaveStatus, LeaveType


# ---------------- AUTHENTICATION SCHEMAS ----------------

class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------------- EMPLOYEE SCHEMAS ----------------

class EmployeeCreate(BaseModel):
    user_id: int = Field(gt=0)
    full_name: str = Field(min_length=2, max_length=150)
    designation: str = Field(min_length=2, max_length=100)
    department: str = Field(min_length=2, max_length=100)
    joining_date: date
    salary: float = Field(ge=0, le=1_000_000_000)
    status: EmployeeStatus = EmployeeStatus.ACTIVE

    @field_validator("full_name", "designation", "department")
    @classmethod
    def clean_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be empty")
        return value


class EmployeeUpdate(BaseModel):
    full_name: str | None = Field(
        default=None, min_length=2, max_length=150
    )
    designation: str | None = Field(
        default=None, min_length=2, max_length=100
    )
    department: str | None = Field(
        default=None, min_length=2, max_length=100
    )
    joining_date: date | None = None
    salary: float | None = Field(
        default=None, ge=0, le=1_000_000_000
    )
    status: EmployeeStatus | None = None

    @field_validator("full_name", "designation", "department")
    @classmethod
    def clean_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return value

        value = value.strip()
        if not value:
            raise ValueError("This field cannot be empty")
        return value

    @model_validator(mode="after")
    def require_update_field(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update")

        if any(
            getattr(self, field) is None
            for field in self.model_fields_set
        ):
            raise ValueError("Update fields cannot be null")

        return self


class EmployeeResponse(BaseModel):
    id: int
    user_id: int
    full_name: str
    designation: str
    department: str
    joining_date: date
    salary: float
    status: EmployeeStatus

    model_config = ConfigDict(from_attributes=True)


# ---------------- ATTENDANCE SCHEMAS ----------------

from datetime import date as attendance_date, datetime
from pydantic import ConfigDict, model_validator


class AttendanceResponse(BaseModel):
    id: int
    employee_id: int
    check_in: datetime | None
    check_out: datetime | None
    date: attendance_date
    status: str

    model_config = ConfigDict(from_attributes=True)


# ---------------- LEAVE MANAGEMENT SCHEMAS ----------------

class LeaveCreate(BaseModel):
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: str = Field(min_length=3, max_length=1000)

    @field_validator("reason")
    @classmethod
    def clean_reason(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Reason must contain at least 3 characters")
        return value

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date > self.end_date:
            raise ValueError("Start date cannot be after end date")
        return self


class LeaveDecision(BaseModel):
    decision: Literal["APPROVED", "REJECTED"]


class LeaveResponse(BaseModel):
    id: int
    employee_id: int
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: str
    status: LeaveStatus

    model_config = ConfigDict(from_attributes=True)

# ---------------- PAYROLL MANAGEMENT SCHEMAS ----------------

class PayrollCreate(BaseModel):
    employee_id: int = Field(gt=0)
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    deductions: float = Field(default=0, ge=0, le=1_000_000_000)
    bonus: float = Field(default=0, ge=0, le=1_000_000_000)


class PayrollResponse(BaseModel):
    id: int
    employee_id: int
    basic_salary: float
    deductions: float
    bonus: float
    net_salary: float
    month: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)



# ---------------- NOTIFICATION SCHEMAS ----------------

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UnreadNotificationCount(BaseModel):
    unread_count: int

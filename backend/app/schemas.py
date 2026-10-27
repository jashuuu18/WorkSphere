
from datetime import date, datetime, time
from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)
from typing import Literal
from app.models import EmployeeStatus, LeaveStatus, LeaveType, UserRole


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
    is_active: bool
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
    check_in: datetime | None = None
    check_out: datetime | None = None
    date: attendance_date
    status: str
    is_late: bool = False
    late_minutes: int = 0
    worked_minutes: int | None = None
    overtime_minutes: int = 0
    is_early_checkout: bool = False
    early_checkout_minutes: int = 0
    shift_name: str | None = None
    shift_start_time: time | None = None
    shift_end_time: time | None = None

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



# ---------------- LEAVE POLICY & BALANCE SCHEMAS ----------------

class LeavePolicyCreate(BaseModel):
    leave_type: LeaveType
    total_days_allowed: int = Field(ge=0, le=365)


class LeavePolicyResponse(BaseModel):
    id: int
    leave_type: LeaveType
    total_days_allowed: int

    model_config = ConfigDict(from_attributes=True)


class LeaveBalanceResponse(BaseModel):
    id: int
    employee_id: int
    leave_type: LeaveType
    remaining_days: int

    model_config = ConfigDict(from_attributes=True)


# ---------------- PAYROLL ENHANCEMENT SCHEMAS ----------------

class PayrollSummaryResponse(BaseModel):
    month: str | None = None
    employee_count: int
    total_basic_salary: float
    total_bonus: float
    total_deductions: float
    total_net_salary: float


class PayslipResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    designation: str
    department: str
    month: str
    basic_salary: float
    bonus: float
    deductions: float
    net_salary: float
    created_at: datetime


# ---------------- ADMIN USER MANAGEMENT SCHEMAS ----------------

class AdminUserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.EMPLOYEE
    is_active: bool = True

    @field_validator("username")
    @classmethod
    def clean_username(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Username must contain at least 3 characters")
        return value


class AdminUserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=50)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role: UserRole | None = None
    is_active: bool | None = None

    @field_validator("username")
    @classmethod
    def clean_username(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Username must contain at least 3 characters")
        return value

    @model_validator(mode="after")
    def validate_update(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update")

        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")

        return self

#----------------- SHIFT MANAGEMENT SCHEMAS ----------------
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

#----------------- DOCUMENT MANAGEMENT SCHEMAS ----------------
class DocumentResponse(BaseModel):
    id: int
    employee_id: int
    file_name: str = Field(max_length=255)
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentUploadResponse(BaseModel):
    message: str
    document: DocumentResponse

#----------------- PERFORMANCE REVIEW SCHEMAS ----------------
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

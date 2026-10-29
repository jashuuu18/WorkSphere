
from datetime import date, datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


# ---------------- ENUMS ----------------

class UserRole(str, PyEnum):
    EMPLOYEE = "EMPLOYEE"
    HR = "HR"
    ADMIN = "ADMIN"


class EmployeeStatus(str, PyEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class LeaveType(str, PyEnum):
    SICK = "SICK"
    CASUAL = "CASUAL"
    PAID = "PAID"


class LeaveStatus(str, PyEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class AttendanceStatus(str, PyEnum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    HALF_DAY = "HALF_DAY"


class OnboardingStatus(str, PyEnum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"


class ResignationStatus(str, PyEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class TaskStatus(str, PyEnum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"

# ---------------- USER MODEL ----------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    role = Column(
        Enum(UserRole, name="user_role"),
        nullable=False,
        default=UserRole.EMPLOYEE,
    )

    #  Admin account activation control
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    employee = relationship(
        "Employee",
        back_populates="user",
        uselist=False,
    )

    notifications = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
    )


# ---------------- EMPLOYEE MODEL ----------------

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
    )

    full_name = Column(String(150), nullable=False)
    designation = Column(String(100), nullable=False)
    department = Column(String(100), nullable=False)
    joining_date = Column(Date, nullable=False)
    salary = Column(Float, nullable=False, default=0)

    status = Column(
        Enum(EmployeeStatus, name="employee_status"),
        default=EmployeeStatus.ACTIVE,
        nullable=False,
    )

    user = relationship("User", back_populates="employee")

    attendance_records = relationship(
        "Attendance",
        back_populates="employee",
        cascade="all, delete-orphan",
    )

    leaves = relationship(
        "Leave",
        back_populates="employee",
        cascade="all, delete-orphan",
    )

    payroll_records = relationship(
        "Payroll",
        back_populates="employee",
        cascade="all, delete-orphan",
    )


# ---------------- ATTENDANCE MODEL ----------------

class Attendance(Base):
    __tablename__ = "attendance"

    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "date",
            name="uq_attendance_employee_date",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
    )

    check_in = Column(DateTime, nullable=True)
    check_out = Column(DateTime, nullable=True)
    date = Column(Date, nullable=False)

    status = Column(
        Enum(AttendanceStatus, name="attendance_status"),
        default=AttendanceStatus.PRESENT,
        nullable=False,
    )

    employee = relationship(
        "Employee",
        back_populates="attendance_records",
    )


# ---------------- LEAVE MODEL ----------------

class Leave(Base):
    __tablename__ = "leaves"

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
    )

    leave_type = Column(
        Enum(LeaveType, name="leave_type"),
        nullable=False,
    )

    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=False)

    status = Column(
        Enum(LeaveStatus, name="leave_status"),
        default=LeaveStatus.PENDING,
        nullable=False,
    )

    employee = relationship("Employee", back_populates="leaves")


# ---------------- PAYROLL MODEL ----------------

class Payroll(Base):
    __tablename__ = "payroll"

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
    )

    basic_salary = Column(Float, nullable=False)
    deductions = Column(Float, nullable=False, default=0)
    bonus = Column(Float, nullable=False, default=0)
    net_salary = Column(Float, nullable=False)
    month = Column(String(7), nullable=False)

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    employee = relationship(
        "Employee",
        back_populates="payroll_records",
    )


# ---------------- NOTIFICATION MODEL ----------------

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    user = relationship("User", back_populates="notifications")


# ---------------- LEAVE POLICIES ----------------

class LeavePolicy(Base):
    __tablename__ = "leave_policies"

    id = Column(Integer, primary_key=True, index=True)

    leave_type = Column(
        Enum(LeaveType, name="leave_type"),
        unique=True,
        nullable=False,
    )

    total_days_allowed = Column(
        Integer,
        nullable=False,
        default=0,
    )


# ---------------- LEAVE BALANCES ----------------

class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
    )

    leave_type = Column(
        Enum(LeaveType, name="leave_type"),
        nullable=False,
    )

    remaining_days = Column(
        Integer,
        nullable=False,
        default=0,
    )


# ---------------- SHIFT MANAGEMENT ----------------

class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)


class EmployeeShift(Base):
    __tablename__ = "employee_shifts"

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        unique=True,
        nullable=False,
        index=True,
    )

    shift_id = Column(
        Integer,
        ForeignKey("shifts.id"),
        nullable=False,
        index=True,
    )

    assigned_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
#---------------- DOCUMENT MODEL ----------------

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    file_name = Column(String(255), nullable=False)

    # Internal generated filename; never expose this as a public file URL.
    file_url = Column(String(500), nullable=False, unique=True)

    uploaded_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

#---------------- PERFORMANCE REVIEW MODEL ----------------

class PerformanceReview(Base):
    __tablename__ = "performance_reviews"

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    reviewer_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    rating = Column(Float, nullable=False)

    strengths = Column(Text, nullable=False)
    areas_for_improvement = Column(Text, nullable=False)
    feedback = Column(Text, nullable=False)

    review_period = Column(String(50), nullable=False)
    review_date = Column(Date, default=date.today, nullable=False)

#---------------- ONBOARDING MODEL ----------------
class Onboarding(Base):
    __tablename__ = "onboarding"

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    task_name = Column(String(200), nullable=False)

    status = Column(
        Enum(OnboardingStatus, name="onboarding_status"),
        nullable=False,
        default=OnboardingStatus.PENDING,
    )

    due_date = Column(Date, nullable=False)

#---------------- RESIGNATION MODEL ----------------
class Resignation(Base):
    __tablename__ = "resignations"

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    reason = Column(String(5000), nullable=False)

    # Notice period measured in days.
    notice_period = Column(Integer, nullable=False)

    status = Column(
        Enum(ResignationStatus, name="resignation_status"),
        nullable=False,
        default=ResignationStatus.PENDING,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

#---------------- ANNOUNCEMENT MODEL ----------------
class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String(200), nullable=False)

    message = Column(String(10000), nullable=False)

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

#---------------- TASK MODEL ----------------

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)

    assigned_to = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    title = Column(String(200), nullable=False)

    description = Column(Text, nullable=False, default="")

    due_date = Column(Date, nullable=False)

    status = Column(
        Enum(TaskStatus, name="task_status"),
        nullable=False,
        default=TaskStatus.PENDING,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

#---------------- FEEDBACK MODEL ----------------

class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )
    message = Column(Text, nullable=False)
    rating = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

#---------------- NOTIFICATION PREFERENCES MODEL ----------------

class UserNotificationPreference(Base):
    __tablename__ = "user_notification_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
        index=True,
    )
    email_notifications = Column(Boolean, nullable=False, default=True)
    in_app_notifications = Column(Boolean, nullable=False, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

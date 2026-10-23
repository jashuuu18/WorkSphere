
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

    # Module 13: Admin account activation control
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


from calendar import monthrange
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    Attendance,
    AttendanceStatus,
    Employee,
    EmployeeStatus,
    Leave,
    LeaveStatus,
    Payroll,
    User,
    UserRole,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Analytics"])


def get_employee(db: Session, user_id: int) -> Employee:
    employee = db.query(Employee).filter(
        Employee.user_id == user_id
    ).first()

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Your employee profile has not been created yet",
        )

    return employee


def month_boundaries():
    today = date.today()
    first_day = today.replace(day=1)
    last_day = today.replace(day=monthrange(today.year, today.month)[1])
    return today, first_day, last_day


# Organization-wide dashboard for HR and Admin.
@router.get("/summary")
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    today, first_day, last_day = month_boundaries()
    month_label = today.strftime("%Y-%m")

    total_employees = db.query(func.count(Employee.id)).scalar() or 0

    active_employees = db.query(func.count(Employee.id)).filter(
        Employee.status == EmployeeStatus.ACTIVE
    ).scalar() or 0

    inactive_employees = db.query(func.count(Employee.id)).filter(
        Employee.status == EmployeeStatus.INACTIVE
    ).scalar() or 0

    present_today = db.query(func.count(Attendance.id)).filter(
        Attendance.date == today,
        Attendance.status == AttendanceStatus.PRESENT,
    ).scalar() or 0

    absent_today = db.query(func.count(Attendance.id)).filter(
        Attendance.date == today,
        Attendance.status == AttendanceStatus.ABSENT,
    ).scalar() or 0

    half_day_today = db.query(func.count(Attendance.id)).filter(
        Attendance.date == today,
        Attendance.status == AttendanceStatus.HALF_DAY,
    ).scalar() or 0

    pending_leaves = db.query(func.count(Leave.id)).filter(
        Leave.status == LeaveStatus.PENDING
    ).scalar() or 0

    approved_leaves = db.query(func.count(Leave.id)).filter(
        Leave.status == LeaveStatus.APPROVED,
        Leave.start_date <= last_day,
        Leave.end_date >= first_day,
    ).scalar() or 0

    rejected_leaves = db.query(func.count(Leave.id)).filter(
        Leave.status == LeaveStatus.REJECTED
    ).scalar() or 0

    payroll_result = db.query(
        func.count(Payroll.id),
        func.coalesce(func.sum(Payroll.net_salary), 0),
    ).filter(
        Payroll.month == month_label
    ).first()

    payroll_records = payroll_result[0] or 0
    payroll_total = float(payroll_result[1] or 0)

    return {
        "period": {
            "date": today.isoformat(),
            "month": month_label,
        },
        "employees": {
            "total": total_employees,
            "active": active_employees,
            "inactive": inactive_employees,
        },
        "attendance_today": {
            "present": present_today,
            "absent": absent_today,
            "half_day": half_day_today,
            "recorded": present_today + absent_today + half_day_today,
        },
        "leaves": {
            "pending_requests": pending_leaves,
            "approved_overlapping_this_month": approved_leaves,
            "rejected_requests": rejected_leaves,
        },
        "payroll_this_month": {
            "month": month_label,
            "records": payroll_records,
            "net_salary_total": round(payroll_total, 2),
        },
    }


# Personal dashboard: employees see only their own data.
@router.get("/me")
def my_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_employee(db, current_user.id)
    today, first_day, last_day = month_boundaries()

    attendance_this_month = db.query(
        func.count(Attendance.id)
    ).filter(
        Attendance.employee_id == employee.id,
        Attendance.date >= first_day,
        Attendance.date <= last_day,
    ).scalar() or 0

    present_this_month = db.query(
        func.count(Attendance.id)
    ).filter(
        Attendance.employee_id == employee.id,
        Attendance.date >= first_day,
        Attendance.date <= last_day,
        Attendance.status == AttendanceStatus.PRESENT,
    ).scalar() or 0

    pending_leaves = db.query(func.count(Leave.id)).filter(
        Leave.employee_id == employee.id,
        Leave.status == LeaveStatus.PENDING,
    ).scalar() or 0

    approved_leaves = db.query(func.count(Leave.id)).filter(
        Leave.employee_id == employee.id,
        Leave.status == LeaveStatus.APPROVED,
    ).scalar() or 0

    latest_payroll = db.query(Payroll).filter(
        Payroll.employee_id == employee.id
    ).order_by(
        Payroll.month.desc(),
        Payroll.id.desc(),
    ).first()

    today_attendance = db.query(Attendance).filter(
        Attendance.employee_id == employee.id,
        Attendance.date == today,
    ).first()

    return {
        "employee": {
            "id": employee.id,
            "full_name": employee.full_name,
            "designation": employee.designation,
            "department": employee.department,
            "status": employee.status.value,
        },
        "period": {
            "date": today.isoformat(),
            "month": today.strftime("%Y-%m"),
        },
        "attendance_this_month": {
            "total_records": attendance_this_month,
            "present_days": present_this_month,
        },
        "leaves": {
            "pending_requests": pending_leaves,
            "approved_requests": approved_leaves,
        },
        "today_attendance": (
            {
                "check_in": (
                    today_attendance.check_in.isoformat()
                    if today_attendance and today_attendance.check_in
                    else None
                ),
                "check_out": (
                    today_attendance.check_out.isoformat()
                    if today_attendance and today_attendance.check_out
                    else None
                ),
                "status": (
                    today_attendance.status.value
                    if today_attendance
                    else None
                ),
            }
        ),
        "latest_payroll": (
            {
                "month": latest_payroll.month,
                "basic_salary": latest_payroll.basic_salary,
                "bonus": latest_payroll.bonus,
                "deductions": latest_payroll.deductions,
                "net_salary": latest_payroll.net_salary,
            }
            if latest_payroll
            else None
        ),
    }

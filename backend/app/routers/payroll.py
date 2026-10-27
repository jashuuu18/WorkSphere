
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Employee, Payroll, User, UserRole
from app.notifications import create_notification
from app.schemas import (
    PayrollCreate,
    PayrollResponse,
    PayrollSummaryResponse,
    PayslipResponse,
)

router = APIRouter(prefix="/payroll", tags=["Payroll Management"])


def money(value: float) -> float:
    """Round monetary values to two decimal places."""
    return float(
        Decimal(str(value)).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
    )


# --------------------------------------------------
# CREATE PAYROLL — HR / ADMIN
# --------------------------------------------------

@router.post(
    "/",
    response_model=PayrollResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_payroll(
    payroll_data: PayrollCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    employee = (
        db.query(Employee)
        .filter(Employee.id == payroll_data.employee_id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    existing_payroll = (
        db.query(Payroll)
        .filter(
            Payroll.employee_id == payroll_data.employee_id,
            Payroll.month == payroll_data.month,
        )
        .first()
    )

    if existing_payroll:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payroll already exists for this employee and month",
        )

    basic_salary = money(employee.salary)
    deductions = money(payroll_data.deductions)
    bonus = money(payroll_data.bonus)

    net_salary = money(basic_salary + bonus - deductions)

    if net_salary < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Deductions cannot exceed basic salary plus bonus",
        )

    payroll = Payroll(
        employee_id=employee.id,
        basic_salary=basic_salary,
        deductions=deductions,
        bonus=bonus,
        net_salary=net_salary,
        month=payroll_data.month,
    )

    try:
        db.add(payroll)

        # Save the payroll record in the current transaction.
        db.flush()

        # Add the notification for the employee who owns
        # this payroll record.
        create_notification(
            db=db,
            user_id=employee.user_id,
            title="Payroll Processed",
            message=(
                f"Your payroll for {payroll.month} has been processed. "
                f"Net salary: {net_salary:.2f}."
            ),
        )

        # Commit payroll and notification together.
        db.commit()
        db.refresh(payroll)

        return payroll

    except Exception:
        db.rollback()
        raise


# --------------------------------------------------
# MY PAYROLL HISTORY — AUTHENTICATED EMPLOYEE
# --------------------------------------------------

@router.get(
    "/me",
    response_model=list[PayrollResponse],
)
def my_payroll(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == current_user.id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Your employee profile has not been created yet",
        )

    return (
        db.query(Payroll)
        .filter(Payroll.employee_id == employee.id)
        .order_by(Payroll.month.desc(), Payroll.id.desc())
        .all()
    )


# --------------------------------------------------
# MONTHLY PAYROLL SUMMARY — HR / ADMIN
# --------------------------------------------------

@router.get(
    "/summary",
    response_model=PayrollSummaryResponse,
)
def payroll_summary(
    month: str | None = Query(
        default=None,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    query = db.query(
        func.count(func.distinct(Payroll.employee_id)),
        func.coalesce(func.sum(Payroll.basic_salary), 0),
        func.coalesce(func.sum(Payroll.bonus), 0),
        func.coalesce(func.sum(Payroll.deductions), 0),
        func.coalesce(func.sum(Payroll.net_salary), 0),
    )

    if month is not None:
        query = query.filter(Payroll.month == month)

    result = query.one()

    return {
        "month": month,
        "employee_count": result[0],
        "total_basic_salary": money(result[1]),
        "total_bonus": money(result[2]),
        "total_deductions": money(result[3]),
        "total_net_salary": money(result[4]),
    }


# --------------------------------------------------
# DETAILED PAYSLIP — EMPLOYEE / HR / ADMIN
# --------------------------------------------------

@router.get(
    "/{payroll_id}/payslip",
    response_model=PayslipResponse,
)
def get_payslip(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payroll = (
        db.query(Payroll)
        .filter(Payroll.id == payroll_id)
        .first()
    )

    if payroll is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payroll record not found",
        )

    employee = (
        db.query(Employee)
        .filter(Employee.id == payroll.employee_id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    # Employees can access only their own payslips.
    if current_user.role not in (UserRole.HR, UserRole.ADMIN):
        if employee.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own payslip",
            )

    return {
        "id": payroll.id,
        "employee_id": employee.id,
        "employee_name": employee.full_name,
        "designation": employee.designation,
        "department": employee.department,
        "month": payroll.month,
        "basic_salary": payroll.basic_salary,
        "bonus": payroll.bonus,
        "deductions": payroll.deductions,
        "net_salary": payroll.net_salary,
        "created_at": payroll.created_at,
    }


# --------------------------------------------------
# LIST PAYROLL — HR / ADMIN
# --------------------------------------------------

@router.get(
    "/",
    response_model=list[PayrollResponse],
)
def list_payroll(
    employee_id: int | None = Query(default=None, gt=0),
    month: str | None = Query(
        default=None,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
    ),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    query = db.query(Payroll)

    if employee_id is not None:
        query = query.filter(Payroll.employee_id == employee_id)

    if month is not None:
        query = query.filter(Payroll.month == month)

    return (
        query.order_by(Payroll.month.desc(), Payroll.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

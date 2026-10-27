
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    Employee,
    EmployeeStatus,
    Leave,
    LeaveBalance,
    LeavePolicy,
    LeaveStatus,
    LeaveType,
    User,
    UserRole,
)
from app.schemas import LeaveCreate, LeaveDecision, LeaveResponse
from app.notifications import create_notification


router = APIRouter(
    prefix="/leaves",
    tags=["Leave Management"],
)


def get_employee_for_user(db: Session, user_id: int) -> Employee:
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == user_id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Your employee profile has not been created yet",
        )

    return employee


def find_overlapping_leave(
    db: Session,
    employee_id: int,
    start_date: date,
    end_date: date,
    exclude_leave_id: int | None = None,
):
    """
    Find a pending or approved request for the same employee
    that overlaps the supplied inclusive date range.
    """

    query = db.query(Leave).filter(
        Leave.employee_id == employee_id,
        Leave.status.in_(
            [LeaveStatus.PENDING, LeaveStatus.APPROVED]
        ),
        Leave.start_date <= end_date,
        Leave.end_date >= start_date,
    )

    if exclude_leave_id is not None:
        query = query.filter(Leave.id != exclude_leave_id)

    return query.order_by(Leave.start_date).first()


def find_department_leave_overlaps(
    db: Session,
    start_date: date,
    end_date: date,
    department: str | None = None,
):
    """
    Return approved leave pairs that overlap in date and department.
    Each pair is returned only once.
    """

    first_employee = Employee.__table__.alias("first_employee")
    second_employee = Employee.__table__.alias("second_employee")
    first_leave = Leave.__table__.alias("first_leave")
    second_leave = Leave.__table__.alias("second_leave")

    query = (
        db.query(
            first_leave.c.id.label("first_leave_id"),
            first_leave.c.employee_id.label("first_employee_id"),
            first_leave.c.start_date.label("first_start_date"),
            first_leave.c.end_date.label("first_end_date"),
            second_leave.c.id.label("second_leave_id"),
            second_leave.c.employee_id.label("second_employee_id"),
            second_leave.c.start_date.label("second_start_date"),
            second_leave.c.end_date.label("second_end_date"),
            first_employee.c.full_name.label("first_employee_name"),
            second_employee.c.full_name.label("second_employee_name"),
            first_employee.c.department.label("department"),
        )
        .select_from(
            first_leave.join(
                first_employee,
                first_employee.c.id == first_leave.c.employee_id,
            )
            .join(
                second_leave,
                second_leave.c.id > first_leave.c.id,
            )
            .join(
                second_employee,
                second_employee.c.id == second_leave.c.employee_id,
            )
        )
        .filter(
            first_leave.c.status == LeaveStatus.APPROVED,
            second_leave.c.status == LeaveStatus.APPROVED,
            first_leave.c.employee_id != second_leave.c.employee_id,
            first_employee.c.department == second_employee.c.department,
            first_leave.c.start_date <= second_leave.c.end_date,
            second_leave.c.start_date <= first_leave.c.end_date,
            first_leave.c.start_date <= end_date,
            first_leave.c.end_date >= start_date,
            second_leave.c.start_date <= end_date,
            second_leave.c.end_date >= start_date,
        )
    )

    if department:
        query = query.filter(
            first_employee.c.department == department
        )

    rows = query.order_by(
        first_employee.c.department,
        first_leave.c.start_date,
    ).all()

    return [
        {
            "department": row.department,
            "first_leave_id": row.first_leave_id,
            "first_employee_id": row.first_employee_id,
            "first_employee_name": row.first_employee_name,
            "first_start_date": row.first_start_date,
            "first_end_date": row.first_end_date,
            "second_leave_id": row.second_leave_id,
            "second_employee_id": row.second_employee_id,
            "second_employee_name": row.second_employee_name,
            "second_start_date": row.second_start_date,
            "second_end_date": row.second_end_date,
            "warning": (
                f"{row.first_employee_name} and "
                f"{row.second_employee_name} have overlapping "
                f"approved leave in {row.department or 'an unspecified department'}."
            ),
        }
        for row in rows
    ]


# Employees apply for leave.
@router.post(
    "/",
    response_model=LeaveResponse,
    status_code=status.HTTP_201_CREATED,
)
def apply_for_leave(
    leave_data: LeaveCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_employee_for_user(db, current_user.id)

    if leave_data.start_date > leave_data.end_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Leave end date must not be before start date",
        )

    conflict = find_overlapping_leave(
        db=db,
        employee_id=employee.id,
        start_date=leave_data.start_date,
        end_date=leave_data.end_date,
    )

    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Your requested dates overlap leave request "
                f"#{conflict.id} ({conflict.start_date} to "
                f"{conflict.end_date}, status: {conflict.status.value}). "
                "Choose dates that do not overlap pending or approved leave."
            ),
        )

    leave = Leave(
        employee_id=employee.id,
        leave_type=leave_data.leave_type,
        start_date=leave_data.start_date,
        end_date=leave_data.end_date,
        reason=leave_data.reason,
        status=LeaveStatus.PENDING,
    )

    try:
        db.add(leave)
        db.commit()
        db.refresh(leave)
        return leave
    except Exception:
        db.rollback()
        raise


# Employees view their own leave requests.
@router.get(
    "/me",
    response_model=list[LeaveResponse],
)
def my_leave_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_employee_for_user(db, current_user.id)

    return (
        db.query(Leave)
        .filter(Leave.employee_id == employee.id)
        .order_by(Leave.id.desc())
        .all()
    )


# HR and Admin view and filter leave requests.
@router.get(
    "/",
    response_model=list[LeaveResponse],
)
def list_leave_requests(
    employee_id: int | None = Query(default=None, gt=0),
    leave_status: LeaveStatus | None = Query(
        default=None,
        alias="status",
    ),
    leave_type: LeaveType | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start_date cannot be after end_date",
        )

    query = db.query(Leave)

    if employee_id is not None:
        query = query.filter(Leave.employee_id == employee_id)

    if leave_status is not None:
        query = query.filter(Leave.status == leave_status)

    if leave_type is not None:
        query = query.filter(Leave.leave_type == leave_type)

    if start_date is not None:
        query = query.filter(Leave.start_date >= start_date)

    if end_date is not None:
        query = query.filter(Leave.end_date <= end_date)

    return (
        query.order_by(Leave.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# HR/Admin approve or reject pending leave requests.
@router.patch(
    "/{leave_id}/decision",
    response_model=LeaveResponse,
)
def decide_leave_request(
    leave_id: int,
    decision_data: LeaveDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    leave = db.query(Leave).filter(Leave.id == leave_id).first()

    if leave is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found",
        )

    if leave.employee.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot approve or reject your own leave request",
        )

    if leave.status != LeaveStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This leave request has already been decided",
        )

    try:
        if decision_data.decision == "APPROVED":
            # Recheck overlapping requests when approving.
            conflict = find_overlapping_leave(
                db=db,
                employee_id=leave.employee_id,
                start_date=leave.start_date,
                end_date=leave.end_date,
                exclude_leave_id=leave.id,
            )

            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Cannot approve this request because it overlaps "
                        f"leave request #{conflict.id} "
                        f"({conflict.start_date} to {conflict.end_date}, "
                        f"status: {conflict.status.value})."
                    ),
                )

            requested_days = (leave.end_date - leave.start_date).days + 1

            if requested_days <= 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Leave end date must not be before start date",
                )

            policy = (
                db.query(LeavePolicy)
                .filter(LeavePolicy.leave_type == leave.leave_type)
                .first()
            )

            if policy is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "No leave policy has been configured for "
                        f"{leave.leave_type.value} leave"
                    ),
                )

            balance = (
                db.query(LeaveBalance)
                .filter(
                    LeaveBalance.employee_id == leave.employee_id,
                    LeaveBalance.leave_type == leave.leave_type,
                )
                .with_for_update()
                .first()
            )

            if balance is None:
                balance = LeaveBalance(
                    employee_id=leave.employee_id,
                    leave_type=leave.leave_type,
                    remaining_days=policy.total_days_allowed,
                )
                db.add(balance)
                db.flush()

            if balance.remaining_days < requested_days:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Insufficient {leave.leave_type.value.lower()} "
                        f"leave balance. Available: {balance.remaining_days} "
                        f"days; requested: {requested_days} days."
                    ),
                )

            balance.remaining_days -= requested_days
            leave.status = LeaveStatus.APPROVED

        else:
            leave.status = LeaveStatus.REJECTED

        create_notification(
            db=db,
            user_id=leave.employee.user_id,
            title=f"Leave {leave.status.value.lower()}",
            message=(
                f"Your {leave.leave_type.value.lower()} leave request "
                f"from {leave.start_date} to {leave.end_date} "
                f"has been {leave.status.value.lower()}."
            ),
        )

        db.commit()
        db.refresh(leave)
        return leave

    except Exception:
        db.rollback()
        raise


@router.get("/calendar", tags=["Leave Calendar"])
def get_leave_calendar(
    start_date: date = Query(..., description="Calendar start date"),
    end_date: date = Query(..., description="Calendar end date"),
    department: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return approved leave entries overlapping a date range."""

    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start_date cannot be after end_date",
        )

    query = (
        db.query(Leave, Employee)
        .join(Employee, Employee.id == Leave.employee_id)
        .filter(
            Leave.status == LeaveStatus.APPROVED,
            Leave.start_date <= end_date,
            Leave.end_date >= start_date,
        )
    )

    if department:
        query = query.filter(Employee.department == department)

    rows = query.order_by(Leave.start_date, Employee.full_name).all()

    return [
        {
            "leave_id": leave.id,
            "employee_id": employee.id,
            "employee_name": employee.full_name,
            "department": employee.department,
            "leave_type": (
                leave.leave_type.value
                if hasattr(leave.leave_type, "value")
                else str(leave.leave_type)
            ),
            "start_date": leave.start_date,
            "end_date": leave.end_date,
            "status": (
                leave.status.value
                if hasattr(leave.status, "value")
                else str(leave.status)
            ),
        }
        for leave, employee in rows
    ]


@router.get("/team-availability", tags=["Leave Calendar"])
def get_team_availability(
    target_date: date = Query(..., description="Date to check"),
    department: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Show active employees who are available or on approved leave."""

    employee_query = db.query(Employee).filter(
        Employee.status == EmployeeStatus.ACTIVE
    )

    if department:
        employee_query = employee_query.filter(
            Employee.department == department
        )

    employees = employee_query.order_by(Employee.full_name).all()
    results = []

    for employee in employees:
        leave = (
            db.query(Leave)
            .filter(
                Leave.employee_id == employee.id,
                Leave.status == LeaveStatus.APPROVED,
                Leave.start_date <= target_date,
                Leave.end_date >= target_date,
            )
            .first()
        )

        results.append(
            {
                "employee_id": employee.id,
                "employee_name": employee.full_name,
                "department": employee.department,
                "available": leave is None,
                "leave_type": (
                    leave.leave_type.value
                    if leave and hasattr(leave.leave_type, "value")
                    else str(leave.leave_type) if leave else None
                ),
                "leave_start_date": leave.start_date if leave else None,
                "leave_end_date": leave.end_date if leave else None,
            }
        )

    return {
        "date": target_date,
        "total_employees": len(results),
        "available_count": sum(1 for item in results if item["available"]),
        "on_leave_count": sum(1 for item in results if not item["available"]),
        "employees": results,
    }


@router.get(
    "/team-overlap-warnings",
    tags=["Leave Calendar"],
)
def get_team_overlap_warnings(
    start_date: date = Query(..., description="Range start date"),
    end_date: date = Query(..., description="Range end date"),
    department: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    """
    HR/Admin-only report of different employees in the same
    department with overlapping approved leave.
    """

    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start_date cannot be after end_date",
        )

    warnings = find_department_leave_overlaps(
        db=db,
        start_date=start_date,
        end_date=end_date,
        department=department,
    )

    return {
        "start_date": start_date,
        "end_date": end_date,
        "department": department,
        "warning_count": len(warnings),
        "warnings": warnings,
    }


from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    Employee,
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


# HR and Admin approve or reject pending leave requests.
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
    leave = (
        db.query(Leave)
        .filter(Leave.id == leave_id)
        .first()
    )

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
            # Count calendar days, including both start and end dates.
            requested_days = (
                leave.end_date - leave.start_date
            ).days + 1

            if requested_days <= 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Leave end date must not be before start date",
                )

            # Find the policy for this leave type.
            policy = (
                db.query(LeavePolicy)
                .filter(
                    LeavePolicy.leave_type == leave.leave_type
                )
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

            # Find this employee's balance.
            balance = (
                db.query(LeaveBalance)
                .filter(
                    LeaveBalance.employee_id == leave.employee_id,
                    LeaveBalance.leave_type == leave.leave_type,
                )
                .with_for_update()
                .first()
            )

            # Initialize the balance if it does not exist yet.
            if balance is None:
                balance = LeaveBalance(
                    employee_id=leave.employee_id,
                    leave_type=leave.leave_type,
                    remaining_days=policy.total_days_allowed,
                )
                db.add(balance)
                db.flush()

            # Do not approve requests that exceed the balance.
            if balance.remaining_days < requested_days:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Insufficient {leave.leave_type.value.lower()} "
                        f"leave balance. Available: "
                        f"{balance.remaining_days} days; requested: "
                        f"{requested_days} days."
                    ),
                )

            # Deduct days only when approval is possible.
            balance.remaining_days -= requested_days
            leave.status = LeaveStatus.APPROVED

        else:
            # Rejected requests do not deduct leave days.
            leave.status = LeaveStatus.REJECTED

        # Notify the employee of the decision.
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

        # Save the balance, leave decision, and notification together.
        db.commit()
        db.refresh(leave)

        return leave

    except Exception:
        db.rollback()
        raise


from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    Employee,
    LeaveBalance,
    LeavePolicy,
    LeaveType,
    User,
    UserRole,
)
from app.schemas import (
    LeaveBalanceResponse,
    LeavePolicyCreate,
    LeavePolicyResponse,
)

router = APIRouter(
    prefix="/leave-policies",
    tags=["Leave Policies & Balances"],
)


# View all configured leave policies.
@router.get(
    "/",
    response_model=list[LeavePolicyResponse],
)
def list_leave_policies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(LeavePolicy).order_by(LeavePolicy.id).all()


# HR/Admin create or update a policy.
@router.put(
    "/{leave_type}",
    response_model=LeavePolicyResponse,
)
def save_leave_policy(
    leave_type: LeaveType,
    policy_data: LeavePolicyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    if policy_data.leave_type != leave_type:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Path leave_type must match the request body",
        )

    try:
        policy = (
            db.query(LeavePolicy)
            .filter(LeavePolicy.leave_type == leave_type)
            .first()
        )

        if policy is None:
            policy = LeavePolicy(
                leave_type=leave_type,
                total_days_allowed=policy_data.total_days_allowed,
            )
            db.add(policy)
            db.flush()
        else:
            policy.total_days_allowed = policy_data.total_days_allowed

        # Create balances only when they do not already exist.
        # Existing balances are never reset by a policy update.
        employees = db.query(Employee).all()

        for employee in employees:
            balance = (
                db.query(LeaveBalance)
                .filter(
                    LeaveBalance.employee_id == employee.id,
                    LeaveBalance.leave_type == leave_type,
                )
                .first()
            )

            if balance is None:
                db.add(
                    LeaveBalance(
                        employee_id=employee.id,
                        leave_type=leave_type,
                        remaining_days=policy_data.total_days_allowed,
                    )
                )

        db.commit()
        db.refresh(policy)
        return policy

    except Exception:
        db.rollback()
        raise


# Employees view their own leave balances.
@router.get(
    "/balances/me",
    response_model=list[LeaveBalanceResponse],
)
def my_leave_balances(
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

    policies = db.query(LeavePolicy).all()

    try:
        for policy in policies:
            balance = (
                db.query(LeaveBalance)
                .filter(
                    LeaveBalance.employee_id == employee.id,
                    LeaveBalance.leave_type == policy.leave_type,
                )
                .first()
            )

            if balance is None:
                db.add(
                    LeaveBalance(
                        employee_id=employee.id,
                        leave_type=policy.leave_type,
                        remaining_days=policy.total_days_allowed,
                    )
                )

        db.commit()

    except Exception:
        db.rollback()
        raise

    return (
        db.query(LeaveBalance)
        .filter(LeaveBalance.employee_id == employee.id)
        .order_by(LeaveBalance.id)
        .all()
    )


# HR/Admin can view an employee's leave balances.
@router.get(
    "/balances/{employee_id}",
    response_model=list[LeaveBalanceResponse],
)
def employee_leave_balances(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    employee = (
        db.query(Employee)
        .filter(Employee.id == employee_id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    return (
        db.query(LeaveBalance)
        .filter(LeaveBalance.employee_id == employee_id)
        .order_by(LeaveBalance.id)
        .all()
    )

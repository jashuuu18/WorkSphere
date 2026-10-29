
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    Employee,
    Onboarding,
    OnboardingStatus,
    User,
    UserRole,
)
from app.onboarding_schemas import (
    OnboardingCreate,
    OnboardingProgress,
    OnboardingResponse,
)

router = APIRouter(prefix="/onboarding", tags=["Employee Onboarding"])


def get_employee_for_user(db: Session, user_id: int) -> Employee:
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == user_id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )

    return employee


@router.post(
    "/",
    response_model=OnboardingResponse,
    status_code=status.HTTP_201_CREATED,
)
def assign_onboarding_task(
    data: OnboardingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    employee = (
        db.query(Employee)
        .filter(Employee.id == data.employee_id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    task = Onboarding(
        employee_id=data.employee_id,
        task_name=data.task_name,
        due_date=data.due_date,
        status=OnboardingStatus.PENDING,
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    return task


@router.get("/me", response_model=list[OnboardingResponse])
def get_my_onboarding(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_employee_for_user(db, current_user.id)

    return (
        db.query(Onboarding)
        .filter(Onboarding.employee_id == employee.id)
        .order_by(Onboarding.due_date.asc(), Onboarding.id.asc())
        .all()
    )


@router.get("/progress/{employee_id}", response_model=OnboardingProgress)
def get_onboarding_progress(
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

    tasks = (
        db.query(Onboarding)
        .filter(Onboarding.employee_id == employee_id)
        .all()
    )

    total = len(tasks)
    completed = sum(
        task.status == OnboardingStatus.COMPLETED
        for task in tasks
    )
    pending = total - completed
    percentage = round((completed / total) * 100, 2) if total else 0.0

    return OnboardingProgress(
        employee_id=employee_id,
        total_tasks=total,
        completed_tasks=completed,
        pending_tasks=pending,
        progress_percentage=percentage,
    )


@router.get("/", response_model=list[OnboardingResponse])
def list_onboarding_tasks(
    employee_id: int | None = Query(default=None, gt=0),
    task_status: OnboardingStatus | None = Query(
        default=None,
        alias="status",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    query = db.query(Onboarding)

    if employee_id is not None:
        query = query.filter(Onboarding.employee_id == employee_id)

    if task_status is not None:
        query = query.filter(Onboarding.status == task_status)

    return query.order_by(
        Onboarding.due_date.asc(),
        Onboarding.id.asc(),
    ).all()


@router.patch(
    "/{task_id}/complete",
    response_model=OnboardingResponse,
)
def complete_onboarding_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = (
        db.query(Onboarding)
        .filter(Onboarding.id == task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onboarding task not found",
        )

    # Employees can complete only tasks assigned to themselves.
    if current_user.role == UserRole.EMPLOYEE:
        employee = get_employee_for_user(db, current_user.id)

        if task.employee_id != employee.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only complete your own onboarding tasks",
            )

    if task.status == OnboardingStatus.COMPLETED:
        return task

    task.status = OnboardingStatus.COMPLETED
    db.commit()
    db.refresh(task)

    return task

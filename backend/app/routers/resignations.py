
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    Employee,
    Resignation,
    ResignationStatus,
    User,
    UserRole,
)
from app.resignation_schemas import (
    ResignationCreate,
    ResignationDecision,
    ResignationResponse,
)

router = APIRouter(
    prefix="/resignations",
    tags=["Resignation & Exit Management"],
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
            detail="Employee profile not found",
        )

    return employee


@router.post(
    "/",
    response_model=ResignationResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_resignation(
    data: ResignationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.EMPLOYEE)
    ),
):
    employee = get_employee_for_user(db, current_user.id)

    # Prevent multiple simultaneous pending resignation requests.
    existing_pending = (
        db.query(Resignation)
        .filter(
            Resignation.employee_id == employee.id,
            Resignation.status == ResignationStatus.PENDING,
        )
        .first()
    )

    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending resignation request",
        )

    resignation = Resignation(
        employee_id=employee.id,
        reason=data.reason,
        notice_period=data.notice_period,
        status=ResignationStatus.PENDING,
    )

    db.add(resignation)
    db.commit()
    db.refresh(resignation)

    return resignation


@router.get(
    "/me",
    response_model=list[ResignationResponse],
)
def get_my_resignations(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.EMPLOYEE)
    ),
):
    employee = get_employee_for_user(db, current_user.id)

    return (
        db.query(Resignation)
        .filter(Resignation.employee_id == employee.id)
        .order_by(Resignation.created_at.desc())
        .all()
    )


@router.get(
    "/",
    response_model=list[ResignationResponse],
)
def list_resignations(
    request_status: ResignationStatus | None = Query(
        default=None,
        alias="status",
    ),
    employee_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    query = db.query(Resignation)

    if request_status is not None:
        query = query.filter(Resignation.status == request_status)

    if employee_id is not None:
        query = query.filter(Resignation.employee_id == employee_id)

    return query.order_by(Resignation.created_at.desc()).all()


@router.patch(
    "/{resignation_id}/decision",
    response_model=ResignationResponse,
)
def decide_resignation(
    resignation_id: int,
    decision: ResignationDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    resignation = (
        db.query(Resignation)
        .filter(Resignation.id == resignation_id)
        .first()
    )

    if resignation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resignation request not found",
        )

    if resignation.status != ResignationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This resignation request has already been decided",
        )

    resignation.status = ResignationStatus(decision.status)

    db.commit()
    db.refresh(resignation)

    return resignation

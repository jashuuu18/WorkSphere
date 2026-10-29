
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.feedback_schemas import FeedbackCreate, FeedbackResponse
from app.models import Employee, Feedback, UserRole

router = APIRouter(
    prefix="/feedback",
    tags=["Employee Feedback"],
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
            detail="Employee profile not found.",
        )

    return employee


@router.post(
    "/",
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_feedback(
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    employee = get_employee_for_user(db, current_user.id)

    feedback = Feedback(
        employee_id=employee.id,
        message=payload.message,
        rating=payload.rating,
    )

    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    return feedback


@router.get(
    "/me",
    response_model=list[FeedbackResponse],
)
def get_my_feedback(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    employee = get_employee_for_user(db, current_user.id)

    return (
        db.query(Feedback)
        .filter(Feedback.employee_id == employee.id)
        .order_by(Feedback.created_at.desc())
        .all()
    )


@router.get(
    "/",
    response_model=list[FeedbackResponse],
)
def get_all_feedback(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    return (
        db.query(Feedback)
        .order_by(Feedback.created_at.desc())
        .all()
    )

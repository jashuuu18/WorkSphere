
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Employee, PerformanceReview, User, UserRole
from app.performance_schemas import (
    PerformanceReviewCreate,
    PerformanceReviewResponse,
    PerformanceReviewUpdate,
)

router = APIRouter(
    prefix="/performance-reviews",
    tags=["Performance Management"],
)


def get_review_or_404(db: Session, review_id: int) -> PerformanceReview:
    review = (
        db.query(PerformanceReview)
        .filter(PerformanceReview.id == review_id)
        .first()
    )

    if review is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Performance review not found",
        )

    return review


def check_review_access(
    db: Session,
    review: PerformanceReview,
    current_user: User,
):
    if current_user.role in (UserRole.HR, UserRole.ADMIN):
        return

    employee = (
        db.query(Employee)
        .filter(Employee.user_id == current_user.id)
        .first()
    )

    if employee is None or employee.id != review.employee_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to access this performance review",
        )


@router.post(
    "/",
    response_model=PerformanceReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_performance_review(
    review_data: PerformanceReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    employee = (
        db.query(Employee)
        .filter(Employee.id == review_data.employee_id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    review_date = review_data.review_date or date.today()

    if review_date > date.today():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Review date cannot be in the future",
        )

    review = PerformanceReview(
        employee_id=review_data.employee_id,
        reviewer_id=current_user.id,
        rating=review_data.rating,
        strengths=review_data.strengths.strip(),
        areas_for_improvement=review_data.areas_for_improvement.strip(),
        feedback=review_data.feedback.strip(),
        review_period=review_data.review_period.strip(),
        review_date=review_date,
    )

    if not all(
        [
            review.strengths,
            review.areas_for_improvement,
            review.feedback,
            review.review_period,
        ]
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Review text fields cannot be blank",
        )

    db.add(review)
    db.commit()
    db.refresh(review)

    return review


@router.get(
    "/me",
    response_model=list[PerformanceReviewResponse],
)
def get_my_performance_reviews(
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
        db.query(PerformanceReview)
        .filter(PerformanceReview.employee_id == employee.id)
        .order_by(PerformanceReview.review_date.desc())
        .all()
    )


@router.get(
    "/",
    response_model=list[PerformanceReviewResponse],
)
def list_performance_reviews(
    employee_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    query = db.query(PerformanceReview)

    if employee_id is not None:
        query = query.filter(
            PerformanceReview.employee_id == employee_id
        )

    return query.order_by(
        PerformanceReview.review_date.desc()
    ).all()


@router.get(
    "/{review_id}",
    response_model=PerformanceReviewResponse,
)
def get_performance_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = get_review_or_404(db, review_id)
    check_review_access(db, review, current_user)
    return review


@router.patch(
    "/{review_id}",
    response_model=PerformanceReviewResponse,
)
def update_performance_review(
    review_id: int,
    review_data: PerformanceReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    review = get_review_or_404(db, review_id)

    updates = review_data.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one field to update",
        )

    if "review_date" in updates:
        if updates["review_date"] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Review date cannot be empty",
            )

        if updates["review_date"] > date.today():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Review date cannot be in the future",
            )

    for field in (
        "strengths",
        "areas_for_improvement",
        "feedback",
        "review_period",
    ):
        if field in updates:
            updates[field] = updates[field].strip()

            if not updates[field]:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"{field} cannot be blank",
                )

    for field, value in updates.items():
        setattr(review, field, value)

    db.commit()
    db.refresh(review)

    return review

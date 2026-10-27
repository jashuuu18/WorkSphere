
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Notification, User
from app.schemas import (
    NotificationResponse,
    UnreadNotificationCount,
)

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)


def get_my_notification(
    db: Session,
    notification_id: int,
    user_id: int,
) -> Notification:
    """Return a notification only if it belongs to the current user."""
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
        .first()
    )

    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    return notification


@router.get(
    "/",
    response_model=list[NotificationResponse],
)
def list_my_notifications(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List only the current user's notifications."""
    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(
            Notification.created_at.desc(),
            Notification.id.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get(
    "/unread-count",
    response_model=UnreadNotificationCount,
)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current user's unread notification count."""
    count = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .count()
    )

    return {"unread_count": count}


@router.patch("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all unread notifications belonging to the current user as read."""
    try:
        updated_count = (
            db.query(Notification)
            .filter(
                Notification.user_id == current_user.id,
                Notification.is_read.is_(False),
            )
            .update(
                {Notification.is_read: True},
                synchronize_session=False,
            )
        )

        db.commit()

        return {
            "message": "All notifications marked as read",
            "updated_count": updated_count,
        }

    except Exception:
        db.rollback()
        raise


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark one of the current user's notifications as read."""
    notification = get_my_notification(
        db=db,
        notification_id=notification_id,
        user_id=current_user.id,
    )

    try:
        notification.is_read = True
        db.commit()
        db.refresh(notification)
        return notification

    except Exception:
        db.rollback()
        raise


@router.patch(
    "/{notification_id}/unread",
    response_model=NotificationResponse,
)
def mark_notification_unread(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark one of the current user's notifications as unread."""
    notification = get_my_notification(
        db=db,
        notification_id=notification_id,
        user_id=current_user.id,
    )

    try:
        notification.is_read = False
        db.commit()
        db.refresh(notification)
        return notification

    except Exception:
        db.rollback()
        raise

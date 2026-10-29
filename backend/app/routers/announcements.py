
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Announcement, User, UserRole
from app.announcement_schemas import (
    AnnouncementCreate,
    AnnouncementResponse,
)

router = APIRouter(
    prefix="/announcements",
    tags=["Internal Announcements"],
)


@router.post(
    "/",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_announcement(
    data: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    announcement = Announcement(
        title=data.title,
        message=data.message,
        created_by=current_user.id,
    )

    db.add(announcement)
    db.commit()
    db.refresh(announcement)

    return announcement


@router.get(
    "/",
    response_model=list[AnnouncementResponse],
)
def list_announcements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Announcement)
        .order_by(Announcement.created_at.desc(), Announcement.id.desc())
        .all()
    )


@router.get(
    "/{announcement_id}",
    response_model=AnnouncementResponse,
)
def get_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    announcement = (
        db.query(Announcement)
        .filter(Announcement.id == announcement_id)
        .first()
    )

    if announcement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )

    return announcement

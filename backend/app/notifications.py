
from sqlalchemy.orm import Session

from app.models import Notification


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        is_read=False,
    )

    db.add(notification)
    return notification


from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import hash_password, verify_password
from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    Employee,
    User,
    UserNotificationPreference,
)
from app.settings_schemas import (
    NotificationPreferencesUpdate,
    PasswordChange,
    ProfileUpdate,
)

router = APIRouter(prefix="/settings", tags=["Profile & Settings"])


@router.get("/profile")
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == current_user.id)
        .first()
    )

    role = current_user.role
    if hasattr(role, "value"):
        role = role.value

    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": role,
        "employee": (
            {
                "id": employee.id,
                "full_name": employee.full_name,
                "designation": employee.designation,
                "department": employee.department,
                "joining_date": (
                    employee.joining_date.isoformat()
                    if employee.joining_date
                    else None
                ),
                "status": (
                    employee.status.value
                    if hasattr(employee.status, "value")
                    else employee.status
                ),
            }
            if employee
            else None
        ),
    }


@router.patch("/profile")
def update_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    changes = payload.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one field to update.",
        )

    if "email" in changes and changes["email"] is not None:
        email = str(changes["email"]).strip().lower()

        existing_user = (
            db.query(User)
            .filter(User.email == email, User.id != current_user.id)
            .first()
        )

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email address is already in use.",
            )

        current_user.email = email

    if "full_name" in changes and changes["full_name"] is not None:
        employee = (
            db.query(Employee)
            .filter(Employee.user_id == current_user.id)
            .first()
        )

        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee profile not found.",
            )

        employee.full_name = changes["full_name"]

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Profile updated successfully.",
        "email": current_user.email,
    }


@router.patch("/password")
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    if not verify_password(
        payload.current_password,
        current_user.hashed_password,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    current_user.hashed_password = hash_password(payload.new_password)

    db.commit()

    return {"message": "Password changed successfully."}


@router.get("/notifications")
def get_notification_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    preferences = (
        db.query(UserNotificationPreference)
        .filter(
            UserNotificationPreference.user_id == current_user.id
        )
        .first()
    )

    if preferences is None:
        return {
            "email_notifications": True,
            "in_app_notifications": True,
        }

    return {
        "email_notifications": preferences.email_notifications,
        "in_app_notifications": preferences.in_app_notifications,
    }


@router.put("/notifications")
def update_notification_preferences(
    payload: NotificationPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    preferences = (
        db.query(UserNotificationPreference)
        .filter(
            UserNotificationPreference.user_id == current_user.id
        )
        .first()
    )

    if preferences is None:
        preferences = UserNotificationPreference(
            user_id=current_user.id,
            email_notifications=payload.email_notifications,
            in_app_notifications=payload.in_app_notifications,
            updated_at=datetime.utcnow(),
        )
        db.add(preferences)
    else:
        preferences.email_notifications = payload.email_notifications
        preferences.in_app_notifications = payload.in_app_notifications
        preferences.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(preferences)

    return {
        "message": "Notification preferences saved successfully.",
        "email_notifications": preferences.email_notifications,
        "in_app_notifications": preferences.in_app_notifications,
    }

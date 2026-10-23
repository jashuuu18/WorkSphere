
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.database import get_db
from app.dependencies import require_roles
from app.models import Employee, User, UserRole
from app.schemas import AdminUserCreate, AdminUserUpdate, UserResponse

router = APIRouter(prefix="/users", tags=["Admin - User Management"])

admin_required = require_roles(UserRole.ADMIN)


def count_active_admins(db: Session) -> int:
    return db.query(User).filter(
        User.role == UserRole.ADMIN,
        User.is_active.is_(True),
    ).count()


@router.get("/", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_required),
):
    return db.query(User).order_by(User.id.asc()).all()


@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    user_data: AdminUserCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_required),
):
    username = user_data.username.strip()
    email = str(user_data.email).strip().lower()

    existing = db.query(User).filter(
        (User.username == username) | (User.email == email)
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already exists",
        )

    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(user_data.password),
        role=user_data.role,
        is_active=user_data.is_active,
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_required),
):
    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    changes = user_data.model_dump(exclude_unset=True)

    # Prevent the logged-in administrator from locking themselves out.
    if user.id == current_admin.id:
        if changes.get("is_active") is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot deactivate your own account",
            )
        if (
            "role" in changes
            and changes["role"] != UserRole.ADMIN
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot remove your own ADMIN role",
            )

    new_username = changes.get("username", user.username)
    new_email = changes.get("email", user.email)

    if "username" in changes:
        new_username = new_username.strip()

    if "email" in changes:
        new_email = str(new_email).strip().lower()

    duplicate = db.query(User).filter(
        User.id != user.id,
        (User.username == new_username) | (User.email == new_email),
    ).first()

    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already belongs to another user",
        )

    new_role = changes.get("role", user.role)
    new_active = changes.get("is_active", user.is_active)

    if (
        user.role == UserRole.ADMIN
        and user.is_active
        and (
            new_role != UserRole.ADMIN
            or new_active is False
        )
        and count_active_admins(db) <= 1
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot demote or deactivate the last active administrator",
        )

    if "username" in changes:
        user.username = new_username

    if "email" in changes:
        user.email = new_email

    if "password" in changes:
        user.hashed_password = hash_password(changes["password"])

    if "role" in changes:
        user.role = changes["role"]

    if "is_active" in changes:
        user.is_active = changes["is_active"]

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_required),
):
    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account",
        )

    if (
        user.role == UserRole.ADMIN
        and user.is_active
        and count_active_admins(db) <= 1
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete the last active administrator",
        )

    # Employee records link to attendance, leaves and payroll.
    # Do not cascade-delete HR records when removing a user.
    linked_employee = db.query(Employee).filter(
        Employee.user_id == user.id
    ).first()

    if linked_employee:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This user has an employee profile and related HR records. "
                "Deactivate the account instead of deleting it."
            ),
        )

    db.delete(user)
    db.commit()

    return {"message": f"User '{user.username}' deleted successfully"}

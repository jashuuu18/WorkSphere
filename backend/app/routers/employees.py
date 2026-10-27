
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import exists, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    Attendance,
    AttendanceStatus,
    Employee,
    EmployeeStatus,
    PerformanceReview,
    User,
    UserRole,
)
from app.schemas import EmployeeCreate, EmployeeResponse, EmployeeUpdate


router = APIRouter(prefix="/employees", tags=["Employees"])


# ---------------------------------------------------------
# CREATE EMPLOYEE
# HR / ADMIN ONLY
# ---------------------------------------------------------
@router.post("/", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
def create_employee(
    employee_data: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    user = db.query(User).filter(
        User.id == employee_data.user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    existing_employee = db.query(Employee).filter(
        Employee.user_id == employee_data.user_id
    ).first()

    if existing_employee:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Employee profile already exists for this user",
        )

    employee = Employee(**employee_data.model_dump())

    db.add(employee)
    db.commit()
    db.refresh(employee)

    return employee


# ---------------------------------------------------------
# ADVANCED EMPLOYEE SEARCH AND FILTERS
# HR / ADMIN ONLY
# ---------------------------------------------------------
@router.get("/", response_model=list[EmployeeResponse])
def list_employees(
    search: str | None = Query(
        default=None, min_length=1, max_length=100
    ),
    department: str | None = Query(
        default=None, min_length=1, max_length=100
    ),
    status_filter: EmployeeStatus | None = Query(
        default=None, alias="status"
    ),
    role: UserRole | None = Query(default=None),
    attendance_status: AttendanceStatus | None = Query(default=None),
    attendance_date: date | None = Query(default=None),
    min_rating: float | None = Query(default=None, ge=1, le=5),
    max_rating: float | None = Query(default=None, ge=1, le=5),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    """
    Search and filter employees by profile, department, role,
    status, attendance, and performance rating.
    """

    if min_rating is not None and max_rating is not None:
        if min_rating > max_rating:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="min_rating cannot be greater than max_rating",
            )

    query = db.query(Employee).join(
        User,
        Employee.user_id == User.id,
    )

    # Search employee name, designation, department, username, email.
    if search:
        term = f"%{search.strip()}%"

        query = query.filter(
            or_(
                Employee.full_name.ilike(term),
                Employee.designation.ilike(term),
                Employee.department.ilike(term),
                User.username.ilike(term),
                User.email.ilike(term),
            )
        )

    # Department filter.
    if department:
        query = query.filter(
            Employee.department.ilike(f"%{department.strip()}%")
        )

    # Employee status filter.
    if status_filter is not None:
        query = query.filter(
            Employee.status == status_filter
        )

    # User role filter.
    if role is not None:
        query = query.filter(
            User.role == role
        )

    # Attendance filters.
    if attendance_status is not None or attendance_date is not None:
        attendance_conditions = [
            Attendance.employee_id == Employee.id
        ]

        if attendance_status is not None:
            attendance_conditions.append(
                Attendance.status == attendance_status
            )

        if attendance_date is not None:
            attendance_conditions.append(
                Attendance.date == attendance_date
            )

        query = query.filter(
            exists().where(*attendance_conditions)
        )

    # Performance rating filters.
    if min_rating is not None or max_rating is not None:
        review_conditions = [
            PerformanceReview.employee_id == Employee.id
        ]

        if min_rating is not None:
            review_conditions.append(
                PerformanceReview.rating >= min_rating
            )

        if max_rating is not None:
            review_conditions.append(
                PerformanceReview.rating <= max_rating
            )

        query = query.filter(
            exists().where(*review_conditions)
        )

    return (
        query
        .order_by(Employee.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# ---------------------------------------------------------
# GET MY EMPLOYEE PROFILE
# AUTHENTICATED USERS WITH AN EMPLOYEE PROFILE
# ---------------------------------------------------------
@router.get("/me", response_model=EmployeeResponse)
def get_my_employee_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = db.query(Employee).filter(
        Employee.user_id == current_user.id
    ).first()

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )

    return employee


# ---------------------------------------------------------
# GET EMPLOYEE BY ID
# HR / ADMIN ONLY
# ---------------------------------------------------------
@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    employee = db.query(Employee).filter(
        Employee.id == employee_id
    ).first()

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    return employee


# ---------------------------------------------------------
# UPDATE EMPLOYEE
# HR / ADMIN ONLY
# ---------------------------------------------------------
@router.patch("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: int,
    employee_data: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    employee = db.query(Employee).filter(
        Employee.id == employee_id
    ).first()

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    update_data = employee_data.model_dump(exclude_unset=True)

    if "user_id" in update_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Changing an employee's user_id is not allowed",
        )

    for field, value in update_data.items():
        setattr(employee, field, value)

    db.commit()
    db.refresh(employee)

    return employee

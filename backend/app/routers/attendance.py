
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    Attendance,
    AttendanceStatus,
    Employee,
    User,
    UserRole,
)
from app.schemas import AttendanceResponse

router = APIRouter(prefix="/attendance", tags=["Attendance"])


def get_employee_for_user(db: Session, user_id: int) -> Employee:
    employee = db.query(Employee).filter(
        Employee.user_id == user_id
    ).first()

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Your employee profile has not been created yet",
        )

    return employee


# Employee checks in for the current day.
@router.post(
    "/check-in",
    response_model=AttendanceResponse,
    status_code=status.HTTP_201_CREATED,
)
def check_in(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_employee_for_user(db, current_user.id)
    today = date.today()

    record = db.query(Attendance).filter(
        Attendance.employee_id == employee.id,
        Attendance.date == today,
    ).first()

    if record is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Attendance already exists for today",
        )

    record = Attendance(
        employee_id=employee.id,
        date=today,
        check_in=datetime.now(),
        status=AttendanceStatus.PRESENT,
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    return record


# Employee checks out of the current day's attendance.
@router.post(
    "/check-out",
    response_model=AttendanceResponse,
)
def check_out(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_employee_for_user(db, current_user.id)
    today = date.today()

    record = db.query(Attendance).filter(
        Attendance.employee_id == employee.id,
        Attendance.date == today,
    ).first()

    if record is None or record.check_in is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Check in before checking out",
        )

    if record.check_out is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already checked out today",
        )

    record.check_out = datetime.now()

    db.commit()
    db.refresh(record)

    return record


# An employee can view only their own attendance history.
@router.get(
    "/me",
    response_model=list[AttendanceResponse],
)
def my_attendance(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_employee_for_user(db, current_user.id)

    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start_date cannot be after end_date",
        )

    query = db.query(Attendance).filter(
        Attendance.employee_id == employee.id
    )

    if start_date:
        query = query.filter(Attendance.date >= start_date)

    if end_date:
        query = query.filter(Attendance.date <= end_date)

    return query.order_by(Attendance.date.desc()).all()


# HR and Admin can view and filter attendance for all employees.
@router.get(
    "/",
    response_model=list[AttendanceResponse],
)
def list_attendance(
    employee_id: int | None = Query(default=None, gt=0),
    start_date: date | None = None,
    end_date: date | None = None,
    attendance_status: AttendanceStatus | None = Query(
        default=None,
        alias="status",
    ),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start_date cannot be after end_date",
        )

    query = db.query(Attendance)

    if employee_id is not None:
        query = query.filter(
            Attendance.employee_id == employee_id
        )

    if start_date:
        query = query.filter(Attendance.date >= start_date)

    if end_date:
        query = query.filter(Attendance.date <= end_date)

    if attendance_status is not None:
        query = query.filter(
            Attendance.status == attendance_status
        )

    return (
        query.order_by(Attendance.date.desc(), Attendance.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

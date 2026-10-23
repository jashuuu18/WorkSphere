
import math
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    Attendance,
    AttendanceStatus,
    Employee,
    EmployeeStatus,
    Leave,
    LeaveStatus,
    User,
    UserRole,
)
from app.schemas import AttendanceResponse

router = APIRouter(prefix="/attendance", tags=["Attendance"])

# Work schedule. Change these values to match your organisation.
WORK_START_TIME = time(9, 30)
WORK_END_TIME = time(18, 30)


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


def attendance_data(record: Attendance) -> dict:
    """Build an attendance response with calculated values."""
    check_in = record.check_in
    check_out = record.check_out

    late_minutes = 0
    worked_minutes = None
    overtime_minutes = 0

    if check_in is not None:
        check_in_time = check_in.time()
        late_seconds = (
            datetime.combine(record.date, check_in_time)
            - datetime.combine(record.date, WORK_START_TIME)
        ).total_seconds()

        if late_seconds > 0:
            late_minutes = math.ceil(late_seconds / 60)

    if check_in is not None and check_out is not None:
        worked_seconds = (check_out - check_in).total_seconds()
        worked_minutes = max(0, math.floor(worked_seconds / 60))

        overtime_seconds = (
            datetime.combine(record.date, check_out.time())
            - datetime.combine(record.date, WORK_END_TIME)
        ).total_seconds()

        if overtime_seconds > 0:
            overtime_minutes = math.floor(overtime_seconds / 60)

    return {
        "id": record.id,
        "employee_id": record.employee_id,
        "check_in": check_in,
        "check_out": check_out,
        "date": record.date,
        "status": (
            record.status.value
            if hasattr(record.status, "value")
            else record.status
        ),
        "is_late": late_minutes > 0,
        "late_minutes": late_minutes,
        "worked_minutes": worked_minutes,
        "overtime_minutes": overtime_minutes,
    }


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

    existing = db.query(Attendance).filter(
        Attendance.employee_id == employee.id,
        Attendance.date == today,
    ).first()

    if existing is not None:
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

    try:
        db.add(record)
        db.commit()
        db.refresh(record)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Attendance already exists for today",
        )

    return attendance_data(record)


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

    return attendance_data(record)


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

    records = query.order_by(Attendance.date.desc()).all()
    return [attendance_data(record) for record in records]


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
        query = query.filter(Attendance.employee_id == employee_id)

    if start_date:
        query = query.filter(Attendance.date >= start_date)

    if end_date:
        query = query.filter(Attendance.date <= end_date)

    if attendance_status is not None:
        query = query.filter(Attendance.status == attendance_status)

    records = (
        query.order_by(Attendance.date.desc(), Attendance.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [attendance_data(record) for record in records]


@router.post("/mark-absent")
def mark_absent(
    attendance_date: date = Query(..., description="Date to mark absent, YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    """Mark eligible active employees absent for a past working day."""

    today = date.today()

    if attendance_date > today:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot mark attendance for a future date",
        )

    if attendance_date.weekday() >= 5:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Weekends are not eligible for automatic absence marking",
        )

    if attendance_date == today and datetime.now().time() < WORK_END_TIME:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Today's attendance can be marked absent only after work ends",
        )

    employees = db.query(Employee).filter(
        Employee.status == EmployeeStatus.ACTIVE
    ).all()

    marked_absent = 0
    skipped_existing = 0
    skipped_on_leave = 0

    try:
        for employee in employees:
            existing = db.query(Attendance).filter(
                Attendance.employee_id == employee.id,
                Attendance.date == attendance_date,
            ).first()

            if existing is not None:
                skipped_existing += 1
                continue

            approved_leave = db.query(Leave).filter(
                Leave.employee_id == employee.id,
                Leave.status == LeaveStatus.APPROVED,
                Leave.start_date <= attendance_date,
                Leave.end_date >= attendance_date,
            ).first()

            if approved_leave is not None:
                skipped_on_leave += 1
                continue

            db.add(
                Attendance(
                    employee_id=employee.id,
                    date=attendance_date,
                    check_in=None,
                    check_out=None,
                    status=AttendanceStatus.ABSENT,
                )
            )
            marked_absent += 1

        db.commit()

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Attendance data changed during processing. Please retry.",
        )

    return {
        "date": attendance_date.isoformat(),
        "marked_absent": marked_absent,
        "skipped_existing": skipped_existing,
        "skipped_on_approved_leave": skipped_on_leave,
        "message": "Absence marking completed",
    }

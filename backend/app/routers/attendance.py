
import math
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    Attendance,
    AttendanceStatus,
    Employee,
    EmployeeShift,
    EmployeeStatus,
    Leave,
    LeaveStatus,
    Shift,
    User,
    UserRole,
)
from app.schemas import AttendanceResponse

router = APIRouter(prefix="/attendance", tags=["Attendance"])

# Default schedule for employees without an assigned shift.
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


def get_shift_for_employee(
    db: Session, employee_id: int
) -> Shift | None:
    assignment = db.query(EmployeeShift).filter(
        EmployeeShift.employee_id == employee_id
    ).first()

    if assignment is None:
        return None

    return db.query(Shift).filter(
        Shift.id == assignment.shift_id
    ).first()


def get_shift_times(shift: Shift | None) -> tuple[time, time]:
    if shift is None:
        return WORK_START_TIME, WORK_END_TIME

    return shift.start_time, shift.end_time


def get_shift_start_datetime(
    attendance_day: date, start_time: time
) -> datetime:
    return datetime.combine(attendance_day, start_time)


def get_shift_end_datetime(
    attendance_day: date,
    start_time: time,
    end_time: time,
) -> datetime:
    end_datetime = datetime.combine(attendance_day, end_time)

    # An end time at or before the start time means the shift
    # ends on the following calendar day.
    if end_time <= start_time:
        end_datetime += timedelta(days=1)

    return end_datetime


def attendance_data(record: Attendance, db: Session) -> dict:
    check_in = record.check_in
    check_out = record.check_out
    shift = get_shift_for_employee(db, record.employee_id)

    start_time, end_time = get_shift_times(shift)

    late_minutes = 0
    worked_minutes = None
    overtime_minutes = 0
    early_checkout_minutes = 0

    shift_start = get_shift_start_datetime(record.date, start_time)
    shift_end = get_shift_end_datetime(
        record.date, start_time, end_time
    )

    if check_in is not None:
        late_seconds = (check_in - shift_start).total_seconds()

        if late_seconds > 0:
            late_minutes = math.ceil(late_seconds / 60)

    if check_in is not None and check_out is not None:
        worked_seconds = (check_out - check_in).total_seconds()
        worked_minutes = max(0, math.floor(worked_seconds / 60))

        if check_out < shift_end:
            early_seconds = (shift_end - check_out).total_seconds()
            early_checkout_minutes = math.ceil(early_seconds / 60)

        if check_out > shift_end:
            overtime_seconds = (check_out - shift_end).total_seconds()
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
        "is_early_checkout": early_checkout_minutes > 0,
        "early_checkout_minutes": early_checkout_minutes,
        "shift_name": shift.name if shift else None,
        "shift_start_time": start_time,
        "shift_end_time": end_time,
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
    now = datetime.now()
    today = now.date()

    shift = get_shift_for_employee(db, employee.id)
    start_time, end_time = get_shift_times(shift)

    # For overnight shifts, early-morning check-in belongs to
    # the shift that began the previous calendar day.
    attendance_day = today

    if (
        shift is not None
        and end_time <= start_time
        and now.time() <= end_time
    ):
        attendance_day = today - timedelta(days=1)

    existing = db.query(Attendance).filter(
        Attendance.employee_id == employee.id,
        Attendance.date == attendance_day,
    ).first()

    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Attendance already exists for this shift date",
        )

    record = Attendance(
        employee_id=employee.id,
        date=attendance_day,
        check_in=now,
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
            detail="Attendance already exists for this shift date",
        )

    return attendance_data(record, db)


@router.post(
    "/check-out",
    response_model=AttendanceResponse,
)
def check_out(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_employee_for_user(db, current_user.id)
    now = datetime.now()
    today = now.date()

    shift = get_shift_for_employee(db, employee.id)
    start_time, end_time = get_shift_times(shift)

    candidate_dates = [today]

    if shift is not None and end_time <= start_time:
        candidate_dates.append(today - timedelta(days=1))

    record = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee.id,
            Attendance.date.in_(candidate_dates),
            Attendance.check_in.isnot(None),
            Attendance.check_out.is_(None),
        )
        .order_by(Attendance.date.desc())
        .first()
    )

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No open check-in was found for your current shift",
        )

    record.check_out = now
    db.commit()
    db.refresh(record)

    return attendance_data(record, db)


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

    return [attendance_data(record, db) for record in records]


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

    return [attendance_data(record, db) for record in records]


@router.post("/mark-absent")
def mark_absent(
    attendance_date: date = Query(
        ...,
        description="Shift start date to mark absent, YYYY-MM-DD",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    """Mark eligible employees absent after their assigned shift ends."""

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

    employees = db.query(Employee).filter(
        Employee.status == EmployeeStatus.ACTIVE
    ).all()

    marked_absent = 0
    skipped_existing = 0
    skipped_on_leave = 0
    skipped_shift_not_ended = 0

    now = datetime.now()

    try:
        for employee in employees:
            existing = db.query(Attendance).filter(
                Attendance.employee_id == employee.id,
                Attendance.date == attendance_date,
            ).first()

            if existing is not None:
                skipped_existing += 1
                continue

            shift = get_shift_for_employee(db, employee.id)
            start_time, end_time = get_shift_times(shift)

            shift_end = get_shift_end_datetime(
                attendance_date, start_time, end_time
            )

            if attendance_date == today and now < shift_end:
                skipped_shift_not_ended += 1
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
        "skipped_shift_not_ended": skipped_shift_not_ended,
        "message": "Absence marking completed",
    }

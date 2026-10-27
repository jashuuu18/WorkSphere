
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    Employee,
    EmployeeShift,
    EmployeeStatus,
    Shift,
    User,
    UserRole,
)
from app.shift_schemas import (
    EmployeeShiftAssign,
    EmployeeShiftResponse,
    ShiftCreate,
    ShiftResponse,
)

router = APIRouter(prefix="/shifts", tags=["Shift Management"])


def require_hr_or_admin():
    return require_roles(UserRole.HR, UserRole.ADMIN)


@router.get("/", response_model=list[ShiftResponse])
def list_shifts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Shift).order_by(Shift.start_time).all()


@router.post(
    "/",
    response_model=ShiftResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_shift(
    payload: ShiftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
):
    existing = db.query(Shift).filter(
        Shift.name.ilike(payload.name)
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A shift with this name already exists",
        )

    shift = Shift(
        name=payload.name,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )

    db.add(shift)

    try:
        db.commit()
        db.refresh(shift)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A shift with this name already exists",
        )

    return shift


@router.get("/me")
def my_shift(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = db.query(Employee).filter(
        Employee.user_id == current_user.id
    ).first()

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Your employee profile has not been created",
        )

    assignment = (
        db.query(EmployeeShift)
        .filter(EmployeeShift.employee_id == employee.id)
        .first()
    )

    if assignment is None:
        return {"message": "No shift has been assigned to you"}

    shift = db.query(Shift).filter(
        Shift.id == assignment.shift_id
    ).first()

    if shift is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned shift was not found",
        )

    return {
        "employee_id": employee.id,
        "employee_name": employee.full_name,
        "assignment_id": assignment.id,
        "shift_id": shift.id,
        "shift_name": shift.name,
        "start_time": shift.start_time,
        "end_time": shift.end_time,
        "assigned_at": assignment.assigned_at,
    }


@router.get(
    "/assignments",
    response_model=list[EmployeeShiftResponse],
)
def list_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
):
    rows = (
        db.query(EmployeeShift, Employee, Shift)
        .join(Employee, Employee.id == EmployeeShift.employee_id)
        .join(Shift, Shift.id == EmployeeShift.shift_id)
        .order_by(Employee.full_name)
        .all()
    )

    return [
        {
            "id": assignment.id,
            "employee_id": employee.id,
            "employee_name": employee.full_name,
            "department": employee.department,
            "shift_id": shift.id,
            "shift_name": shift.name,
            "start_time": shift.start_time,
            "end_time": shift.end_time,
            "assigned_at": assignment.assigned_at,
        }
        for assignment, employee, shift in rows
    ]


@router.post(
    "/assign",
    response_model=EmployeeShiftResponse,
)
def assign_shift(
    payload: EmployeeShiftAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
):
    employee = db.query(Employee).filter(
        Employee.id == payload.employee_id
    ).first()

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    if employee.status != EmployeeStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot assign a shift to an inactive employee",
        )

    shift = db.query(Shift).filter(
        Shift.id == payload.shift_id
    ).first()

    if shift is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shift not found",
        )

    assignment = db.query(EmployeeShift).filter(
        EmployeeShift.employee_id == employee.id
    ).first()

    if assignment is None:
        assignment = EmployeeShift(
            employee_id=employee.id,
            shift_id=shift.id,
        )
        db.add(assignment)
    else:
        assignment.shift_id = shift.id

    try:
        db.commit()
        db.refresh(assignment)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to assign this shift",
        )

    return {
        "id": assignment.id,
        "employee_id": employee.id,
        "employee_name": employee.full_name,
        "department": employee.department,
        "shift_id": shift.id,
        "shift_name": shift.name,
        "start_time": shift.start_time,
        "end_time": shift.end_time,
        "assigned_at": assignment.assigned_at,
    }


@router.delete("/assignments/{employee_id}")
def remove_shift_assignment(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
):
    assignment = db.query(EmployeeShift).filter(
        EmployeeShift.employee_id == employee_id
    ).first()

    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee shift assignment not found",
        )

    db.delete(assignment)
    db.commit()

    return {"message": "Shift assignment removed successfully"}

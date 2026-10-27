
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Employee, EmployeeStatus, User, UserRole
from app.schemas import EmployeeCreate, EmployeeResponse, EmployeeUpdate

router = APIRouter(prefix="/employees", tags=["Employees"])


# HR and ADMIN can create employee records.
@router.post(
    "/",
    response_model=EmployeeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_employee(
    employee_data: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    linked_user = db.query(User).filter(
        User.id == employee_data.user_id
    ).first()

    if linked_user is None:
        raise HTTPException(
            status_code=404,
            detail="User account not found",
        )

    existing_employee = db.query(Employee).filter(
        Employee.user_id == employee_data.user_id
    ).first()

    if existing_employee:
        raise HTTPException(
            status_code=409,
            detail="This user already has an employee profile",
        )

    employee = Employee(**employee_data.model_dump())

    db.add(employee)
    db.commit()
    db.refresh(employee)

    return employee


# HR and ADMIN can view/search the employee directory.
@router.get("/", response_model=list[EmployeeResponse])
def list_employees(
    search: str | None = Query(default=None, max_length=150),
    department: str | None = Query(default=None, max_length=100),
    employee_status: EmployeeStatus | None = Query(
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
    query = db.query(Employee)

    if search and search.strip():
        query = query.filter(
            Employee.full_name.ilike(f"%{search.strip()}%")
        )

    if department and department.strip():
        query = query.filter(
            Employee.department.ilike(f"%{department.strip()}%")
        )

    if employee_status is not None:
        query = query.filter(Employee.status == employee_status)

    return (
        query.order_by(Employee.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# Employees can view only their own employee profile.
@router.get("/me", response_model=EmployeeResponse)
def get_my_employee_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = db.query(Employee).filter(
        Employee.user_id == current_user.id
    ).first()

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Employee profile has not been created yet",
        )

    return employee


# HR and ADMIN can view an employee by ID.
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

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Employee not found",
        )

    return employee


# HR and ADMIN can update employee details.
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

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Employee not found",
        )

    update_data = employee_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(employee, field, value)

    db.commit()
    db.refresh(employee)

    return employee

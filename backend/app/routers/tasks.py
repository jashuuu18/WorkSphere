
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Employee, Task, TaskStatus, User, UserRole
from app.task_schemas import TaskCreate, TaskResponse, TaskStatusUpdate

router = APIRouter(
    prefix="/tasks",
    tags=["Task Assignment & Tracking"],
)


def get_employee_for_user(db: Session, user_id: int) -> Employee:
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == user_id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )

    return employee


@router.post(
    "/",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def assign_task(
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    employee = (
        db.query(Employee)
        .filter(Employee.id == data.assigned_to)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    task = Task(
        assigned_to=data.assigned_to,
        title=data.title,
        description=data.description,
        due_date=data.due_date,
        status=TaskStatus.PENDING,
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    return task


@router.get("/me", response_model=list[TaskResponse])
def get_my_tasks(
    task_status: TaskStatus | None = Query(
        default=None,
        alias="status",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_employee_for_user(db, current_user.id)

    query = db.query(Task).filter(
        Task.assigned_to == employee.id
    )

    if task_status is not None:
        query = query.filter(Task.status == task_status)

    return query.order_by(Task.due_date.asc(), Task.id.desc()).all()


@router.get("/", response_model=list[TaskResponse])
def list_all_tasks(
    task_status: TaskStatus | None = Query(
        default=None,
        alias="status",
    ),
    employee_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    query = db.query(Task)

    if task_status is not None:
        query = query.filter(Task.status == task_status)

    if employee_id is not None:
        query = query.filter(Task.assigned_to == employee_id)

    return query.order_by(Task.due_date.asc(), Task.id.desc()).all()


@router.patch(
    "/{task_id}/status",
    response_model=TaskResponse,
)
def update_task_status(
    task_id: int,
    data: TaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    is_manager = current_user.role in (UserRole.HR, UserRole.ADMIN)

    if not is_manager:
        employee = get_employee_for_user(db, current_user.id)

        if task.assigned_to != employee.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own assigned tasks",
            )

        if data.status != TaskStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Employees can only mark their tasks as completed",
            )

    task.status = data.status
    db.commit()
    db.refresh(task)

    return task

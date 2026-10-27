
from collections import Counter, defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models import (
    Attendance,
    Employee,
    Leave,
    PerformanceReview,
    User,
    UserRole,
)

router = APIRouter(
    prefix="/analytics",
    tags=["Advanced Analytics & Reports"],
)


def enum_text(value):
    """Return a consistent string for enum or string database values."""
    return str(getattr(value, "value", value)).upper()


def get_date_range(start_date, end_date):
    """Apply a six-month default reporting window."""
    today = date.today()
    end = end_date or today
    start = start_date or (end - timedelta(days=180))

    if start > end:
        raise HTTPException(
            status_code=422,
            detail="start_date cannot be after end_date",
        )

    if end > today:
        raise HTTPException(
            status_code=422,
            detail="end_date cannot be in the future",
        )

    return start, end


def get_employee_scope(db, department):
    query = db.query(Employee)

    if department:
        query = query.filter(Employee.department == department)

    employees = query.all()
    employee_ids = {employee.id for employee in employees}

    return employees, employee_ids


def month_key(value):
    return value.strftime("%Y-%m")


def count_status(records, status_attribute="status"):
    counts = Counter(
        enum_text(getattr(record, status_attribute))
        for record in records
    )
    return dict(counts)


@router.get("/overview")
def analytics_overview(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    department: str | None = Query(default=None, min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    start, end = get_date_range(start_date, end_date)
    employees, employee_ids = get_employee_scope(db, department)

    attendance = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id.in_(employee_ids),
            Attendance.date >= start,
            Attendance.date <= end,
        )
        .all()
        if employee_ids
        else []
    )

    leaves = (
        db.query(Leave)
        .filter(
            Leave.employee_id.in_(employee_ids),
            Leave.start_date <= end,
            Leave.end_date >= start,
        )
        .all()
        if employee_ids
        else []
    )

    reviews = (
        db.query(PerformanceReview)
        .filter(
            PerformanceReview.employee_id.in_(employee_ids),
            PerformanceReview.review_date >= start,
            PerformanceReview.review_date <= end,
        )
        .all()
        if employee_ids
        else []
    )

    attendance_counts = count_status(attendance)
    leave_counts = count_status(leaves)

    return {
        "period": {
            "start_date": start,
            "end_date": end,
        },
        "department": department or "ALL",
        "total_employees": len(employees),
        "active_employees": sum(
            enum_text(employee.status) == "ACTIVE"
            for employee in employees
        ),
        "attendance_records": len(attendance),
        "attendance_status_counts": attendance_counts,
        "leave_records": len(leaves),
        "leave_status_counts": leave_counts,
        "performance_reviews": len(reviews),
        "average_performance_rating": (
            round(sum(review.rating for review in reviews) / len(reviews), 2)
            if reviews
            else None
        ),
    }


@router.get("/attendance-trends")
def attendance_trends(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    department: str | None = Query(default=None, min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    start, end = get_date_range(start_date, end_date)
    employees, employee_ids = get_employee_scope(db, department)

    records = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id.in_(employee_ids),
            Attendance.date >= start,
            Attendance.date <= end,
        )
        .order_by(Attendance.date.asc())
        .all()
        if employee_ids
        else []
    )

    monthly = defaultdict(Counter)

    for record in records:
        monthly[month_key(record.date)][enum_text(record.status)] += 1

    return {
        "start_date": start,
        "end_date": end,
        "department": department or "ALL",
        "total_employees": len(employees),
        "trends": [
            {
                "month": month,
                "present": counts.get("PRESENT", 0),
                "absent": counts.get("ABSENT", 0),
                "half_day": counts.get("HALF_DAY", 0),
                "total_records": sum(counts.values()),
            }
            for month, counts in sorted(monthly.items())
        ],
    }


@router.get("/leave-trends")
def leave_trends(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    department: str | None = Query(default=None, min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    start, end = get_date_range(start_date, end_date)
    employees, employee_ids = get_employee_scope(db, department)

    records = (
        db.query(Leave)
        .filter(
            Leave.employee_id.in_(employee_ids),
            Leave.start_date <= end,
            Leave.end_date >= start,
        )
        .all()
        if employee_ids
        else []
    )

    monthly = defaultdict(Counter)
    type_counts = Counter()

    for record in records:
        # Group each leave by its start month.
        monthly[month_key(record.start_date)][enum_text(record.status)] += 1
        type_counts[enum_text(record.leave_type)] += 1

    return {
        "start_date": start,
        "end_date": end,
        "department": department or "ALL",
        "total_employees": len(employees),
        "leave_type_counts": dict(type_counts),
        "trends": [
            {
                "month": month,
                "pending": counts.get("PENDING", 0),
                "approved": counts.get("APPROVED", 0),
                "rejected": counts.get("REJECTED", 0),
                "total": sum(counts.values()),
            }
            for month, counts in sorted(monthly.items())
        ],
    }


@router.get("/performance")
def performance_insights(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    department: str | None = Query(default=None, min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    start, end = get_date_range(start_date, end_date)
    employees, employee_ids = get_employee_scope(db, department)

    records = (
        db.query(PerformanceReview)
        .filter(
            PerformanceReview.employee_id.in_(employee_ids),
            PerformanceReview.review_date >= start,
            PerformanceReview.review_date <= end,
        )
        .order_by(PerformanceReview.review_date.desc())
        .all()
        if employee_ids
        else []
    )

    grouped = defaultdict(list)

    for review in records:
        grouped[review.employee_id].append(review.rating)

    employee_lookup = {
        employee.id: employee.full_name
        for employee in employees
    }

    employee_results = []

    for employee_id, ratings in grouped.items():
        employee_results.append(
            {
                "employee_id": employee_id,
                "employee_name": employee_lookup.get(
                    employee_id, "Unknown"
                ),
                "review_count": len(ratings),
                "average_rating": round(sum(ratings) / len(ratings), 2),
            }
        )

    employee_results.sort(
        key=lambda item: item["average_rating"],
        reverse=True,
    )

    return {
        "start_date": start,
        "end_date": end,
        "department": department or "ALL",
        "review_count": len(records),
        "average_rating": (
            round(
                sum(review.rating for review in records) / len(records),
                2,
            )
            if records
            else None
        ),
        "employees": employee_results,
    }


@router.get("/departments")
def department_reports(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    start, end = get_date_range(start_date, end_date)
    employees = db.query(Employee).all()

    department_employees = defaultdict(list)

    for employee in employees:
        department_name = employee.department or "Unassigned"
        department_employees[department_name].append(employee)

    reports = []

    for department_name, members in sorted(department_employees.items()):
        employee_ids = [member.id for member in members]

        attendance = (
            db.query(Attendance)
            .filter(
                Attendance.employee_id.in_(employee_ids),
                Attendance.date >= start,
                Attendance.date <= end,
            )
            .all()
            if employee_ids
            else []
        )

        statuses = count_status(attendance)

        reviews = (
            db.query(PerformanceReview)
            .filter(
                PerformanceReview.employee_id.in_(employee_ids),
                PerformanceReview.review_date >= start,
                PerformanceReview.review_date <= end,
            )
            .all()
            if employee_ids
            else []
        )

        reports.append(
            {
                "department": department_name,
                "employee_count": len(members),
                "active_employees": sum(
                    enum_text(member.status) == "ACTIVE"
                    for member in members
                ),
                "attendance_records": len(attendance),
                "present_records": statuses.get("PRESENT", 0),
                "absent_records": statuses.get("ABSENT", 0),
                "half_day_records": statuses.get("HALF_DAY", 0),
                "performance_review_count": len(reviews),
                "average_performance_rating": (
                    round(
                        sum(review.rating for review in reviews)
                        / len(reviews),
                        2,
                    )
                    if reviews
                    else None
                ),
            }
        )

    return {
        "start_date": start,
        "end_date": end,
        "departments": reports,
    }

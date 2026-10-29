
import csv
from io import BytesIO, StringIO
from datetime import date, datetime
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Employee, Attendance, Payroll, UserRole

router = APIRouter(prefix="/exports", tags=["HR Reports & Exports"])


def serialize_value(value):
    """Convert database values into CSV/PDF-friendly text."""
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if value is None:
        return ""
    return str(value)


def get_export_data(db: Session, model):
    """Read table columns and records without hardcoding every field."""
    columns = list(model.__table__.columns)
    records = db.query(model).all()

    headers = [column.name for column in columns]
    rows = [
        [serialize_value(getattr(record, column.name)) for column in columns]
        for record in records
    ]
    return headers, rows


def build_csv(db: Session, model):
    headers, rows = get_export_data(db, model)
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(rows)
    return output.getvalue()


def build_pdf(title: str, headers: list, rows: list):
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=24,
        leftMargin=24,
        topMargin=24,
        bottomMargin=24,
    )

    styles = getSampleStyleSheet()
    elements = [
        Paragraph(title, styles["Title"]),
        Spacer(1, 16),
    ]

    table_data = [headers] + rows
    if not rows:
        table_data.append(["No records found"] + [""] * (len(headers) - 1))

    table = Table(table_data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#243b53")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f1f5f9")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(table)
    document.build(elements)
    buffer.seek(0)
    return buffer


def export_response(db: Session, model, title: str, filename: str, file_type: str):
    headers, rows = get_export_data(db, model)

    if file_type == "csv":
        csv_content = build_csv(db, model)
        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}.csv"'
            },
        )

    pdf_buffer = build_pdf(title, headers, rows)
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}.pdf"'
        },
    )


@router.get("/employees.csv")
def export_employees_csv(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
):
    return export_response(db, Employee, "Employee Report", "employees", "csv")


@router.get("/attendance.csv")
def export_attendance_csv(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
):
    return export_response(db, Attendance, "Attendance Report", "attendance", "csv")


@router.get("/payroll.csv")
def export_payroll_csv(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
):
    return export_response(db, Payroll, "Payroll Report", "payroll", "csv")


@router.get("/employees.pdf")
def export_employees_pdf(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
):
    return export_response(db, Employee, "Employee Report", "employees", "pdf")


@router.get("/attendance.pdf")
def export_attendance_pdf(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
):
    return export_response(db, Attendance, "Attendance Report", "attendance", "pdf")


@router.get("/payroll.pdf")
def export_payroll_pdf(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
):
    return export_response(db, Payroll, "Payroll Report", "payroll", "pdf")

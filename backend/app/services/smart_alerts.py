
import logging
import os
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Attendance, Employee, Notification

logger = logging.getLogger(__name__)

TIMEZONE_NAME = os.getenv("APP_TIMEZONE", "Asia/Kolkata")
APP_TIMEZONE = ZoneInfo(TIMEZONE_NAME)

CUTOFF_HOUR = int(os.getenv("ATTENDANCE_CUTOFF_HOUR", "10"))
CUTOFF_MINUTE = int(os.getenv("ATTENDANCE_CUTOFF_MINUTE", "0"))

if not 0 <= CUTOFF_HOUR <= 23:
    raise ValueError("ATTENDANCE_CUTOFF_HOUR must be between 0 and 23")

if not 0 <= CUTOFF_MINUTE <= 59:
    raise ValueError("ATTENDANCE_CUTOFF_MINUTE must be between 0 and 59")

scheduler = BackgroundScheduler(timezone=APP_TIMEZONE)


def get_local_now() -> datetime:
    """Return the current time in the configured application timezone."""
    return datetime.now(APP_TIMEZONE)


def generate_late_attendance_alerts(
    db: Session,
    target_date: date | None = None,
) -> int:
    """
    Create one late-check-in notification per employee per day.

    This function can be called by the scheduler or directly in tests.
    """
    today = target_date or get_local_now().date()
    cutoff = time(CUTOFF_HOUR, CUTOFF_MINUTE)

    attendance_records = (
        db.query(Attendance)
        .filter(
            Attendance.date == today,
            Attendance.check_in.isnot(None),
        )
        .all()
    )

    created_count = 0

    for record in attendance_records:
        check_in = record.check_in

        # Attendance.check_in is expected to be a datetime.
        if isinstance(check_in, datetime):
            check_in_time = check_in.time()
        elif isinstance(check_in, time):
            check_in_time = check_in
        else:
            logger.warning(
                "Skipping attendance record %s: unexpected check_in value",
                record.id,
            )
            continue

        # Compare clock times, excluding timezone information.
        if check_in_time.replace(tzinfo=None) <= cutoff:
            continue

        employee = (
            db.query(Employee)
            .filter(Employee.id == record.employee_id)
            .first()
        )

        if employee is None:
            logger.warning(
                "Skipping attendance record %s: employee not found",
                record.id,
            )
            continue

        title = "Late Attendance Alert"
        message = (
            f"Your attendance on {today.isoformat()} was recorded "
            f"after the {cutoff.strftime('%I:%M %p')} cutoff."
        )

        # Prevent duplicate notifications when the scheduler runs again.
        already_exists = (
            db.query(Notification.id)
            .filter(
                Notification.user_id == employee.user_id,
                Notification.title == title,
                Notification.message == message,
            )
            .first()
        )

        if already_exists:
            continue

        notification = Notification(
            user_id=employee.user_id,
            title=title,
            message=message,
            is_read=False,
        )

        db.add(notification)
        created_count += 1

    if created_count:
        db.commit()

    return created_count


def run_late_attendance_job() -> None:
    """Create a database session for a scheduled execution."""
    db = SessionLocal()

    try:
        today = get_local_now().date()
        count = generate_late_attendance_alerts(db, today)

        if count:
            logger.info(
                "Created %s late attendance notifications for %s",
                count,
                today,
            )
    except Exception:
        db.rollback()
        logger.exception("Late attendance notification job failed")
    finally:
        db.close()


def start_smart_alert_scheduler() -> None:
    """Start the background job once per application process."""
    if scheduler.running:
        return

    scheduler.add_job(
        run_late_attendance_job,
        trigger="interval",
        minutes=5,
        id="late_attendance_alerts",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    scheduler.start()
    logger.info("Smart alert scheduler started")


def stop_smart_alert_scheduler() -> None:
    """Stop the scheduler during application shutdown."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Smart alert scheduler stopped")

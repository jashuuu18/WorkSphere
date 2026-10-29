
import os
import smtplib
from email.message import EmailMessage


def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send an email using SMTP settings from environment variables."""

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    from_email = os.getenv("EMAIL_FROM", smtp_user or "")

    if not all([smtp_host, smtp_user, smtp_password, from_email]):
        raise RuntimeError(
            "Email is not configured. Set SMTP_HOST, SMTP_PORT, "
            "SMTP_USER, SMTP_PASSWORD, and EMAIL_FROM."
        )

    message = EmailMessage()
    message["From"] = from_email
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(message)

    return True


from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.dependencies import require_roles
from app.models import User, UserRole
from app.routers import auth, employees, attendance, leaves, leave_policies, payroll, dashboard, notifications, users

# Create database tables for development.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="WorkSphere HRMS API",
    description=(
        "WorkSphere Human Resource Management System "
        "with authentication, employee management, "
        "attendance, leave, payroll, and notifications."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(auth.router, prefix="/api/v1")
app.include_router(employees.router, prefix="/api/v1")
app.include_router(attendance.router, prefix="/api/v1")
app.include_router(leaves.router, prefix="/api/v1")
app.include_router(leave_policies.router, prefix="/api/v1")
app.include_router(payroll.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")


@app.get("/", tags=["Health"])
def home():
    return {
        "message": "Welcome to WorkSphere HRMS API",
        "status": "running",
    }


@app.get("/api/v1/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}


@app.get("/api/v1/admin/verify", tags=["Authorization"])
def verify_admin_access(
    current_user: User = Depends(
        require_roles(UserRole.ADMIN)
    ),
):
    return {
        "message": "Admin access verified",
        "username": current_user.username,
        "role": current_user.role.value,
    }

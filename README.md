# WorkSphere – HR Management System (HRMS)

## Project Overview
WorkSphere is a web-based Human Resource Management System that simplifies employee management, attendance tracking, leave management, payroll processing, notifications, and dashboard analytics.

## Technologies Used
- **Frontend:** React.js, Vite
- **Backend:** FastAPI (Python)
- **Database:** SQLite / SQLAlchemy
- **Authentication:** JWT
- **API Testing:** Swagger UI

## Key Features
- User registration and login
- Role-based access: EMPLOYEE, HR, and ADMIN
- Employee management
- Attendance check-in and check-out
- Leave application and approval
- Payroll management
- Dashboard and analytics
- Notifications system
- Protected routes and API endpoints

## Project Structure
```text
WorkSphere/
├── backend/
│   └── app/
│       ├── models.py
│       ├── schemas.py
│       ├── database.py
│       └── routers/
└── frontend/
    └── src/
        ├── components/
        ├── context/
        ├── pages/
        └── services/
```

## How to Run the Project

### Backend
```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

Backend API: `http://127.0.0.1:8000`

Swagger documentation: `http://127.0.0.1:8000/docs`

### Frontend
Open another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the frontend URL displayed in the terminal.

## User Roles
- **EMPLOYEE:** View profile, manage attendance, apply for leave, view payroll and notifications.
- **HR:** Manage employees, attendance, leave approvals, and payroll.
- **ADMIN:** Administrative access to authorized HRMS features.

## Project Objective
To develop a secure and user-friendly HR management system that automates routine HR operations and improves efficiency.

## Future Enhancements
- Email and real-time notifications
- Advanced reports and analytics
- Payroll report downloads
- Improved UI and mobile responsiveness

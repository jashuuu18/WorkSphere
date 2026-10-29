# WorkSphere – HR Management System (HRMS)

## Project Overview
WorkSphere is a web-based Human Resource Management System built to simplify employee management and HR operations. It provides role-based access to employee records, attendance, leave management, payroll, reports, feedback, and account settings.

## Technologies Used
- **Frontend:** React, Vite, JavaScript, CSS
- **Backend:** Python, FastAPI
- **Database:** SQLAlchemy with the configured database
- **Authentication:** JWT
- **Validation:** Pydantic
- **API Testing:** Swagger UI
- **Version Control:** Git and GitHub

## Key Features — Modules 1–27

1. User Registration and Authentication
2. Employee Management
3. Attendance Management
4. Leave Management and Approval
5. Payroll Management
6. Dashboard and Analytics
7. Notifications System
8. Role-Based Access Control (RBAC)
9. Advanced HR Features
10. Audit and Account Controls
11. Advanced Employee Operations
12. HR Workflow Enhancements
13. Additional HR Management Features
14. Employee Operations Enhancements
15. HRMS Security and Workflow Improvements
16. Employee Document Management
17. Performance Reviews
18. Advanced Analytics
19. Smart Alerts
20. Advanced Employee Search and Filtering
21. Employee Onboarding
22. Resignation and Exit Management
23. Internal Announcements
24. Task Assignment and Tracking
25. Third-Party Integrations and CSV Report Exports
26. Employee Feedback System
27. Profile and Settings Management

## User Roles
- **EMPLOYEE:** Access personal information and permitted employee features.
- **HR:** Manage employee records, HR workflows, and authorized reports.
- **ADMIN:** Access administrative features and authorized management operations.

Access is controlled through authentication and role-based authorization.

## Project Structure

```text
WorkSphere/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   └── main.py
│   ├── .env
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/
│   │   └── App.jsx
│   └── package.json
└── README.md
```

## Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/jashuuu18/WorkSphere.git
cd WorkSphere
```

### 2. Backend Setup

Open a terminal in the backend directory:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Configure the required environment variables in `backend/.env`, including database and JWT settings. Configure SMTP settings if email integration is required.

Start the backend:

```powershell
uvicorn app.main:app --reload
```

### 3. Frontend Setup

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the local frontend URL displayed by Vite, usually `http://localhost:5173`.

## API Documentation

Once the backend is running, open:

- **Swagger UI:** http://127.0.0.1:8000/docs
- **ReDoc:** http://127.0.0.1:8000/redoc

API routes use the `/api/v1` prefix where configured.

## Security Features
- JWT-based authentication
- Role-based authorization
- Protected API endpoints
- Pydantic request validation
- Password hashing and password verification
- Employee ownership checks
- Environment-based configuration
- Restricted access to sensitive employee and payroll reports

## Testing
- Test API endpoints using Swagger UI.
- Verify authentication and role permissions.
- Test employee, attendance, leave, and payroll workflows.
- Validate onboarding, resignations, announcements, and tasks.
- Test CSV exports and email integration.
- Verify feedback submission and profile settings.

## Future Enhancements
- Google Calendar integration
- Advanced reporting and PDF exports
- Enhanced notification delivery and preferences
- Automated testing and deployment
- Additional analytics and HR workflow automation

## Repository
GitHub: https://github.com/jashuuu18/WorkSphere

## Conclusion
WorkSphere HRMS brings essential employee management and HR workflows into one application. Its modular architecture supports authentication, employee operations, reporting, and additional HR features through a React frontend and FastAPI backend.

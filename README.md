# WorkSphere – HR Management System (HRMS)

## 1. Project Overview

WorkSphere is a web-based Human Resource Management System (HRMS) developed using **FastAPI and React**. It helps organizations manage employee information, attendance, leave requests, payroll, performance reviews, documents, notifications, and HR operations through a centralized platform.

The system uses role-based access control to provide different permissions for Employees, HR personnel, and Administrators.

## 2. Objectives

- Centralize employee information and HR operations.
- Manage employee attendance and leave requests.
- Simplify payroll and salary record management.
- Maintain employee documents and performance reviews.
- Provide dashboards, analytics, and reports.
- Send notifications and attendance alerts.
- Secure application access using JWT authentication and role-based permissions.

## 3. Technology Stack

**Backend**
- Python
- FastAPI
- SQLAlchemy
- Pydantic
- JWT authentication
- SQLite / configured database

**Frontend**
- React
- Vite
- JavaScript
- HTML and CSS
- Axios
- React Router

**Development and Testing**
- Visual Studio Code
- PowerShell
- Git and GitHub
- FastAPI Swagger UI
- Pytest, where configured

## 4. Main Features and Modules

1. User Authentication and Login
2. Employee Management
3. Attendance Management
4. Leave Management and Approval
5. Payroll Management
6. Dashboard and Analytics
7. Notifications System
8. Role-Based Access Control (RBAC)
9. Advanced HR Features
10. Employee Profile Management
11. Employee Search and Filtering
12. Attendance and Leave Reports
13. Administrative Controls
14. Audit and Security Features
15. HR Workflow Management
16. Document Management
17. Performance Management
18. Advanced Analytics and Reports
19. Smart Notifications and Alerts
20. Advanced Employee Search and Filters

*Note: The exact implementation and completion status of each module depend on the current project code.*

## 5. User Roles

### Employee
- View personal employee information.
- Mark attendance and view attendance history.
- Apply for leave and view leave status.
- View available payroll information.
- Access personal documents and performance reviews.
- View notifications.

### HR
- Manage employee records.
- Review and process leave requests.
- Manage payroll records.
- Access permitted reports and analytics.
- Manage performance reviews and employee documents.

### Administrator
- Access administrative features.
- Manage permitted HR operations.
- Access dashboards, analytics, and reports.
- Perform authorized administrative actions.

Access is controlled by the permissions implemented in the backend.

## 6. Project Structure

```text
WorkSphere/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   ├── services/
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   └── main.py
│   ├── .env
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.jsx
│   ├── package.json
│   └── index.html
├── README.md
└── .gitignore
```

*The structure above is representative. Your actual folders and files may differ.*

## 7. Installation and Setup

### Prerequisites

Install the following:
- Python
- Node.js and npm
- Git (optional, for version control)

### Step 1: Clone the Repository

```bash
git clone https://github.com/jashuuu18/WorkSphere.git
cd WorkSphere
```

Alternatively, open your existing WorkSphere project folder.

### Step 2: Set Up the Backend

Open a terminal:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create or configure the `.env` file with the environment variables required by the application. Use a secure JWT secret and never commit credentials to GitHub.

### Step 3: Start the Backend

From the `backend` directory, with the virtual environment activated:

```powershell
uvicorn app.main:app --reload
```

Backend URL:

http://127.0.0.1:8000

Swagger API documentation:

http://127.0.0.1:8000/docs

### Step 4: Set Up the Frontend

Open another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL displayed in the terminal, commonly:

http://localhost:5173

Keep the backend and frontend running in separate terminals.

## 8. API Testing

FastAPI provides interactive API documentation through Swagger UI.

1. Start the backend.
2. Open `http://127.0.0.1:8000/docs`.
3. Register or log in using an authorized account.
4. Obtain the JWT access token.
5. Click **Authorize** and enter the token as required by the configured authentication scheme.
6. Test the available endpoints using valid request data.
7. Verify successful responses and expected validation or permission errors.

The API prefix used by the application is `/api/v1`.

## 9. Security Features

- JWT-based authentication.
- Role-based authorization for protected endpoints.
- Password hashing.
- Request validation using Pydantic.
- Database-backed employee and HR records.
- Access restrictions for personal employee information.
- Environment-based configuration for secrets and application settings.
- Validation and error handling for invalid requests.

Security depends on the actual implementation and configuration of the application.

## 10. Database

The backend uses SQLAlchemy models to represent application data, such as:

- Users and roles
- Employee profiles
- Attendance records
- Leave requests
- Payroll records
- Notifications
- Employee documents
- Performance reviews

The database engine and connection settings are configured in the backend.

## 11. Version Control

The project repository is available at:

https://github.com/jashuuu18/WorkSphere

Use Git to track code changes and maintain versions of the project. Do not commit virtual environments, dependency folders, database files containing private data, or `.env` files containing secrets.

## 12. Future Enhancements

- Email notifications and reminders.
- Exportable payroll and analytics reports.
- Enhanced audit logging.
- Additional dashboard visualizations.
- Automated testing and continuous integration.
- Deployment to a production hosting environment.

## 13. Conclusion

WorkSphere HRMS provides a centralized platform for managing essential HR activities. By combining FastAPI, React, database models, JWT authentication, and role-based access control, the project demonstrates full-stack web development and the implementation of common enterprise HR workflows.

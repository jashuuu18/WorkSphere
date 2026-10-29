
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Attendance from "./pages/Attendance";
import Leaves from "./pages/Leaves";
import LeaveBalances from "./pages/LeaveBalances";
import Payroll from "./pages/Payroll";
import MyProfile from "./pages/MyProfile";
import Employees from "./pages/Employees";
import Notifications from "./pages/Notifications";
import UserManagement from "./pages/UserManagement";
import Shifts from "./pages/Shifts";
import LeaveCalendar from "./pages/LeaveCalendar";
import Documents from "./pages/Documents";
import PerformanceReviews from "./pages/PerformanceReviews";
import Analytics from "./pages/Analytics";
import SmartAlerts from "./pages/SmartAlerts";
import AdvancedEmployeeSearch from "./pages/AdvancedEmployeeSearch";
import Onboarding from "./pages/Onboarding";
import Resignations from "./pages/Resignations";
import Announcements from "./pages/Announcements";
import Tasks from "./pages/Tasks";
import Reports from "./pages/Reports";
import Feedback from "./pages/Feedback";
import Settings from "./pages/Settings";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<Login />} />

        {/* All authenticated users */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route
              path="/"
              element={<Navigate to="/dashboard" replace />}
            />

            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<MyProfile />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/leaves" element={<Leaves />} />
            <Route path="/leave-balances" element={<LeaveBalances />} />
            <Route path="/leave-calendar" element={<LeaveCalendar />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/smart-alerts" element={<SmartAlerts />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/resignations" element={<Resignations />} />
            <Route path="/announcements" element={<Announcements/>} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/settings" element={<Settings />} />


            {/* EMPLOYEE, HR and ADMIN */}
            <Route path="/shifts" element={<Shifts />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/performance-reviews" element={<PerformanceReviews />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/advanced-employee-search" element={<AdvancedEmployeeSearch />} />

            {/* HR and ADMIN only */}
            <Route element={<ProtectedRoute allowedRoles={["HR", "ADMIN"]} />}>
              <Route path="/employees" element={<Employees />} />
            </Route>

            {/* ADMIN only */}
            <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
              <Route path="/users" element={<UserManagement />} />
            </Route>
          </Route>
        </Route>

        {/* Unknown routes */}
        <Route
          path="*"
          element={<Navigate to="/dashboard" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

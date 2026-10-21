
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Attendance from "./pages/Attendance";
import Leaves from "./pages/Leaves";
import Payroll from "./pages/Payroll";
import MyProfile from "./pages/MyProfile";
import Employees from "./pages/Employees";
import Notifications from "./pages/Notifications";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

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
            <Route path="/payroll" element={<Payroll />} />
            <Route
              path="/notifications"
              element={<Notifications />}
            />

            <Route
              element={
                <ProtectedRoute allowedRoles={["HR", "ADMIN"]} />
              }
            >
              <Route path="/employees" element={<Employees />} />
            </Route>
          </Route>
        </Route>

        <Route
          path="*"
          element={<Navigate to="/dashboard" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

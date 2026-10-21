
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const isStaff = ["HR", "ADMIN"].includes(user?.role);

  return (
    <header className="topbar">
      <NavLink to="/dashboard" className="brand">
        <span className="brand-symbol">W</span>
        <span>WorkSphere</span>
      </NavLink>

      <nav className="main-nav">
        <NavLink to="/dashboard">Dashboard</NavLink>

        {isStaff && (
          <NavLink to="/employees">Employees</NavLink>
        )}

        <NavLink to="/attendance">Attendance</NavLink>
        <NavLink to="/leaves">Leave</NavLink>
        <NavLink to="/payroll">Payroll</NavLink>
      </nav>

      <div className="user-menu">
        <div className="user-info">
          <span className="user-name">{user?.username}</span>
          <span className="role-badge">{user?.role}</span>
        </div>
        <button className="logout-button" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </header>
  );
}

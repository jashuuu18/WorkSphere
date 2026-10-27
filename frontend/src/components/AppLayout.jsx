
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const role = String(user?.role || "").toUpperCase();
  const isManager = ["HR", "ADMIN"].includes(role);
  const isAdmin = role === "ADMIN";

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const links = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "My Profile", path: "/profile" },
    { label: "Attendance", path: "/attendance" },
    { label: "Shift Management", path: "/shifts" },
    { label: "Leave Management", path: "/leaves" },
    { label: "Leave Calendar", path: "/leave-calendar" },
    { label: "Leave Balances", path: "/leave-balances" },
    { label: "Payroll", path: "/payroll" },
    { label: "Notifications", path: "/notifications" },
    { label: "Documents", path: "/documents" },
    { label: "Performance Reviews", path: "/performance-reviews" },
    { label: "Analytics", path: "/analytics" },
    { label: "Smart Alerts", path: "/smart-alerts" },
    { label: "Advanced Employee Search", path: "/advanced-employee-search" },


    ...(isManager
      ? [{ label: "Employees", path: "/employees" }]
      : []),

    ...(isAdmin
      ? [{ label: "User Management", path: "/users" }]
      : []),
  ];

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.brand}>WorkSphere</div>

        <nav style={styles.nav}>
          {links.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              style={({ isActive }) => ({
                ...styles.link,
                ...(isActive ? styles.activeLink : {}),
              })}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div style={styles.userArea}>
          <span style={styles.username}>
            {user?.username || user?.email || "User"}
          </span>

          <span style={styles.role}>{role}</span>

          <button
            type="button"
            onClick={handleLogout}
            style={styles.logout}
          >
            Logout
          </button>
        </div>
      </header>

      <main style={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    background: "#f8fafc",
  },

  header: {
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    padding: "14px 22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    flexWrap: "wrap",
  },

  brand: {
    fontSize: 23,
    fontWeight: 800,
    color: "#1d4ed8",
  },

  nav: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },

  link: {
    textDecoration: "none",
    color: "#475569",
    padding: "9px 10px",
    borderRadius: 7,
    fontSize: 14,
  },

  activeLink: {
    background: "#dbeafe",
    color: "#1d4ed8",
    fontWeight: 700,
  },

  userArea: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  username: {
    color: "#334155",
    fontSize: 14,
  },

  role: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  },

  logout: {
    background: "#dc2626",
    color: "#ffffff",
    border: 0,
    padding: "9px 13px",
    borderRadius: 7,
    cursor: "pointer",
  },

  content: {
    padding: "8px 0 30px",
  },
};


import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const employeeLinks = [
  {
    title: "My Profile",
    description: "View your account and employment information.",
    path: "/profile",
    icon: "👤",
  },
  {
    title: "My Attendance",
    description: "Check in, check out, and view attendance history.",
    path: "/attendance",
    icon: "📅",
  },
  {
    title: "My Leaves",
    description: "Apply for leave and track approval status.",
    path: "/leaves",
    icon: "📝",
  },
  {
    title: "My Payroll",
    description: "Review your salary and monthly payroll history.",
    path: "/payroll",
    icon: "💰",
  },
  {
    title: "Notifications",
    description: "Read updates about your HR requests.",
    path: "/notifications",
    icon: "🔔",
  },
];

function StatCard({ label, value, description }) {
  return (
    <article className="stat-card">
      <p className="stat-label">{label}</p>
      <h3 className="stat-value">{value ?? 0}</h3>
      {description && (
        <p className="stat-description">{description}</p>
      )}
    </article>
  );
}

function Section({ title, children }) {
  return (
    <section className="dashboard-section">
      <h2>{title}</h2>
      <div className="stats-grid">{children}</div>
    </section>
  );
}

function formatMoney(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "Not available";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatTime(value) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleTimeString();
}

export default function Dashboard() {
  const { user } = useAuth();
  const isEmployee = user?.role === "EMPLOYEE";

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const endpoint = isEmployee
        ? "/dashboard/me"
        : "/dashboard/summary";

      const response = await api.get(endpoint);
      setData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load dashboard data. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [isEmployee]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return <div className="page-loading">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <main className="page-container">
        <div className="error-panel">
          <h2>Dashboard unavailable</h2>
          <p>{String(error)}</p>
          <button
            className="primary-button"
            onClick={loadDashboard}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="page-container">
        No dashboard data available.
      </main>
    );
  }

  if (isEmployee) {
    const attendance = data.attendance_this_month || {};
    const leaves = data.leaves || {};
    const today = data.today_attendance || {};
    const payroll = data.latest_payroll;

    return (
      <main className="page-container">
        <div className="page-heading">
          <div>
            <p className="eyebrow">EMPLOYEE SELF-SERVICE PORTAL</p>
            <h1>
              Welcome, {data.employee?.full_name || user.username}
            </h1>
            <p className="muted">
              {[
                data.employee?.designation,
                data.employee?.department,
              ]
                .filter(Boolean)
                .join(" · ") || "Your WorkSphere workspace"}
            </p>
          </div>

          <span className="role-badge">
            {data.employee?.status || "EMPLOYEE"}
          </span>
        </div>

        <section className="dashboard-section">
          <h2>Your self-service portal</h2>

          <div className="stats-grid">
            {employeeLinks.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="self-service-link"
                style={styles.linkCard}
              >
                <span style={styles.linkIcon}>{item.icon}</span>
                <h3 style={styles.linkTitle}>{item.title}</h3>
                <p style={styles.linkDescription}>
                  {item.description}
                </p>
                <span style={styles.openLink}>Open page →</span>
              </Link>
            ))}
          </div>
        </section>

        <Section title="Attendance overview">
          <StatCard
            label="Records this month"
            value={attendance.total_records}
            description="Recorded attendance days"
          />
          <StatCard
            label="Present days"
            value={attendance.present_days}
            description="Days marked present"
          />
          <StatCard
            label="Today's status"
            value={today.status || "Not recorded"}
          />
          <StatCard
            label="Check-in time"
            value={formatTime(today.check_in)}
          />
        </Section>

        <Section title="Leave overview">
          <StatCard
            label="Pending requests"
            value={leaves.pending_requests}
            description="Awaiting a decision"
          />
          <StatCard
            label="Approved requests"
            value={leaves.approved_requests}
            description="Approved leave requests"
          />
        </Section>

        <section className="dashboard-section">
          <h2>Latest payroll</h2>

          {payroll ? (
            <div className="payroll-summary">
              <div>
                <span className="stat-label">Payroll month</span>
                <strong>{payroll.month}</strong>
              </div>
              <div>
                <span className="stat-label">Basic salary</span>
                <strong>{formatMoney(payroll.basic_salary)}</strong>
              </div>
              <div>
                <span className="stat-label">Bonus</span>
                <strong>{formatMoney(payroll.bonus)}</strong>
              </div>
              <div>
                <span className="stat-label">Deductions</span>
                <strong>{formatMoney(payroll.deductions)}</strong>
              </div>
              <div>
                <span className="stat-label">Net salary</span>
                <strong>{formatMoney(payroll.net_salary)}</strong>
              </div>
            </div>
          ) : (
            <p className="empty-state">
              No payroll records are available yet.
            </p>
          )}

          <p>
            <Link to="/payroll">View all my payroll records →</Link>
          </p>
        </section>

        <p className="muted dashboard-footnote">
          Your personal information is loaded from your authenticated
          WorkSphere account.
        </p>
      </main>
    );
  }

  // HR and ADMIN dashboard
  const employees = data.employees || {};
  const attendance = data.attendance_today || {};
  const leaves = data.leaves || {};
  const payroll = data.payroll_this_month || {};

  return (
    <main className="page-container">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{user.role} WORKSPACE</p>
          <h1>Dashboard & Analytics</h1>
          <p className="muted">
            Organization overview for {data.period?.date || "today"}
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={loadDashboard}
        >
          Refresh data
        </button>
      </div>

      <Section title="Employees">
        <StatCard label="Total employees" value={employees.total} />
        <StatCard label="Active employees" value={employees.active} />
        <StatCard label="Inactive employees" value={employees.inactive} />
      </Section>

      <Section title="Today's attendance">
        <StatCard label="Present" value={attendance.present} />
        <StatCard label="Absent" value={attendance.absent} />
        <StatCard label="Half day" value={attendance.half_day} />
        <StatCard label="Recorded" value={attendance.recorded} />
      </Section>

      <Section title="Leave requests">
        <StatCard
          label="Pending requests"
          value={leaves.pending_requests}
        />
        <StatCard
          label="Approved this month"
          value={leaves.approved_overlapping_this_month}
        />
        <StatCard
          label="Rejected requests"
          value={leaves.rejected_requests}
        />
      </Section>

      <Section title="Current-month payroll">
        <StatCard label="Payroll records" value={payroll.records} />
        <StatCard
          label="Total net salary"
          value={formatMoney(payroll.net_salary_total || 0)}
          description={`Month: ${payroll.month || "Not available"}`}
        />
      </Section>

      <p className="muted dashboard-footnote">
        These figures reflect records currently saved in the database.
      </p>
    </main>
  );
}

const styles = {
  linkCard: {
    display: "block",
    padding: "20px",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#172554",
    textDecoration: "none",
    boxSizing: "border-box",
  },
  linkIcon: {
    fontSize: "28px",
  },
  linkTitle: {
    margin: "12px 0 8px",
    fontSize: "18px",
  },
  linkDescription: {
    color: "#64748b",
    lineHeight: 1.5,
    minHeight: "44px",
  },
  openLink: {
    display: "inline-block",
    marginTop: "8px",
    color: "#2563eb",
    fontWeight: 600,
  },
};


import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

function StatCard({ label, value, description }) {
  return (
    <article className="stat-card">
      <p className="stat-label">{label}</p>
      <h3 className="stat-value">{value ?? 0}</h3>
      {description && <p className="stat-description">{description}</p>}
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
      const endpoint = isEmployee ? "/dashboard/me" : "/dashboard/summary";
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
          <button className="primary-button" onClick={loadDashboard}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!data) {
    return <main className="page-container">No dashboard data available.</main>;
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
            <p className="eyebrow">EMPLOYEE WORKSPACE</p>
            <h1>Welcome, {data.employee?.full_name || user.username}</h1>
            <p className="muted">
              {data.employee?.designation} · {data.employee?.department}
            </p>
          </div>
          <span className="role-badge">{data.employee?.status}</span>
        </div>

        <Section title="Your overview">
          <StatCard
            label="Attendance records this month"
            value={attendance.total_records}
            description="Recorded workdays"
          />
          <StatCard
            label="Present days"
            value={attendance.present_days}
            description="Marked present this month"
          />
          <StatCard
            label="Pending leave requests"
            value={leaves.pending_requests}
            description="Awaiting a decision"
          />
          <StatCard
            label="Approved leave requests"
            value={leaves.approved_requests}
            description="Approved requests"
          />
        </Section>

        <Section title="Today's attendance">
          <StatCard label="Status" value={today.status || "Not recorded"} />
          <StatCard
            label="Check-in"
            value={today.check_in ? new Date(today.check_in).toLocaleTimeString() : "—"}
          />
          <StatCard
            label="Check-out"
            value={today.check_out ? new Date(today.check_out).toLocaleTimeString() : "—"}
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
                <strong>{Number(payroll.basic_salary).toLocaleString()}</strong>
              </div>
              <div>
                <span className="stat-label">Bonus</span>
                <strong>{Number(payroll.bonus).toLocaleString()}</strong>
              </div>
              <div>
                <span className="stat-label">Deductions</span>
                <strong>{Number(payroll.deductions).toLocaleString()}</strong>
              </div>
              <div>
                <span className="stat-label">Net salary</span>
                <strong>{Number(payroll.net_salary).toLocaleString()}</strong>
              </div>
            </div>
          ) : (
            <p className="empty-state">No payroll records are available yet.</p>
          )}
        </section>

        <p className="muted dashboard-footnote">
          Data is loaded from the WorkSphere backend.
        </p>
      </main>
    );
  }

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
        <button className="secondary-button" onClick={loadDashboard}>
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
        <StatCard label="Pending requests" value={leaves.pending_requests} />
        <StatCard
          label="Approved this month"
          value={leaves.approved_overlapping_this_month}
        />
        <StatCard label="Rejected requests" value={leaves.rejected_requests} />
      </Section>

      <Section title="Current-month payroll">
        <StatCard label="Payroll records" value={payroll.records} />
        <StatCard
          label="Total net salary"
          value={Number(payroll.net_salary_total || 0).toLocaleString()}
          description={`Month: ${payroll.month || "—"}`}
        />
      </Section>

      <p className="muted dashboard-footnote">
        These figures reflect records currently saved in the database.
      </p>
    </main>
  );
}

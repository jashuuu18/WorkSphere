
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Payroll() {
  const { user } = useAuth();
  const isManager = ["HR", "ADMIN"].includes(user?.role);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [employeeId, setEmployeeId] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  const [form, setForm] = useState({
    employee_id: "",
    month: new Date().toISOString().slice(0, 7),
    deductions: "0",
    bonus: "0",
  });

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {};
      if (isManager && employeeId) params.employee_id = employeeId;
      if (monthFilter) params.month = monthFilter;

      const response = await api.get(
        isManager ? "/payroll/" : "/payroll/me",
        { params }
      );
      setRecords(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Could not load payroll records."
      );
    } finally {
      setLoading(false);
    }
  }, [isManager, employeeId, monthFilter]);

  useEffect(() => {
    loadPayroll();
  }, [loadPayroll]);

  function updateForm(event) {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  }

  async function createPayroll(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await api.post("/payroll/", {
        employee_id: Number(form.employee_id),
        month: form.month,
        deductions: Number(form.deductions),
        bonus: Number(form.bonus),
      });

      setMessage("Payroll record created successfully.");
      setForm((previous) => ({
        ...previous,
        employee_id: "",
        deductions: "0",
        bonus: "0",
      }));
      await loadPayroll();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Could not create payroll record."
      );
    } finally {
      setBusy(false);
    }
  }

  function money(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "—";

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  }

  return (
    <section style={styles.page}>
      <h1 style={styles.title}>Payroll Management</h1>
      <p style={styles.subtitle}>
        {isManager
          ? "Create payroll records and review employee salary details."
          : "Review your salary, deductions, bonus, and net pay."}
      </p>

      {message && <p style={styles.success}>{message}</p>}
      {error && <p style={styles.error}>{error}</p>}

      {isManager && (
        <div style={styles.panel}>
          <h2 style={styles.heading}>Create payroll record</h2>
          <form onSubmit={createPayroll} style={styles.form}>
            <label style={styles.field}>
              Employee ID
              <input
                style={styles.input}
                name="employee_id"
                type="number"
                min="1"
                required
                value={form.employee_id}
                onChange={updateForm}
                placeholder="Enter employee ID"
              />
            </label>

            <label style={styles.field}>
              Payroll month
              <input
                style={styles.input}
                name="month"
                type="month"
                required
                value={form.month}
                onChange={updateForm}
              />
            </label>

            <label style={styles.field}>
              Deductions (₹)
              <input
                style={styles.input}
                name="deductions"
                type="number"
                min="0"
                step="0.01"
                required
                value={form.deductions}
                onChange={updateForm}
              />
            </label>

            <label style={styles.field}>
              Bonus (₹)
              <input
                style={styles.input}
                name="bonus"
                type="number"
                min="0"
                step="0.01"
                required
                value={form.bonus}
                onChange={updateForm}
              />
            </label>

            <button style={styles.primaryButton} disabled={busy} type="submit">
              {busy ? "Creating..." : "Create payroll"}
            </button>
          </form>
          <p style={styles.hint}>
            The backend calculates basic salary and net salary. Deductions
            cannot exceed basic salary plus bonus.
          </p>
        </div>
      )}

      <div style={styles.panel}>
        <h2 style={styles.heading}>Payroll records</h2>
        <div style={styles.filters}>
          {isManager && (
            <label style={styles.field}>
              Employee ID
              <input
                style={styles.input}
                type="number"
                min="1"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="All employees"
              />
            </label>
          )}
          <label style={styles.field}>
            Month
            <input
              style={styles.input}
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            />
          </label>
          <button
            style={styles.secondaryButton}
            disabled={loading}
            onClick={loadPayroll}
          >
            Apply filters
          </button>
        </div>

        {loading ? (
          <p>Loading payroll records...</p>
        ) : records.length === 0 ? (
          <p style={styles.muted}>No payroll records found.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {isManager && <th style={styles.th}>Employee ID</th>}
                  <th style={styles.th}>Month</th>
                  <th style={styles.th}>Basic salary</th>
                  <th style={styles.th}>Deductions</th>
                  <th style={styles.th}>Bonus</th>
                  <th style={styles.th}>Net salary</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    {isManager && (
                      <td style={styles.td}>{record.employee_id}</td>
                    )}
                    <td style={styles.td}>{record.month}</td>
                    <td style={styles.td}>{money(record.basic_salary)}</td>
                    <td style={styles.td}>{money(record.deductions)}</td>
                    <td style={styles.td}>{money(record.bonus)}</td>
                    <td style={{ ...styles.td, fontWeight: 700 }}>
                      {money(record.net_salary)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

const styles = {
  page: { padding: 24, maxWidth: 1200, margin: "0 auto" },
  title: { margin: 0, fontSize: 30, color: "#172554" },
  subtitle: { color: "#64748b", marginTop: 8, marginBottom: 24 },
  panel: {
    background: "#fff",
    padding: 20,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    marginBottom: 20,
  },
  heading: { marginTop: 0, color: "#1e293b", fontSize: 18 },
  form: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 16,
    alignItems: "end",
  },
  filters: {
    display: "flex",
    alignItems: "end",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 20,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    color: "#475569",
    fontSize: 14,
  },
  input: {
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 7,
    fontSize: 14,
    minWidth: 150,
    boxSizing: "border-box",
  },
  primaryButton: {
    background: "#2563eb",
    color: "#fff",
    border: 0,
    padding: "11px 16px",
    borderRadius: 7,
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#f1f5f9",
    color: "#1e293b",
    border: "1px solid #cbd5e1",
    padding: "10px 14px",
    borderRadius: 7,
    cursor: "pointer",
  },
  tableWrap: { width: "100%", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", textAlign: "left" },
  th: {
    padding: 12,
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },
  td: { padding: 12, borderBottom: "1px solid #e2e8f0" },
  hint: { color: "#64748b", fontSize: 13, marginTop: 14 },
  muted: { color: "#64748b" },
  success: {
    background: "#dcfce7",
    color: "#166534",
    padding: 12,
    borderRadius: 8,
  },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: 12,
    borderRadius: 8,
  },
};


import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Payroll() {
  const { user } = useAuth();
  const role = String(user?.role || "").toUpperCase();
  const isManager = ["HR", "ADMIN"].includes(role);

  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [payslip, setPayslip] = useState(null);

  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [employeeId, setEmployeeId] = useState("");
  const [monthFilter, setMonthFilter] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const [form, setForm] = useState({
    employee_id: "",
    month: new Date().toISOString().slice(0, 7),
    deductions: "0",
    bonus: "0",
  });

  const money = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "—";

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  };

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

  const loadSummary = useCallback(async () => {
    if (!isManager) return;

    setSummaryLoading(true);

    try {
      const params = monthFilter ? { month: monthFilter } : {};
      const response = await api.get("/payroll/summary", { params });
      setSummary(response.data);
    } catch (err) {
      setSummary(null);
      setError(
        err.response?.data?.detail || "Could not load payroll summary."
      );
    } finally {
      setSummaryLoading(false);
    }
  }, [isManager, monthFilter]);

  useEffect(() => {
    loadPayroll();
  }, [loadPayroll]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

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

      await Promise.all([loadPayroll(), loadSummary()]);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Could not create payroll record."
      );
    } finally {
      setBusy(false);
    }
  }

  async function openPayslip(payrollId) {
    setError("");
    setMessage("");
    setPayslip(null);

    try {
      const response = await api.get(
        `/payroll/${payrollId}/payslip`
      );
      setPayslip(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Could not load payslip."
      );
    }
  }

  function printPayslip() {
    window.print();
  }

  return (
    <section style={styles.page}>
      <h1 style={styles.title}>Payroll Management</h1>
      <p style={styles.subtitle}>
        {isManager
          ? "Manage payroll, review monthly totals, and view payslips."
          : "Review your salary history and detailed payslips."}
      </p>

      {message && <p style={styles.success}>{message}</p>}
      {error && <p role="alert" style={styles.error}>{error}</p>}

      {isManager && (
        <div style={styles.panel}>
          <h2 style={styles.heading}>Monthly Payroll Summary</h2>

          <label style={styles.field}>
            Summary month
            <input
              style={styles.input}
              type="month"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
            />
          </label>

          {summaryLoading ? (
            <p>Loading summary...</p>
          ) : summary ? (
            <div style={styles.summaryGrid}>
              <SummaryCard
                label="Employees with payroll"
                value={summary.employee_count}
              />
              <SummaryCard
                label="Total basic salary"
                value={money(summary.total_basic_salary)}
              />
              <SummaryCard
                label="Total bonus"
                value={money(summary.total_bonus)}
              />
              <SummaryCard
                label="Total deductions"
                value={money(summary.total_deductions)}
              />
              <SummaryCard
                label="Total net salary"
                value={money(summary.total_net_salary)}
              />
            </div>
          ) : (
            <p style={styles.muted}>Summary is unavailable.</p>
          )}
        </div>
      )}

      {isManager && (
        <div style={styles.panel}>
          <h2 style={styles.heading}>Create Payroll Record</h2>

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
              Deductions (INR)
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
              Bonus (INR)
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

            <button
              style={styles.primaryButton}
              disabled={busy}
              type="submit"
            >
              {busy ? "Creating..." : "Create payroll"}
            </button>
          </form>

          <p style={styles.hint}>
            Net salary is calculated by the backend as basic salary plus
            bonus minus deductions.
          </p>
        </div>
      )}

      <div style={styles.panel}>
        <h2 style={styles.heading}>Payroll History</h2>

        <div style={styles.filters}>
          {isManager && (
            <label style={styles.field}>
              Employee ID
              <input
                style={styles.input}
                type="number"
                min="1"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                placeholder="All employees"
              />
            </label>
          )}

          <label style={styles.field}>
            Month filter
            <input
              style={styles.input}
              type="month"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
            />
          </label>

          <button
            style={styles.secondaryButton}
            disabled={loading}
            onClick={() => {
              loadPayroll();
              loadSummary();
            }}
            type="button"
          >
            Refresh records
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
                  <th style={styles.th}>Payslip</th>
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
                    <td style={styles.td}>
                      <button
                        type="button"
                        style={styles.smallButton}
                        onClick={() => openPayslip(record.id)}
                      >
                        View payslip
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {payslip && (
        <div style={styles.overlay}>
          <div style={styles.payslip} id="payslip-print">
            <div style={styles.payslipHeader}>
              <div>
                <h2 style={styles.title}>WorkSphere</h2>
                <p style={styles.muted}>Employee Salary Payslip</p>
              </div>
              <button
                type="button"
                style={styles.closeButton}
                onClick={() => setPayslip(null)}
              >
                Close
              </button>
            </div>

            <h3 style={styles.heading}>Employee Details</h3>
            <div style={styles.detailGrid}>
              <Detail label="Employee name" value={payslip.employee_name} />
              <Detail label="Employee ID" value={payslip.employee_id} />
              <Detail label="Designation" value={payslip.designation} />
              <Detail label="Department" value={payslip.department} />
              <Detail label="Payroll month" value={payslip.month} />
            </div>

            <h3 style={styles.heading}>Salary Breakdown</h3>
            <table style={styles.table}>
              <tbody>
                <tr>
                  <td style={styles.td}>Basic salary</td>
                  <td style={styles.amountCell}>
                    {money(payslip.basic_salary)}
                  </td>
                </tr>
                <tr>
                  <td style={styles.td}>Bonus</td>
                  <td style={styles.amountCell}>
                    {money(payslip.bonus)}
                  </td>
                </tr>
                <tr>
                  <td style={styles.td}>Deductions</td>
                  <td style={styles.amountCell}>
                    - {money(payslip.deductions)}
                  </td>
                </tr>
                <tr>
                  <td style={styles.netLabel}>Net salary</td>
                  <td style={styles.netAmount}>
                    {money(payslip.net_salary)}
                  </td>
                </tr>
              </tbody>
            </table>

            <p style={styles.hint}>
              This payslip reflects the payroll record stored in WorkSphere.
            </p>

            <button
              type="button"
              style={styles.primaryButton}
              onClick={printPayslip}
            >
              Print payslip
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div style={styles.summaryCard}>
      <p style={styles.summaryLabel}>{label}</p>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <p style={styles.summaryLabel}>{label}</p>
      <strong>{value ?? "—"}</strong>
    </div>
  );
}

const styles = {
  page: {
    padding: 24,
    maxWidth: 1200,
    margin: "0 auto",
    color: "#334155",
  },
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
    marginBottom: 14,
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
  smallButton: {
    background: "#dbeafe",
    color: "#1d4ed8",
    border: 0,
    padding: "8px 10px",
    borderRadius: 6,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  closeButton: {
    background: "#f1f5f9",
    border: "1px solid #cbd5e1",
    padding: "8px 12px",
    borderRadius: 7,
    cursor: "pointer",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
    marginTop: 20,
  },
  summaryCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 16,
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 0,
    marginBottom: 8,
  },
  summaryValue: {
    color: "#1e3a8a",
    fontWeight: 700,
    fontSize: 20,
    overflowWrap: "anywhere",
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
  amountCell: {
    padding: 12,
    borderBottom: "1px solid #e2e8f0",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  netLabel: {
    padding: 12,
    borderTop: "2px solid #cbd5e1",
    fontWeight: 700,
  },
  netAmount: {
    padding: 12,
    borderTop: "2px solid #cbd5e1",
    fontWeight: 800,
    color: "#166534",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 16,
    marginBottom: 24,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.55)",
    zIndex: 1000,
    overflowY: "auto",
    padding: 20,
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
  },
  payslip: {
    background: "#fff",
    width: "100%",
    maxWidth: 760,
    padding: 28,
    borderRadius: 12,
    margin: "20px auto",
    boxSizing: "border-box",
  },
  payslipHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 28,
  },
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


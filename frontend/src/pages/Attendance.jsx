
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Attendance() {
  const { user } = useAuth();
  const isManager = ["HR", "ADMIN"].includes(user?.role);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {};

      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      if (isManager && employeeId) {
        params.employee_id = Number(employeeId);
      }

      const response = await api.get(
        isManager ? "/attendance/" : "/attendance/me",
        { params }
      );

      setRecords(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load attendance records."
      );
    } finally {
      setLoading(false);
    }
  }, [isManager, employeeId, startDate, endDate]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  async function performAction(action) {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await api.post(`/attendance/${action}`);

      setMessage(
        action === "check-in"
          ? "Check-in successful!"
          : "Check-out successful!"
      );

      await loadAttendance();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Attendance action failed. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  function formatDate(value) {
    if (!value) return "—";
    return String(value).slice(0, 10);
  }

  function formatDateTime(value) {
    if (!value) return "—";

    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleString();
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Attendance Management</h1>
          <p style={styles.subtitle}>
            Track daily attendance and working hours.
          </p>
        </div>

        {!isManager && (
          <div style={styles.actions}>
            <button
              type="button"
              style={styles.primaryButton}
              disabled={busy}
              onClick={() => performAction("check-in")}
            >
              {busy ? "Please wait..." : "Check In"}
            </button>

            <button
              type="button"
              style={styles.secondaryButton}
              disabled={busy}
              onClick={() => performAction("check-out")}
            >
              Check Out
            </button>
          </div>
        )}
      </header>

      {message && <div style={styles.success}>{message}</div>}
      {error && <div style={styles.error}>{error}</div>}

      <section style={styles.panel}>
        <h2 style={styles.heading}>Filter Attendance</h2>

        <div style={styles.filters}>
          {isManager && (
            <label style={styles.field}>
              Employee ID
              <input
                style={styles.input}
                type="number"
                min="1"
                placeholder="All employees"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
              />
            </label>
          )}

          <label style={styles.field}>
            Start Date
            <input
              style={styles.input}
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>

          <label style={styles.field}>
            End Date
            <input
              style={styles.input}
              type="date"
              min={startDate || undefined}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={loadAttendance}
            disabled={loading}
          >
            Apply Filters
          </button>

          <button
            type="button"
            style={styles.textButton}
            onClick={() => {
              setEmployeeId("");
              setStartDate("");
              setEndDate("");
            }}
          >
            Clear Filters
          </button>
        </div>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.heading}>
          {isManager ? "Employee Attendance Records" : "My Attendance History"}
        </h2>

        {loading ? (
          <p style={styles.muted}>Loading attendance records...</p>
        ) : records.length === 0 ? (
          <p style={styles.muted}>No attendance records found.</p>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {isManager && <th style={styles.th}>Employee ID</th>}
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Check In</th>
                  <th style={styles.th}>Check Out</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>

              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    {isManager && (
                      <td style={styles.td}>{record.employee_id}</td>
                    )}

                    <td style={styles.td}>{formatDate(record.date)}</td>
                    <td style={styles.td}>
                      {formatDateTime(record.check_in)}
                    </td>
                    <td style={styles.td}>
                      {formatDateTime(record.check_out)}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.status}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

const styles = {
  page: {
    padding: "24px",
    maxWidth: "1200px",
    margin: "0 auto",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
    marginBottom: "24px",
  },
  title: {
    margin: 0,
    fontSize: "30px",
    color: "#172554",
  },
  subtitle: {
    color: "#64748b",
    marginTop: "8px",
  },
  actions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  panel: {
    background: "#ffffff",
    padding: "20px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    marginBottom: "20px",
  },
  heading: {
    marginTop: 0,
    fontSize: "19px",
    color: "#1e293b",
  },
  filters: {
    display: "flex",
    alignItems: "end",
    flexWrap: "wrap",
    gap: "14px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    color: "#475569",
    fontSize: "14px",
  },
  input: {
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    minWidth: "150px",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  primaryButton: {
    background: "#2563eb",
    color: "#ffffff",
    border: 0,
    padding: "11px 16px",
    borderRadius: "7px",
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#f1f5f9",
    color: "#1e293b",
    border: "1px solid #cbd5e1",
    padding: "10px 14px",
    borderRadius: "7px",
    cursor: "pointer",
  },
  textButton: {
    background: "transparent",
    color: "#2563eb",
    border: 0,
    padding: "10px",
    cursor: "pointer",
  },
  tableContainer: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
  },
  th: {
    padding: "12px",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #e2e8f0",
  },
  status: {
    background: "#dbeafe",
    color: "#1d4ed8",
    borderRadius: "20px",
    padding: "4px 9px",
    fontSize: "12px",
  },
  muted: {
    color: "#64748b",
  },
  success: {
    background: "#dcfce7",
    color: "#166534",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "16px",
  },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "16px",
  },
};

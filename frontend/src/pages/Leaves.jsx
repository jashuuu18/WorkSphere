
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Leaves() {
  const { user } = useAuth();
  const isManager = ["HR", "ADMIN"].includes(user?.role);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [leaveType, setLeaveType] = useState("CASUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const [employeeId, setEmployeeId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadLeaves = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {};
      if (isManager && employeeId) params.employee_id = employeeId;
      if (isManager && statusFilter) params.status = statusFilter;

      const response = await api.get(
        isManager ? "/leaves/" : "/leaves/me",
        { params }
      );
      setRecords(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Could not load leave requests."
      );
    } finally {
      setLoading(false);
    }
  }, [isManager, employeeId, statusFilter]);

  useEffect(() => {
    loadLeaves();
  }, [loadLeaves]);

  async function applyForLeave(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await api.post("/leaves/", {
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
      });

      setMessage("Leave request submitted successfully.");
      setStartDate("");
      setEndDate("");
      setReason("");
      await loadLeaves();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Could not submit your leave request."
      );
    } finally {
      setBusy(false);
    }
  }

  async function decideLeave(leaveId, decision) {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await api.patch(`/leaves/${leaveId}/decision`, { decision });
      setMessage(`Leave request ${decision.toLowerCase()} successfully.`);
      await loadLeaves();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Could not update the leave request."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={styles.page}>
      <h1 style={styles.title}>Leave Management</h1>
      <p style={styles.subtitle}>
        {isManager
          ? "Review employee leave requests and record decisions."
          : "Submit a leave request and track its status."}
      </p>

      {message && <p style={styles.success}>{message}</p>}
      {error && <p style={styles.error}>{error}</p>}

      {!isManager && (
        <div style={styles.panel}>
          <h2 style={styles.heading}>Apply for leave</h2>
          <form onSubmit={applyForLeave} style={styles.form}>
            <label style={styles.field}>
              Leave type
              <select
                style={styles.input}
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
              >
                <option value="SICK">Sick leave</option>
                <option value="CASUAL">Casual leave</option>
                <option value="PAID">Paid leave</option>
              </select>
            </label>

            <label style={styles.field}>
              Start date
              <input
                style={styles.input}
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>

            <label style={styles.field}>
              End date
              <input
                style={styles.input}
                type="date"
                min={startDate || undefined}
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>

            <label style={styles.field}>
              Reason
              <textarea
                style={{ ...styles.input, minHeight: 90 }}
                required
                minLength={3}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter the reason for your leave"
              />
            </label>

            <button style={styles.primaryButton} disabled={busy} type="submit">
              {busy ? "Submitting..." : "Submit leave request"}
            </button>
          </form>
        </div>
      )}

      {isManager && (
        <div style={styles.panel}>
          <h2 style={styles.heading}>Filter requests</h2>
          <div style={styles.filters}>
            <label style={styles.field}>
              Employee ID
              <input
                style={styles.input}
                type="number"
                min="1"
                placeholder="All employees"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              />
            </label>
            <label style={styles.field}>
              Status
              <select
                style={styles.input}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </label>
            <button
              style={styles.secondaryButton}
              onClick={loadLeaves}
              disabled={loading}
            >
              Apply filters
            </button>
          </div>
        </div>
      )}

      <div style={styles.panel}>
        <h2 style={styles.heading}>
          {isManager ? "Employee leave requests" : "My leave requests"}
        </h2>

        {loading ? (
          <p>Loading leave requests...</p>
        ) : records.length === 0 ? (
          <p style={styles.muted}>No leave requests found.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {isManager && <th style={styles.th}>Employee ID</th>}
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Start date</th>
                  <th style={styles.th}>End date</th>
                  <th style={styles.th}>Reason</th>
                  <th style={styles.th}>Status</th>
                  {isManager && <th style={styles.th}>Decision</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    {isManager && (
                      <td style={styles.td}>{record.employee_id}</td>
                    )}
                    <td style={styles.td}>{record.leave_type}</td>
                    <td style={styles.td}>{record.start_date}</td>
                    <td style={styles.td}>{record.end_date}</td>
                    <td style={styles.td}>{record.reason}</td>
                    <td style={styles.td}>
                      <span style={styles.status}>{record.status}</span>
                    </td>
                    {isManager && (
                      <td style={styles.td}>
                        {record.status === "PENDING" ? (
                          <div style={styles.actions}>
                            <button
                              style={styles.approveButton}
                              disabled={busy}
                              onClick={() =>
                                decideLeave(record.id, "APPROVED")
                              }
                            >
                              Approve
                            </button>
                            <button
                              style={styles.rejectButton}
                              disabled={busy}
                              onClick={() =>
                                decideLeave(record.id, "REJECTED")
                              }
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          "Decided"
                        )}
                      </td>
                    )}
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
  form: { display: "grid", gap: 16, maxWidth: 620 },
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
    width: "100%",
    boxSizing: "border-box",
  },
  filters: { display: "flex", alignItems: "end", flexWrap: "wrap", gap: 14 },
  actions: { display: "flex", flexWrap: "wrap", gap: 6 },
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
  approveButton: {
    background: "#15803d",
    color: "#fff",
    border: 0,
    padding: "7px 10px",
    borderRadius: 6,
    cursor: "pointer",
  },
  rejectButton: {
    background: "#b91c1c",
    color: "#fff",
    border: 0,
    padding: "7px 10px",
    borderRadius: 6,
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
  status: {
    background: "#dbeafe",
    color: "#1d4ed8",
    borderRadius: 20,
    padding: "4px 9px",
    fontSize: 12,
  },
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


import { useCallback, useEffect, useState } from "react";
import api from "../services/api";

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {};

      if (search.trim()) params.search = search.trim();
      if (department.trim()) params.department = department.trim();
      if (status) params.status = status;

      const response = await api.get("/employees/", { params });
      setEmployees(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load employees. Confirm you are logged in as HR or Admin."
      );
    } finally {
      setLoading(false);
    }
  }, [search, department, status]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Employee Management</h1>
          <p style={styles.subtitle}>
            View and search employee information.
          </p>
        </div>

        <button
          type="button"
          style={styles.button}
          onClick={loadEmployees}
          disabled={loading}
        >
          Refresh
        </button>
      </header>

      {error && <p style={styles.error}>{error}</p>}

      <section style={styles.panel}>
        <h2 style={styles.heading}>Search Employees</h2>

        <div style={styles.filters}>
          <label style={styles.field}>
            Search
            <input
              style={styles.input}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employee"
            />
          </label>

          <label style={styles.field}>
            Department
            <input
              style={styles.input}
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="e.g. IT"
            />
          </label>

          <label style={styles.field}>
            Employment Status
            <select
              style={styles.input}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>

          <button
            type="button"
            style={styles.button}
            onClick={loadEmployees}
            disabled={loading}
          >
            Apply Filters
          </button>

          <button
            type="button"
            style={styles.clearButton}
            onClick={() => {
              setSearch("");
              setDepartment("");
              setStatus("");
            }}
          >
            Clear
          </button>
        </div>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.heading}>
          Employee Records ({employees.length})
        </h2>

        {loading ? (
          <p style={styles.muted}>Loading employees...</p>
        ) : employees.length === 0 ? (
          <p style={styles.muted}>No employees found.</p>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Full Name</th>
                  <th style={styles.th}>Designation</th>
                  <th style={styles.th}>Department</th>
                  <th style={styles.th}>Joining Date</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>

              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td style={styles.td}>{employee.id}</td>
                    <td style={styles.td}>{employee.full_name}</td>
                    <td style={styles.td}>{employee.designation || "—"}</td>
                    <td style={styles.td}>{employee.department || "—"}</td>
                    <td style={styles.td}>
                      {employee.joining_date || "—"}
                    </td>
                    <td style={styles.td}>
                      <span
                        style={
                          employee.status === "ACTIVE"
                            ? styles.active
                            : styles.inactive
                        }
                      >
                        {employee.status || "—"}
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
  page: { padding: 24, maxWidth: 1300, margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  title: { margin: 0, fontSize: 30, color: "#172554" },
  subtitle: { color: "#64748b" },
  panel: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  heading: { marginTop: 0, fontSize: 19, color: "#1e293b" },
  filters: {
    display: "flex",
    alignItems: "end",
    flexWrap: "wrap",
    gap: 14,
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
    minWidth: 160,
    fontSize: 14,
  },
  button: {
    background: "#2563eb",
    color: "#fff",
    border: 0,
    borderRadius: 7,
    padding: "11px 15px",
    cursor: "pointer",
  },
  clearButton: {
    background: "#f1f5f9",
    color: "#334155",
    border: "1px solid #cbd5e1",
    borderRadius: 7,
    padding: "10px 15px",
    cursor: "pointer",
  },
  tableContainer: { overflowX: "auto", width: "100%" },
  table: { width: "100%", borderCollapse: "collapse", textAlign: "left" },
  th: {
    background: "#f8fafc",
    padding: 12,
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },
  td: { padding: 12, borderBottom: "1px solid #e2e8f0" },
  active: {
    background: "#dcfce7",
    color: "#166534",
    padding: "4px 9px",
    borderRadius: 20,
    fontSize: 12,
  },
  inactive: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "4px 9px",
    borderRadius: 20,
    fontSize: 12,
  },
  muted: { color: "#64748b" },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: 12,
    borderRadius: 8,
  },
};

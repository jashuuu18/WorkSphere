
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";

const styles = {
  page: {
    padding: "24px",
    maxWidth: "1200px",
    margin: "0 auto",
    color: "#172033",
  },
  heading: { marginBottom: "6px", fontSize: "28px" },
  subtitle: { color: "#64748b", marginTop: 0, marginBottom: "24px" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
    marginBottom: "24px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
  },
  cardTitle: { marginTop: 0, marginBottom: "18px", fontSize: "18px" },
  label: {
    display: "block",
    fontSize: "14px",
    fontWeight: 600,
    marginBottom: "6px",
  },
  input: {
    boxSizing: "border-box",
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    marginBottom: "14px",
    fontSize: "14px",
    background: "#fff",
  },
  button: {
    padding: "10px 15px",
    border: 0,
    borderRadius: "7px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "8px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    background: "#fff",
    color: "#334155",
    cursor: "pointer",
  },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "14px" },
  th: {
    textAlign: "left",
    background: "#f8fafc",
    color: "#475569",
    padding: "12px",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #e2e8f0",
    verticalAlign: "middle",
  },
  badge: {
    display: "inline-block",
    padding: "4px 9px",
    borderRadius: "20px",
    background: "#dbeafe",
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: 600,
  },
  notice: {
    padding: "12px 14px",
    borderRadius: "8px",
    marginBottom: "18px",
    fontSize: "14px",
  },
};

function getStoredUser() {
  for (const key of ["user", "current_user", "auth_user"]) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      if (value && typeof value === "object") return value;
    } catch {
      // Ignore invalid stored JSON.
    }
  }

  // If the app stores only a JWT, try reading its role claim.
  try {
    const token = localStorage.getItem("access_token");
    if (token) {
      const payload = token.split(".")[1];
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = JSON.parse(atob(normalized));
      return { role: decoded.role || decoded.user_role || "" };
    }
  } catch {
    // The backend remains responsible for authorization.
  }

  return {};
}

function formatTime(value) {
  if (!value) return "—";
  return String(value).slice(0, 5);
}

function getErrorMessage(error) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || "Invalid input").join(", ");
  }

  return error?.message || "Something went wrong. Please try again.";
}

export default function Shifts() {
  const [user] = useState(getStoredUser);
  const role = String(user.role || "").toUpperCase();
  const isManager = ["HR", "ADMIN"].includes(role);

  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [myShift, setMyShift] = useState(null);

  const [shiftName, setShiftName] = useState("Morning");
  const [startTime, setStartTime] = useState("09:30");
  const [endTime, setEndTime] = useState("18:30");
  const [employeeId, setEmployeeId] = useState("");
  const [shiftId, setShiftId] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingShift, setSavingShift] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const shiftResponse = await api.get("/shifts/");
      const shiftList = Array.isArray(shiftResponse.data)
        ? shiftResponse.data
        : [];

      setShifts(shiftList);
      setShiftId((current) => {
        if (current && shiftList.some((shift) => String(shift.id) === current)) {
          return current;
        }
        return shiftList.length ? String(shiftList[0].id) : "";
      });

      if (isManager) {
        const [employeeResponse, assignmentResponse] = await Promise.all([
          api.get("/employees/"),
          api.get("/shifts/assignments"),
        ]);

        const employeeData = Array.isArray(employeeResponse.data)
          ? employeeResponse.data
          : employeeResponse.data?.items || [];

        setEmployees(
          employeeData.filter(
            (employee) =>
              String(employee.status || "ACTIVE").toUpperCase() === "ACTIVE"
          )
        );
        setAssignments(
          Array.isArray(assignmentResponse.data) ? assignmentResponse.data : []
        );
      } else {
        const response = await api.get("/shifts/me");
        setMyShift(response.data);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [isManager]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function createShift(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!shiftName.trim() || !startTime || !endTime) {
      setError("Please complete all shift fields.");
      return;
    }

    if (startTime === endTime) {
      setError("Start and end times cannot be identical.");
      return;
    }

    setSavingShift(true);

    try {
      const response = await api.post("/shifts/", {
        name: shiftName.trim(),
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
      });

      setSuccess(`The ${response.data.name} shift was created successfully.`);
      setShiftName("");
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSavingShift(false);
    }
  }

  async function assignShift(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!employeeId || !shiftId) {
      setError("Select both an employee and a shift.");
      return;
    }

    setSavingAssignment(true);

    try {
      await api.post("/shifts/assign", {
        employee_id: Number(employeeId),
        shift_id: Number(shiftId),
      });

      setSuccess("Shift assigned successfully.");
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSavingAssignment(false);
    }
  }

  async function removeAssignment(id) {
    const confirmed = window.confirm(
      "Are you sure you want to remove this employee's shift assignment?"
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await api.delete(`/shifts/assignments/${id}`);
      setSuccess("Shift assignment removed successfully.");
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  return (
    <main style={styles.page}>
      <h1 style={styles.heading}>Shift Management</h1>
      <p style={styles.subtitle}>
        Manage employee shifts and view work schedules.
      </p>

      {error && (
        <div
          role="alert"
          style={{
            ...styles.notice,
            background: "#fee2e2",
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          style={{
            ...styles.notice,
            background: "#dcfce7",
            color: "#166534",
          }}
        >
          {success}
        </div>
      )}

      {loading ? (
        <p>Loading shift information...</p>
      ) : (
        <>
          {!isManager && (
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>My Shift Schedule</h2>

              {myShift?.shift_name ? (
                <>
                  <p>
                    <strong>Shift:</strong> {myShift.shift_name}
                  </p>
                  <p>
                    <strong>Start time:</strong>{" "}
                    {formatTime(myShift.start_time)}
                  </p>
                  <p>
                    <strong>End time:</strong> {formatTime(myShift.end_time)}
                  </p>
                  <p>
                    <strong>Employee:</strong>{" "}
                    {myShift.employee_name || "My profile"}
                  </p>
                </>
              ) : (
                <p>
                  {myShift?.message ||
                    "No shift has been assigned to you yet."}
                </p>
              )}
            </section>
          )}

          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Available Shifts</h2>

            {shifts.length === 0 ? (
              <p>No shifts have been created yet.</p>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Shift ID</th>
                      <th style={styles.th}>Shift Name</th>
                      <th style={styles.th}>Start Time</th>
                      <th style={styles.th}>End Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((shift) => (
                      <tr key={shift.id}>
                        <td style={styles.td}>{shift.id}</td>
                        <td style={styles.td}>
                          <span style={styles.badge}>{shift.name}</span>
                        </td>
                        <td style={styles.td}>
                          {formatTime(shift.start_time)}
                        </td>
                        <td style={styles.td}>
                          {formatTime(shift.end_time)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {isManager && (
            <>
              <div style={{ height: 20 }} />

              <div style={styles.grid}>
                <section style={styles.card}>
                  <h2 style={styles.cardTitle}>Create a Shift</h2>

                  <form onSubmit={createShift}>
                    <label style={styles.label} htmlFor="shift-name">
                      Shift name
                    </label>
                    <input
                      id="shift-name"
                      style={styles.input}
                      value={shiftName}
                      onChange={(event) => setShiftName(event.target.value)}
                      placeholder="e.g. Morning"
                      minLength={2}
                      maxLength={50}
                      required
                    />

                    <label style={styles.label} htmlFor="shift-start">
                      Start time
                    </label>
                    <input
                      id="shift-start"
                      type="time"
                      style={styles.input}
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                      required
                    />

                    <label style={styles.label} htmlFor="shift-end">
                      End time
                    </label>
                    <input
                      id="shift-end"
                      type="time"
                      style={styles.input}
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                      required
                    />

                    <button
                      type="submit"
                      style={styles.button}
                      disabled={savingShift}
                    >
                      {savingShift ? "Creating..." : "Create Shift"}
                    </button>
                  </form>
                </section>

                <section style={styles.card}>
                  <h2 style={styles.cardTitle}>Assign Shift to Employee</h2>

                  <form onSubmit={assignShift}>
                    <label style={styles.label} htmlFor="employee">
                      Employee
                    </label>
                    <select
                      id="employee"
                      style={styles.input}
                      value={employeeId}
                      onChange={(event) => setEmployeeId(event.target.value)}
                      required
                    >
                      <option value="">Select an employee</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.full_name} — ID {employee.id}
                        </option>
                      ))}
                    </select>

                    <label style={styles.label} htmlFor="shift">
                      Shift
                    </label>
                    <select
                      id="shift"
                      style={styles.input}
                      value={shiftId}
                      onChange={(event) => setShiftId(event.target.value)}
                      required
                    >
                      <option value="">Select a shift</option>
                      {shifts.map((shift) => (
                        <option key={shift.id} value={shift.id}>
                          {shift.name} ({formatTime(shift.start_time)}–
                          {formatTime(shift.end_time)})
                        </option>
                      ))}
                    </select>

                    <button
                      type="submit"
                      style={styles.button}
                      disabled={
                        savingAssignment ||
                        employees.length === 0 ||
                        shifts.length === 0
                      }
                    >
                      {savingAssignment ? "Assigning..." : "Assign Shift"}
                    </button>

                    {employees.length === 0 && (
                      <p style={{ color: "#b45309", fontSize: 13 }}>
                        No active employees are available. Create an employee
                        profile first.
                      </p>
                    )}
                  </form>
                </section>
              </div>

              <section style={styles.card}>
                <h2 style={styles.cardTitle}>Employee Shift Assignments</h2>

                {assignments.length === 0 ? (
                  <p>No employee shifts have been assigned yet.</p>
                ) : (
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Employee</th>
                          <th style={styles.th}>Department</th>
                          <th style={styles.th}>Shift</th>
                          <th style={styles.th}>Working Hours</th>
                          <th style={styles.th}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignments.map((assignment) => (
                          <tr key={assignment.id}>
                            <td style={styles.td}>
                              {assignment.employee_name}
                              <div style={{ color: "#64748b", fontSize: 12 }}>
                                ID: {assignment.employee_id}
                              </div>
                            </td>
                            <td style={styles.td}>
                              {assignment.department || "—"}
                            </td>
                            <td style={styles.td}>
                              <span style={styles.badge}>
                                {assignment.shift_name}
                              </span>
                            </td>
                            <td style={styles.td}>
                              {formatTime(assignment.start_time)} –{" "}
                              {formatTime(assignment.end_time)}
                            </td>
                            <td style={styles.td}>
                              <button
                                type="button"
                                style={styles.secondaryButton}
                                onClick={() =>
                                  removeAssignment(assignment.employee_id)
                                }
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          <div style={{ marginTop: 20 }}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={loadData}
            >
              Refresh Data
            </button>
          </div>
        </>
      )}
    </main>
  );
}


import { useCallback, useEffect, useState } from "react";
import api from "../services/api";

function formatMinutes(minutes) {
  if (minutes == null) return "—";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m`;
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "—";

  return new Date(value).toLocaleString();
}

export default function Attendance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [absenceDate, setAbsenceDate] = useState("");
  const [absenceResult, setAbsenceResult] = useState(null);

  // Change these values if your app uses different role names in localStorage.
  const storedRole = localStorage.getItem("role") || "";
  const role = storedRole.toUpperCase();
  const canManageAttendance = ["HR", "ADMIN"].includes(role);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {};

      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const endpoint = canManageAttendance
        ? "/attendance/"
        : "/attendance/me";

      const response = await api.get(endpoint, { params });
      setRecords(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Could not load attendance records."
      );
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, canManageAttendance]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  async function performAttendanceAction(action) {
    setWorking(true);
    setError("");
    setMessage("");

    try {
      const response = await api.post(`/attendance/${action}`);

      setMessage(
        action === "check-in"
          ? "Check-in recorded successfully."
          : "Check-out recorded successfully."
      );

      if (response.data) {
        setMessage(
          `${action === "check-in" ? "Check-in" : "Check-out"} recorded successfully.`
        );
      }

      await loadAttendance();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          `Could not complete ${action}.`
      );
    } finally {
      setWorking(false);
    }
  }

  async function markAbsent(event) {
    event.preventDefault();

    if (!absenceDate) {
      setError("Please select a date.");
      return;
    }

    setWorking(true);
    setError("");
    setMessage("");
    setAbsenceResult(null);

    try {
      const response = await api.post("/attendance/mark-absent", null, {
        params: { attendance_date: absenceDate },
      });

      setAbsenceResult(response.data);
      setMessage(response.data.message || "Absence marking completed.");
      await loadAttendance();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Could not mark absent employees."
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="attendance-page">
      <h1>Attendance Management</h1>
      <p>Track attendance, late arrivals, worked time, and overtime.</p>

      {error && (
        <div role="alert" className="attendance-alert attendance-error">
          {typeof error === "string" ? error : JSON.stringify(error)}
        </div>
      )}

      {message && (
        <div role="status" className="attendance-alert attendance-success">
          {message}
        </div>
      )}

      {!canManageAttendance && (
        <section className="attendance-actions">
          <button
            type="button"
            disabled={working}
            onClick={() => performAttendanceAction("check-in")}
          >
            {working ? "Please wait..." : "Check In"}
          </button>

          <button
            type="button"
            disabled={working}
            onClick={() => performAttendanceAction("check-out")}
          >
            {working ? "Please wait..." : "Check Out"}
          </button>
        </section>
      )}

      {canManageAttendance && (
        <section className="attendance-panel">
          <h2>Mark Absences</h2>
          <p>
            Marks active employees absent on an eligible weekday if they
            have no attendance record and no approved leave.
          </p>

          <form onSubmit={markAbsent}>
            <label htmlFor="absence-date">Attendance date</label>
            <input
              id="absence-date"
              type="date"
              value={absenceDate}
              onChange={(event) => setAbsenceDate(event.target.value)}
              required
            />

            <button type="submit" disabled={working}>
              {working ? "Processing..." : "Mark Absences"}
            </button>
          </form>

          {absenceResult && (
            <div className="attendance-result">
              <p><strong>Date:</strong> {absenceResult.date}</p>
              <p><strong>Marked absent:</strong> {absenceResult.marked_absent}</p>
              <p><strong>Skipped existing records:</strong> {absenceResult.skipped_existing}</p>
              <p><strong>Skipped approved leave:</strong> {absenceResult.skipped_on_approved_leave}</p>
            </div>
          )}
        </section>
      )}

      <section className="attendance-panel">
        <h2>{canManageAttendance ? "All Attendance Records" : "My Attendance"}</h2>

        <div className="attendance-filters">
          <label>
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>

          <label>
            End date
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>

          <button type="button" onClick={loadAttendance} disabled={loading}>
            Apply Filters
          </button>

          <button
            type="button"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
          >
            Clear Filters
          </button>
        </div>

        {loading ? (
          <p>Loading attendance...</p>
        ) : records.length === 0 ? (
          <p>No attendance records found for the selected dates.</p>
        ) : (
          <div className="attendance-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  {canManageAttendance && <th>Employee ID</th>}
                  <th>Status</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Late</th>
                  <th>Worked</th>
                  <th>Overtime</th>
                </tr>
              </thead>

              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{formatDate(record.date)}</td>
                    {canManageAttendance && <td>{record.employee_id}</td>}
                    <td>{record.status}</td>
                    <td>{formatDateTime(record.check_in)}</td>
                    <td>{formatDateTime(record.check_out)}</td>
                    <td>
                      {record.is_late
                        ? `Yes (${record.late_minutes} min)`
                        : "No"}
                    </td>
                    <td>{formatMinutes(record.worked_minutes)}</td>
                    <td>{formatMinutes(record.overtime_minutes)}</td>
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

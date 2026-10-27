
import { useEffect, useState } from "react";
import api from "../services/api";
import "./Analytics.css";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function sixMonthsAgoString() {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().slice(0, 10);
}

function Metric({ label, value }) {
  return (
    <article className="analytics-metric">
      <p>{label}</p>
      <strong>{value ?? "—"}</strong>
    </article>
  );
}

function StatusSummary({ title, values }) {
  return (
    <section className="analytics-card">
      <h2>{title}</h2>
      {Object.keys(values || {}).length === 0 ? (
        <p>No records found.</p>
      ) : (
        <div className="analytics-status-list">
          {Object.entries(values).map(([key, value]) => (
            <div className="analytics-status-item" key={key}>
              <span>{key.replaceAll("_", " ")}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Analytics() {
  const [startDate, setStartDate] = useState(sixMonthsAgoString);
  const [endDate, setEndDate] = useState(todayString);
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState([]);
  const [overview, setOverview] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [departmentReports, setDepartmentReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadAnalytics(event) {
    event?.preventDefault();
    setError("");

    if (startDate > endDate) {
      setError("Start date cannot be after end date.");
      return;
    }

    if (endDate > todayString()) {
      setError("End date cannot be in the future.");
      return;
    }

    const params = {
      start_date: startDate,
      end_date: endDate,
    };

    if (department.trim()) {
      params.department = department.trim();
    }

    setLoading(true);

    try {
      const [
        overviewResponse,
        attendanceResponse,
        leaveResponse,
        performanceResponse,
        departmentsResponse,
      ] = await Promise.all([
        api.get("/analytics/overview", { params }),
        api.get("/analytics/attendance-trends", { params }),
        api.get("/analytics/leave-trends", { params }),
        api.get("/analytics/performance", { params }),
        api.get("/analytics/departments", {
          params: {
            start_date: startDate,
            end_date: endDate,
          },
        }),
      ]);

      setOverview(overviewResponse.data);
      setAttendance(attendanceResponse.data.trends || []);
      setLeaves(leaveResponse.data);
      setPerformance(performanceResponse.data);
      setDepartmentReports(
        department.trim()
          ? departmentsResponse.data.departments.filter(
              (item) =>
                item.department.toLowerCase() ===
                department.trim().toLowerCase()
            )
          : departmentsResponse.data.departments
      );

      setDepartments(
        departmentsResponse.data.departments.map(
          (item) => item.department
        )
      );
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load analytics. Please sign in with an HR or Admin account."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  return (
    <main className="analytics-page">
      <header className="analytics-header">
        <div>
          <h1>Advanced Analytics & Reports</h1>
          <p>
            Explore attendance, leave, performance, and department statistics.
          </p>
        </div>
      </header>

      <form className="analytics-filters" onSubmit={loadAnalytics}>
        <div>
          <label htmlFor="analytics-start-date">Start date</label>
          <input
            id="analytics-start-date"
            type="date"
            required
            value={startDate}
            max={endDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="analytics-end-date">End date</label>
          <input
            id="analytics-end-date"
            type="date"
            required
            value={endDate}
            min={startDate}
            max={todayString()}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="analytics-department">Department</label>
          <select
            id="analytics-department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          >
            <option value="">All departments</option>
            {departments.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Loading..." : "Apply Filters"}
        </button>
      </form>

      {error && (
        <div className="analytics-error">{String(error)}</div>
      )}

      {loading && !overview ? (
        <section className="analytics-card">
          <p>Loading reports...</p>
        </section>
      ) : overview ? (
        <>
          <section className="analytics-metrics">
            <Metric
              label="Total Employees"
              value={overview.total_employees}
            />
            <Metric
              label="Active Employees"
              value={overview.active_employees}
            />
            <Metric
              label="Attendance Records"
              value={overview.attendance_records}
            />
            <Metric
              label="Leave Records"
              value={overview.leave_records}
            />
            <Metric
              label="Performance Reviews"
              value={overview.performance_reviews}
            />
            <Metric
              label="Average Performance Rating"
              value={
                overview.average_performance_rating == null
                  ? "N/A"
                  : `${overview.average_performance_rating}/5`
              }
            />
          </section>

          <section className="analytics-grid">
            <StatusSummary
              title="Attendance Summary"
              values={overview.attendance_status_counts}
            />
            <StatusSummary
              title="Leave Summary"
              values={overview.leave_status_counts}
            />
          </section>

          <section className="analytics-card">
            <h2>Monthly Attendance Trends</h2>
            {attendance.length === 0 ? (
              <p>No attendance records for this period.</p>
            ) : (
              <div className="analytics-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>Half Day</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((item) => (
                      <tr key={item.month}>
                        <td>{item.month}</td>
                        <td>{item.present}</td>
                        <td>{item.absent}</td>
                        <td>{item.half_day}</td>
                        <td>{item.total_records}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="analytics-card">
            <h2>Monthly Leave Trends</h2>
            {!leaves?.trends?.length ? (
              <p>No leave records for this period.</p>
            ) : (
              <div className="analytics-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Pending</th>
                      <th>Approved</th>
                      <th>Rejected</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.trends.map((item) => (
                      <tr key={item.month}>
                        <td>{item.month}</td>
                        <td>{item.pending}</td>
                        <td>{item.approved}</td>
                        <td>{item.rejected}</td>
                        <td>{item.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <h3>Leave Types</h3>
            <StatusSummary
              title="Leave Type Counts"
              values={leaves?.leave_type_counts}
            />
          </section>

          <section className="analytics-card">
            <h2>Employee Performance Insights</h2>
            <p>
              Overall average rating:{" "}
              <strong>
                {performance?.average_rating == null
                  ? "N/A"
                  : `${performance.average_rating}/5`}
              </strong>
            </p>

            {!performance?.employees?.length ? (
              <p>No performance reviews for this period.</p>
            ) : (
              <div className="analytics-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Employee ID</th>
                      <th>Reviews</th>
                      <th>Average Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performance.employees.map((item) => (
                      <tr key={item.employee_id}>
                        <td>{item.employee_name}</td>
                        <td>{item.employee_id}</td>
                        <td>{item.review_count}</td>
                        <td>{item.average_rating}/5</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="analytics-card">
            <h2>Department-wise Reports</h2>
            {departmentReports.length === 0 ? (
              <p>No department records found.</p>
            ) : (
              <div className="analytics-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Employees</th>
                      <th>Active</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>Half Day</th>
                      <th>Avg. Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentReports.map((item) => (
                      <tr key={item.department}>
                        <td>{item.department}</td>
                        <td>{item.employee_count}</td>
                        <td>{item.active_employees}</td>
                        <td>{item.present_records}</td>
                        <td>{item.absent_records}</td>
                        <td>{item.half_day_records}</td>
                        <td>
                          {item.average_performance_rating == null
                            ? "N/A"
                            : `${item.average_performance_rating}/5`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        !loading && (
          <section className="analytics-card">
            <p>No analytics data is available yet.</p>
          </section>
        )
      )}
    </main>
  );
}


import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import "./LeaveCalendar.css";

const toISODate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (value) => {
  if (!value) return "—";

  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};

const getErrorMessage = (error) => {
  const detail = error?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).join(", ");
  }

  return detail || error?.message || "Unable to load leave information.";
};

function LeaveCalendar() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));
  const [department, setDepartment] = useState("");
  const [calendarLeaves, setCalendarLeaves] = useState([]);
  const [availability, setAvailability] = useState(null);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [error, setError] = useState("");

  const monthStart = useMemo(
    () => toISODate(new Date(month.getFullYear(), month.getMonth(), 1)),
    [month]
  );

  const monthEnd = useMemo(
    () => toISODate(new Date(month.getFullYear(), month.getMonth() + 1, 0)),
    [month]
  );

  const monthTitle = month.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const loadCalendar = useCallback(async () => {
    setLoadingCalendar(true);
    setError("");

    try {
      const response = await api.get("/leaves/calendar", {
        params: {
          start_date: monthStart,
          end_date: monthEnd,
          ...(department ? { department } : {}),
        },
      });

      setCalendarLeaves(
        Array.isArray(response.data) ? response.data : []
      );
    } catch (requestError) {
      setCalendarLeaves([]);
      setError(getErrorMessage(requestError));
    } finally {
      setLoadingCalendar(false);
    }
  }, [monthStart, monthEnd, department]);

  const loadAvailability = useCallback(async () => {
    if (!selectedDate) return;

    setLoadingAvailability(true);

    try {
      const response = await api.get("/leaves/team-availability", {
        params: {
          target_date: selectedDate,
          ...(department ? { department } : {}),
        },
      });

      setAvailability(response.data);
    } catch (requestError) {
      setAvailability(null);
      setError(getErrorMessage(requestError));
    } finally {
      setLoadingAvailability(false);
    }
  }, [selectedDate, department]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate();

  // Monday-first calendar layout.
  const firstDayOffset =
    (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;

  const calendarCells = [
    ...Array(firstDayOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  while (calendarCells.length % 7 !== 0) {
    calendarCells.push(null);
  }

  const leavesByDate = useMemo(() => {
    const grouped = {};

    for (const leave of calendarLeaves) {
      const start = new Date(`${leave.start_date}T00:00:00`);
      const end = new Date(`${leave.end_date}T00:00:00`);

      for (
        const cursor = new Date(
          Math.max(
            start.getTime(),
            new Date(`${monthStart}T00:00:00`).getTime()
          )
        );
        cursor <= end && cursor <= new Date(`${monthEnd}T00:00:00`);
        cursor.setDate(cursor.getDate() + 1)
      ) {
        const key = toISODate(cursor);

        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(leave);
      }
    }

    return grouped;
  }, [calendarLeaves, monthStart, monthEnd]);

  const selectedLeaves = calendarLeaves.filter(
    (leave) =>
      leave.start_date <= selectedDate &&
      leave.end_date >= selectedDate
  );

  const departments = useMemo(
    () =>
      [...new Set(
        calendarLeaves
          .map((leave) => leave.department)
          .filter(Boolean)
      )].sort(),
    [calendarLeaves]
  );

  const moveMonth = (offset) => {
    setMonth(
      (previous) =>
        new Date(previous.getFullYear(), previous.getMonth() + offset, 1)
    );
  };

  const handleDateSelect = (day) => {
    if (!day) return;

    setSelectedDate(
      toISODate(new Date(month.getFullYear(), month.getMonth(), day))
    );
  };

  const isToday = (day) => {
    if (!day) return false;
    return toISODate(new Date()) ===
      toISODate(new Date(month.getFullYear(), month.getMonth(), day));
  };

  const isSelected = (day) => {
    if (!day) return false;
    return selectedDate ===
      toISODate(new Date(month.getFullYear(), month.getMonth(), day));
  };

  return (
    <main className="leave-calendar-page">
      <header className="leave-calendar-header">
        <div>
          <p className="leave-calendar-eyebrow">WORKSPHERE HRMS</p>
          <h1>Leave Calendar &amp; Team View</h1>
          <p className="leave-calendar-subtitle">
            See approved team leave and check availability by date.
          </p>
        </div>

        <button
          type="button"
          className="lc-button lc-button-secondary"
          onClick={() => {
            loadCalendar();
            loadAvailability();
          }}
        >
          Refresh
        </button>
      </header>

      {error && (
        <div className="lc-alert" role="alert">
          {error}
        </div>
      )}

      <section className="lc-summary">
        <article className="lc-summary-card">
          <span>Approved leave entries this month</span>
          <strong>{calendarLeaves.length}</strong>
        </article>
        <article className="lc-summary-card">
          <span>Selected date</span>
          <strong>{formatDate(selectedDate)}</strong>
        </article>
        <article className="lc-summary-card">
          <span>Employees on leave</span>
          <strong>{availability?.on_leave_count ?? "—"}</strong>
        </article>
      </section>

      <section className="lc-card">
        <div className="lc-calendar-toolbar">
          <div>
            <h2>{monthTitle}</h2>
            <p>Choose a date to view who is away.</p>
          </div>

          <div className="lc-toolbar-actions">
            <label className="lc-department-filter">
              Department
              <select
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
            </label>

            <div className="lc-month-buttons">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => moveMonth(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  setSelectedDate(toISODate(now));
                }}
              >
                Today
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => moveMonth(1)}
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {loadingCalendar ? (
          <p className="lc-empty">Loading calendar...</p>
        ) : (
          <div className="lc-calendar-grid">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
              (weekday) => (
                <div className="lc-weekday" key={weekday}>
                  {weekday}
                </div>
              )
            )}

            {calendarCells.map((day, index) => {
              const key = day
                ? toISODate(
                    new Date(month.getFullYear(), month.getMonth(), day)
                  )
                : `empty-${index}`;

              const leaves = day ? leavesByDate[key] || [] : [];

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!day}
                  onClick={() => handleDateSelect(day)}
                  className={[
                    "lc-day",
                    !day ? "lc-day-empty" : "",
                    isToday(day) ? "lc-day-today" : "",
                    isSelected(day) ? "lc-day-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {day && <span className="lc-day-number">{day}</span>}

                  {leaves.slice(0, 2).map((leave) => (
                    <span
                      key={`${key}-${leave.leave_id}`}
                      className="lc-leave-chip"
                      title={`${leave.employee_name} — ${leave.leave_type}`}
                    >
                      {leave.employee_name}
                    </span>
                  ))}

                  {leaves.length > 2 && (
                    <span className="lc-more">
                      +{leaves.length - 2} more
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <p className="lc-calendar-note">
          Only approved leave is displayed. Select a day to see its leave
          details and team availability.
        </p>
      </section>

      <section className="lc-card">
        <div className="lc-section-heading">
          <div>
            <h2>Leave on {formatDate(selectedDate)}</h2>
            <p>Employees with approved leave on the selected date.</p>
          </div>
        </div>

        {selectedLeaves.length === 0 ? (
          <p className="lc-empty">
            No approved leave entries for this date.
          </p>
        ) : (
          <div className="lc-table-wrap">
            <table className="lc-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Leave type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {selectedLeaves.map((leave) => (
                  <tr key={leave.leave_id}>
                    <td>
                      <strong>{leave.employee_name}</strong>
                    </td>
                    <td>{leave.department || "—"}</td>
                    <td>{leave.leave_type}</td>
                    <td>{formatDate(leave.start_date)}</td>
                    <td>{formatDate(leave.end_date)}</td>
                    <td>
                      <span className="lc-approved">Approved</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="lc-card">
        <div className="lc-section-heading">
          <div>
            <h2>Team availability</h2>
            <p>Active employees and their leave status on this date.</p>
          </div>
        </div>

        {loadingAvailability ? (
          <p className="lc-empty">Checking team availability...</p>
        ) : !availability ? (
          <p className="lc-empty">
            Team availability could not be loaded.
          </p>
        ) : (
          <>
            <div className="lc-availability-stats">
              <div>
                <span>Active employees</span>
                <strong>{availability.total_employees}</strong>
              </div>
              <div>
                <span>Available</span>
                <strong>{availability.available_count}</strong>
              </div>
              <div>
                <span>On leave</span>
                <strong>{availability.on_leave_count}</strong>
              </div>
            </div>

            {availability.employees?.length ? (
              <div className="lc-table-wrap">
                <table className="lc-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Availability</th>
                      <th>Leave type</th>
                      <th>Leave dates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availability.employees.map((employee) => (
                      <tr key={employee.employee_id}>
                        <td>
                          <strong>{employee.employee_name}</strong>
                        </td>
                        <td>{employee.department || "—"}</td>
                        <td>
                          <span
                            className={
                              employee.available
                                ? "lc-available"
                                : "lc-on-leave"
                            }
                          >
                            {employee.available ? "Available" : "On leave"}
                          </span>
                        </td>
                        <td>{employee.leave_type || "—"}</td>
                        <td>
                          {employee.leave_start_date
                            ? `${formatDate(employee.leave_start_date)} – ${formatDate(employee.leave_end_date)}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="lc-empty">
                No active employees found for this filter.
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default LeaveCalendar;

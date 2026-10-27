
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "./AdvancedEmployeeSearch.css";

const initialFilters = {
  search: "",
  department: "",
  status: "",
  role: "",
  attendance_status: "",
  attendance_date: "",
  min_rating: "",
  max_rating: "",
};

export default function AdvancedEmployeeSearch() {
  const [filters, setFilters] = useState(initialFilters);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const pageSize = 20;

  const updateFilter = (event) => {
    const { name, value } = event.target;

    setFilters((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        skip: page * pageSize,
        limit: pageSize,
      };

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== "") {
          params[key] = value;
        }
      });

      const response = await api.get("/employees/", { params });
      const results = Array.isArray(response.data) ? response.data : [];

      setEmployees(results);
      setHasMore(results.length === pageSize);
    } catch (err) {
      setEmployees([]);
      setHasMore(false);
      setError(
        err.response?.data?.detail ||
          "Unable to load employees. Check your login and filter values."
      );
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (
      filters.min_rating !== "" &&
      filters.max_rating !== "" &&
      Number(filters.min_rating) > Number(filters.max_rating)
    ) {
      setError("Minimum rating cannot exceed maximum rating.");
      return;
    }

    setPage(0);
    
    loadEmployees();
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setPage(0);
    setError("");
  };

  return (
    <main className="advanced-employees-page">
      <header className="advanced-employees-header">
        <div>
          <p className="advanced-eyebrow">WORKSPHERE HRMS</p>
          <h1>Employee Search & Filters</h1>
          <p>Find employees using profile, role, attendance, and review filters.</p>
        </div>

        <button
          type="button"
          className="advanced-secondary-button"
          onClick={clearFilters}
        >
          Clear filters
        </button>
      </header>

      <form className="advanced-filter-panel" onSubmit={handleSubmit}>
        <div className="advanced-filter-heading">
          <h2>Search employees</h2>
          <span>Use one or more filters</span>
        </div>

        <div className="advanced-filter-grid">
          <label className="advanced-field advanced-field-wide">
            Search
            <input
              type="search"
              name="search"
              value={filters.search}
              onChange={updateFilter}
              maxLength={100}
              placeholder="Name, designation, username, email..."
            />
          </label>

          <label className="advanced-field">
            Department
            <input
              type="text"
              name="department"
              value={filters.department}
              onChange={updateFilter}
              maxLength={100}
              placeholder="e.g. Engineering"
            />
          </label>

          <label className="advanced-field">
            Employee status
            <select
              name="status"
              value={filters.status}
              onChange={updateFilter}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>

          <label className="advanced-field">
            User role
            <select
              name="role"
              value={filters.role}
              onChange={updateFilter}
            >
              <option value="">All roles</option>
              <option value="EMPLOYEE">Employee</option>
              <option value="HR">HR</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>

          <label className="advanced-field">
            Attendance status
            <select
              name="attendance_status"
              value={filters.attendance_status}
              onChange={updateFilter}
            >
              <option value="">Any attendance status</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="HALF_DAY">Half day</option>
            </select>
          </label>

          <label className="advanced-field">
            Attendance date
            <input
              type="date"
              name="attendance_date"
              value={filters.attendance_date}
              onChange={updateFilter}
            />
          </label>

          <label className="advanced-field">
            Minimum review rating
            <input
              type="number"
              name="min_rating"
              min="1"
              max="5"
              step="0.1"
              value={filters.min_rating}
              onChange={updateFilter}
              placeholder="1–5"
            />
          </label>

          <label className="advanced-field">
            Maximum review rating
            <input
              type="number"
              name="max_rating"
              min="1"
              max="5"
              step="0.1"
              value={filters.max_rating}
              onChange={updateFilter}
              placeholder="1–5"
            />
          </label>
        </div>

        <div className="advanced-filter-actions">
          <button type="submit" className="advanced-primary-button">
            Apply filters
          </button>

          <button
            type="button"
            className="advanced-secondary-button"
            onClick={loadEmployees}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </form>

      {error && (
        <div className="advanced-error" role="alert">
          {String(error)}
        </div>
      )}

      <section className="advanced-results-panel">
        <div className="advanced-results-heading">
          <div>
            <h2>Employee directory</h2>
            <p>
              {loading
                ? "Loading employees..."
                : `${employees.length} employee(s) on this page`}
            </p>
          </div>

          <span className="advanced-page-label">
            Page {page + 1}
          </span>
        </div>

        {loading ? (
          <div className="advanced-empty-state">Loading employees...</div>
        ) : employees.length === 0 ? (
          <div className="advanced-empty-state">
            <span>🔎</span>
            <h3>No employees found</h3>
            <p>Try changing your search text or clearing some filters.</p>
          </div>
        ) : (
          <div className="advanced-table-wrapper">
            <table className="advanced-employee-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Employee</th>
                  <th>Designation</th>
                  <th>Department</th>
                  <th>Joining date</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>EMP-{employee.id}</td>
                    <td>
                      <strong>{employee.full_name}</strong>
                      <small>User ID: {employee.user_id}</small>
                    </td>
                    <td>{employee.designation || "—"}</td>
                    <td>{employee.department || "—"}</td>
                    <td>{employee.joining_date || "—"}</td>
                    <td>
                      <span
                        className={`advanced-status ${
                          String(employee.status).toLowerCase()
                        }`}
                      >
                        {String(employee.status).replaceAll("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="advanced-pagination">
          <button
            type="button"
            className="advanced-secondary-button"
            disabled={page === 0 || loading}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            Previous
          </button>

          <span>Page {page + 1}</span>

          <button
            type="button"
            className="advanced-secondary-button"
            disabled={!hasMore || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      </section>
    </main>
  );
}

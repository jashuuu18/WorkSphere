
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "./Tasks.css";

function getUserRole() {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return "";

    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized));

    return String(decoded.role || "").toUpperCase();
  } catch {
    return "";
  }
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString();
}

export default function Tasks() {
  const role = getUserRole();
  const isManager = role === "HR" || role === "ADMIN";

  const [tasks, setTasks] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const endpoint = isManager ? "/tasks/" : "/tasks/me";
      const params = filter === "ALL" ? {} : { status: filter };
      const response = await api.get(endpoint, { params });
      setTasks(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load tasks. Please check your login and try again."
      );
    } finally {
      setLoading(false);
    }
  }, [filter, isManager]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function handleAssign(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!employeeId || Number(employeeId) <= 0) {
      setError("Enter a valid employee ID.");
      return;
    }

    if (title.trim().length < 3) {
      setError("The task title must contain at least 3 characters.");
      return;
    }

    if (!dueDate) {
      setError("Please select a due date.");
      return;
    }

    setSubmitting(true);

    try {
      await api.post("/tasks/", {
        assigned_to: Number(employeeId),
        title: title.trim(),
        description: description.trim(),
        due_date: dueDate,
      });

      setTitle("");
      setDescription("");
      setEmployeeId("");
      setDueDate("");
      setSuccess("Task assigned successfully.");
      await loadTasks();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to assign task. Verify that the employee ID exists."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete(taskId) {
    setError("");
    setSuccess("");
    setUpdatingId(taskId);

    try {
      await api.patch(`/tasks/${taskId}/status`, {
        status: "COMPLETED",
      });

      setSuccess("Task marked as completed.");
      await loadTasks();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to update the task."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(
    (task) => task.status === "COMPLETED"
  ).length;
  const pendingTasks = tasks.filter(
    (task) => task.status === "PENDING"
  ).length;
  const completionRate = totalTasks
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  return (
    <main className="tasks-page">
      <header className="tasks-header">
        <div>
          <p className="tasks-eyebrow">WORKSPHERE HRMS</p>
          <h1>{isManager ? "Task Management" : "My Tasks"}</h1>
          <p>Assign, organize, and track internal work tasks.</p>
        </div>
        <button
          type="button"
          className="tasks-refresh"
          onClick={loadTasks}
          disabled={loading}
        >
          Refresh
        </button>
      </header>

      {error && <div className="tasks-alert tasks-error">{error}</div>}
      {success && <div className="tasks-alert tasks-success">{success}</div>}

      <section className="tasks-summary">
        <article className="task-stat">
          <span>Total tasks</span>
          <strong>{totalTasks}</strong>
        </article>
        <article className="task-stat">
          <span>Pending</span>
          <strong>{pendingTasks}</strong>
        </article>
        <article className="task-stat">
          <span>Completed</span>
          <strong>{completedTasks}</strong>
        </article>
        <article className="task-stat">
          <span>Completion rate</span>
          <strong>{completionRate}%</strong>
        </article>
      </section>

      {isManager && (
        <section className="tasks-panel">
          <h2>Assign a new task</h2>
          <p className="tasks-muted">
            Use an existing employee's employee ID, not their user ID.
          </p>

          <form className="tasks-form" onSubmit={handleAssign}>
            <div className="tasks-field">
              <label htmlFor="task-employee-id">Employee ID</label>
              <input
                id="task-employee-id"
                type="number"
                min="1"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                required
              />
            </div>

            <div className="tasks-field">
              <label htmlFor="task-title">Task title</label>
              <input
                id="task-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Enter task title"
                maxLength={200}
                minLength={3}
                required
              />
            </div>

            <div className="tasks-field">
              <label htmlFor="task-due-date">Due date</label>
              <input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                required
              />
            </div>

            <div className="tasks-field tasks-field-full">
              <label htmlFor="task-description">Description</label>
              <textarea
                id="task-description"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the work to be completed"
                maxLength={10000}
              />
            </div>

            <button type="submit" disabled={submitting}>
              {submitting ? "Assigning..." : "Assign task"}
            </button>
          </form>
        </section>
      )}

      <section className="tasks-list-section">
        <div className="tasks-list-heading">
          <h2>{isManager ? "All assigned tasks" : "Your task list"}</h2>
          <select
            aria-label="Filter tasks by status"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        {loading ? (
          <div className="tasks-empty">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="tasks-empty">
            <h3>No tasks found</h3>
            <p>Tasks will appear here when they are assigned.</p>
          </div>
        ) : (
          <div className="tasks-list">
            {tasks.map((task) => (
              <article className="task-card" key={task.id}>
                <div className="task-card-heading">
                  <div>
                    <span className="task-id">TASK #{task.id}</span>
                    <h3>{task.title}</h3>
                  </div>
                  <span
                    className={`task-status ${
                      task.status === "COMPLETED"
                        ? "task-status-completed"
                        : "task-status-pending"
                    }`}
                  >
                    {task.status}
                  </span>
                </div>

                {task.description && (
                  <p className="task-description">{task.description}</p>
                )}

                <div className="task-meta">
                  {isManager && (
                    <span>Employee ID: {task.assigned_to}</span>
                  )}
                  <span>Due: {formatDate(task.due_date)}</span>
                </div>

                {task.status === "PENDING" && (
                  <button
                    type="button"
                    className="task-complete-button"
                    disabled={updatingId === task.id}
                    onClick={() => handleComplete(task.id)}
                  >
                    {updatingId === task.id
                      ? "Updating..."
                      : "Mark as completed"}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}


import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import "./Onboarding.css";

function formatDate(value) {
  if (!value) return "No due date";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Onboarding() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/onboarding/me");
      setTasks(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load your onboarding checklist. Please log in and try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const completedCount = useMemo(
    () => tasks.filter((task) => task.status === "COMPLETED").length,
    [tasks]
  );

  const totalCount = tasks.length;
  const pendingCount = totalCount - completedCount;
  const progress =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  async function completeTask(taskId) {
    setCompletingId(taskId);
    setError("");
    setSuccess("");

    try {
      const response = await api.patch(
        `/onboarding/${taskId}/complete`
      );

      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === taskId ? response.data : task
        )
      );
      setSuccess("Onboarding task marked as completed.");
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to complete this task."
      );
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <div>
          <p className="onboarding-eyebrow">EMPLOYEE EXPERIENCE</p>
          <h1>My Onboarding</h1>
          <p className="onboarding-subtitle">
            Follow your checklist to complete your onboarding journey.
          </p>
        </div>

        <button
          className="onboarding-refresh"
          type="button"
          onClick={loadTasks}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="onboarding-message onboarding-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="onboarding-message onboarding-success" role="status">
          {success}
        </div>
      )}

      {loading ? (
        <div className="onboarding-empty">Loading your checklist...</div>
      ) : (
        <>
          <section className="onboarding-progress-card">
            <div className="onboarding-progress-top">
              <div>
                <h2>Your progress</h2>
                <p>Keep going — every completed task brings you closer.</p>
              </div>
              <strong className="onboarding-progress-percent">
                {progress}%
              </strong>
            </div>

            <div
              className="onboarding-progress-track"
              role="progressbar"
              aria-label="Onboarding progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="onboarding-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="onboarding-stats">
              <div>
                <span className="onboarding-stat-number">{totalCount}</span>
                <span>Total tasks</span>
              </div>
              <div>
                <span className="onboarding-stat-number">{completedCount}</span>
                <span>Completed</span>
              </div>
              <div>
                <span className="onboarding-stat-number">{pendingCount}</span>
                <span>Pending</span>
              </div>
            </div>
          </section>

          <section className="onboarding-list-section">
            <div className="onboarding-list-heading">
              <div>
                <h2>My checklist</h2>
                <p>Your assigned onboarding activities</p>
              </div>
              <span className="onboarding-count">{totalCount} tasks</span>
            </div>

            {tasks.length === 0 ? (
              <div className="onboarding-empty">
                <div className="onboarding-empty-icon" aria-hidden="true">
                  ✓
                </div>
                <h3>No onboarding tasks yet</h3>
                <p>
                  Your HR team has not assigned any onboarding tasks. Please
                  check again later.
                </p>
              </div>
            ) : (
              <div className="onboarding-task-list">
                {tasks.map((task) => {
                  const isCompleted = task.status === "COMPLETED";
                  const isOverdue =
                    !isCompleted &&
                    task.due_date &&
                    new Date(`${task.due_date}T23:59:59`) < new Date();

                  return (
                    <article className="onboarding-task" key={task.id}>
                      <div
                        className={`onboarding-task-icon ${
                          isCompleted ? "is-completed" : ""
                        }`}
                        aria-hidden="true"
                      >
                        {isCompleted ? "✓" : "○"}
                      </div>

                      <div className="onboarding-task-details">
                        <h3>{task.task_name}</h3>
                        <p>
                          Due date: {formatDate(task.due_date)}
                          {isOverdue && (
                            <span className="onboarding-overdue">
                              {" "}
                              · Overdue
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="onboarding-task-actions">
                        <span
                          className={`onboarding-status ${
                            isCompleted ? "status-completed" : "status-pending"
                          }`}
                        >
                          {isCompleted ? "Completed" : "Pending"}
                        </span>

                        {!isCompleted && (
                          <button
                            type="button"
                            className="onboarding-complete-button"
                            onClick={() => completeTask(task.id)}
                            disabled={completingId !== null}
                          >
                            {completingId === task.id
                              ? "Saving..."
                              : "Mark complete"}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

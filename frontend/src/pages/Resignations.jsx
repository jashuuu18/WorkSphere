
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "./Resignations.css";

function getCurrentRole() {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return "";

    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    const parsed = JSON.parse(decoded);
    return parsed.role || "";
  } catch {
    return "";
  }
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }) {
  return (
    <span className={`resignation-status status-${status?.toLowerCase()}`}>
      {status || "UNKNOWN"}
    </span>
  );
}

export default function Resignations() {
  const role = getCurrentRole();
  const isManager = role === "HR" || role === "ADMIN";

  const [requests, setRequests] = useState([]);
  const [reason, setReason] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("30");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [decisionId, setDecisionId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (isManager) {
        const params = {};
        if (statusFilter) params.status = statusFilter;

        const response = await api.get("/resignations/", { params });
        setRequests(Array.isArray(response.data) ? response.data : []);
      } else {
        const response = await api.get("/resignations/me");
        setRequests(Array.isArray(response.data) ? response.data : []);
      }
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load resignation requests. Please log in again and retry."
      );
    } finally {
      setLoading(false);
    }
  }, [isManager, statusFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function submitResignation(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (reason.trim().length < 5) {
      setError("Please enter a reason with at least 5 characters.");
      return;
    }

    const days = Number(noticePeriod);
    if (!Number.isInteger(days) || days < 0 || days > 365) {
      setError("Notice period must be between 0 and 365 days.");
      return;
    }

    setSubmitting(true);

    try {
      await api.post("/resignations/", {
        reason: reason.trim(),
        notice_period: days,
      });

      setReason("");
      setSuccess("Your resignation request has been submitted.");
      await loadRequests();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to submit your resignation request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function decideRequest(requestId, decision) {
    const action = decision === "APPROVED" ? "approve" : "reject";

    if (!window.confirm(`Are you sure you want to ${action} this request?`)) {
      return;
    }

    setDecisionId(requestId);
    setError("");
    setSuccess("");

    try {
      await api.patch(`/resignations/${requestId}/decision`, {
        status: decision,
      });

      setSuccess(`Resignation request ${action}d successfully.`);
      await loadRequests();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          `Unable to ${action} this resignation request.`
      );
    } finally {
      setDecisionId(null);
    }
  }

  const pendingCount = requests.filter(
    (request) => request.status === "PENDING"
  ).length;

  const approvedCount = requests.filter(
    (request) => request.status === "APPROVED"
  ).length;

  return (
    <main className="resignation-page">
      <header className="resignation-header">
        <div>
          <p className="resignation-eyebrow">EMPLOYEE EXPERIENCE</p>
          <h1>{isManager ? "Resignation Management" : "Resignation & Exit"}</h1>
          <p className="resignation-subtitle">
            {isManager
              ? "Review employee resignation requests and record decisions."
              : "Submit a resignation request and track its progress."}
          </p>
        </div>

        <button
          className="resignation-refresh"
          type="button"
          onClick={loadRequests}
          disabled={loading}
        >
          Refresh
        </button>
      </header>

      {error && (
        <div className="resignation-message error-message" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="resignation-message success-message" role="status">
          {success}
        </div>
      )}

      <section className="resignation-stats">
        <article className="resignation-stat-card">
          <span>Total shown</span>
          <strong>{requests.length}</strong>
        </article>
        <article className="resignation-stat-card">
          <span>Pending</span>
          <strong>{pendingCount}</strong>
        </article>
        <article className="resignation-stat-card">
          <span>Approved</span>
          <strong>{approvedCount}</strong>
        </article>
      </section>

      {!isManager && (
        <section className="resignation-card">
          <div className="resignation-section-heading">
            <h2>Submit resignation</h2>
            <p>Provide a reason and your notice period in days.</p>
          </div>

          <form onSubmit={submitResignation} className="resignation-form">
            <label htmlFor="resignation-reason">Reason for resignation</label>
            <textarea
              id="resignation-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Enter your reason for resignation..."
              rows={5}
              minLength={5}
              maxLength={5000}
              required
            />

            <label htmlFor="notice-period">Notice period (days)</label>
            <input
              id="notice-period"
              type="number"
              min="0"
              max="365"
              step="1"
              value={noticePeriod}
              onChange={(event) => setNoticePeriod(event.target.value)}
              required
            />

            <p className="resignation-help">
              You can have only one pending resignation request at a time.
            </p>

            <button
              className="resignation-primary-button"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit resignation"}
            </button>
          </form>
        </section>
      )}

      <section className="resignation-card">
        <div className="resignation-section-heading resignation-list-heading">
          <div>
            <h2>{isManager ? "Employee requests" : "My resignation history"}</h2>
            <p>
              {isManager
                ? "Review the requests returned by the selected filter."
                : "Your submitted requests and their current status."}
            </p>
          </div>

          {isManager && (
            <select
              aria-label="Filter by resignation status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          )}
        </div>

        {loading ? (
          <div className="resignation-empty">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="resignation-empty">
            <h3>No resignation requests found</h3>
            <p>
              {isManager
                ? "There are no requests matching this filter."
                : "Your resignation history will appear here after you submit a request."}
            </p>
          </div>
        ) : (
          <div className="resignation-table-wrap">
            <table className="resignation-table">
              <thead>
                <tr>
                  {isManager && <th>Employee ID</th>}
                  <th>Reason</th>
                  <th>Notice period</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  {isManager && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    {isManager && <td>#{request.employee_id}</td>}
                    <td className="resignation-reason-cell">{request.reason}</td>
                    <td>{request.notice_period} days</td>
                    <td>{formatDate(request.created_at)}</td>
                    <td>
                      <StatusBadge status={request.status} />
                    </td>
                    {isManager && (
                      <td>
                        {request.status === "PENDING" ? (
                          <div className="resignation-actions">
                            <button
                              type="button"
                              className="approve-button"
                              onClick={() =>
                                decideRequest(request.id, "APPROVED")
                              }
                              disabled={decisionId !== null}
                            >
                              {decisionId === request.id
                                ? "Saving..."
                                : "Approve"}
                            </button>
                            <button
                              type="button"
                              className="reject-button"
                              onClick={() =>
                                decideRequest(request.id, "REJECTED")
                              }
                              disabled={decisionId !== null}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="resignation-no-action">Decided</span>
                        )}
                      </td>
                    )}
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

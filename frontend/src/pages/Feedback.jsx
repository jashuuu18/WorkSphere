
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "./Feedback.css";

function getUserRole() {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return "";
    const payload = JSON.parse(atob(token.split(".")[1]));
    return String(payload.role || "").toUpperCase();
  } catch {
    return "";
  }
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function Rating({ value }) {
  return (
    <span className="feedback-stars" aria-label={`${value} out of 5 stars`}>
      {"★".repeat(value)}
      <span className="feedback-empty-stars">
        {"★".repeat(5 - value)}
      </span>
      <span className="feedback-rating-number">{value}/5</span>
    </span>
  );
}

export default function Feedback() {
  const role = getUserRole();
  const isManager = ["HR", "ADMIN"].includes(role);

  const [message, setMessage] = useState("");
  const [rating, setRating] = useState("5");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(
        isManager ? "/feedback/" : "/feedback/me"
      );
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to load feedback."
      );
    } finally {
      setLoading(false);
    }
  }, [isManager]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  async function submitFeedback(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    setSubmitting(true);

    try {
      await api.post("/feedback/", {
        message: message.trim(),
        rating: Number(rating),
      });

      setMessage("");
      setRating("5");
      setNotice("Your feedback was submitted successfully.");
      await loadFeedback();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to submit feedback."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const averageRating = items.length
    ? (
        items.reduce((sum, item) => sum + item.rating, 0) / items.length
      ).toFixed(1)
    : "—";

  return (
    <main className="feedback-page">
      <header className="feedback-header">
        <div>
          <p className="feedback-eyebrow">WORKSPHERE HRMS</p>
          <h1>{isManager ? "Employee Feedback" : "Share Your Feedback"}</h1>
          <p className="feedback-subtitle">
            {isManager
              ? "Review employee feedback and ratings."
              : "Your ideas help improve our workplace."}
          </p>
        </div>
        <span className="feedback-role">{role || "USER"}</span>
      </header>

      {notice && (
        <div className="feedback-alert success" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="feedback-alert error" role="alert">
          {error}
        </div>
      )}

      {isManager ? (
        <section className="feedback-summary-grid">
          <article className="feedback-summary-card">
            <span>Total submissions</span>
            <strong>{items.length}</strong>
          </article>
          <article className="feedback-summary-card">
            <span>Average rating</span>
            <strong>{averageRating}</strong>
            <small>Out of 5</small>
          </article>
        </section>
      ) : (
        <section className="feedback-form-card">
          <h2>Submit feedback</h2>
          <p>Share a suggestion, concern, or positive experience.</p>

          <form onSubmit={submitFeedback}>
            <label htmlFor="feedback-rating">Your rating</label>
            <select
              id="feedback-rating"
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              required
            >
              <option value="5">5 — Excellent</option>
              <option value="4">4 — Very good</option>
              <option value="3">3 — Good</option>
              <option value="2">2 — Needs improvement</option>
              <option value="1">1 — Poor</option>
            </select>

            <label htmlFor="feedback-message">Your feedback</label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write your feedback here..."
              minLength={5}
              maxLength={5000}
              rows={5}
              required
            />

            <div className="feedback-form-footer">
              <small>{message.length}/5000 characters</small>
              <button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit feedback"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="feedback-history">
        <div className="feedback-history-heading">
          <div>
            <h2>{isManager ? "All submissions" : "My feedback history"}</h2>
            <p>
              {isManager
                ? "Feedback submitted by employees."
                : "Your previously submitted feedback."}
            </p>
          </div>
          <button
            className="feedback-refresh-button"
            type="button"
            onClick={loadFeedback}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="feedback-empty">Loading feedback...</p>
        ) : items.length === 0 ? (
          <div className="feedback-empty">
            <span aria-hidden="true">💬</span>
            <h3>No feedback yet</h3>
            <p>Submitted feedback will appear here.</p>
          </div>
        ) : (
          <div className="feedback-list">
            {items.map((item) => (
              <article className="feedback-item" key={item.id}>
                <div className="feedback-item-top">
                  <div>
                    <span className="feedback-item-id">
                      Feedback #{item.id}
                    </span>
                    {isManager && (
                      <span className="feedback-employee-id">
                        Employee #{item.employee_id}
                      </span>
                    )}
                  </div>
                  <Rating value={item.rating} />
                </div>
                <p className="feedback-message">{item.message}</p>
                <time className="feedback-date" dateTime={item.created_at}>
                  Submitted {formatDate(item.created_at)}
                </time>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

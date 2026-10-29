
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "./Announcements.css";

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
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Announcements() {
  const role = getUserRole();
  const canPublish = role === "HR" || role === "ADMIN";

  const [announcements, setAnnouncements] = useState([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/announcements/");
      setAnnouncements(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load announcements. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (title.trim().length < 3 || message.trim().length < 5) {
      setError("Enter a title of at least 3 characters and a message of at least 5 characters.");
      return;
    }

    setSubmitting(true);

    try {
      await api.post("/announcements/", {
        title: title.trim(),
        message: message.trim(),
      });

      setTitle("");
      setMessage("");
      setSuccess("Announcement published successfully.");
      await loadAnnouncements();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to publish the announcement."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="announcements-page">
      <header className="announcements-header">
        <div>
          <p className="announcements-eyebrow">WORKSPHERE HRMS</p>
          <h1>Internal Announcements</h1>
          <p className="announcements-subtitle">
            Company news, important updates, and workplace notices in one place.
          </p>
        </div>

        <div className="announcement-count">
          <span>{announcements.length}</span>
          <small>Announcements</small>
        </div>
      </header>

      {error && (
        <div className="announcement-alert announcement-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="announcement-alert announcement-success" role="status">
          {success}
        </div>
      )}

      {canPublish && (
        <section className="announcement-panel">
          <h2>Publish an announcement</h2>
          <p className="announcement-panel-description">
            Share an update with all authenticated WorkSphere users.
          </p>

          <form onSubmit={handleSubmit} className="announcement-form">
            <label htmlFor="announcement-title">Title</label>
            <input
              id="announcement-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Company holiday notice"
              maxLength={200}
              minLength={3}
              required
            />

            <label htmlFor="announcement-message">Message</label>
            <textarea
              id="announcement-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write the announcement details..."
              rows={5}
              maxLength={10000}
              minLength={5}
              required
            />

            <button type="submit" disabled={submitting}>
              {submitting ? "Publishing..." : "Publish announcement"}
            </button>
          </form>
        </section>
      )}

      <section className="announcement-list-section">
        <div className="announcement-list-heading">
          <h2>Latest updates</h2>
          <button
            type="button"
            className="announcement-refresh"
            onClick={loadAnnouncements}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <p className="announcement-empty">Loading announcements...</p>
        ) : announcements.length === 0 ? (
          <div className="announcement-empty">
            <h3>No announcements yet</h3>
            <p>New company announcements will appear here.</p>
          </div>
        ) : (
          <div className="announcement-list">
            {announcements.map((announcement) => (
              <article
                className="announcement-card"
                key={announcement.id}
              >
                <div className="announcement-card-top">
                  <span className="announcement-label">COMPANY UPDATE</span>
                  <time dateTime={announcement.created_at}>
                    {formatDate(announcement.created_at)}
                  </time>
                </div>

                <h3>{announcement.title}</h3>
                <p className="announcement-message">
                  {announcement.message}
                </p>

                <div className="announcement-author">
                  Published by user #{announcement.created_by}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}


import { useCallback, useEffect, useState } from "react";
import api from "../services/api";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/notifications/");
      setNotifications(
        Array.isArray(response.data) ? response.data : []
      );
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load notifications. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  function formatDate(value) {
    if (!value) return "Date unavailable";

    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleString();
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Notifications</h1>
          <p style={styles.subtitle}>
            Updates and messages related to your WorkSphere account.
          </p>
        </div>

        <button
          type="button"
          style={styles.button}
          onClick={loadNotifications}
          disabled={loading}
        >
          Refresh
        </button>
      </header>

      <section style={styles.summary}>
        <div>
          <p style={styles.summaryLabel}>Total notifications</p>
          <h2 style={styles.summaryNumber}>{notifications.length}</h2>
        </div>

        <div>
          <p style={styles.summaryLabel}>Unread notifications</p>
          <h2 style={styles.summaryNumber}>{unreadCount}</h2>
        </div>
      </section>

      {error && <p style={styles.error}>{error}</p>}

      <section style={styles.panel}>
        <h2 style={styles.heading}>Your Notifications</h2>

        {loading ? (
          <p style={styles.muted}>Loading notifications...</p>
        ) : notifications.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>✓</div>
            <h3>You're all caught up!</h3>
            <p>No notifications are available right now.</p>
          </div>
        ) : (
          <div style={styles.list}>
            {notifications.map((notification) => (
              <article
                key={notification.id}
                style={{
                  ...styles.notification,
                  ...(notification.is_read ? {} : styles.unread),
                }}
              >
                <div style={styles.notificationHeader}>
                  <h3 style={styles.notificationTitle}>
                    {notification.title || "Notification"}
                  </h3>

                  <span
                    style={
                      notification.is_read
                        ? styles.readBadge
                        : styles.unreadBadge
                    }
                  >
                    {notification.is_read ? "Read" : "Unread"}
                  </span>
                </div>

                <p style={styles.message}>
                  {notification.message || "No message provided."}
                </p>

                <p style={styles.date}>
                  {formatDate(notification.created_at)}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const styles = {
  page: { padding: 24, maxWidth: 1000, margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  title: { margin: 0, fontSize: 30, color: "#172554" },
  subtitle: { color: "#64748b" },
  button: {
    background: "#2563eb",
    color: "#fff",
    border: 0,
    borderRadius: 7,
    padding: "11px 15px",
    cursor: "pointer",
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
    marginBottom: 20,
  },
  summaryLabel: { color: "#64748b", marginBottom: 8 },
  summaryNumber: { color: "#172554", fontSize: 28, margin: 0 },
  panel: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 20,
  },
  heading: { marginTop: 0, fontSize: 19, color: "#1e293b" },
  list: { display: "grid", gap: 14 },
  notification: {
    padding: 18,
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    background: "#fff",
  },
  unread: {
    borderLeft: "4px solid #2563eb",
    background: "#f8fbff",
  },
  notificationHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  notificationTitle: { margin: 0, color: "#172554", fontSize: 17 },
  message: { color: "#475569", lineHeight: 1.6 },
  date: { color: "#94a3b8", fontSize: 13, marginBottom: 0 },
  readBadge: {
    background: "#f1f5f9",
    color: "#475569",
    borderRadius: 20,
    padding: "4px 9px",
    fontSize: 12,
  },
  unreadBadge: {
    background: "#dbeafe",
    color: "#1d4ed8",
    borderRadius: 20,
    padding: "4px 9px",
    fontSize: 12,
  },
  empty: { textAlign: "center", padding: "35px 10px", color: "#64748b" },
  emptyIcon: {
    margin: "0 auto",
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "#dcfce7",
    color: "#166534",
    display: "grid",
    placeItems: "center",
    fontSize: 24,
  },
  muted: { color: "#64748b" },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: 12,
    borderRadius: 8,
  },
};

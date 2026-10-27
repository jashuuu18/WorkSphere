
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyIds, setBusyIds] = useState([]);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
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
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Refresh notifications and their read/unread status every 30 seconds.
  useEffect(() => {
    const timer = setInterval(() => {
      loadNotifications(false);
    }, 30000);

    return () => clearInterval(timer);
  }, [loadNotifications]);

  async function toggleReadStatus(notification) {
    const id = notification.id;

    setError("");
    setSuccess("");
    setBusyIds((previous) => [...previous, id]);

    try {
      if (notification.is_read) {
        await api.patch(`/notifications/${id}/unread`);
      } else {
        await api.patch(`/notifications/${id}/read`);
      }

      // Update the displayed status only after the API succeeds.
      setNotifications((previous) =>
        previous.map((item) =>
          item.id === id
            ? { ...item, is_read: !notification.is_read }
            : item
        )
      );

      setSuccess(
        notification.is_read
          ? "Notification marked as unread."
          : "Notification marked as read."
      );
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to update notification. Please try again."
      );
    } finally {
      setBusyIds((previous) => previous.filter((itemId) => itemId !== id));
    }
  }

  async function markAllRead() {
    setError("");
    setSuccess("");
    setMarkingAll(true);

    try {
      await api.patch("/notifications/read-all");

      setNotifications((previous) =>
        previous.map((item) => ({ ...item, is_read: true }))
      );

      setSuccess("All notifications marked as read.");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to mark all notifications as read."
      );
    } finally {
      setMarkingAll(false);
    }
  }

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

        <div style={styles.actions}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => loadNotifications()}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button
            type="button"
            style={styles.button}
            onClick={markAllRead}
            disabled={loading || markingAll || unreadCount === 0}
          >
            {markingAll ? "Updating..." : "Mark all as read"}
          </button>
        </div>
      </header>

      <section style={styles.summary}>
        <div style={styles.summaryCard}>
          <p style={styles.summaryLabel}>Total notifications</p>
          <h2 style={styles.summaryNumber}>{notifications.length}</h2>
        </div>

        <div style={styles.summaryCard}>
          <p style={styles.summaryLabel}>Unread notifications</p>
          <h2 style={styles.summaryNumber}>{unreadCount}</h2>
        </div>
      </section>

      {error && (
        <p role="alert" style={styles.error}>
          {String(error)}
        </p>
      )}

      {success && (
        <p role="status" style={styles.success}>
          {success}
        </p>
      )}

      <section style={styles.panel}>
        <h2 style={styles.heading}>Your Notifications</h2>

        {loading ? (
          <p style={styles.muted}>Loading notifications...</p>
        ) : notifications.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>✓</div>
            <h3>No alerts found</h3>
            <p>No notifications are available right now.</p>
          </div>
        ) : (
          <div style={styles.list}>
            {notifications.map((notification) => {
              const isBusy = busyIds.includes(notification.id);

              return (
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

                  <button
                    type="button"
                    style={{
                      ...styles.button,
                      ...(notification.is_read
                        ? styles.unreadButton
                        : styles.readButton),
                      ...(isBusy ? styles.disabledButton : {}),
                    }}
                    disabled={isBusy}
                    onClick={() => toggleReadStatus(notification)}
                  >
                    {isBusy
                      ? "Updating..."
                      : notification.is_read
                        ? "Mark as unread"
                        : "Mark as read"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

const styles = {
  page: {
    padding: 24,
    maxWidth: 1000,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  title: {
    margin: 0,
    fontSize: 30,
    color: "#172554",
  },
  subtitle: {
    color: "#64748b",
  },
  button: {
    background: "#2563eb",
    color: "#fff",
    border: 0,
    borderRadius: 7,
    padding: "10px 13px",
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#e2e8f0",
    color: "#1e293b",
    border: 0,
    borderRadius: 7,
    padding: "10px 13px",
    cursor: "pointer",
  },
  readButton: {
    background: "#475569",
    marginTop: 8,
  },
  unreadButton: {
    background: "#2563eb",
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
    marginBottom: 20,
  },
  summaryCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 18,
  },
  summaryLabel: {
    color: "#64748b",
    marginBottom: 8,
  },
  summaryNumber: {
    color: "#172554",
    fontSize: 28,
    margin: 0,
  },
  panel: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 20,
  },
  heading: {
    marginTop: 0,
    fontSize: 19,
    color: "#1e293b",
  },
  list: {
    display: "grid",
    gap: 14,
  },
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
  notificationTitle: {
    margin: 0,
    color: "#172554",
    fontSize: 17,
  },
  message: {
    color: "#475569",
    lineHeight: 1.6,
  },
  date: {
    color: "#94a3b8",
    fontSize: 13,
    marginBottom: 8,
  },
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
  empty: {
    textAlign: "center",
    padding: "35px 10px",
    color: "#64748b",
  },
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
  muted: {
    color: "#64748b",
  },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: 12,
    borderRadius: 8,
  },
  success: {
    background: "#dcfce7",
    color: "#166534",
    padding: 12,
    borderRadius: 8,
  },
};

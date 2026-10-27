
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "./SmartAlerts.css";

function getAlertType(title = "") {
  const normalized = title.toLowerCase();

  if (normalized.includes("attendance") || normalized.includes("late")) {
    return "attendance";
  }

  if (normalized.includes("leave")) {
    return "leave";
  }

  if (normalized.includes("payroll") || normalized.includes("salary")) {
    return "payroll";
  }

  if (normalized.includes("document")) {
    return "document";
  }

  return "general";
}

function getAlertIcon(type) {
  const icons = {
    attendance: "🕒",
    leave: "📅",
    payroll: "💰",
    document: "📄",
    general: "🔔",
  };

  return icons[type] || icons.general;
}

export default function SmartAlerts() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadNotifications = useCallback(async (manual = false) => {
    if (manual) {
      setRefreshing(true);
    }

    setError("");

    try {
      const response = await api.get("/notifications/");
      const data = Array.isArray(response.data) ? response.data : [];

      setNotifications(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load alerts. Please sign in again if your session expired."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    const intervalId = window.setInterval(() => {
      loadNotifications();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [loadNotifications]);

  const unreadCount = notifications.filter(
    (item) => !item.is_read
  ).length;

  const filteredNotifications = notifications.filter((item) => {
    if (filter === "unread") {
      return !item.is_read;
    }

    if (filter === "read") {
      return item.is_read;
    }

    if (filter === "attendance") {
      return getAlertType(item.title) === "attendance";
    }

    if (filter === "leave") {
      return getAlertType(item.title) === "leave";
    }

    if (filter === "payroll") {
      return getAlertType(item.title) === "payroll";
    }

    return true;
  });

  return (
    <main className="smart-alerts-page">
      <header className="smart-alerts-header">
        <div>
          <h1>Smart Notifications & Alerts</h1>
          <p>
            Stay updated on attendance, leave decisions, payroll,
            and other HR activities.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadNotifications(true)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="smart-alerts-error" role="alert">
          {String(error)}
        </div>
      )}

      <section className="smart-alerts-summary">
        <article className="smart-alerts-stat">
          <span>Total notifications</span>
          <strong>{notifications.length}</strong>
        </article>

        <article className="smart-alerts-stat">
          <span>Unread notifications</span>
          <strong>{unreadCount}</strong>
        </article>

        <article className="smart-alerts-stat">
          <span>Update frequency</span>
          <strong>30 seconds</strong>
        </article>
      </section>

      <section className="smart-alerts-list-card">
        <div className="smart-alerts-list-header">
          <div>
            <h2>Your alerts</h2>
            <p>
              {lastUpdated
                ? `Last updated ${lastUpdated.toLocaleTimeString()}`
                : "Waiting for notifications"}
            </p>
          </div>

          <label className="smart-alerts-filter">
            Filter
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">All alerts</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
              <option value="attendance">Attendance</option>
              <option value="leave">Leave</option>
              <option value="payroll">Payroll</option>
            </select>
          </label>
        </div>

        {loading ? (
          <p className="smart-alerts-empty">Loading alerts...</p>
        ) : filteredNotifications.length === 0 ? (
          <div className="smart-alerts-empty">
            <span className="smart-alerts-empty-icon">🔔</span>
            <h3>No alerts found</h3>
            <p>
              New notifications will appear here when they are generated.
            </p>
          </div>
        ) : (
          <div className="smart-alerts-list">
            {filteredNotifications.map((item) => {
              const type = getAlertType(item.title);

              return (
                <article
                  key={item.id}
                  className={`smart-alert-item ${
                    item.is_read ? "is-read" : "is-unread"
                  }`}
                >
                  <div className={`smart-alert-icon ${type}`}>
                    {getAlertIcon(type)}
                  </div>

                  <div className="smart-alert-content">
                    <div className="smart-alert-title-row">
                      <h3>{item.title}</h3>

                      {!item.is_read && (
                        <span className="smart-alert-unread">
                          Unread
                        </span>
                      )}
                    </div>

                    <p>{item.message}</p>

                    <time>
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString()
                        : "Date unavailable"}
                    </time>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

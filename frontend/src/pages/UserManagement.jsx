
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const emptyForm = {
  username: "",
  email: "",
  password: "",
  role: "EMPLOYEE",
  is_active: true,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  fontSize: 14,
  background: "#fff",
};

const buttonStyle = {
  border: 0,
  borderRadius: 8,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 13,
};

export default function UserManagement() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const currentUserId = Number(currentUser?.id);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/users/");
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load users. Check your admin access and backend server."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((item) => {
      const matchesSearch =
        !query ||
        String(item.username || "").toLowerCase().includes(query) ||
        String(item.email || "").toLowerCase().includes(query) ||
        String(item.id || "").includes(query);

      const matchesRole =
        roleFilter === "ALL" || item.role === roleFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && item.is_active) ||
        (statusFilter === "INACTIVE" && !item.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  function updateField(event) {
    const { name, value, checked, type } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setError("");
    setMessage("");
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      username: item.username || "",
      email: item.email || "",
      password: "",
      role: item.role || "EMPLOYEE",
      is_active: Boolean(item.is_active),
    });
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    const payload = {
      username: form.username.trim(),
      email: form.email.trim(),
      role: form.role,
      is_active: form.is_active,
    };

    if (!editingId || form.password.trim()) {
      payload.password = form.password;
    }

    try {
      if (editingId) {
        await api.patch(`/users/${editingId}`, payload);
        setMessage("User updated successfully.");
      } else {
        await api.post("/users/", payload);
        setMessage("User created successfully.");
      }

      setForm({ ...emptyForm });
      setEditingId(null);
      await loadUsers();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((item) => item.msg).join(", ")
            : "Unable to save the user. Please check the entered details."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item) {
    const action = item.is_active ? "deactivate" : "activate";

    if (
      !window.confirm(
        `Are you sure you want to ${action} ${item.username}'s account?`
      )
    ) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.patch(`/users/${item.id}`, {
        is_active: !item.is_active,
      });
      setMessage(
        `${item.username}'s account was ${action}d successfully.`
      );
      await loadUsers();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : `Unable to ${action} this account.`
      );
    }
  }

  async function deleteUser(item) {
    if (
      !window.confirm(
        `Delete user "${item.username}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.delete(`/users/${item.id}`);
      setMessage(`User "${item.username}" deleted successfully.`);

      if (editingId === item.id) {
        resetForm();
      }

      await loadUsers();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Unable to delete this user. They may have linked employee records."
      );
    }
  }

  const activeCount = users.filter((item) => item.is_active).length;
  const inactiveCount = users.length - activeCount;
  const adminCount = users.filter(
    (item) => item.role === "ADMIN"
  ).length;

  return (
    <div style={styles.page}>
      <div style={styles.heading}>
        <div>
          <p style={styles.eyebrow}>ADMINISTRATION</p>
          <h1 style={styles.title}>User Management</h1>
          <p style={styles.subtitle}>
            Create accounts, manage access roles, and control account status.
          </p>
        </div>

        <button
          type="button"
          onClick={loadUsers}
          disabled={loading}
          style={{
            ...buttonStyle,
            background: "#e2e8f0",
            color: "#334155",
          }}
        >
          {loading ? "Refreshing..." : "Refresh Users"}
        </button>
      </div>

      <div style={styles.stats}>
        <StatCard label="Total Users" value={users.length} />
        <StatCard label="Active Accounts" value={activeCount} />
        <StatCard label="Inactive Accounts" value={inactiveCount} />
        <StatCard label="Administrators" value={adminCount} />
      </div>

      {error && <div role="alert" style={styles.error}>{error}</div>}
      {message && <div role="status" style={styles.success}>{message}</div>}

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>
          {editingId ? `Edit User #${editingId}` : "Create New User"}
        </h2>
        <p style={styles.helper}>
          {editingId
            ? "Leave the password empty to keep the existing password."
            : "Create an account and assign its initial role."}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={styles.formGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Username</span>
              <input
                style={inputStyle}
                name="username"
                value={form.username}
                onChange={updateField}
                minLength={3}
                maxLength={50}
                autoComplete="off"
                required
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Email Address</span>
              <input
                style={inputStyle}
                type="email"
                name="email"
                value={form.email}
                onChange={updateField}
                required
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>
                Password {editingId ? "(optional)" : ""}
              </span>
              <input
                style={inputStyle}
                type="password"
                name="password"
                value={form.password}
                onChange={updateField}
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                placeholder={editingId ? "Leave blank to keep current" : "Minimum 8 characters"}
                required={!editingId}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Role</span>
              <select
                style={inputStyle}
                name="role"
                value={form.role}
                onChange={updateField}
                required
              >
                <option value="EMPLOYEE">EMPLOYEE</option>
                <option value="HR">HR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </label>
          </div>

          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="is_active"
              checked={form.is_active}
              onChange={updateField}
            />
            Account is active
          </label>

          <div style={styles.formActions}>
            <button
              type="submit"
              disabled={saving}
              style={{
                ...buttonStyle,
                background: "#1d4ed8",
                color: "#fff",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Save Changes"
                  : "Create User"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                style={{
                  ...buttonStyle,
                  background: "#e2e8f0",
                  color: "#334155",
                }}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section style={styles.card}>
        <div style={styles.tableHeading}>
          <div>
            <h2 style={styles.sectionTitle}>All Users</h2>
            <p style={styles.helper}>
              Showing {filteredUsers.length} of {users.length} accounts
            </p>
          </div>
        </div>

        <div style={styles.filters}>
          <input
            style={{ ...inputStyle, flex: "2 1 220px" }}
            placeholder="Search username, email, or ID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            style={{ ...inputStyle, flex: "1 1 140px" }}
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            aria-label="Filter by role"
          >
            <option value="ALL">All roles</option>
            <option value="EMPLOYEE">EMPLOYEE</option>
            <option value="HR">HR</option>
            <option value="ADMIN">ADMIN</option>
          </select>

          <select
            style={{ ...inputStyle, flex: "1 1 140px" }}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by account status"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {loading ? (
          <p style={styles.empty}>Loading users...</p>
        ) : filteredUsers.length === 0 ? (
          <p style={styles.empty}>No users match your filters.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>User</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Created</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((item) => {
                  const isSelf = Number(item.id) === currentUserId;

                  return (
                    <tr key={item.id}>
                      <td style={styles.td}>{item.id}</td>
                      <td style={styles.td}>
                        <div style={styles.userName}>{item.username}</div>
                        <div style={styles.email}>{item.email}</div>
                        {isSelf && <span style={styles.youTag}>Your account</span>}
                      </td>
                      <td style={styles.td}>
                        <span style={roleBadge(item.role)}>{item.role}</span>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={
                            item.is_active
                              ? styles.activeBadge
                              : styles.inactiveBadge
                          }
                        >
                          {item.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {item.created_at
                          ? new Date(item.created_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actions}>
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            style={{
                              ...buttonStyle,
                              ...styles.smallButton,
                              background: "#dbeafe",
                              color: "#1d4ed8",
                            }}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleStatus(item)}
                            style={{
                              ...buttonStyle,
                              ...styles.smallButton,
                              background: item.is_active ? "#fef3c7" : "#dcfce7",
                              color: item.is_active ? "#92400e" : "#166534",
                            }}
                          >
                            {item.is_active ? "Deactivate" : "Activate"}
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteUser(item)}
                            disabled={isSelf}
                            title={isSelf ? "You cannot delete your own account here" : "Delete user"}
                            style={{
                              ...buttonStyle,
                              ...styles.smallButton,
                              background: "#fee2e2",
                              color: "#b91c1c",
                              opacity: isSelf ? 0.45 : 1,
                              cursor: isSelf ? "not-allowed" : "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function roleBadge(role) {
  const colors = {
    ADMIN: { background: "#ede9fe", color: "#6d28d9" },
    HR: { background: "#dbeafe", color: "#1d4ed8" },
    EMPLOYEE: { background: "#f1f5f9", color: "#475569" },
  };

  return {
    display: "inline-block",
    padding: "5px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 800,
    ...colors[role],
  };
}

const styles = {
  page: {
    maxWidth: 1450,
    margin: "0 auto",
    padding: "28px 24px",
    color: "#0f172a",
  },
  heading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
  },
  eyebrow: {
    color: "#2563eb",
    fontWeight: 800,
    fontSize: 11,
    letterSpacing: 1.5,
    margin: "0 0 7px",
  },
  title: {
    fontSize: 30,
    lineHeight: 1.2,
    margin: "0 0 8px",
    fontWeight: 800,
  },
  subtitle: {
    color: "#64748b",
    margin: 0,
    fontSize: 14,
  },
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 14,
    marginBottom: 22,
  },
  statCard: {
    padding: "20px",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
  },
  statValue: {
    fontSize: 27,
    fontWeight: 800,
    color: "#1d4ed8",
  },
  statLabel: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 5,
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 22,
    marginBottom: 22,
    minWidth: 0,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: 800,
    margin: 0,
  },
  helper: {
    color: "#64748b",
    fontSize: 13,
    margin: "6px 0 18px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    minWidth: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    marginTop: 18,
    fontSize: 14,
    color: "#334155",
  },
  formActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 20,
  },
  tableHeading: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 18,
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    fontSize: 13,
  },
  th: {
    padding: "13px 12px",
    background: "#f8fafc",
    color: "#475569",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px 12px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle",
  },
  userName: {
    fontWeight: 700,
    color: "#0f172a",
  },
  email: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },
  youTag: {
    display: "inline-block",
    color: "#1d4ed8",
    background: "#dbeafe",
    padding: "3px 6px",
    borderRadius: 5,
    fontSize: 10,
    fontWeight: 700,
    marginTop: 5,
  },
  activeBadge: {
    color: "#166534",
    background: "#dcfce7",
    padding: "5px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 800,
  },
  inactiveBadge: {
    color: "#991b1b",
    background: "#fee2e2",
    padding: "5px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 800,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    minWidth: 220,
  },
  smallButton: {
    padding: "7px 9px",
    fontSize: 11,
  },
  empty: {
    padding: 24,
    textAlign: "center",
    color: "#64748b",
  },
  error: {
    padding: "12px 14px",
    borderRadius: 8,
    marginBottom: 16,
    color: "#991b1b",
    background: "#fee2e2",
    border: "1px solid #fecaca",
  },
  success: {
    padding: "12px 14px",
    borderRadius: 8,
    marginBottom: 16,
    color: "#166534",
    background: "#dcfce7",
    border: "1px solid #bbf7d0",
  },
};

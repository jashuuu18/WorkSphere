
import { useEffect, useState } from "react";
import api from "../services/api";

export default function MyProfile() {
  const [account, setAccount] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError("");

      try {
        const accountResponse = await api.get("/auth/me");
        setAccount(accountResponse.data);

        try {
          const employeeResponse = await api.get("/employees/me");
          setEmployee(employeeResponse.data);
        } catch (employeeError) {
          if (employeeError.response?.status !== 404) {
            console.error("Employee profile load failed:", employeeError);
          }
        }
      } catch (err) {
        setError(
          err.response?.data?.detail || "Unable to load your account."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  if (loading) {
    return <main style={styles.page}>Loading your profile...</main>;
  }

  if (error) {
    return (
      <main style={styles.page}>
        <h1>My Profile</h1>
        <p style={styles.error}>{error}</p>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <h1 style={styles.title}>My Profile</h1>
      <p style={styles.subtitle}>
        View your WorkSphere account and employee information.
      </p>

      <section style={styles.card}>
        <div style={styles.avatar}>
          {(account?.username || "U").charAt(0).toUpperCase()}
        </div>

        <h2 style={styles.name}>{account?.username || "User"}</h2>
        <span style={styles.role}>{account?.role || "EMPLOYEE"}</span>
        <p style={styles.email}>{account?.email || "No email available"}</p>
      </section>

      <section style={styles.card}>
        <h2 style={styles.heading}>Account Information</h2>
        <Info label="User ID" value={account?.id} />
        <Info label="Username" value={account?.username} />
        <Info label="Email" value={account?.email} />
        <Info label="Role" value={account?.role} />
        <Info
          label="Account Created"
          value={
            account?.created_at
              ? new Date(account.created_at).toLocaleString()
              : "—"
          }
        />
      </section>

      <section style={styles.card}>
        <h2 style={styles.heading}>Employee Information</h2>

        {employee ? (
          <>
            <Info label="Employee ID" value={employee.id} />
            <Info label="Full Name" value={employee.full_name} />
            <Info label="Designation" value={employee.designation} />
            <Info label="Department" value={employee.department} />
            <Info label="Joining Date" value={employee.joining_date} />
            <Info label="Employment Status" value={employee.status} />
          </>
        ) : (
          <p style={styles.muted}>
            No employee profile is linked to this account yet. Contact HR
            to create or link your employee profile.
          </p>
        )}
      </section>
    </main>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.label}>{label}</span>
      <span style={styles.value}>
        {value === null || value === undefined || value === ""
          ? "—"
          : String(value)}
      </span>
    </div>
  );
}

const styles = {
  page: {
    padding: 24,
    maxWidth: 1000,
    margin: "0 auto",
    color: "#172554",
  },
  title: { margin: 0, fontSize: 30 },
  subtitle: { color: "#64748b", marginBottom: 24 },
  card: {
    background: "#fff",
    padding: 24,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "#dbeafe",
    color: "#1d4ed8",
    display: "grid",
    placeItems: "center",
    fontSize: 28,
    fontWeight: 700,
  },
  name: { marginBottom: 8 },
  role: {
    background: "#dbeafe",
    color: "#1d4ed8",
    padding: "5px 10px",
    borderRadius: 20,
    fontSize: 12,
  },
  email: { color: "#64748b" },
  heading: { marginTop: 0, fontSize: 19 },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    padding: "13px 0",
    borderBottom: "1px solid #e2e8f0",
  },
  label: { color: "#64748b" },
  value: { fontWeight: 600, overflowWrap: "anywhere" },
  muted: { color: "#64748b", lineHeight: 1.6 },
  error: {
    color: "#991b1b",
    background: "#fee2e2",
    padding: 12,
    borderRadius: 8,
  },
};

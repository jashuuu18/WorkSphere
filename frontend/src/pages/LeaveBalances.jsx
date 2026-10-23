
import { useEffect, useState } from "react";
import api from "../services/api";

export default function LeaveBalances() {
  const [policies, setPolicies] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadLeaveData() {
      try {
        setError("");

        const [policyResponse, balanceResponse] = await Promise.all([
          api.get("/leave-policies/"),
          api.get("/leave-policies/balances/me"),
        ]);

        setPolicies(policyResponse.data);
        setBalances(balanceResponse.data);
      } catch (err) {
        setError(
          err.response?.data?.detail ||
            "Unable to load leave policies and balances."
        );
      } finally {
        setLoading(false);
      }
    }

    loadLeaveData();
  }, []);

  const getBalance = (leaveType) =>
    balances.find((balance) => balance.leave_type === leaveType);

  const cardStyle = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "22px",
    boxShadow: "0 3px 10px rgba(15, 23, 42, 0.05)",
  };

  const headingStyle = {
    color: "#0f172a",
    marginTop: 0,
  };

  if (loading) {
    return (
      <div style={{ padding: "24px" }}>
        Loading leave policies and balances...
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "1100px",
        margin: "0 auto",
        color: "#334155",
      }}
    >
      <h1 style={{ color: "#0f172a" }}>Leave Policies & Balances</h1>

      <p style={{ color: "#64748b", marginBottom: "28px" }}>
        Review your leave entitlements and the number of days remaining.
      </p>

      {error && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            color: "#b91c1c",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            padding: "14px",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}

      <h2 style={headingStyle}>My Leave Balance</h2>

      {!error && balances.length === 0 && (
        <p>
          No leave balances are available yet. Check that leave policies have
          been configured and your employee profile exists.
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
          marginBottom: "36px",
        }}
      >
        {balances.map((balance) => {
          const policy = policies.find(
            (item) => item.leave_type === balance.leave_type
          );

          return (
            <div key={balance.id} style={cardStyle}>
              <p
                style={{
                  color: "#64748b",
                  fontSize: "14px",
                  margin: "0 0 10px",
                }}
              >
                {balance.leave_type} LEAVE
              </p>

              <div
                style={{
                  fontSize: "34px",
                  fontWeight: "700",
                  color: "#2563eb",
                }}
              >
                {balance.remaining_days}
              </div>

              <p style={{ marginBottom: "0" }}>
                days remaining
              </p>

              <p
                style={{
                  color: "#64748b",
                  fontSize: "13px",
                  marginBottom: 0,
                }}
              >
                Total allowance:{" "}
                {policy ? policy.total_days_allowed : "Not available"} days
              </p>
            </div>
          );
        })}
      </div>

      <h2 style={headingStyle}>Leave Policy Overview</h2>

      <div
        style={{
          overflowX: "auto",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
          }}
        >
          <thead style={{ background: "#f1f5f9" }}>
            <tr>
              <th style={{ padding: "14px" }}>Leave Type</th>
              <th style={{ padding: "14px" }}>Total Allowed Days</th>
              <th style={{ padding: "14px" }}>Remaining Days</th>
            </tr>
          </thead>

          <tbody>
            {policies.map((policy) => {
              const balance = getBalance(policy.leave_type);

              return (
                <tr key={policy.id}>
                  <td
                    style={{
                      padding: "14px",
                      borderTop: "1px solid #e2e8f0",
                    }}
                  >
                    {policy.leave_type}
                  </td>

                  <td
                    style={{
                      padding: "14px",
                      borderTop: "1px solid #e2e8f0",
                    }}
                  >
                    {policy.total_days_allowed}
                  </td>

                  <td
                    style={{
                      padding: "14px",
                      borderTop: "1px solid #e2e8f0",
                    }}
                  >
                    {balance ? balance.remaining_days : "Not initialized"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

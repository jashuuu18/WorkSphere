
import { useState } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { user, login, loading } = useAuth();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <div className="page-loading">Loading WorkSphere...</div>;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      await login(email, password);

      const destination = location.state?.from?.pathname || "/dashboard";
      window.location.assign(destination);
    } catch (error) {
      const detail = error.response?.data?.detail;
      setMessage(
        typeof detail === "string"
          ? detail
          : "Login failed. Check your email and password."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <div className="brand-mark">W</div>
        <h1>WorkSphere</h1>
        <p className="muted">Human Resource Management System</p>

        <h2>Welcome back</h2>
        <p className="muted">Sign in to access your workspace.</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            placeholder="you@company.com"
            required
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="Enter your password"
            required
          />

          <button
            className="primary-button"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {message && <div className="error-message">{message}</div>}

        <p className="footer-note">
          Secure access for WorkSphere employees and administrators.
        </p>
      </section>
    </main>
  );
}

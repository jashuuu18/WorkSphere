
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "./Settings.css";

export default function Settings() {
  const [profile, setProfile] = useState(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [preferences, setPreferences] = useState({
    email_notifications: true,
    in_app_notifications: true,
  });

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [profileResponse, preferencesResponse] = await Promise.all([
        api.get("/settings/profile"),
        api.get("/settings/notifications"),
      ]);

      const data = profileResponse.data;
      setProfile(data);
      setEmail(data.email || "");
      setFullName(data.employee?.full_name || "");
      setPreferences(preferencesResponse.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load your profile settings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function saveProfile(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    setSavingProfile(true);

    try {
      const changes = {};

      if (email.trim() !== profile.email) {
        changes.email = email.trim();
      }

      if (
        profile.employee &&
        fullName.trim() !== profile.employee.full_name
      ) {
        changes.full_name = fullName.trim();
      }

      if (Object.keys(changes).length === 0) {
        setNotice("There are no profile changes to save.");
        return;
      }

      await api.patch("/settings/profile", changes);
      setNotice("Profile updated successfully.");
      await loadSettings();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to update your profile."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setNotice("");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Your new password must contain at least 8 characters.");
      return;
    }

    setSavingPassword(true);

    try {
      const response = await api.patch("/settings/password", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      setNotice(response.data.message || "Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to change your password."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  async function savePreferences(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    setSavingPreferences(true);

    try {
      const response = await api.put(
        "/settings/notifications",
        preferences
      );

      setPreferences({
        email_notifications: response.data.email_notifications,
        in_app_notifications: response.data.in_app_notifications,
      });

      setNotice(
        response.data.message || "Notification preferences saved."
      );
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to save notification preferences."
      );
    } finally {
      setSavingPreferences(false);
    }
  }

  if (loading) {
    return <main className="settings-page">Loading your settings...</main>;
  }

  if (!profile) {
    return (
      <main className="settings-page">
        <div className="settings-alert error">
          {error || "Profile information is unavailable."}
        </div>
        <button type="button" onClick={loadSettings}>
          Try again
        </button>
      </main>
    );
  }

  return (
    <main className="settings-page">
      <header className="settings-header">
        <div>
          <p className="settings-eyebrow">WORKSPHERE HRMS</p>
          <h1>Profile & Settings</h1>
          <p>Manage your account information and preferences.</p>
        </div>
        <div className="settings-avatar" aria-hidden="true">
          {(profile.employee?.full_name || profile.username || "U")
            .charAt(0)
            .toUpperCase()}
        </div>
      </header>

      {notice && (
        <div className="settings-alert success" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="settings-alert error" role="alert">
          {error}
        </div>
      )}

      <section className="settings-section">
        <div className="settings-section-heading">
          <h2>Account information</h2>
          <p>Review and update your permitted profile details.</p>
        </div>

        <div className="settings-account-summary">
          <div>
            <span>Username</span>
            <strong>{profile.username}</strong>
          </div>
          <div>
            <span>Role</span>
            <strong>{profile.role}</strong>
          </div>
          <div>
            <span>Employee ID</span>
            <strong>{profile.employee?.id ?? "Not assigned"}</strong>
          </div>
        </div>

        {profile.employee && (
          <div className="settings-employment-details">
            <div>
              <span>Designation</span>
              <strong>{profile.employee.designation || "—"}</strong>
            </div>
            <div>
              <span>Department</span>
              <strong>{profile.employee.department || "—"}</strong>
            </div>
            <div>
              <span>Joining date</span>
              <strong>{profile.employee.joining_date || "—"}</strong>
            </div>
            <div>
              <span>Employment status</span>
              <strong>{profile.employee.status || "—"}</strong>
            </div>
          </div>
        )}

        <form className="settings-form" onSubmit={saveProfile}>
          <label htmlFor="settings-email">Email address</label>
          <input
            id="settings-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          {profile.employee && (
            <>
              <label htmlFor="settings-full-name">Full name</label>
              <input
                id="settings-full-name"
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                minLength={2}
                maxLength={150}
                required
              />
            </>
          )}

          <button type="submit" disabled={savingProfile}>
            {savingProfile ? "Saving..." : "Save profile"}
          </button>
        </form>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading">
          <h2>Change password</h2>
          <p>Enter your current password to set a new one.</p>
        </div>

        <form className="settings-form" onSubmit={changePassword}>
          <label htmlFor="settings-current-password">
            Current password
          </label>
          <input
            id="settings-current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />

          <label htmlFor="settings-new-password">New password</label>
          <input
            id="settings-new-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />

          <label htmlFor="settings-confirm-password">
            Confirm new password
          </label>
          <input
            id="settings-confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />

          <button type="submit" disabled={savingPassword}>
            {savingPassword ? "Updating..." : "Change password"}
          </button>
        </form>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading">
          <h2>Notification preferences</h2>
          <p>Choose which notification channels you prefer.</p>
        </div>

        <form className="settings-preferences" onSubmit={savePreferences}>
          <label className="settings-toggle">
            <span>
              <strong>Email notifications</strong>
              <small>Preference for receiving email updates.</small>
            </span>
            <input
              type="checkbox"
              checked={preferences.email_notifications}
              onChange={(event) =>
                setPreferences((previous) => ({
                  ...previous,
                  email_notifications: event.target.checked,
                }))
              }
            />
          </label>

          <label className="settings-toggle">
            <span>
              <strong>In-app notifications</strong>
              <small>Preference for notifications inside WorkSphere.</small>
            </span>
            <input
              type="checkbox"
              checked={preferences.in_app_notifications}
              onChange={(event) =>
                setPreferences((previous) => ({
                  ...previous,
                  in_app_notifications: event.target.checked,
                }))
              }
            />
          </label>

          <button type="submit" disabled={savingPreferences}>
            {savingPreferences ? "Saving..." : "Save preferences"}
          </button>
        </form>
      </section>
    </main>
  );
}

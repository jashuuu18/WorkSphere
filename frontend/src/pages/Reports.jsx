
import { useState } from "react";
import api from "../services/api";
import "./Reports.css";

const reports = [
  { label: "Employees", path: "/exports/employees" },
  { label: "Attendance", path: "/exports/attendance" },
  { label: "Payroll", path: "/exports/payroll" },
];

export default function Reports() {
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function downloadReport(path, format, label) {
    const key = `${label}-${format}`;

    setLoading(key);
    setMessage("");
    setError("");

    try {
      const response = await api.get(`${path}.${format}`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type:
          format === "pdf"
            ? "application/pdf"
            : "text/csv;charset=utf-8",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `${label.toLowerCase()}-report.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMessage(`${label} ${format.toUpperCase()} report downloaded.`);
    } catch (err) {
      setError(
        err.response?.status === 401
          ? "Please log in again."
          : err.response?.status === 403
          ? "Only HR and Admin can download reports."
          : `Unable to download the ${label} report. Check the backend and try again.`
      );
    } finally {
      setLoading("");
    }
  }

  return (
    <main className="reports-page">
      <header className="reports-header">
        <div>
          <h1>HR Reports</h1>
          <p>Export employee, attendance, and payroll records.</p>
        </div>
      </header>

      {message && <div className="report-message">{message}</div>}
      {error && <div className="report-error">{error}</div>}

      <div className="reports-grid">
        {reports.map((report) => (
          <section className="report-card" key={report.label}>
            <div className="report-icon">▤</div>
            <h2>{report.label}</h2>
            <p>
              Download the {report.label.toLowerCase()} data
              as a CSV spreadsheet or a PDF report.
            </p>

            <div className="report-actions">
              <button
                disabled={Boolean(loading)}
                onClick={() =>
                  downloadReport(report.path, "csv", report.label)
                }
              >
                {loading === `${report.label}-csv`
                  ? "Downloading..."
                  : "Download CSV"}
              </button>

              <button
                className="pdf-button"
                disabled={Boolean(loading)}
                onClick={() =>
                  downloadReport(report.path, "pdf", report.label)
                }
              >
                {loading === `${report.label}-pdf`
                  ? "Downloading..."
                  : "Download PDF"}
              </button>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

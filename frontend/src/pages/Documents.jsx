import { useEffect, useState } from "react";
import api from "../services/api";
import "./Documents.css";

// Convert FastAPI and Axios errors into readable text.
// Never render a JavaScript object directly in React.
function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;

        const location = Array.isArray(item?.loc)
          ? item.loc.filter((part) => part !== "body").join(" > ")
          : "";

        const message = item?.msg || "Invalid input";

        return location ? `${location}: ${message}` : message;
      })
      .join(". ");
  }

  if (detail && typeof detail === "object") {
    return detail.msg || detail.message || fallback;
  }

  if (error?.response?.status === 401) {
    return "Your session has expired. Please log in again.";
  }

  if (error?.response?.status === 403) {
    return "You do not have permission to perform this action.";
  }

  if (error?.response?.status === 404) {
    return "The requested resource was not found.";
  }

  if (error?.response?.status === 413) {
    return "The file is too large. The maximum size is 5 MB.";
  }

  if (error?.response?.status === 415) {
    return "This file type or file content is not supported.";
  }

  if (error?.response?.status === 422) {
    return "The upload information is invalid. Check the selected file and required employee ID.";
  }

  if (error?.response?.status >= 500) {
    return "The server encountered an error. Please check the backend terminal.";
  }

  if (error?.message === "Network Error") {
    return "Cannot connect to the server. Make sure the FastAPI backend is running.";
  }

  return fallback;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".png",
  ".jpg",
  ".jpeg",
];

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [viewAll, setViewAll] = useState(false);

  async function loadDocuments(allEmployees = false) {
    setLoading(true);
    setError("");

    try {
      const endpoint = allEmployees ? "/documents/" : "/documents/me";
      const response = await api.get(endpoint);

      setDocuments(Array.isArray(response.data) ? response.data : []);
      setViewAll(allEmployees);
    } catch (err) {
      setDocuments([]);
      setError(
        getErrorMessage(
          err,
          "Unable to load documents. Please check your login and permissions."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments(false);
  }, []);

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0] || null;

    setFile(selectedFile);
    setError("");
    setMessage("");

    if (!selectedFile) return;

    const lastDot = selectedFile.name.lastIndexOf(".");
    const extension =
      lastDot >= 0 ? selectedFile.name.slice(lastDot).toLowerCase() : "";

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setError("Choose a PDF, DOC, DOCX, PNG, JPG, or JPEG file.");
      setFile(null);
      event.target.value = "";
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("The maximum file size is 5 MB.");
      setFile(null);
      event.target.value = "";
    }
  }

  async function handleUpload(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!file) {
      setError("Please choose a valid document before uploading.");
      return;
    }

    const lastDot = file.name.lastIndexOf(".");
    const extension =
      lastDot >= 0 ? file.name.slice(lastDot).toLowerCase() : "";

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setError("This file extension is not supported.");
      return;
    }

    if (file.size === 0) {
      setError("The selected file is empty.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("The maximum file size is 5 MB.");
      return;
    }

    if (employeeId.trim() && Number(employeeId) <= 0) {
      setError("Employee ID must be a positive number.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    if (employeeId.trim()) {
      formData.append("employee_id", employeeId.trim());
    }

    setUploading(true);

    try {
      // Let Axios set the multipart/form-data boundary automatically.
      const response = await api.post("/documents/upload", formData);

      setMessage(
        response.data?.message || "Document uploaded successfully."
      );
      setFile(null);
      setEmployeeId("");

      const input = document.getElementById("document-file-input");
      if (input) input.value = "";

      // Refresh the current list without clearing the success message.
      await loadDocuments(viewAll);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Document upload failed. Please check the file and try again."
        )
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(documentItem) {
    setError("");
    setMessage("");
    setDownloadingId(documentItem.id);

    let blobUrl;

    try {
      const response = await api.get(
        `/documents/${documentItem.id}/download`,
        { responseType: "blob" }
      );

      blobUrl = window.URL.createObjectURL(response.data);

      const link = window.document.createElement("a");
      link.href = blobUrl;
      link.download = documentItem.file_name || "document";
      window.document.body.appendChild(link);
      link.click();
      link.remove();

      setMessage("Download started successfully.");
    } catch (err) {
      let readableError = getErrorMessage(
        err,
        "Download failed. Please check your access permissions."
      );

      // With responseType="blob", FastAPI error details may also be a Blob.
      const responseData = err?.response?.data;

      if (responseData instanceof Blob) {
        try {
          const text = await responseData.text();
          const parsed = JSON.parse(text);

          if (parsed?.detail) {
            readableError =
              typeof parsed.detail === "string"
                ? parsed.detail
                : Array.isArray(parsed.detail)
                  ? parsed.detail
                      .map((item) =>
                        typeof item === "string" ? item : item?.msg || "Invalid input"
                      )
                      .join(". ")
                  : parsed.detail?.msg || readableError;
          }
        } catch {
          // Keep the readable fallback if the response isn't JSON.
        }
      }

      setError(readableError);
    } finally {
      if (blobUrl) {
        window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      }

      setDownloadingId(null);
    }
  }

  return (
    <main className="documents-page">
      <header className="documents-header">
        <div>
          <h1>Document Management</h1>
          <p>Securely upload and access employee documents.</p>
        </div>
      </header>

      {message && (
        <div className="documents-success" role="status">
          {message}
        </div>
      )}

      {error && (
        <div className="documents-error" role="alert">
          {error}
        </div>
      )}

      <section className="documents-card">
        <h2>Upload a Document</h2>

        <p className="documents-help">
          Accepted formats: PDF, DOC, DOCX, PNG, JPG, and JPEG.
          Maximum size: 5 MB.
        </p>

        <form onSubmit={handleUpload} className="documents-form">
          <label htmlFor="document-file-input">Choose file</label>

          <input
            id="document-file-input"
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            disabled={uploading}
          />

          {file && (
            <p className="documents-help">
              Selected: {file.name} (
              {(file.size / 1024).toFixed(1)} KB)
            </p>
          )}

          <label htmlFor="document-employee-id">
            Employee ID (for HR/Admin uploads on behalf of an employee)
          </label>

          <input
            id="document-employee-id"
            type="number"
            min="1"
            step="1"
            placeholder="HR/Admin: enter employee ID"
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            disabled={uploading}
          />

          <p className="documents-help">
            Employees can upload to their own profile. HR/Admin must enter
            the target employee ID when uploading on another employee's behalf.
          </p>

          <button type="submit" disabled={uploading || !file}>
            {uploading ? "Uploading..." : "Upload Document"}
          </button>
        </form>
      </section>

      <section className="documents-card">
        <div className="documents-list-header">
          <div>
            <h2>{viewAll ? "Employee Documents" : "My Documents"}</h2>
            <p className="documents-help">
              Downloads are restricted by backend permissions.
            </p>
          </div>

          <div className="documents-actions">
            <button
              type="button"
              className="documents-secondary-button"
              onClick={() => loadDocuments(false)}
              disabled={loading}
            >
              My Documents
            </button>

            <button
              type="button"
              className="documents-secondary-button"
              onClick={() => loadDocuments(true)}
              disabled={loading}
            >
              All Documents (HR/Admin)
            </button>
          </div>
        </div>

        {loading ? (
          <p>Loading documents...</p>
        ) : documents.length === 0 ? (
          <p>No documents found.</p>
        ) : (
          <div className="documents-table-wrapper">
            <table className="documents-table">
              <thead>
                <tr>
                  <th>Document ID</th>
                  <th>Employee ID</th>
                  <th>File Name</th>
                  <th>Uploaded At</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {documents.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.employee_id}</td>
                    <td>{item.file_name}</td>
                    <td>
                      {item.uploaded_at
                        ? new Date(item.uploaded_at).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleDownload(item)}
                        disabled={downloadingId === item.id}
                      >
                        {downloadingId === item.id
                          ? "Downloading..."
                          : "Download"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

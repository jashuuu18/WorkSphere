
import { useEffect, useState } from "react";
import api from "../services/api";
import "./PerformanceReviews.css";

const initialForm = {
  employee_id: "",
  rating: "3",
  strengths: "",
  areas_for_improvement: "",
  feedback: "",
  review_period: "",
  review_date: new Date().toISOString().slice(0, 10),
};

export default function PerformanceReviews() {
  const [reviews, setReviews] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadReviews(all = false, filter = "") {
    setLoading(true);
    setError("");
    try {
      let response;

      if (all) {
        const params = filter.trim()
          ? { employee_id: Number(filter) }
          : {};
        response = await api.get("/performance-reviews/", { params });
      } else {
        response = await api.get("/performance-reviews/me");
      }

      setReviews(response.data);
      setShowAll(all);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load reviews. Check your login and permissions."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReviews(false);
  }, []);

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function startEdit(review) {
    setEditingId(review.id);
    setForm({
      employee_id: String(review.employee_id),
      rating: String(review.rating),
      strengths: review.strengths,
      areas_for_improvement: review.areas_for_improvement,
      feedback: review.feedback,
      review_period: review.review_period,
      review_date: review.review_date,
    });
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(initialForm);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!editingId && !form.employee_id.trim()) {
      setError("Enter an employee ID.");
      return;
    }

    const payload = {
      rating: Number(form.rating),
      strengths: form.strengths.trim(),
      areas_for_improvement: form.areas_for_improvement.trim(),
      feedback: form.feedback.trim(),
      review_period: form.review_period.trim(),
      review_date: form.review_date,
    };

    if (!editingId) {
      payload.employee_id = Number(form.employee_id);
    }

    setSaving(true);

    try {
      if (editingId) {
        await api.patch(
          `/performance-reviews/${editingId}`,
          payload
        );
        setMessage("Performance review updated successfully.");
      } else {
        await api.post("/performance-reviews/", payload);
        setMessage("Performance review created successfully.");
      }

      setEditingId(null);
      setForm(initialForm);
      await loadReviews(showAll, employeeFilter);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to save the review. HR/Admin permission may be required."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="performance-page">
      <header className="performance-header">
        <div>
          <h1>Performance Management</h1>
          <p>Employee reviews, ratings, and development feedback.</p>
        </div>
      </header>

      {message && (
        <div className="performance-success">{message}</div>
      )}
      {error && (
        <div className="performance-error">{String(error)}</div>
      )}

      <section className="performance-card">
        <h2>{editingId ? "Update Review" : "Create Performance Review"}</h2>
        <p className="performance-help">
          Creating and updating reviews requires HR or Admin access.
        </p>

        <form className="performance-form" onSubmit={handleSubmit}>
          {!editingId && (
            <>
              <label htmlFor="employee_id">Employee ID</label>
              <input
                id="employee_id"
                name="employee_id"
                type="number"
                min="1"
                required
                value={form.employee_id}
                onChange={handleChange}
              />
            </>
          )}

          <label htmlFor="rating">Rating (1–5)</label>
          <select
            id="rating"
            name="rating"
            min="1"
            max="5"
            required
            value={form.rating}
            onChange={handleChange}
          >
            <option value="1">1 - Needs significant improvement</option>
            <option value="2">2 - Needs improvement</option>
            <option value="3">3 - Meets expectations</option>
            <option value="4">4 - Exceeds expectations</option>
            <option value="5">5 - Outstanding</option>
          </select>

          <label htmlFor="review_period">Review Period</label>
          <input
            id="review_period"
            name="review_period"
            placeholder="Example: 2026-Q3"
            maxLength="50"
            required
            value={form.review_period}
            onChange={handleChange}
          />

          <label htmlFor="review_date">Review Date</label>
          <input
            id="review_date"
            name="review_date"
            type="date"
            required
            value={form.review_date}
            onChange={handleChange}
          />

          <label htmlFor="strengths">Strengths</label>
          <textarea
            id="strengths"
            name="strengths"
            rows="3"
            maxLength="5000"
            required
            value={form.strengths}
            onChange={handleChange}
          />

          <label htmlFor="areas_for_improvement">
            Areas for Improvement
          </label>
          <textarea
            id="areas_for_improvement"
            name="areas_for_improvement"
            rows="3"
            maxLength="5000"
            required
            value={form.areas_for_improvement}
            onChange={handleChange}
          />

          <label htmlFor="feedback">Overall Feedback</label>
          <textarea
            id="feedback"
            name="feedback"
            rows="4"
            maxLength="5000"
            required
            value={form.feedback}
            onChange={handleChange}
          />

          <div className="performance-form-actions">
            <button type="submit" disabled={saving}>
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Review"
                  : "Create Review"}
            </button>

            {editingId && (
              <button
                type="button"
                className="performance-secondary"
                onClick={cancelEdit}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="performance-card">
        <div className="performance-list-header">
          <div>
            <h2>{showAll ? "All Employee Reviews" : "My Reviews"}</h2>
            <p className="performance-help">
              Reviews are displayed according to your permissions.
            </p>
          </div>
          <div className="performance-actions">
            <button
              type="button"
              className="performance-secondary"
              disabled={loading}
              onClick={() => loadReviews(false)}
            >
              My Reviews
            </button>
            <button
              type="button"
              className="performance-secondary"
              disabled={loading}
              onClick={() => loadReviews(true, employeeFilter)}
            >
              All Reviews (HR/Admin)
            </button>
          </div>
        </div>

        {showAll && (
          <form
            className="performance-filter"
            onSubmit={(event) => {
              event.preventDefault();
              loadReviews(true, employeeFilter);
            }}
          >
            <input
              type="number"
              min="1"
              placeholder="Filter by employee ID (optional)"
              value={employeeFilter}
              onChange={(event) => setEmployeeFilter(event.target.value)}
            />
            <button type="submit" disabled={loading}>Filter</button>
          </form>
        )}

        {loading ? (
          <p>Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <p>No performance reviews found.</p>
        ) : (
          <div className="performance-review-list">
            {reviews.map((review) => (
              <article className="performance-review" key={review.id}>
                <div className="performance-review-top">
                  <div>
                    <h3>Review #{review.id}</h3>
                    <p>
                      Employee ID: {review.employee_id} ·{" "}
                      {review.review_period}
                    </p>
                  </div>
                  <span className="performance-rating">
                    {review.rating}/5
                  </span>
                </div>

                <p><strong>Review date:</strong> {review.review_date}</p>
                <p><strong>Strengths:</strong> {review.strengths}</p>
                <p>
                  <strong>Areas for improvement:</strong>{" "}
                  {review.areas_for_improvement}
                </p>
                <p><strong>Feedback:</strong> {review.feedback}</p>
                <p className="performance-reviewer">
                  Reviewer ID: {review.reviewer_id}
                </p>

                {showAll && (
                  <button
                    type="button"
                    onClick={() => startEdit(review)}
                  >
                    Edit Review
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

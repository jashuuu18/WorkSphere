
export default function ModulePlaceholder({ title, description }) {
  return (
    <main className="page-container">
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPHERE MODULE</p>
          <h1>{title}</h1>
          <p className="muted">{description}</p>
        </div>
      </div>

      <section className="empty-state module-placeholder">
        <h2>{title} page</h2>
        <p>
          Your backend module is available. The full interactive page will be
          connected in the next frontend integration step.
        </p>
      </section>
    </main>
  );
}

export default function Loading() {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="skeleton skeleton-eyebrow" />
      <div className="skeleton skeleton-title" />
      <div className="skeleton-grid">
        <div className="skeleton skeleton-tile" />
        <div className="skeleton skeleton-tile" />
      </div>
      <div className="skeleton skeleton-card" />
      <div className="skeleton skeleton-card" />
      <span className="sr-only">Dealing the cards…</span>
    </div>
  );
}

import { Loader2, RefreshCw } from 'lucide-react';

/** Page title + optional right-side actions. */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="ct-page-head">
      <div>
        <h1 className="ct-page-title">{title}</h1>
        {subtitle && <p className="ct-text-muted mb-0">{subtitle}</p>}
      </div>
      {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Spinner block for loading states. */
export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="ct-state" role="status" aria-live="polite">
      <Loader2 className="ct-spin" size={22} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Error panel with retry. */
export function ErrorState({ message, onRetry }) {
  return (
    <div className="ct-state ct-state-error" role="alert">
      <div>
        <strong>Could not load data.</strong>
        <div className="small">{message}</div>
      </div>
      {onRetry && (
        <button type="button" className="btn btn-ct-outline ct-btn btn-sm" onClick={onRetry}>
          <RefreshCw size={14} className="me-1" aria-hidden="true" /> Retry
        </button>
      )}
    </div>
  );
}

/** Friendly empty list state. */
export function EmptyState({ title, hint, action }) {
  return (
    <div className="ct-state ct-state-empty">
      <div>
        <strong>{title}</strong>
        {hint && <div className="small ct-text-muted mt-1">{hint}</div>}
      </div>
      {action}
    </div>
  );
}

/** Small pill used for statuses. */
export function Pill({ children, tone = 'neutral' }) {
  return <span className={`ct-pill ct-pill-${tone}`}>{children}</span>;
}

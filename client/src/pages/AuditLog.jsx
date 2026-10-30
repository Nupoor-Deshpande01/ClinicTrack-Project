import { useEffect, useState } from 'react';
import { CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { auditApi } from '../api';
import { errorMessage } from '../api/client';
import { EmptyState, ErrorState, LoadingState, PageHeader, Pill } from '../components/ui';

const PAGE_SIZE = 20;

const shortHash = hash => (hash ? `${hash.slice(0, 10)}…${hash.slice(-4)}` : '—');

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null); // { valid, ... } after a verify run

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    auditApi
      .list({ page, limit: PAGE_SIZE, action })
      .then(res => {
        if (!active) return;
        setEntries(res.data);
        setMeta(res.meta);
      })
      .catch(err => active && setError(errorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page, action]);

  const verify = async () => {
    setVerifying(true);
    try {
      const res = await auditApi.verify();
      setResult(res.data);
      if (res.data.valid) toast.success(res.message);
      else toast.error(res.message);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every login, edit, version and queue change — chained with SHA-256."
        actions={
          <button
            type="button"
            className="btn btn-ct-primary ct-btn"
            onClick={verify}
            disabled={verifying}
          >
            <ShieldCheck size={16} aria-hidden="true" />
            {verifying ? 'Verifying…' : 'Verify integrity'}
          </button>
        }
      />

      {result && (
        <div
          className={`ct-alert ${result.valid ? 'ct-alert-info' : 'ct-alert-danger'} mb-3`}
          role="status"
        >
          {result.valid ? (
            <div className="d-flex align-items-center gap-2">
              <CheckCircle2 size={18} aria-hidden="true" />
              <div>
                <strong>Chain intact.</strong> All {result.checked} entries hash-match their
                predecessor.
              </div>
            </div>
          ) : (
            <div className="d-flex align-items-start gap-2">
              <ShieldAlert size={18} aria-hidden="true" />
              <div>
                <strong>Chain broken at entry {result.firstBroken.position}</strong> (
                {result.firstBroken.action} · {result.firstBroken.entity}).
                <div className="small mt-1">
                  Stored hash <code>{shortHash(result.firstBroken.storedHash)}</code>, expected{' '}
                  <code>{shortHash(result.firstBroken.expectedHash)}</code> — this record was
                  changed after it was written.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <section className="ct-card ct-card-pad">
        <div className="ct-toolbar mb-3">
          <div>
            <label className="visually-hidden" htmlFor="audit-action">
              Filter by action
            </label>
            <input
              id="audit-action"
              className="ct-input"
              style={{ maxWidth: 260 }}
              placeholder="Filter action (e.g. VISIT, LOGIN)…"
              value={action}
              onChange={e => {
                setAction(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {meta && <span className="ct-text-muted small ms-auto">{meta.total} entries</span>}
        </div>

        {loading && <LoadingState label="Loading audit trail…" />}
        {error && !loading && <ErrorState message={error} onRetry={() => setPage(p => p)} />}
        {!loading && !error && entries.length === 0 && (
          <EmptyState title="No audit entries match" hint="Try a different action filter." />
        )}

        {!loading && !error && entries.length > 0 && (
          <>
            <div className="table-responsive">
              <table className="ct-table">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Action</th>
                    <th scope="col">Entity</th>
                    <th scope="col">Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => (
                    <tr key={entry.id}>
                      <td className="text-nowrap small">
                        {new Date(entry.at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td>
                        <div className="small fw-semibold">{entry.actorName}</div>
                        <Pill tone="info">{entry.actorRole}</Pill>
                      </td>
                      <td>
                        <code className="small">{entry.action}</code>
                      </td>
                      <td className="small">
                        {entry.entity}
                        {entry.entityId ? ` · ${String(entry.entityId).slice(-6)}` : ''}
                      </td>
                      <td>
                        <code className="small" title={entry.hash}>
                          {shortHash(entry.hash)}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ct-pagination">
              <span className="ct-text-muted small">
                Page {meta.page} of {meta.pages || 1}
              </span>
              <button
                type="button"
                className="btn btn-ct-ghost ct-btn btn-sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={meta.page <= 1}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-ct-ghost ct-btn btn-sm"
                onClick={() => setPage(p => Math.min(meta.pages, p + 1))}
                disabled={meta.page >= meta.pages}
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}

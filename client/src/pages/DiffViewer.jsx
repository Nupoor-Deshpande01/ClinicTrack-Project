import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { visitsApi } from '../api';
import { errorMessage } from '../api/client';
import { EmptyState, ErrorState, LoadingState, PageHeader, Pill } from '../components/ui';

/** Side-by-side version diff with red (old) / green (new) highlighting. */
export default function DiffViewer() {
  const { a, b } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    visitsApi
      .diff(a, b)
      .then(res => active && setData(res))
      .catch(err => active && setError(errorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [a, b]);

  if (loading) return <LoadingState label="Building diff…" />;
  if (error) return <ErrorState message={error} />;

  const changedCount = data.diff.filter(d => d.changed).length;

  return (
    <>
      <PageHeader
        title={`Compare v${data.a.versionNumber} → v${data.b.versionNumber}`}
        subtitle={`${changedCount} field(s) changed`}
        actions={
          <Link to={`/visits/${data.b.id}/timeline`} className="btn btn-ct-outline ct-btn">
            <ArrowLeft size={15} aria-hidden="true" /> Timeline
          </Link>
        }
      />

      {changedCount === 0 ? (
        <EmptyState
          title="These versions are identical"
          hint="No clinical fields differ between the two versions."
        />
      ) : (
        <section className="ct-card ct-card-pad">
          <div className="ct-diff-grid mb-2 ct-text-muted small fw-bold">
            <div>v{data.a.versionNumber} (older)</div>
            <div>v{data.b.versionNumber} (newer)</div>
          </div>

          <div className="d-flex flex-column gap-3">
            {data.diff.map(row => (
              <div
                key={row.field}
                className={row.changed ? 'ct-diff-changed' : 'ct-diff-unchanged'}
              >
                <div className="ct-diff-field">
                  {row.label} {row.changed && <Pill tone="warning">changed</Pill>}
                </div>
                <div className="ct-diff-grid">
                  <div className="ct-diff-cell ct-diff-cell-a">{String(row.a) || '—'}</div>
                  <div className="ct-diff-cell ct-diff-cell-b">{String(row.b) || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

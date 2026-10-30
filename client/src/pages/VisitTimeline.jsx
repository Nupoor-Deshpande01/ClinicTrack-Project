import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GitCompare, RotateCcw, ArrowLeft, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { visitsApi } from '../api';
import { errorMessage } from '../api/client';
import { ErrorState, LoadingState, PageHeader, Pill } from '../components/ui';

const fmt = d =>
  new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const fmtDate = d =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Git-style visit timeline: every version, newest current badge, diff against
 * the previous version, and one-click rollback of an older version.
 */
export default function VisitTimeline() {
  const { id } = useParams();
  const [versions, setVersions] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    visitsApi
      .versions(id)
      .then(res => {
        setVersions([...res.data].sort((a, b) => b.versionNumber - a.versionNumber)); // newest first
        setCurrentId(res.currentVersionId);
      })
      .catch(err => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const rollback = async version => {
    if (
      !window.confirm(
        `Restore version ${version.versionNumber} as a NEW version? History is preserved.`
      )
    )
      return;
    setBusy(version.id);
    try {
      const res = await visitsApi.rollback(currentId, version.id);
      toast.success(res.message);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <LoadingState label="Loading visit history…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const current = versions.find(v => v.isCurrent);
  const patientId = current?.patientId;

  return (
    <>
      <PageHeader
        title={current ? current.diagnosis : 'Visit timeline'}
        subtitle={`${versions.length} version(s) · v${versions[0]?.versionNumber} is current`}
        actions={
          <>
            {patientId && (
              <Link to={`/patients/${patientId}`} className="btn btn-ct-outline ct-btn">
                <ArrowLeft size={15} aria-hidden="true" /> Patient
              </Link>
            )}
            {current && (
              <Link to={`/visits/${current.id}/prescription`} className="btn btn-ct-primary ct-btn">
                <FileText size={15} aria-hidden="true" /> Write prescription
              </Link>
            )}
          </>
        }
      />

      <div className="ct-timeline">
        {versions.map(v => {
          const previous = versions.find(x => x.versionNumber === v.versionNumber - 1);
          return (
            <article className={`ct-card ct-version ${v.isCurrent ? 'is-current' : ''}`} key={v.id}>
              <span className="ct-version-dot" aria-hidden="true">
                v{v.versionNumber}
              </span>
              <div className="flex-grow-1">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <strong>{v.diagnosis}</strong>
                  {v.isCurrent ? <Pill tone="success">Current</Pill> : <Pill>History</Pill>}
                  <small className="ct-text-muted ms-auto">{fmt(v.createdAt)}</small>
                </div>
                <div className="small ct-text-muted mt-1">
                  Visit date: {fmtDate(v.visitDate)}
                  {v.vitals?.bloodPressure ? ` · BP ${v.vitals.bloodPressure}` : ''}
                  {v.vitals?.temperatureC ? ` · ${v.vitals.temperatureC}°C` : ''}
                </div>
                {v.symptoms?.length > 0 && (
                  <div className="small mt-1">Symptoms: {v.symptoms.join(', ')}</div>
                )}
                {v.notes && <p className="small mb-1 mt-2">{v.notes}</p>}
                {v.changeReason && (
                  <div className="ct-alert ct-alert-info py-2 mt-2 small">
                    Change reason: {v.changeReason}
                  </div>
                )}

                <div className="d-flex gap-2 flex-wrap mt-3">
                  {previous && (
                    <Link
                      to={`/visits/${previous.id}/diff/${v.id}`}
                      className="btn btn-ct-outline ct-btn btn-sm"
                    >
                      <GitCompare size={14} aria-hidden="true" /> Diff vs v{previous.versionNumber}
                    </Link>
                  )}
                  {!v.isCurrent && currentId && (
                    <button
                      type="button"
                      className="btn btn-ct-ghost ct-btn btn-sm"
                      onClick={() => rollback(v)}
                      disabled={busy === v.id}
                    >
                      <RotateCcw size={14} aria-hidden="true" />{' '}
                      {busy === v.id ? 'Restoring…' : 'Rollback to this'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="ct-help mt-3">
        Edits create new versions; nothing is ever overwritten. “Rollback” copies an old version
        into a brand-new latest version.
      </p>
    </>
  );
}

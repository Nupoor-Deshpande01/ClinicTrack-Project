import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronRight,
  MonitorPlay,
  Plus,
  SkipForward,
  Users2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { patientsApi, queueApi } from '../api';
import { errorMessage } from '../api/client';
import useQueueSocket from '../hooks/useQueueSocket';
import { EmptyState, ErrorState, LoadingState, PageHeader, Pill } from '../components/ui';

const STATUS_TONE = { waiting: 'warning', serving: 'info', done: 'success', skipped: 'danger' };

export default function Queue() {
  const [queue, setQueue] = useState(null);
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [adding, setAdding] = useState(false);
  const { snapshot, connected } = useQueueSocket();

  // Live broadcasts replace whatever REST returned last.
  useEffect(() => {
    if (snapshot) {
      setQueue(snapshot);
      setLoading(false);
    }
  }, [snapshot]);

  const load = () => {
    setLoading(true);
    setError('');
    queueApi
      .today()
      .then(res => setQueue(res))
      .catch(err => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    patientsApi
      .list({ limit: 50 })
      .then(res => setPatients(res.data))
      .catch(() => setPatients([]));
  }, []);

  const addToken = async e => {
    e.preventDefault();
    if (!patientId) {
      toast.error('Choose a patient first.');
      return;
    }
    setAdding(true);
    try {
      const res = await queueApi.add({ patientId, note: note || undefined });
      toast.success(res.message);
      setQueue(res);
      setPatientId('');
      setNote('');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const move = async (token, status) => {
    setBusyId(token.id);
    try {
      const res = await queueApi.setStatus(token.id, status);
      setQueue(res);
      toast.success(res.message);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingState label="Loading today's queue…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const { data, stats } = queue;

  return (
    <>
      <PageHeader
        title="Live queue"
        subtitle="Today's waiting-room tokens. Updates push to every open screen."
        actions={
          <>
            <span className={`ct-live ${connected ? 'is-on' : ''}`}>
              {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
              {connected ? 'Live' : 'Reconnecting…'}
            </span>
            <Link to="/queue/board" className="btn btn-ct-outline ct-btn">
              <MonitorPlay size={15} aria-hidden="true" /> Now Serving board
            </Link>
          </>
        }
      />

      <div className="ct-queue-stats">
        <div className="ct-card ct-queue-stat">
          <span className="ct-stat-label">
            <Users2 size={15} aria-hidden="true" /> Waiting
          </span>
          <strong>{stats.waiting}</strong>
        </div>
        <div className="ct-card ct-queue-stat">
          <span className="ct-stat-label">In consultation</span>
          <strong>{stats.serving}</strong>
        </div>
        <div className="ct-card ct-queue-stat">
          <span className="ct-stat-label">Seen today</span>
          <strong>{stats.done}</strong>
        </div>
      </div>

      <section className="ct-card ct-card-pad mb-3">
        <h2 className="ct-card-title">Issue a token</h2>
        <form className="ct-queue-form" onSubmit={addToken}>
          <div>
            <label className="ct-label" htmlFor="queue-patient">
              Patient
            </label>
            <select
              id="queue-patient"
              className="ct-select"
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
            >
              <option value="">Select a patient…</option>
              {patients.map(p => (
                <option key={p.id || p._id} value={p.id || p._id}>
                  {p.fullName} · {p.mrn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="ct-label" htmlFor="queue-note">
              Reason (optional)
            </label>
            <input
              id="queue-note"
              className="ct-input"
              placeholder="Walk-in, follow-up, report review…"
              value={note}
              maxLength={120}
              onChange={e => setNote(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-ct-primary ct-btn" disabled={adding}>
            <Plus size={15} aria-hidden="true" /> {adding ? 'Issuing…' : 'Add to queue'}
          </button>
        </form>
      </section>

      {data.length === 0 ? (
        <EmptyState
          title="No tokens issued today"
          hint="Add the first patient above — they appear here and on the Now Serving board."
        />
      ) : (
        <div className="ct-queue-list">
          {data.map(token => (
            <article key={token.id} className={`ct-card ct-queue-card is-${token.status}`}>
              <span className="ct-token">#{String(token.tokenNumber).padStart(2, '0')}</span>
              <div className="flex-grow-1 min-w-0">
                <div className="fw-semibold text-truncate">
                  {token.patient?.fullName ?? 'Unknown patient'}
                </div>
                <small className="ct-text-muted">
                  {token.patient?.mrn}
                  {token.doctor ? ` · ${token.doctor.name}` : ''}
                  {token.note ? ` · ${token.note}` : ''}
                </small>
              </div>
              <Pill tone={STATUS_TONE[token.status]}>{token.status}</Pill>
              <div className="d-flex gap-1">
                {token.status === 'waiting' && (
                  <button
                    type="button"
                    className="btn btn-ct-ghost ct-btn btn-sm"
                    onClick={() => move(token, 'serving')}
                    disabled={busyId === token.id}
                  >
                    <ChevronRight size={14} aria-hidden="true" /> Call
                  </button>
                )}
                {(token.status === 'waiting' || token.status === 'serving') && (
                  <>
                    <button
                      type="button"
                      className="btn btn-ct-ghost ct-btn btn-sm"
                      onClick={() => move(token, 'done')}
                      disabled={busyId === token.id}
                    >
                      <Check size={14} aria-hidden="true" /> Done
                    </button>
                    <button
                      type="button"
                      className="btn btn-ct-ghost ct-btn btn-sm"
                      onClick={() => move(token, 'skipped')}
                      disabled={busyId === token.id}
                    >
                      <SkipForward size={14} aria-hidden="true" /> Skip
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

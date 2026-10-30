import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, HeartPulse } from 'lucide-react';
import { queueApi } from '../api';
import useQueueSocket from '../hooks/useQueueSocket';

/**
 * Waiting-room display: big "now serving" token and the next few in line.
 * Meant for a second screen — no sidebar, huge type, updates over Socket.IO.
 */
export default function QueueBoard() {
  const [queue, setQueue] = useState(null);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(() => new Date());
  const { snapshot, connected } = useQueueSocket();

  useEffect(() => {
    if (snapshot) setQueue(snapshot);
  }, [snapshot]);

  useEffect(() => {
    queueApi
      .today()
      .then(setQueue)
      .catch(err => setError(err.message || 'Could not load the queue.'));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // If two tokens are open, the one called most recently owns the big number.
  const serving = (queue?.data || [])
    .filter(t => t.status === 'serving')
    .sort((a, b) => new Date(b.calledAt || 0) - new Date(a.calledAt || 0))[0];
  const upcoming = (queue?.data || []).filter(t => t.status === 'waiting').slice(0, 4);

  return (
    <div className="ct-board">
      <header className="ct-board-head">
        <div className="d-flex align-items-center gap-2">
          <span className="ct-logo" aria-hidden="true">
            <HeartPulse size={22} />
          </span>
          <div>
            <strong>Siddhivinayak Clinic</strong>
            <div className="ct-board-muted">Now serving</div>
          </div>
        </div>
        <div className="text-end">
          <div className="ct-board-clock">
            {clock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="ct-board-muted">
            {clock.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            {' · '}
            {connected ? 'live' : 'offline'}
          </div>
        </div>
      </header>

      {error && (
        <p className="ct-alert ct-alert-danger" role="alert">
          {error}
        </p>
      )}

      <main className="ct-board-main">
        <section className="ct-board-serving" aria-live="polite">
          <span className="ct-board-label">Token</span>
          <span className="ct-board-token">
            {serving ? `#${String(serving.tokenNumber).padStart(2, '0')}` : '—'}
          </span>
          <span className="ct-board-name">
            {serving ? serving.patient?.fullName : 'Please wait to be called'}
          </span>
          {serving?.doctor && <span className="ct-board-muted">with {serving.doctor.name}</span>}
        </section>

        <section className="ct-board-next">
          <h2 className="ct-board-label">Next in line</h2>
          {upcoming.length === 0 ? (
            <p className="ct-board-muted mb-0">No one waiting.</p>
          ) : (
            <ol className="ct-board-list">
              {upcoming.map(t => (
                <li key={t.id}>
                  <span>#{String(t.tokenNumber).padStart(2, '0')}</span>
                  <small>{t.patient?.mrn}</small>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>

      <footer className="ct-board-foot">
        <Link to="/queue" className="btn btn-ct-outline ct-btn btn-sm">
          <ArrowLeft size={14} aria-hidden="true" /> Back to queue
        </Link>
        <span className="ct-board-muted">
          Also waiting: {queue?.stats.waiting ?? 0} · Seen today: {queue?.stats.done ?? 0}
        </span>
      </footer>
    </div>
  );
}

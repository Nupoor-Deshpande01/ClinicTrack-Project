import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Trash2 } from 'lucide-react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { appointmentsApi } from '../api';
import { errorMessage, TOKEN_KEY } from '../api/client';
import { EmptyState, ErrorState, LoadingState, Pill } from './ui';

const dayLabel = d => d.toLocaleDateString('en-IN', { weekday: 'short' });
const dayNum = d => d.getDate();

/**
 * Date strip + appointment table, shared by the Dashboard and /appointments.
 * One owner of "which day is selected" and its data fetch.
 */
export default function AppointmentsPanel() {
  const [selected, setSelected] = useState(() => new Date());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const iso = d => {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // Live Socket.IO listener: whenever staff books an appointment, doctors see it live!
  useEffect(() => {
    const origin = import.meta.env.VITE_API_URL || window.location.origin;
    const socket = io(origin, {
      auth: { token: localStorage.getItem(TOKEN_KEY) },
      transports: ['websocket', 'polling'],
    });
    socket.on('appointment:update', () => {
      setReload(n => n + 1);
    });
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    appointmentsApi
      .listByDate(iso(selected))
      .then(res => {
        if (active) setAppointments(res.data);
      })
      .catch(err => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected, reload]);

  const handleDelete = async id => {
    if (!window.confirm('Remove this appointment?')) return;
    try {
      await appointmentsApi.remove(id);
      toast.success('Appointment removed');
      setReload(n => n + 1);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  // Two weeks starting today, like the horizontal strip in the design.
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <section className="ct-card ct-card-pad">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="ct-card-title mb-0">Appointments</h2>
        <span className="ct-text-muted small">{appointments.length} booked</span>
      </div>

      <div className="ct-date-strip" role="group" aria-label="Choose appointment day">
        {days.map(d => {
          const isSelected = iso(d) === iso(selected);
          return (
            <button
              key={iso(d)}
              type="button"
              className={`ct-date ${isSelected ? 'is-selected' : ''}`}
              aria-pressed={isSelected}
              onClick={() => setSelected(d)}
            >
              <span>{dayLabel(d)}</span>
              <strong>{dayNum(d)}</strong>
            </button>
          );
        })}
      </div>

      {loading && <LoadingState label="Loading appointments…" />}
      {error && !loading && <ErrorState message={error} onRetry={() => setReload(n => n + 1)} />}
      {!loading && !error && appointments.length === 0 && (
        <EmptyState
          title="No appointments on this day"
          hint="Pick another day from the strip above."
        />
      )}

      {!loading && !error && appointments.length > 0 && (
        <div className="table-responsive">
          <table className="table ct-table align-middle mb-0">
            <thead className="ct-th">
              <tr>
                <th scope="col">Patient</th>
                <th scope="col">Assigned Doctor</th>
                <th scope="col">Time</th>
                <th scope="col">Treatment / Concern</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(a => (
                <tr key={a.id}>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span className="ct-avatar ct-avatar-sm" aria-hidden="true">
                        {a.patient?.fullName?.charAt(0) || '?'}
                      </span>
                      <div>
                        <div className="fw-semibold">{a.patient?.fullName || 'Unknown'}</div>
                        <small className="ct-text-muted">{a.patient?.mrn}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>{a.doctor?.name || '—'}</div>
                    <small className="ct-text-muted">{a.doctor?.specialty || ''}</small>
                  </td>
                  <td>{a.time}</td>
                  <td>
                    <Pill tone={a.status === 'scheduled' ? 'info' : 'success'}>
                      {a.disease || 'Consultation'}
                    </Pill>
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      <Link
                        className="ct-icon-btn"
                        to={`/patients/${a.patient?.id}`}
                        aria-label={`View patient ${a.patient?.fullName}`}
                        title="View patient"
                      >
                        <Eye size={16} />
                      </Link>
                      <button
                        type="button"
                        className="ct-icon-btn ct-icon-danger"
                        onClick={() => handleDelete(a.id)}
                        aria-label={`Delete appointment for ${a.patient?.fullName}`}
                        title="Delete appointment"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

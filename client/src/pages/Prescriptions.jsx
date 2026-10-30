import { useEffect, useState } from 'react';
import { FileDown, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import { prescriptionsApi } from '../api';
import { errorMessage } from '../api/client';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/ui';

export default function Prescriptions() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let active = true;
    prescriptionsApi
      .recent()
      .then(res => active && setItems(res))
      .catch(err => active && setError(errorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  /** Fetch the PDF as a blob (it needs the JWT) and save it. */
  const downloadPdf = async rx => {
    setBusyId(rx.id);
    try {
      const blob = await prescriptionsApi.pdf(rx.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prescription-${rx.patient?.mrn ?? rx.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Prescription PDF downloaded');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingState label="Loading prescriptions…" />;
  if (error) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader
        title="Prescriptions"
        subtitle="Most recent prescriptions. Each one prints on clinic letterhead with a verification QR."
      />

      {items.length === 0 ? (
        <EmptyState
          title="No prescriptions yet"
          hint="Open a patient's current visit and write one from the prescription builder."
        />
      ) : (
        <div className="ct-rx-list">
          {items.map(rx => (
            <article key={rx.id} className="ct-card ct-card-pad ct-rx-card">
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <h2 className="ct-card-title mb-1">
                    {rx.patient?.fullName ?? 'Unknown patient'}{' '}
                    <small className="ct-text-muted">· {rx.patient?.mrn}</small>
                  </h2>
                  <p className="ct-text-muted small mb-2">
                    {new Date(rx.createdAt).toLocaleString('en-IN')} · Dr. {rx.doctor?.name ?? '—'}
                  </p>
                </div>
                <div className="d-flex gap-1 flex-shrink-0">
                  <button
                    type="button"
                    className="btn btn-ct-primary ct-btn btn-sm"
                    onClick={() => downloadPdf(rx)}
                    disabled={busyId === rx.id}
                  >
                    <FileDown size={14} aria-hidden="true" />
                    {busyId === rx.id ? 'Preparing…' : 'PDF'}
                  </button>
                  <a
                    className="btn btn-ct-outline ct-btn btn-sm"
                    href={`/verify/${rx.qrToken}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <QrCode size={14} aria-hidden="true" /> Verify
                  </a>
                </div>
              </div>
              <ul className="mb-0 small">
                {rx.medicines.map(m => (
                  <li key={`${rx.id}-${m.name}`}>
                    {m.name} — {m.dosage}, {m.frequency}, {m.durationDays} day(s)
                  </li>
                ))}
              </ul>
              {rx.advice && <p className="small ct-text-muted mb-0 mt-2">Advice: {rx.advice}</p>}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

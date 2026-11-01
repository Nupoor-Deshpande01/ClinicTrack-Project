import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, ShieldX } from 'lucide-react';
import { prescriptionsApi } from '../api';
import { errorMessage } from '../api/client';
import { LoadingState } from '../components/ui';

/**
 * Public QR landing page (/verify/:qrToken). No login: it only exposes the
 * prescription summary that is already printed on the paper copy.
 */
export default function VerifyPrescription() {
  const { qrToken } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    prescriptionsApi
      .verify(qrToken)
      .then(res => active && setData(res))
      .catch(err => active && setError(errorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [qrToken]);

  return (
    <div className="ct-verify">
      <div className="ct-verify-card ct-card">
        <div className="ct-verify-head">
          <strong>CityCare Clinic</strong>
          <small>Prescription verification</small>
        </div>

        {loading && <LoadingState label="Checking this prescription…" />}

        {!loading && error && (
          <div className="p-4" role="alert">
            <ShieldX size={28} className="text-danger mb-2" aria-hidden="true" />
            <h1 className="h5">Not verified</h1>
            <p className="ct-text-muted small mb-0">{error}</p>
          </div>
        )}

        {!loading && data && (
          <div className="p-4">
            <p className="ct-pill ct-pill-success mb-3">
              <BadgeCheck size={14} aria-hidden="true" /> Valid prescription
            </p>
            <dl className="ct-verify-list">
              <div>
                <dt>Patient</dt>
                <dd>
                  {data.patient?.fullName}{' '}
                  <span className="ct-text-muted">· {data.patient?.mrn}</span>
                </dd>
              </div>
              <div>
                <dt>Prescribed by</dt>
                <dd>
                  Dr. {data.doctor?.name}{' '}
                  <span className="ct-text-muted">· {data.doctor?.specialty}</span>
                </dd>
              </div>
              <div>
                <dt>Issued</dt>
                <dd>{new Date(data.issuedAt).toLocaleString('en-IN')}</dd>
              </div>
              <div>
                <dt>Medicines</dt>
                <dd>
                  <ul className="mb-0 ps-3">
                    {data.medicines.map(m => (
                      <li key={m.name}>
                        {m.name} — {m.dosage}, {m.frequency}, {m.durationDays} day(s)
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              {data.advice && (
                <div>
                  <dt>Advice</dt>
                  <dd>{data.advice}</dd>
                </div>
              )}
            </dl>
            <p className="ct-text-muted small mb-0 mt-3">
              Demonstration data — this record exists in the ClinicTrack demo database only.
            </p>
          </div>
        )}
      </div>
      <p className="mt-3 small">
        <Link to="/login">← Open ClinicTrack</Link>
      </p>
    </div>
  );
}

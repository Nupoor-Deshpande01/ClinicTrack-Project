import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, History, FileText } from 'lucide-react';
import { patientsApi, visitsApi } from '../api';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ErrorState, LoadingState, PageHeader, Pill } from '../components/ui';

const fmtDate = d =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function PatientProfile() {
  const { id } = useParams();
  const { isClinical } = useAuth();
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visitsError, setVisitsError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    patientsApi
      .get(id)
      .then(p => active && setPatient(p))
      .catch(err => active && setError(errorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    // Staff never see clinical visits — the server rejects this call, which is
    // exactly why we only call it for doctor/admin.
    if (!isClinical) return;
    let active = true;
    visitsApi
      .listForPatient(id)
      .then(v => active && setVisits(v))
      .catch(err => active && setVisitsError(errorMessage(err)));
    return () => {
      active = false;
    };
  }, [id, isClinical]);

  if (loading) return <LoadingState label="Loading patient…" />;
  if (error) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader
        title={patient.fullName}
        subtitle={`${patient.mrn} · ${patient.age} years · ${patient.gender}`}
        actions={
          <>
            <Link to="/patients" className="btn btn-ct-outline ct-btn">
              <ArrowLeft size={15} aria-hidden="true" /> All patients
            </Link>
            {isClinical && (
              <Link to={`/patients/${id}/visits/new`} className="btn btn-ct-primary ct-btn">
                <Plus size={15} aria-hidden="true" /> New visit
              </Link>
            )}
          </>
        }
      />

      <div className="ct-dash-grid" style={{ marginTop: 0 }}>
        <div className="ct-dash-col">
          <section className="ct-card ct-card-pad">
            <h2 className="ct-card-title mb-3">Demographics</h2>
            <div className="ct-form-grid" style={{ gap: '0.65rem' }}>
              <div>
                <span className="ct-help">Phone</span>
                <div>{patient.phone}</div>
              </div>
              <div>
                <span className="ct-help">Date of birth</span>
                <div>{fmtDate(patient.dob)}</div>
              </div>
              <div>
                <span className="ct-help">Blood group</span>
                <div>{patient.bloodGroup || 'Unknown'}</div>
              </div>
              <div>
                <span className="ct-help">Registered</span>
                <div>{fmtDate(patient.createdAt)}</div>
              </div>
              {patient.treatment && (
                <div className="col-span-2">
                  <span className="ct-help">Required Treatment / Reason for Visit</span>
                  <div className="fw-semibold text-primary">{patient.treatment}</div>
                </div>
              )}
              {patient.primaryDoctor && (
                <div className="col-span-2">
                  <span className="ct-help">Assigned Doctor</span>
                  <div>
                    Dr. {patient.primaryDoctor.name} ({patient.primaryDoctor.specialty || 'General'}
                    )
                  </div>
                </div>
              )}
              <div className="col-span-2">
                <span className="ct-help">Address</span>
                <div>{patient.address || '—'}</div>
              </div>
            </div>
          </section>

          {isClinical && (
            <section className="ct-card ct-card-pad">
              <h2 className="ct-card-title mb-2">Allergies</h2>
              {patient.allergies?.length ? (
                <div className="d-flex gap-2 flex-wrap">
                  {patient.allergies.map(a => (
                    <Pill key={a} tone="danger">
                      {a}
                    </Pill>
                  ))}
                </div>
              ) : (
                <p className="ct-text-muted mb-0 small">No allergies recorded.</p>
              )}
            </section>
          )}
        </div>

        <div className="ct-dash-col">
          {isClinical ? (
            <section className="ct-card ct-card-pad">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h2 className="ct-card-title mb-0">Visit history</h2>
                <span className="ct-text-muted small">{visits.length} current</span>
              </div>
              {visitsError && <div className="ct-alert ct-alert-danger">{visitsError}</div>}
              {!visitsError && visits.length === 0 && (
                <p className="ct-text-muted small mb-0">
                  No visits yet. Record the first visit to start this record's history.
                </p>
              )}
              <div className="ct-timeline">
                {visits.map(v => (
                  <div className="ct-card ct-version" key={v.id}>
                    <span className="ct-version-dot">{v.versionNumber}</span>
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between flex-wrap gap-2">
                        <strong>{v.diagnosis}</strong>
                        <small className="ct-text-muted">{fmtDate(v.visitDate)}</small>
                      </div>
                      <div className="small ct-text-muted">
                        {(v.symptoms || []).join(', ') || 'No symptoms recorded'}
                      </div>
                      <div className="d-flex gap-2 flex-wrap mt-2">
                        <Pill tone="info">{v.versionCount} version(s)</Pill>
                        <Link
                          to={`/visits/${v.id}/timeline`}
                          className="btn btn-ct-outline ct-btn btn-sm"
                        >
                          <History size={14} aria-hidden="true" /> Timeline
                        </Link>
                        <Link
                          to={`/visits/${v.id}/prescription`}
                          className="btn btn-ct-ghost ct-btn btn-sm"
                        >
                          <FileText size={14} aria-hidden="true" /> Prescription
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="ct-card ct-card-pad">
              <h2 className="ct-card-title mb-2">Clinical records</h2>
              <p className="ct-text-muted small mb-0">
                Reception accounts cannot view clinical notes or prescriptions. Ask a doctor or
                admin to open the visit history.
              </p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, FileDown, Plus, Trash2, Save } from 'lucide-react';
import { prescriptionsApi, visitsApi } from '../api';
import { errorMessage } from '../api/client';
import { prescriptionSchema } from '../validation/schemas';
import { ErrorState, LoadingState, PageHeader } from '../components/ui';

export default function PrescriptionBuilder() {
  const { id: visitId } = useParams();
  const [visit, setVisit] = useState(null);
  const [existing, setExisting] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [serverError, setServerError] = useState('');
  const [downloading, setDownloading] = useState(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(prescriptionSchema),
    defaultValues: {
      medicines: [{ name: '', dosage: '', frequency: '', durationDays: 3 }],
      advice: '',
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'medicines' });

  useEffect(() => {
    let active = true;
    Promise.all([visitsApi.versions(visitId), prescriptionsApi.listForVisit(visitId)])
      .then(([versions, rx]) => {
        if (!active) return;
        setVisit(
          versions.data.find(v => v.id === versions.currentVersionId) || versions.data.at(-1)
        );
        setExisting(rx);
      })
      .catch(err => active && setLoadError(errorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [visitId]);

  const onSubmit = async values => {
    setServerError('');
    try {
      const res = await prescriptionsApi.create(visitId, values);
      toast.success(res.message);
      setExisting(list => [res.data, ...list]);
      reset({ medicines: [{ name: '', dosage: '', frequency: '', durationDays: 3 }], advice: '' });
    } catch (err) {
      setServerError(errorMessage(err));
    }
  };

  /** The PDF needs the JWT, so it is fetched as a blob and saved locally. */
  const downloadPdf = async rx => {
    setDownloading(rx.id);
    try {
      const blob = await prescriptionsApi.pdf(rx.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prescription-${rx.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDownloading(null);
    }
  };

  if (loading) return <LoadingState label="Loading visit…" />;
  if (loadError) return <ErrorState message={loadError} />;

  return (
    <>
      <PageHeader
        title="Prescription builder"
        subtitle={
          visit ? `Visit v${visit.versionNumber} · ${visit.diagnosis}` : 'Visit prescription'
        }
        actions={
          <Link to={`/visits/${visitId}/timeline`} className="btn btn-ct-outline ct-btn">
            <ArrowLeft size={15} aria-hidden="true" /> Timeline
          </Link>
        }
      />

      {serverError && (
        <div className="ct-alert ct-alert-danger mb-3" role="alert">
          {serverError}
        </div>
      )}

      <section className="ct-card ct-card-pad mb-3" style={{ maxWidth: 900 }}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h2 className="ct-card-title mb-0">Medicines</h2>
            <button
              type="button"
              className="btn btn-ct-ghost ct-btn btn-sm"
              onClick={() => append({ name: '', dosage: '', frequency: '', durationDays: 3 })}
            >
              <Plus size={14} aria-hidden="true" /> Add medicine
            </button>
          </div>

          {errors.medicines?.root && <p className="ct-error">{errors.medicines.root.message}</p>}
          {errors.medicines?.message && <p className="ct-error">{errors.medicines.message}</p>}

          <div className="d-flex flex-column gap-3">
            {fields.map((field, index) => (
              <div
                className="ct-card ct-card-pad"
                key={field.id}
                style={{ background: 'var(--ct-page)' }}
              >
                <div className="ct-form-grid">
                  <div>
                    <label className="ct-label" htmlFor={`med-name-${index}`}>
                      Medicine
                    </label>
                    <input
                      id={`med-name-${index}`}
                      className={`ct-input ${errors.medicines?.[index]?.name ? 'is-invalid' : ''}`}
                      placeholder="Paracetamol"
                      {...register(`medicines.${index}.name`)}
                    />
                    {errors.medicines?.[index]?.name && (
                      <p className="ct-error">{errors.medicines[index].name.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="ct-label" htmlFor={`med-dosage-${index}`}>
                      Dosage
                    </label>
                    <input
                      id={`med-dosage-${index}`}
                      className={`ct-input ${errors.medicines?.[index]?.dosage ? 'is-invalid' : ''}`}
                      placeholder="500 mg"
                      {...register(`medicines.${index}.dosage`)}
                    />
                    {errors.medicines?.[index]?.dosage && (
                      <p className="ct-error">{errors.medicines[index].dosage.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="ct-label" htmlFor={`med-freq-${index}`}>
                      Frequency
                    </label>
                    <input
                      id={`med-freq-${index}`}
                      className={`ct-input ${errors.medicines?.[index]?.frequency ? 'is-invalid' : ''}`}
                      placeholder="1-0-1 or twice daily"
                      {...register(`medicines.${index}.frequency`)}
                    />
                    {errors.medicines?.[index]?.frequency && (
                      <p className="ct-error">{errors.medicines[index].frequency.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="ct-label" htmlFor={`med-days-${index}`}>
                      Duration (days)
                    </label>
                    <input
                      id={`med-days-${index}`}
                      type="number"
                      className={`ct-input ${errors.medicines?.[index]?.durationDays ? 'is-invalid' : ''}`}
                      {...register(`medicines.${index}.durationDays`)}
                    />
                    {errors.medicines?.[index]?.durationDays && (
                      <p className="ct-error">{errors.medicines[index].durationDays.message}</p>
                    )}
                  </div>
                </div>
                {fields.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ct-danger ct-btn btn-sm mt-2"
                    onClick={() => remove(index)}
                  >
                    <Trash2 size={14} aria-hidden="true" /> Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <label className="ct-label mt-3" htmlFor="advice">
            Advice for the patient
          </label>
          <textarea
            id="advice"
            className="ct-textarea"
            placeholder="Rest, hydration, review in 3 days…"
            {...register('advice')}
          />
          {errors.advice && <p className="ct-error">{errors.advice.message}</p>}

          <button type="submit" className="btn btn-ct-primary ct-btn mt-4" disabled={isSubmitting}>
            <Save size={16} aria-hidden="true" /> {isSubmitting ? 'Saving…' : 'Save prescription'}
          </button>
        </form>
      </section>

      <section className="ct-card ct-card-pad" style={{ maxWidth: 900 }}>
        <h2 className="ct-card-title mb-2">Saved prescriptions</h2>
        {existing.length === 0 ? (
          <p className="ct-text-muted small mb-0">No prescription written for this visit yet.</p>
        ) : (
          <div className="d-flex flex-column gap-2">
            {existing.map(rx => (
              <div key={rx.id} className="ct-alert ct-alert-info mb-0">
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div className="fw-semibold small">
                    {new Date(rx.createdAt).toLocaleString('en-IN')} · {rx.medicines.length}{' '}
                    medicine(s)
                  </div>
                  <button
                    type="button"
                    className="btn btn-ct-outline ct-btn btn-sm"
                    onClick={() => downloadPdf(rx)}
                    disabled={downloading === rx.id}
                  >
                    <FileDown size={14} aria-hidden="true" />
                    {downloading === rx.id ? 'Preparing…' : 'PDF'}
                  </button>
                </div>
                <ul className="mb-0 mt-1 small">
                  {rx.medicines.map(m => (
                    <li key={`${rx.id}-${m.name}`}>
                      {m.name} — {m.dosage}, {m.frequency}, {m.durationDays} day(s)
                    </li>
                  ))}
                </ul>
                {rx.advice && <div className="small mt-1">Advice: {rx.advice}</div>}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

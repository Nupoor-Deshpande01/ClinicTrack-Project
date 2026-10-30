import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Save, ArrowLeft } from 'lucide-react';
import { visitsApi } from '../api';
import { errorMessage } from '../api/client';
import { visitSchema } from '../validation/schemas';
import { PageHeader } from '../components/ui';

export default function VisitForm() {
  const { id: patientId } = useParams();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(visitSchema),
    defaultValues: { visitDate: new Date().toISOString().slice(0, 10) },
  });

  const onSubmit = async values => {
    setServerError('');
    try {
      const res = await visitsApi.create(patientId, {
        visitDate: values.visitDate,
        diagnosis: values.diagnosis,
        symptoms: values.symptoms
          ? values.symptoms
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : [],
        notes: values.notes,
        vitals: {
          temperatureC: values.temperatureC ?? undefined,
          bloodPressure: values.bloodPressure || undefined,
          heartRate: values.heartRate ?? undefined,
        },
      });
      toast.success(res.message);
      navigate(`/visits/${res.data.id}/timeline`);
    } catch (err) {
      setServerError(errorMessage(err));
    }
  };

  const fieldClass = name => `ct-input ${errors[name] ? 'is-invalid' : ''}`;

  return (
    <>
      <PageHeader
        title="New visit"
        subtitle="The first save creates version 1 of this visit. Later edits add versions instead of overwriting."
        actions={
          <Link to={`/patients/${patientId}`} className="btn btn-ct-outline ct-btn">
            <ArrowLeft size={15} aria-hidden="true" /> Patient
          </Link>
        }
      />

      <section className="ct-card ct-card-pad" style={{ maxWidth: 880 }}>
        {serverError && (
          <div className="ct-alert ct-alert-danger mb-3" role="alert">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="ct-form-grid">
            <div>
              <label className="ct-label" htmlFor="visitDate">
                Visit date *
              </label>
              <input
                id="visitDate"
                type="date"
                className={fieldClass('visitDate')}
                max={new Date().toISOString().slice(0, 10)}
                {...register('visitDate')}
              />
              {errors.visitDate && <p className="ct-error">{errors.visitDate.message}</p>}
            </div>

            <div>
              <label className="ct-label" htmlFor="diagnosis">
                Diagnosis *
              </label>
              <input
                id="diagnosis"
                className={fieldClass('diagnosis')}
                placeholder="e.g. Acute viral fever"
                {...register('diagnosis')}
              />
              {errors.diagnosis && <p className="ct-error">{errors.diagnosis.message}</p>}
            </div>

            <div className="col-span-2">
              <label className="ct-label" htmlFor="symptoms">
                Symptoms (comma separated)
              </label>
              <input
                id="symptoms"
                className="ct-input"
                placeholder="fever, body ache"
                {...register('symptoms')}
              />
              {errors.symptoms && <p className="ct-error">{errors.symptoms.message}</p>}
            </div>

            <div>
              <label className="ct-label" htmlFor="temperatureC">
                Temperature (°C)
              </label>
              <input
                id="temperatureC"
                type="number"
                step="0.1"
                className={fieldClass('temperatureC')}
                placeholder="37.2"
                {...register('temperatureC')}
              />
              {errors.temperatureC && <p className="ct-error">{errors.temperatureC.message}</p>}
            </div>

            <div>
              <label className="ct-label" htmlFor="bloodPressure">
                Blood pressure
              </label>
              <input
                id="bloodPressure"
                className={fieldClass('bloodPressure')}
                placeholder="120/80"
                {...register('bloodPressure')}
              />
              {errors.bloodPressure && <p className="ct-error">{errors.bloodPressure.message}</p>}
            </div>

            <div>
              <label className="ct-label" htmlFor="heartRate">
                Heart rate (bpm)
              </label>
              <input
                id="heartRate"
                type="number"
                className={fieldClass('heartRate')}
                placeholder="78"
                {...register('heartRate')}
              />
              {errors.heartRate && <p className="ct-error">{errors.heartRate.message}</p>}
            </div>

            <div className="col-span-2">
              <label className="ct-label" htmlFor="notes">
                Clinical notes
              </label>
              <textarea
                id="notes"
                className="ct-textarea"
                rows={4}
                placeholder="Examination findings, advice…"
                {...register('notes')}
              />
              {errors.notes && <p className="ct-error">{errors.notes.message}</p>}
            </div>
          </div>

          <button type="submit" className="btn btn-ct-primary ct-btn mt-4" disabled={isSubmitting}>
            <Save size={16} aria-hidden="true" />{' '}
            {isSubmitting ? 'Saving visit…' : 'Save visit (v1)'}
          </button>
        </form>
      </section>
    </>
  );
}

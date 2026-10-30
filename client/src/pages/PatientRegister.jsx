import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Save } from 'lucide-react';
import { patientsApi } from '../api';
import { errorMessage } from '../api/client';
import { patientSchema } from '../validation/schemas';
import { PageHeader } from '../components/ui';

export default function PatientRegister() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [duplicate, setDuplicate] = useState(null); // live duplicate-phone warning
  const [warnings, setWarnings] = useState([]);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(patientSchema),
    defaultValues: { gender: '', bloodGroup: '' },
  });

  /** Look up an existing patient with exactly this mobile number. */
  const findSamePhone = async phone => {
    if (!/^[6-9]\d{9}$/.test(phone || '')) return null;
    try {
      const res = await patientsApi.list({ search: phone, limit: 5 });
      return res.data.find(p => p.phone === phone) || null;
    } catch {
      return null; // the warning is best-effort; saving still works
    }
  };

  /** Duplicate-patient warning: check the phone against the existing records. */
  const checkDuplicate = async () => {
    const match = await findSamePhone(getValues('phone'));
    setDuplicate(match);
  };

  const onSubmit = async values => {
    setServerError('');
    setWarnings([]);

    // Confirm before saving a second record on the same mobile number (the
    // blur-time banner can be missed when the user types and clicks Save fast).
    const existing = duplicate || (await findSamePhone(values.phone));
    if (
      existing &&
      !window.confirm(
        `${existing.fullName} (${existing.mrn}) already uses this mobile number. Register this patient anyway?`
      )
    ) {
      return;
    }

    try {
      const res = await patientsApi.create({
        ...values,
        allergies: values.allergies
          ? values.allergies
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : [],
      });
      toast.success(res.message);
      if (res.warnings?.length) toast(res.warnings[0].message, { icon: '⚠️' });
      navigate(`/patients/${res.data.id || res.data._id}`);
    } catch (err) {
      setServerError(errorMessage(err));
      setWarnings(err.response?.data?.errors || []);
    }
  };

  const fieldClass = name => `ct-input ${errors[name] ? 'is-invalid' : ''}`;

  return (
    <>
      <PageHeader
        title="Register patient"
        subtitle="Client validation runs live below; the server validates the same rules again before saving."
        actions={
          <Link to="/patients" className="btn btn-ct-outline ct-btn">
            <ArrowLeft size={15} aria-hidden="true" /> Back
          </Link>
        }
      />

      <section className="ct-card ct-card-pad" style={{ maxWidth: 880 }}>
        {serverError && (
          <div className="ct-alert ct-alert-danger mb-3" role="alert">
            {serverError}
            {warnings.length > 0 && (
              <ul className="mb-0 mt-1">
                {warnings.map(w => (
                  <li key={w.field}>{w.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {duplicate && (
          <div className="ct-alert ct-alert-warning mb-3" role="status">
            <strong>Possible duplicate:</strong> {duplicate.fullName} ({duplicate.mrn}) already uses
            this mobile number. You can still register if this is a different family member.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="ct-form-grid">
            <div className="col-span-2">
              <label className="ct-label" htmlFor="fullName">
                Full name *
              </label>
              <input
                id="fullName"
                className={fieldClass('fullName')}
                placeholder="e.g. Ravi Kulkarni"
                {...register('fullName')}
              />
              {errors.fullName && <p className="ct-error">{errors.fullName.message}</p>}
            </div>

            <div>
              <label className="ct-label" htmlFor="phone">
                Mobile number *
              </label>
              <input
                id="phone"
                type="tel"
                className={fieldClass('phone')}
                placeholder="10 digits starting 6-9"
                {...register('phone')}
                onBlur={checkDuplicate}
              />
              {errors.phone && <p className="ct-error">{errors.phone.message}</p>}
            </div>

            <div>
              <label className="ct-label" htmlFor="dob">
                Date of birth *
              </label>
              <input
                id="dob"
                type="date"
                className={fieldClass('dob')}
                max={new Date().toISOString().slice(0, 10)}
                {...register('dob')}
              />
              {errors.dob && <p className="ct-error">{errors.dob.message}</p>}
            </div>

            <div>
              <label className="ct-label" htmlFor="gender">
                Gender *
              </label>
              <select
                id="gender"
                className={`ct-select ${errors.gender ? 'is-invalid' : ''}`}
                {...register('gender')}
              >
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              {errors.gender && <p className="ct-error">{errors.gender.message}</p>}
            </div>

            <div>
              <label className="ct-label" htmlFor="bloodGroup">
                Blood group
              </label>
              <select id="bloodGroup" className="ct-select" {...register('bloodGroup')}>
                <option value="">Unknown</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="ct-label" htmlFor="allergies">
                Known allergies (comma separated)
              </label>
              <input
                id="allergies"
                className="ct-input"
                placeholder="e.g. penicillin, sulfonamides"
                {...register('allergies')}
              />
              {errors.allergies && <p className="ct-error">{errors.allergies.message}</p>}
            </div>

            <div className="col-span-2">
              <label className="ct-label" htmlFor="address">
                Address
              </label>
              <textarea
                id="address"
                className="ct-textarea"
                placeholder="Area, city, PIN"
                {...register('address')}
              />
              {errors.address && <p className="ct-error">{errors.address.message}</p>}
            </div>
          </div>

          <button type="submit" className="btn btn-ct-primary ct-btn mt-4" disabled={isSubmitting}>
            <Save size={16} aria-hidden="true" /> {isSubmitting ? 'Saving…' : 'Save patient'}
          </button>
        </form>
      </section>
    </>
  );
}

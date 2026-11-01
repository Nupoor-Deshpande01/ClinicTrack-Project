import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HeartPulse, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { loginSchema } from '../validation/schemas';
import { errorMessage } from '../api/client';

const DEMO_ACCOUNTS = [
  { label: 'Doctor', email: 'doctor@clinic.test', password: 'Doctor@123' },
  { label: 'Reception', email: 'staff@clinic.test', password: 'Staff@123' },
  { label: 'Admin', email: 'admin@clinic.test', password: 'Admin@123' },
];

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: yupResolver(loginSchema) });

  // Already signed in? Go where you were headed.
  useEffect(() => {
    if (isAuthenticated) navigate(location.state?.from || '/dashboard', { replace: true });
  }, [isAuthenticated, navigate, location.state]);

  const onSubmit = async values => {
    setServerError('');
    try {
      const user = await login(values.email, values.password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setServerError(errorMessage(err)); // server-side 401/422 message
    }
  };

  const fillDemo = account => {
    setValue('email', account.email, { shouldValidate: true });
    setValue('password', account.password, { shouldValidate: true });
  };

  return (
    <div className="ct-auth">
      <div className="ct-auth-art">
        <div className="d-flex align-items-center gap-2">
          <span
            className="ct-logo"
            style={{ background: 'rgba(255,255,255,.22)' }}
            aria-hidden="true"
          >
            <HeartPulse size={20} />
          </span>
          <strong>ClinicTrack</strong>
        </div>
        <div>
          <h2>Patient records with a memory — every visit versioned, every change auditable.</h2>
          <p className="opacity-75 mb-0">CityCare Clinic · Patient Management Portal</p>
        </div>
        <small className="opacity-75">Version-tracked records. Tamper-evident audit trail.</small>
      </div>

      <div className="ct-auth-form">
        <div className="ct-auth-card">
          <h1 className="h4 fw-bold mb-1">Login to your clinic</h1>
          <p className="ct-text-muted small mb-4">
            Use one of the demo accounts below while seeding.
          </p>

          {serverError && (
            <div className="ct-alert ct-alert-danger mb-3" role="alert">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <label className="ct-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              className={`ct-input ${errors.email ? 'is-invalid' : ''}`}
              placeholder="doctor@clinic.test"
              {...register('email')}
            />
            {errors.email && <p className="ct-error">{errors.email.message}</p>}

            <label className="ct-label mt-3" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className={`ct-input ${errors.password ? 'is-invalid' : ''}`}
              placeholder="At least 8 characters"
              {...register('password')}
            />
            {errors.password && <p className="ct-error">{errors.password.message}</p>}

            <button
              type="submit"
              className="btn btn-ct-primary ct-btn w-100 mt-4"
              disabled={isSubmitting}
            >
              <LogIn size={16} aria-hidden="true" />
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-4">
            <p className="ct-help mb-2">Demo accounts (seeded):</p>
            <div className="ct-demo-btns">
              {DEMO_ACCOUNTS.map(a => (
                <button key={a.label} type="button" onClick={() => fillDemo(a)}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <p className="ct-help mt-4 mb-0">
            {/* Plain <a>: the marketing site is static HTML outside the React router. */}
            <a href={import.meta.env.VITE_PUBLIC_SITE_URL || '/site/'}>
              ← Back to the clinic website
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

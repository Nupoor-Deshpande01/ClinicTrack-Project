import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import toast from 'react-hot-toast';
import { UserPlus, Plus } from 'lucide-react';
import { usersApi } from '../api';
import { errorMessage } from '../api/client';
import { userSchema } from '../validation/schemas';
import { EmptyState, ErrorState, LoadingState, PageHeader, Pill } from '../components/ui';

/** Admin-only account management. Passwords are hashed server-side; never returned. */
export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [serverError, setServerError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: yupResolver(userSchema), defaultValues: { role: 'staff' } });

  const load = () => {
    setLoading(true);
    setError('');
    usersApi
      .list()
      .then(setUsers)
      .catch(err => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onSubmit = async values => {
    setServerError('');
    try {
      const res = await usersApi.create(values);
      toast.success(res.message);
      reset({ role: 'staff' });
      setShowForm(false);
      load();
    } catch (err) {
      setServerError(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Doctor, reception and admin accounts."
        actions={
          <button
            type="button"
            className="btn btn-ct-primary ct-btn"
            onClick={() => setShowForm(s => !s)}
          >
            <Plus size={16} aria-hidden="true" /> New account
          </button>
        }
      />

      {showForm && (
        <section className="ct-card ct-card-pad mb-3" style={{ maxWidth: 880 }}>
          <h2 className="ct-card-title mb-3">
            <UserPlus size={16} className="me-1" aria-hidden="true" /> Create account
          </h2>
          {serverError && (
            <div className="ct-alert ct-alert-danger mb-3" role="alert">
              {serverError}
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="ct-form-grid">
              <div>
                <label className="ct-label" htmlFor="u-name">
                  Full name *
                </label>
                <input
                  id="u-name"
                  className={`ct-input ${errors.name ? 'is-invalid' : ''}`}
                  {...register('name')}
                />
                {errors.name && <p className="ct-error">{errors.name.message}</p>}
              </div>
              <div>
                <label className="ct-label" htmlFor="u-email">
                  Email *
                </label>
                <input
                  id="u-email"
                  type="email"
                  className={`ct-input ${errors.email ? 'is-invalid' : ''}`}
                  {...register('email')}
                />
                {errors.email && <p className="ct-error">{errors.email.message}</p>}
              </div>
              <div>
                <label className="ct-label" htmlFor="u-password">
                  Password *
                </label>
                <input
                  id="u-password"
                  type="password"
                  className={`ct-input ${errors.password ? 'is-invalid' : ''}`}
                  {...register('password')}
                />
                {errors.password && <p className="ct-error">{errors.password.message}</p>}
                <p className="ct-help">Minimum 8 characters. Stored hashed with bcrypt.</p>
              </div>
              <div>
                <label className="ct-label" htmlFor="u-role">
                  Role *
                </label>
                <select
                  id="u-role"
                  className={`ct-select ${errors.role ? 'is-invalid' : ''}`}
                  {...register('role')}
                >
                  <option value="staff">Staff (reception)</option>
                  <option value="doctor">Doctor</option>
                  <option value="admin">Admin</option>
                </select>
                {errors.role && <p className="ct-error">{errors.role.message}</p>}
              </div>
              <div>
                <label className="ct-label" htmlFor="u-specialty">
                  Specialty (doctors)
                </label>
                <input
                  id="u-specialty"
                  className="ct-input"
                  placeholder="Cardiology"
                  {...register('specialty')}
                />
                {errors.specialty && <p className="ct-error">{errors.specialty.message}</p>}
              </div>
              <div>
                <label className="ct-label" htmlFor="u-phone">
                  Phone
                </label>
                <input
                  id="u-phone"
                  className={`ct-input ${errors.phone ? 'is-invalid' : ''}`}
                  {...register('phone')}
                />
                {errors.phone && <p className="ct-error">{errors.phone.message}</p>}
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-ct-primary ct-btn mt-3"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating…' : 'Create account'}
            </button>
          </form>
        </section>
      )}

      <section className="ct-card ct-card-pad">
        {loading && <LoadingState label="Loading accounts…" />}
        {error && !loading && <ErrorState message={error} onRetry={load} />}
        {!loading && !error && users.length === 0 && <EmptyState title="No accounts yet" />}
        {!loading && !error && users.length > 0 && (
          <div className="table-responsive">
            <table className="ct-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Specialty</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className="ct-avatar ct-avatar-sm" aria-hidden="true">
                          {u.name.charAt(0)}
                        </span>
                        <span className="fw-semibold">{u.name}</span>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td className="text-capitalize">{u.role}</td>
                    <td>{u.specialty || '—'}</td>
                    <td>
                      <Pill tone={u.isActive ? 'success' : 'danger'}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

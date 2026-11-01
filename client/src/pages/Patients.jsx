import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { patientsApi } from '../api';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { EmptyState, ErrorState, LoadingState, PageHeader, Pill } from '../components/ui';

const PAGE_SIZE = 10;

export default function Patients() {
  const { isClinical } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [gender, setGender] = useState(searchParams.get('gender') || '');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], meta: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Reflect the URL so the top-bar search (which navigates here) works.
    const next = new URLSearchParams();
    if (search) next.set('search', search);
    if (gender) next.set('gender', gender);
    setSearchParams(next, { replace: true });
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, gender]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    patientsApi
      .list({ search, gender, page, limit: PAGE_SIZE })
      .then(res => {
        if (!active) return;
        setResult({ data: res.data, meta: res.meta });
      })
      .catch(err => active && setError(errorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [search, gender, page]);

  const changePage = delta =>
    setPage(p => Math.max(1, Math.min(result.meta?.pages || 1, p + delta)));

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle="Every patient is a versioned record — open one to see its visit history."
        actions={
          <Link to="/patients/new" className="btn btn-ct-primary ct-btn">
            <Plus size={16} aria-hidden="true" /> Register patient
          </Link>
        }
      />

      <section className="ct-card ct-card-pad">
        <div className="ct-toolbar mb-3">
          <div className="ct-search" style={{ maxWidth: 340 }}>
            <Search size={16} aria-hidden="true" />
            <label className="visually-hidden" htmlFor="patient-search">
              Search patients
            </label>
            <input
              id="patient-search"
              className="ct-search-input"
              type="search"
              placeholder="Name, MRN or phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <label className="visually-hidden" htmlFor="gender-filter">
            Filter by gender
          </label>
          <select
            id="gender-filter"
            className="ct-select"
            style={{ width: 'auto' }}
            value={gender}
            onChange={e => setGender(e.target.value)}
          >
            <option value="">All genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          {result.meta && (
            <span className="ct-text-muted small ms-auto">{result.meta.total} patient(s)</span>
          )}
        </div>

        {loading && <LoadingState label="Loading patients…" />}
        {error && !loading && <ErrorState message={error} onRetry={() => setPage(p => p)} />}
        {!loading && !error && result.data.length === 0 && (
          <EmptyState
            title="No patients match this filter"
            hint="Try a different name, phone or gender filter."
          />
        )}

        {!loading && !error && result.data.length > 0 && (
          <>
            <div className="table-responsive">
              <table className="ct-table">
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">MRN</th>
                    <th scope="col">Age / Gender</th>
                    <th scope="col">Phone</th>
                    <th scope="col">Treatment</th>
                    {isClinical && <th scope="col">Allergies</th>}
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map(p => (
                    <tr key={p.id || p._id}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <span className="ct-avatar ct-avatar-sm" aria-hidden="true">
                            {p.fullName.charAt(0)}
                          </span>
                          <span className="fw-semibold">{p.fullName}</span>
                        </div>
                      </td>
                      <td>{p.mrn}</td>
                      <td>
                        {p.age} · <span className="text-capitalize">{p.gender}</span>
                      </td>
                      <td>{p.phone}</td>
                      <td>
                        {p.treatment ? (
                          <Pill tone="info">{p.treatment}</Pill>
                        ) : (
                          <span className="ct-text-muted small">—</span>
                        )}
                      </td>
                      {isClinical && (
                        <td>
                          {(p.allergies || []).length === 0 ? (
                            <span className="ct-text-muted small">None recorded</span>
                          ) : (
                            <div className="d-flex gap-1 flex-wrap">
                              {p.allergies.map(a => (
                                <Pill key={a} tone="danger">
                                  {a}
                                </Pill>
                              ))}
                            </div>
                          )}
                        </td>
                      )}
                      <td className="text-end">
                        <Link
                          to={`/patients/${p.id || p._id}`}
                          className="btn btn-ct-ghost ct-btn btn-sm"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ct-pagination">
              <span className="ct-text-muted small">
                Page {result.meta.page} of {result.meta.pages || 1}
              </span>
              <button
                type="button"
                className="ct-icon-btn"
                onClick={() => changePage(-1)}
                disabled={result.meta.page <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="ct-icon-btn"
                onClick={() => changePage(1)}
                disabled={result.meta.page >= result.meta.pages}
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}

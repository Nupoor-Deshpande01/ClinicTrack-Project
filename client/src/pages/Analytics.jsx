import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, CalendarClock, Repeat, UserPlus, Users2 } from 'lucide-react';
import { analyticsApi } from '../api';
import { errorMessage } from '../api/client';
import { ErrorState, LoadingState, PageHeader } from '../components/ui';

const PIE_COLORS = ['#2563EB', '#16A34A'];

/** Tiny labelled stat used at the top of the analytics screen. */
function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="ct-card ct-stat">
      <span className="ct-stat-label">
        <Icon size={16} aria-hidden="true" /> {label}
      </span>
      <span className="ct-stat-value">{value}</span>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    analyticsApi
      .summary(months)
      .then(res => active && setData(res))
      .catch(err => active && setError(errorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [months, reload]);

  if (loading) return <LoadingState label="Crunching the numbers…" />;
  if (error) return <ErrorState message={error} onRetry={() => setReload(n => n + 1)} />;

  const split = data.newVsReturning;
  const totalSplit = split.reduce((sum, s) => sum + s.value, 0) || 1;

  return (
    <>
      <PageHeader
        title="Analytics and Reports"
        subtitle="Aggregated straight from MongoDB — visits, diagnoses, patient mix and clinic load."
        actions={
          <>
            <label className="visually-hidden" htmlFor="analytics-range">
              Arrival chart range
            </label>
            <select
              id="analytics-range"
              className="ct-select"
              style={{ width: 'auto' }}
              value={months}
              onChange={e => setMonths(Number(e.target.value))}
            >
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </select>
          </>
        }
      />

      <div className="ct-stats">
        <MiniStat icon={Users2} label="Total patients" value={data.stats.totalPatients} />
        <MiniStat icon={CalendarClock} label="Visits today" value={data.stats.visitsToday} />
        <MiniStat icon={UserPlus} label="New patients" value={split[0]?.value ?? 0} />
        <MiniStat icon={Repeat} label="Returning patients" value={split[1]?.value ?? 0} />
      </div>

      <div className="ct-chart-grid">
        <section className="ct-card ct-card-pad">
          <h2 className="ct-card-title">Visits per day</h2>
          <p className="ct-text-muted small">Current visit versions over the last 14 days.</p>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.visitTrend} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ct-border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0' }} />
                <Bar dataKey="count" name="Visits" fill="#2563EB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="ct-card ct-card-pad">
          <h2 className="ct-card-title">Peak hours</h2>
          <p className="ct-text-muted small">When the clinic is busiest (last 14 days).</p>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.peakHours} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ct-border)" />
                <XAxis
                  dataKey="hour"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0' }} />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Visits"
                  stroke="#16A34A"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="ct-card ct-card-pad">
          <h2 className="ct-card-title">Top diagnoses</h2>
          <p className="ct-text-muted small">Most frequent current diagnoses.</p>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.topDiagnoses}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--ct-border)" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                />
                <YAxis
                  type="category"
                  dataKey="diagnosis"
                  width={150}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: '#64748B' }}
                />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0' }} />
                <Bar dataKey="count" name="Visits" fill="#6366F1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="ct-card ct-card-pad">
          <h2 className="ct-card-title">New vs returning</h2>
          <p className="ct-text-muted small">Patients by number of current visits.</p>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={split}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={54}
                  outerRadius={84}
                  paddingAngle={3}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {split.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="ct-text-muted small mb-0">
            <Activity size={13} aria-hidden="true" />{' '}
            {Math.round((split[1].value / totalSplit) * 100)}% of patients came back at least once.
          </p>
        </section>
      </div>
    </>
  );
}

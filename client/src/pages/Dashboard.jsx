import { useEffect, useMemo, useState } from 'react';
import { Download, FileBarChart, Users2, CalendarCheck2, Clock4, ListOrdered } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import toast from 'react-hot-toast';
import { analyticsApi, appointmentsApi } from '../api';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ErrorState, LoadingState, Pill } from '../components/ui';
import AppointmentsPanel from '../components/AppointmentsPanel';

/** Tiny sparkline for a stat card (last N points of one series). */
function Sparkline({ data, dataKey, color = 'var(--ct-primary)' }) {
  return (
    <div className="mt-auto" style={{ height: 44 }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={color}
            fillOpacity={0.12}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, note, data, dataKey, color }) {
  return (
    <div className="ct-card ct-stat">
      <span className="ct-stat-label">
        <Icon size={16} aria-hidden="true" /> {label}
      </span>
      <span className="ct-stat-value">{value}</span>
      <span className="ct-stat-note">{note}</span>
      <Sparkline data={data} dataKey={dataKey} color={color} />
    </div>
  );
}

const iso = d => {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState('6'); // months shown in the arrival chart
  const [reload, setReload] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    analyticsApi
      .summary(Number(range))
      .then(data => active && setSummary(data))
      .catch(err => active && setError(errorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [range, reload]);

  const chartData = useMemo(() => summary?.arrivalSeries ?? [], [summary]);

  /** Export today's appointments as CSV (client-side, from the API data). */
  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await appointmentsApi.listByDate(iso(new Date()));
      const rows = [
        ['Patient', 'MRN', 'Doctor', 'Time', 'Disease', 'Status'],
        ...res.data.map(a => [
          a.patient?.fullName ?? '',
          a.patient?.mrn ?? '',
          a.doctor?.name ?? '',
          a.time,
          a.disease ?? '',
          a.status,
        ]),
      ];
      const csv = rows
        .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      downloadFile(`appointments-${iso(new Date())}.csv`, csv, 'text/csv');
      toast.success('Appointments exported');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  /** "Generate Report": a quick plain-text summary of today for the demo. */
  const generateReport = async () => {
    try {
      const res = await appointmentsApi.listByDate(iso(new Date()));
      const s = summary?.stats ?? {};
      const text = [
        'ClinicTrack daily report',
        `Generated: ${new Date().toLocaleString('en-IN')}`,
        `Clinic: Siddhivinayak Clinic, Pune`,
        '',
        `Total patients: ${s.totalPatients ?? '-'}`,
        `Visits today: ${s.visitsToday ?? '-'}`,
        `Pending follow-ups: ${s.pendingFollowUps ?? '-'}`,
        `Appointments today: ${res.data.length}`,
        '',
        ...res.data.map(
          a => `• ${a.time} — ${a.patient?.fullName} (${a.patient?.mrn}) with ${a.doctor?.name}`
        ),
      ].join('\n');
      downloadFile(`clinictrack-report-${iso(new Date())}.txt`, text, 'text/plain');
      toast.success('Report generated');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (loading) return <LoadingState label="Loading dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={() => setReload(n => n + 1)} />;

  const stats = summary.stats;
  const doctors = summary.doctors;
  const firstName = user.name.split(' ')[0];

  return (
    <>
      <div className="ct-page-head">
        <div>
          <h1 className="ct-page-title">
            Welcome back, {user.role === 'doctor' ? `Dr. ${firstName}` : firstName}!
          </h1>
          <p className="ct-text-muted mb-0">Here is what is happening at Siddhivinayak Clinic.</p>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <button
            type="button"
            className="btn btn-ct-outline ct-btn"
            onClick={exportCsv}
            disabled={exporting}
          >
            <Download size={15} aria-hidden="true" /> {exporting ? 'Exporting…' : 'Export to CSV'}
          </button>
          <button type="button" className="btn btn-ct-outline ct-btn" onClick={generateReport}>
            <FileBarChart size={15} aria-hidden="true" /> Generate Report
          </button>
          <label className="visually-hidden" htmlFor="range">
            Chart range
          </label>
          <select
            id="range"
            className="ct-select"
            style={{ width: 'auto' }}
            value={range}
            onChange={e => setRange(e.target.value)}
          >
            <option value="1">This month</option>
            <option value="3">Last 3 months</option>
            <option value="6">Last 6 months</option>
          </select>
        </div>
      </div>

      <div className="ct-stats">
        <StatCard
          icon={Users2}
          label="Total Patients"
          value={stats.totalPatients}
          note="All registered patients"
          data={chartData}
          dataKey="in"
          color="var(--ct-primary)"
        />
        <StatCard
          icon={CalendarCheck2}
          label="Visits Today"
          value={stats.visitsToday}
          note="Current visit versions recorded today"
          data={chartData}
          dataKey="out"
          color="var(--ct-success, #16a34a)"
        />
        <StatCard
          icon={Clock4}
          label="Pending Follow-ups"
          value={stats.pendingFollowUps}
          note="No visit in the last 21 days"
          data={chartData}
          dataKey="out"
          color="var(--ct-warning, #d97706)"
        />
        <StatCard
          icon={ListOrdered}
          label="Active Queue"
          value={stats.activeQueue}
          note="Waiting + in consultation"
          data={chartData}
          dataKey="in"
          color="var(--ct-primary)"
        />
      </div>

      <div className="ct-dash-grid">
        <div className="ct-dash-col">
          <section className="ct-card ct-card-pad">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h2 className="ct-card-title mb-0">Patient Arrival Statistics</h2>
              <span className="ct-text-muted small">Patients in vs out</span>
            </div>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="inFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="outFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#16A34A" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#16A34A" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: '#64748B' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: '#64748B' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
                    formatter={(value, name) => [
                      value,
                      name === 'in' ? 'Patients in' : 'Patients out',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="in"
                    name="Patients in"
                    stroke="#2563EB"
                    strokeWidth={2}
                    fill="url(#inFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="out"
                    name="Patients out"
                    stroke="#16A34A"
                    strokeWidth={2}
                    fill="url(#outFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <AppointmentsPanel />
        </div>

        <div className="ct-dash-col">
          <section className="ct-card ct-card-pad">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h2 className="ct-card-title mb-0">Our Specialist</h2>
              <span className="ct-text-muted small">{doctors.length} doctors</span>
            </div>
            <div className="ct-specialist">
              {doctors.length > 0 && (
                <div className="ct-specialist-feature">
                  <span className="ct-avatar mb-2" aria-hidden="true">
                    {doctors[0].name.charAt(0)}
                  </span>
                  <strong>{doctors[0].name}</strong>
                  <small className="opacity-75">{doctors[0].specialty}</small>
                  <span
                    className="ct-pill ct-pill-success mt-2"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Available
                  </span>
                </div>
              )}
              {doctors.slice(1).map((d, i) => (
                <div className="ct-doctor-row" key={d.id}>
                  <span className="ct-avatar ct-avatar-sm" aria-hidden="true">
                    {d.name.charAt(0)}
                  </span>
                  <div className="flex-grow-1">
                    <div className="fw-semibold small">{d.name}</div>
                    <small className="ct-text-muted">{d.specialty}</small>
                  </div>
                  <Pill tone={i % 2 === 0 ? 'success' : 'info'}>
                    {i % 2 === 0 ? 'Available' : 'On duty'}
                  </Pill>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

/** Client-side file download helper (CSV/TXT). */
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

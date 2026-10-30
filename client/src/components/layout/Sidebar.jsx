import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users2,
  Stethoscope,
  CalendarDays,
  Pill,
  MonitorPlay,
  BarChart3,
  ScrollText,
  UserCog,
  Settings,
  LogOut,
  HeartPulse,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * Primary navigation. `clinical: true` items are hidden from reception, which
 * mirrors the server's role guard (it refuses clinical reads with 403).
 */
const MAIN_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/patients', label: 'Patients', icon: Users2 },
  { to: '/patients', label: 'Visits and Timeline', icon: Stethoscope, end: true },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays },
  { to: '/prescriptions', label: 'Prescriptions', icon: Pill, clinical: true },
  { to: '/queue', label: 'Live Queue', icon: MonitorPlay },
  { to: '/analytics', label: 'Analytics and Reports', icon: BarChart3, clinical: true },
  { to: '/audit', label: 'Audit Log', icon: ScrollText, clinical: true },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout, isAdmin, isClinical } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      {open && (
        <button
          type="button"
          className="ct-sidebar-backdrop"
          aria-label="Close menu"
          onClick={onClose}
        />
      )}
      <aside className={`ct-sidebar ${open ? 'is-open' : ''}`} aria-label="Main navigation">
        <div className="ct-sidebar-head">
          <span className="ct-logo" aria-hidden="true">
            <HeartPulse size={20} />
          </span>
          <div>
            <div className="ct-brand">ClinicTrack</div>
            <small className="ct-text-muted">Siddhivinayak Clinic</small>
          </div>
          <button
            type="button"
            className="ct-icon-btn ms-auto d-lg-none"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <p className="ct-nav-heading">Menu</p>
        <nav className="ct-nav">
          {MAIN_ITEMS.filter(item => !item.clinical || isClinical).map(
            ({ to, label, icon: Icon }) => (
              <NavLink
                key={label}
                to={to}
                end={label === 'Dashboard' || label === 'Visits and Timeline'}
                className={({ isActive }) => `ct-nav-item ${isActive ? 'is-active' : ''}`}
                onClick={onClose}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            )
          )}
        </nav>

        <p className="ct-nav-heading mt-3">Other Menu</p>
        <nav className="ct-nav">
          {isAdmin && (
            <NavLink
              to="/users"
              className={({ isActive }) => `ct-nav-item ${isActive ? 'is-active' : ''}`}
              onClick={onClose}
            >
              <UserCog size={18} aria-hidden="true" />
              <span>Users</span>
            </NavLink>
          )}
          <span className="ct-nav-item is-disabled" aria-disabled="true" title="Arrives in Phase 5">
            <Settings size={18} aria-hidden="true" />
            <span>Settings</span>
            <em className="ct-soon">Soon</em>
          </span>
        </nav>

        <div className="ct-sidebar-foot">
          <button type="button" className="ct-nav-item" onClick={handleLogout}>
            <LogOut size={18} aria-hidden="true" />
            <span>Log out</span>
          </button>
          <div className="ct-sidebar-user">
            <span className="ct-avatar" aria-hidden="true">
              {user?.name?.charAt(0) || 'C'}
            </span>
            <div className="text-truncate">
              <div className="fw-semibold small text-truncate">{user?.name}</div>
              <small className="ct-text-muted text-capitalize">{user?.role}</small>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

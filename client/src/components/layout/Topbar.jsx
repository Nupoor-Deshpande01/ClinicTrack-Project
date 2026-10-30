import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Menu, Moon, Search, Sun } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../hooks/useTheme';

export default function Topbar({ onMenuClick }) {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const searchRef = useRef(null);

  // Ctrl+K focuses the global search, like the design hint promises.
  useEffect(() => {
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submitSearch = e => {
    e.preventDefault();
    const q = searchRef.current.value.trim();
    navigate(q ? `/patients?search=${encodeURIComponent(q)}` : '/patients');
  };

  return (
    <header className="ct-topbar">
      <button
        type="button"
        className="ct-icon-btn d-lg-none"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <form className="ct-search" role="search" onSubmit={submitSearch}>
        <Search size={18} aria-hidden="true" />
        <label className="visually-hidden" htmlFor="global-search">
          Search patients
        </label>
        <input
          id="global-search"
          ref={searchRef}
          type="search"
          placeholder="Search patients by name, MRN or phone…"
          className="ct-search-input"
        />
        <kbd className="ct-kbd">Ctrl K</kbd>
      </form>

      <div className="d-flex align-items-center gap-2 ms-auto">
        <button
          type="button"
          className="ct-icon-btn"
          onClick={toggle}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          type="button"
          className="ct-icon-btn"
          aria-label="Notifications"
          title="Notifications (demo)"
        >
          <Bell size={18} />
          <span className="ct-dot" aria-hidden="true" />
        </button>
        <div className="ct-user-chip">
          <div className="text-end d-none d-sm-block">
            <div className="fw-semibold small">{user?.name}</div>
            <small className="ct-text-muted text-capitalize">{user?.role}</small>
          </div>
          <span className="ct-avatar" aria-hidden="true">
            {user?.name?.charAt(0) || 'C'}
          </span>
        </div>
      </div>
    </header>
  );
}

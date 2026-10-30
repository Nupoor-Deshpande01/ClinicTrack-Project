import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export default function Forbidden() {
  return (
    <div className="ct-state ct-state-error" style={{ marginTop: '2rem' }}>
      <div className="d-flex gap-2">
        <ShieldAlert size={20} aria-hidden="true" />
        <div>
          <strong>Access restricted</strong>
          <div className="small mt-1">
            Your role cannot open this screen. Clinical notes, prescriptions and account management
            are role-protected.
          </div>
        </div>
      </div>
      <Link to="/dashboard" className="btn btn-ct-outline ct-btn btn-sm">
        Dashboard
      </Link>
    </div>
  );
}

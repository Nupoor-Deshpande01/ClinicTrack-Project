import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="ct-state ct-state-empty" style={{ marginTop: '2rem' }}>
      <div>
        <strong>Page not found</strong>
        <div className="small ct-text-muted mt-1">
          The page you requested does not exist in ClinicTrack.
        </div>
      </div>
      <Link to="/dashboard" className="btn btn-ct-primary ct-btn">
        Back to dashboard
      </Link>
    </div>
  );
}

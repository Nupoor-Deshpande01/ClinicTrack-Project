import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientRegister from './pages/PatientRegister';
import PatientProfile from './pages/PatientProfile';
import VisitForm from './pages/VisitForm';
import VisitTimeline from './pages/VisitTimeline';
import DiffViewer from './pages/DiffViewer';
import PrescriptionBuilder from './pages/PrescriptionBuilder';
import Appointments from './pages/Appointments';
import Users from './pages/Users';
import NotFound from './pages/NotFound';
import Forbidden from './pages/Forbidden';

export default function App() {
  const { initialising } = useAuth();

  if (initialising) {
    return (
      <div className="ct-boot">
        <div className="ct-spinner" aria-label="Loading session" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Everything below needs a session; AppLayout draws sidebar + top bar. */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/new" element={<PatientRegister />} />
          <Route path="/patients/:id" element={<PatientProfile />} />
          <Route path="/appointments" element={<Appointments />} />

          {/* Clinical screens — doctor/admin only */}
          <Route element={<ProtectedRoute roles={['doctor', 'admin']} />}>
            <Route path="/patients/:id/visits/new" element={<VisitForm />} />
            <Route path="/visits/:id/timeline" element={<VisitTimeline />} />
            <Route path="/visits/:a/diff/:b" element={<DiffViewer />} />
            <Route path="/visits/:id/prescription" element={<PrescriptionBuilder />} />
          </Route>

          <Route path="/forbidden" element={<Forbidden />} />
          <Route
            path="/users"
            element={
              <ProtectedRoute roles={['admin']}>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}

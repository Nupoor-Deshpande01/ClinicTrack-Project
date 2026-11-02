# React.js Implementation in ClinicTrack

## 1. Executive Overview

In **ClinicTrack**, React.js powers the internal clinical Single Page Application (SPA) located in the `client/` workspace. It provides an intuitive, high-performance, and responsive user interface for **Doctors**, **Reception Staff**, and **Administrators** of CityCare Clinic.

### Why React.js was chosen:
- **Component-Based Architecture:** Encapsulates clinical workflows (e.g., patient vital cards, versioned consultation timelines, diff viewers) into modular, reusable UI components.
- **Virtual DOM Reconciliation:** Provides instant UI updates without whole-page refreshes when switching between patient records or viewing real-time queue tokens.
- **Uncontrolled Form Performance:** Leverages `react-hook-form` with `@hookform/resolvers/yup` to eliminate keystroke re-rendering bottlenecks in large medical history forms.
- **Declarative Client-Side Routing:** Uses `react-router-dom` (v6) with nested layouts and role-based `<ProtectedRoute>` wrappers.

---

## 2. Directory Structure & File Map

```
client/
├── index.html                    # HTML5 shell with root div and metadata
├── package.json                  # Vite 5, React 18, React Router 6, Yup, Recharts
├── vite.config.js                # Vite build config & dev proxy (/api -> :5000, /socket.io)
└── src/
    ├── main.jsx                  # React DOM root render, BrowserRouter wrapper
    ├── App.jsx                   # Declarative route catalog & ProtectedRoute guards
    ├── index.css                 # Global CSS variables, layout resets, utility classes
    ├── context/
    │   └── AuthContext.jsx       # Global authentication state, JWT storage, role access
    ├── services/
    │   ├── api.js                # Axios client with JWT interceptor & 401 redirect
    │   └── socket.js             # Socket.IO client instance configured for real-time
    ├── validation/
    │   └── schemas.js            # Declarative Yup schemas for all form validations
    ├── components/
    │   ├── Layout.jsx            # Sidebar, Topbar, Dark-mode toggle, User menu shell
    │   ├── ProtectedRoute.jsx    # Role-based authorization & login redirection guard
    │   ├── StatCard.jsx          # Metric cards with trend indicators
    │   ├── AppointmentsPanel.jsx # Appointment list with status badges
    │   └── QueueNowServing.jsx   # Live TV display widget
    └── pages/
        ├── Login.jsx             # Credentials login with email/password validation
        ├── Dashboard.jsx         # Clinical analytics, quick actions, schedule
        ├── Patients.jsx          # Paginated patient list with search & filter
        ├── PatientRegister.jsx   # Patient demographic registration form
        ├── PatientProfile.jsx    # Medical profile, visit history, allergy banners
        ├── VisitForm.jsx         # Clinical consultation editor (creates new versions)
        ├── VisitTimeline.jsx     # Git-style consultation commit history tree
        ├── DiffViewer.jsx        # Side-by-side color-coded version comparison
        ├── Queue.jsx             # Operational waiting queue console (call/done/skip)
        ├── QueueBoard.jsx        # Full-screen "Now Serving" TV waiting-room board
        ├── PrescriptionBuilder.jsx # Medicine form with allergy checks
        ├── Prescriptions.jsx     # Prescription history & PDF download triggers
        ├── VerifyPrescription.jsx # Public QR verification landing page
        ├── AuditLog.jsx          # Cryptographic SHA-256 chain + live browser verification
        ├── Analytics.jsx         # Recharts SVG graphs (14-day trend, peak hours)
        ├── Users.jsx             # Staff user administration
        └── Forbidden.jsx         # HTTP 403 access denied fallback screen
```

---

## 3. Deep-Dive Implementation Details

### A. Routing & Role-Guarded Access (`App.jsx` & `ProtectedRoute.jsx`)
Routes are organized in `client/src/App.jsx` using React Router v6. Private clinical routes are wrapped in `<ProtectedRoute>`:

```jsx
// client/src/App.jsx
<Route
  path="/patients/:id/visits/new"
  element={
    <ProtectedRoute allowedRoles={['doctor', 'admin']}>
      <VisitForm />
    </ProtectedRoute>
  }
/>
```

The guard checks `AuthContext`:
1. If loading: Renders a loading spinner.
2. If unauthenticated (`!user`): Redirects to `/login` preserving the attempted path.
3. If user lacks required role: Redirects to `/forbidden`.

### B. Global Authentication State (`AuthContext.jsx`)
`AuthContext` provides global state via React Context API:
- Persists user object and JWT in browser `localStorage`.
- Automatically populates `axios` default authorization header: `Authorization: Bearer <token>`.
- Provides `login(email, password)` and `logout()` helper functions accessible by any component through the custom hook `useAuth()`.

### C. Client-Side Validation (`validation/schemas.js`)
Form validation uses **Yup** with `@hookform/resolvers/yup`. Validation occurs in real-time as users fill inputs:

```javascript
// client/src/validation/schemas.js
export const patientSchema = yup.object({
  fullName: yup.string().trim()
    .required('Full name is required')
    .matches(/^[A-Za-z][A-Za-z .-]{1,58}$/, 'Letters, spaces, dots and hyphens only'),
  phone: yup.string().trim()
    .required('Mobile number is required')
    .matches(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number starting with 6-9'),
  dob: yup.string()
    .required('Date of birth is required')
    .test('not-future', 'Date of birth cannot be in the future', v => !v || v <= todayISO()),
  gender: yup.string().oneOf(['male', 'female', 'other']).required('Select a gender'),
});
```

In `PatientRegister.jsx`, React Hook Form connects the schema:
```jsx
const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
  resolver: yupResolver(patientSchema),
});
```
When validation fails, input borders turn red and `<span className="ct-error">` renders below the field without issuing an HTTP request.

### D. Git-Style Version Diff Viewer (`pages/DiffViewer.jsx`)
When a physician inspects two versions of a medical consultation ($v_1$ vs $v_2$), `DiffViewer.jsx` renders a side-by-side comparison:
- **Left Panel:** Displays the older version (highlighting removed or replaced fields with red strike-through styling).
- **Right Panel:** Displays the newer version (highlighting added or modified fields with green pill badges).
- **Rollback Action:** If an amendment was made in error, clicking the "Rollback" button triggers a `POST /api/patients/:id/visits/:visitId/rollback`, which writes a new forward version restoring historical data.

### E. Real-Time WebSocket Telemetry (`pages/Queue.jsx` & `pages/QueueBoard.jsx`)
In `Queue.jsx` and `QueueBoard.jsx`, React registers Socket.IO listeners inside `useEffect`:

```jsx
// client/src/pages/QueueBoard.jsx
useEffect(() => {
  const handleUpdate = (snapshot) => {
    setQueueData(snapshot.data);
    setStats(snapshot.stats);
  };

  socket.on('queue:updated', handleUpdate);
  return () => {
    socket.off('queue:updated', handleUpdate);
  };
}, []);
```
When reception issues a token or a doctor calls a patient, the TV board updates in `<15ms` without page reloading.

### F. Interactive Clinical Analytics (`pages/Analytics.jsx`)
Uses **Recharts** to render interactive SVG charts:
- `<AreaChart>`: 14-day consultation arrival trends.
- `<BarChart>`: Top 5 medical diagnoses.
- `<ResponsiveContainer>`: Ensures graphs resize cleanly across desktop, tablet, and mobile displays.

---

## 4. Examiner Viva & Defense Guide

### Q1: What is the Virtual DOM and how does React Reconciliation work?
**Answer:** The Virtual DOM is a lightweight JavaScript object tree mirroring the actual browser DOM. When component state changes, React creates a new Virtual DOM tree, executes its diffing algorithm comparing it against the previous snapshot, computes the minimal batch of changes, and updates the real DOM efficiently to prevent costly layout reflows.

### Q2: Why use React Hook Form over traditional `useState` for forms?
**Answer:** In controlled components using `useState` and `onChange`, every single keystroke triggers a re-render of the entire component. In forms with dozens of medical fields, this degrades input responsiveness. `react-hook-form` uses uncontrolled inputs via native DOM `ref` pointers, isolating re-renders strictly to validation state changes.

### Q3: How do you handle Route Protection in React Router v6?
**Answer:** Point to `client/src/components/ProtectedRoute.jsx`. Explain how the component checks `user` and `user.role` from `AuthContext`. If unauthenticated, it returns `<Navigate to="/login" replace />`. If unauthorized, it redirects to `/forbidden`.

### Q4: How is client-side validation prevented from being bypassed?
**Answer:** Client-side validation only optimizes User Experience. The backend independently executes `express-validator` middleware on every single route before data reaches the database, ensuring curl or Postman requests cannot corrupt data.

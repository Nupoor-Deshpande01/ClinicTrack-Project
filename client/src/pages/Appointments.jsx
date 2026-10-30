import { PageHeader } from '../components/ui';
import AppointmentsPanel from '../components/AppointmentsPanel';

export default function Appointments() {
  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="Day-by-day bookings across Siddhivinayak Clinic. Booked by reception, assigned to a doctor."
      />
      <AppointmentsPanel />
    </>
  );
}

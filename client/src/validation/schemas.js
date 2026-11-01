import * as yup from 'yup';

/**
 * Client-side validation (React Hook Form + Yup). These messages appear live
 * under each field. The server re-validates everything independently — see
 * server/routes/*.js — which is the point of "validate on both sides".
 */
const todayISO = () => {
  const t = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
};

const nameRule = yup
  .string()
  .trim()
  .required('Full name is required')
  .matches(/^[A-Za-z][A-Za-z .-]{1,58}$/, 'Letters, spaces, dots and hyphens only');

const phoneRule = yup
  .string()
  .trim()
  .required('Mobile number is required')
  .matches(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number starting with 6-9');

export const loginSchema = yup.object({
  email: yup.string().trim().required('Email is required').email('Enter a valid email address'),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters'),
});

export const patientSchema = yup.object({
  fullName: nameRule,
  phone: phoneRule,
  dob: yup
    .string()
    .required('Date of birth is required')
    .test('not-future', 'Date of birth cannot be in the future', v => !v || v <= todayISO()),
  gender: yup.string().oneOf(['male', 'female', 'other']).required('Select a gender'),
  bloodGroup: yup.string().optional(),
  treatment: yup.string().max(300, 'Keep treatment details under 300 characters').optional(),
  primaryDoctorId: yup.string().optional(),
  addToSchedule: yup.boolean().optional(),
  address: yup.string().max(200, 'Address is too long'),
  allergies: yup.string().max(200, 'Keep allergies under 200 characters'),
});

export const visitSchema = yup.object({
  visitDate: yup
    .string()
    .required('Visit date is required')
    .test('not-future', 'Visit date cannot be in the future', v => !v || v <= todayISO()),
  diagnosis: yup
    .string()
    .trim()
    .required('Diagnosis is required')
    .min(2, 'At least 2 characters')
    .max(200, 'Keep it under 200 characters'),
  symptoms: yup.string().max(300, 'Too many symptoms'),
  notes: yup.string().max(4000, 'Notes are too long'),
  temperatureC: yup
    .number()
    .typeError('Enter a number')
    .min(30, '30–45 °C')
    .max(45, '30–45 °C')
    .nullable(),
  bloodPressure: yup.string().matches(/^$|^\d{2,3}\/\d{2,3}$/, 'Use the format 120/80'),
  heartRate: yup
    .number()
    .typeError('Enter a number')
    .min(25, '25–250 bpm')
    .max(250, '25–250 bpm')
    .nullable(),
});

/** At least one medicine, dosage like "500 mg". */
export const prescriptionSchema = yup.object({
  medicines: yup
    .array()
    .of(
      yup.object({
        name: yup
          .string()
          .trim()
          .required('Medicine name is required')
          .min(2, 'At least 2 characters'),
        dosage: yup
          .string()
          .required('Dosage is required')
          .matches(/^\d+(\.\d+)?\s?(mg|ml|g|mcg|IU)$/i, 'Use a dosage like "500 mg"'),
        frequency: yup.string().trim().required('Frequency is required'),
        durationDays: yup
          .number()
          .typeError('Enter days')
          .required('Duration is required')
          .min(1, 'At least 1 day')
          .max(180, 'At most 180 days'),
      })
    )
    .min(1, 'Add at least one medicine'),
  advice: yup.string().max(500, 'Advice is too long'),
});

export const userSchema = yup.object({
  name: nameRule,
  email: yup.string().trim().required('Email is required').email('Enter a valid email'),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters'),
  role: yup.string().oneOf(['doctor', 'staff', 'admin']).required('Select a role'),
  specialty: yup.string().max(60, 'Too long'),
  phone: phoneRule,
});

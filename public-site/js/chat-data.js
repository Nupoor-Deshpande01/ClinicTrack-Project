/* exported CHAT_INTENTS */
/**
 * chat-data.js — the chatbot's "knowledge" as a JSON object of intents.
 * Kept in a .js file (not .json) so the site also works when opened directly
 * from the file system / Tomcat without a fetch request.
 */
const CHAT_INTENTS = {
  greeting: {
    keywords: ['hi', 'hello', 'hey', 'namaste', 'good morning', 'good evening'],
    reply:
      'Namaste! Welcome to CityCare Clinic. Ask me about timings, services, doctors or booking an appointment.',
  },
  timings: {
    keywords: ['timing', 'timings', 'hours', 'open', 'close', 'closed', 'sunday', 'weekend'],
    reply:
      'We are open:\n• Mon–Sat: 9:00 AM – 1:00 PM and 5:00 PM – 9:00 PM\n• Sunday: 9:00 AM – 1:00 PM (emergency only).',
  },
  services: {
    keywords: ['service', 'services', 'treatment', 'treat', 'offer', 'speciali'],
    reply:
      'Our main services:\n• Primary Care\n• Specialized Medical Services\n• Diagnostic Imaging\n• Rehabilitation Services',
  },
  booking: {
    keywords: ['book', 'appointment', 'slot', 'schedule', 'visit'],
    reply:
      'To book: use the "Make Appointment" form on this page (navbar or the Contact section). You will pick a service and date, and our staff will confirm by phone.',
  },
  doctors: {
    keywords: ['doctor', 'doctors', 'specialist', 'who works'],
    reply:
      'Meet our team: Dr. Anjali Deshmukh (Cardiologist), Dr. Rohan Jadhav (Paediatrics), Dr. Meera Kulkarni (Dermatologist) and Dr. Vikram Patil (Orthopaedics). All MBBS, MD qualified.',
  },
  location: {
    keywords: ['where', 'location', 'address', 'reach', 'directions', 'contact'],
    reply:
      'We are at Shivaji Chowk, Pimpri-Chinchwad, Pune, Maharashtra 411018. Parking is available in the basement.',
  },
  emergency: {
    keywords: ['emergency', 'urgent', 'accident', 'ambulance'],
    reply:
      'For emergencies call our 24x7 helpline: +91 98765 43210. For a life-threatening situation call 108 immediately.',
  },
  fees: {
    keywords: ['fee', 'fees', 'price', 'cost', 'charge'],
    reply:
      'Consultation starts at ₹300. First visit includes a ₹100 registration charge. Investigations are billed separately.',
  },
  tools: {
    keywords: ['tool', 'tools', 'bmi', 'calculator', 'dose'],
    reply:
      'Yes! Open our Tools page for a BMI calculator, paediatric dose calculator and appointment slot finder (link in the footer or the "Learn More" buttons).',
  },
  thanks: {
    keywords: ['thank', 'thanks', 'great', 'ok'],
    reply: 'Welcome! Get well soon. Type "timings" or "book" any time.',
  },
  fallback: {
    keywords: [],
    reply:
      "I'm a simple demo assistant and didn't quite get that. Try: timings, services, doctors, fees, location, book or emergency.",
  },
};

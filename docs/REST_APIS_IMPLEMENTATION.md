# RESTful APIs Implementation in ClinicTrack

## 1. Executive Overview

In **ClinicTrack**, the backend exposes a complete, production-grade **RESTful API** adhering strictly to Representational State Transfer (REST) architectural principles. The API serves the React frontend, external diagnostic tools, and public QR verification scanners.

### Key REST Design Principles Applied:
- **Statelessness:** No client session state is retained on the server. Every authenticated request transmits credentials via the `Authorization: Bearer <JWT>` header.
- **Resource-Oriented URIs:** Nouns represent resources (`/api/patients`, `/api/visits`, `/api/prescriptions`), while HTTP verbs define operations.
- **Uniform Envelopes:** All endpoints return predictable JSON shapes distinguishing successful operations from field-level validation errors.
- **Standard HTTP Status Codes:** Conveys semantic outcomes (200, 201, 400, 401, 403, 404, 409, 422, 429, 500).

---

## 2. Standardized Response Formats

### A. Success Response Envelope
```json
{
  "success": true,
  "message": "Patient registered successfully.",
  "data": {
    "id": "6724a1b2c3d4e5f6a7b8c9d0",
    "mrn": "MC-00018",
    "fullName": "Aarav Sharma",
    "phone": "9876543210"
  },
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 54,
    "pages": 6
  }
}
```

### B. Error Response Envelope (HTTP 422 Unprocessable Entity)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "phone",
      "message": "Indian mobile: 10 digits starting with 6-9"
    },
    {
      "field": "dob",
      "message": "DOB cannot be in the future"
    }
  ]
}
```

---

## 3. Comprehensive REST API Endpoint Catalog

### A. Authentication Resource (`/api/auth`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public (Rate-limited: 20/15m) | Verifies credentials, returns signed JWT token |
| `GET` | `/api/auth/me` | Authenticated (All) | Returns profile of the token owner |

### B. Patient Management Resource (`/api/patients`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/patients?page=1&limit=10&search=Aarav` | Doctor, Staff, Admin | Paginated list with regex search |
| `POST` | `/api/patients` | Doctor, Staff, Admin | Registers new patient; assigns auto-MRN |
| `GET` | `/api/patients/:id` | Doctor, Staff, Admin | Retrieves demographic details |
| `PUT` | `/api/patients/:id` | Doctor, Admin | Updates demographic information |

### C. Versioned Consultations Resource (`/api/visits` & `/api/patients/:id/visits`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/patients/:id/visits` | Doctor, Admin | Creates initial visit ($v_1$) for patient |
| `GET` | `/api/patients/:id/visits` | Doctor, Admin | Lists current visits with version counts |
| `PUT` | `/api/visits/:id` | Doctor, Admin | **Appends new version** ($v_{n+1}$); does not overwrite |
| `GET` | `/api/visits/:id/history` | Doctor, Admin | Retrieves complete revision tree |
| `POST` | `/api/visits/:id/rollback` | Doctor, Admin | Restores a selected historical version |

### D. Digital Prescriptions Resource (`/api/prescriptions`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/visits/:id/prescriptions` | Doctor, Admin | Issues medicine prescription for a visit |
| `GET` | `/api/prescriptions/:id/pdf` | Doctor, Admin | Streams binary printable PDF with QR code |
| `GET` | `/api/prescriptions/verify/:qrToken` | **Public** (No Auth) | Public verification portal for pharmacies |

### E. Live Waiting Queue Resource (`/api/queue`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/queue` | Doctor, Staff, Admin | Retrieves today's queue tokens and summary counts |
| `POST` | `/api/queue` | Doctor, Staff, Admin | Issues next sequential daily token |
| `PATCH` | `/api/queue/:id/status` | Doctor, Staff, Admin | Transitions state (`waiting` $\rightarrow$ `serving` $\rightarrow$ `done`) |

### F. Audit Trail & Clinical Analytics
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/audit` | Doctor, Admin | Returns SHA-256 chained audit entries |
| `GET` | `/api/analytics/summary` | Doctor, Admin | MongoDB aggregation metrics for dashboard |
| `GET` | `/api/health` | Public | Real-time memory, uptime, and database health |

---

## 4. Automated Postman Testing Collection

ClinicTrack includes an importable Postman test suite located at:
`docs/clinictrack.postman_collection.json`

### Key Postman Features Configured:
1. **Environment Variables:** `{{baseUrl}}` (defaults to `http://localhost:5000/api`) and `{{token}}`.
2. **Automated Token Capture:** In the `POST /api/auth/login` request, a **Post-response script** automatically extracts and stores the JWT:
   ```javascript
   const res = pm.response.json();
   if (res.success && res.data && res.data.token) {
     pm.environment.set("token", res.data.token);
   }
   ```
3. **Inherited Bearer Authentication:** All 30 requests in the collection automatically inherit `Authorization: Bearer {{token}}`.
4. **Assertion Tests:** Checks HTTP status codes (`pm.response.to.have.status(200)`), response time (`pm.expect(pm.response.responseTime).to.be.below(300)`), and JSON schema integrity.

---

## 5. Examiner Viva & Defense Guide

### Q1: What makes an API "RESTful"? State the 6 Architectural Constraints.
**Answer:** REST is an architectural style defined by 6 constraints:
1. **Client-Server Architecture:** Decouples user interface concerns from data storage concerns.
2. **Statelessness:** Every request must contain all context needed to process it; the server never stores client session state.
3. **Cacheability:** Responses must explicitly declare whether they can be cached.
4. **Uniform Interface:** Identification of resources (URIs), manipulation through representations (JSON), self-descriptive messages, and HATEOAS.
5. **Layered System:** Clients cannot determine whether they connect directly to an end server or an intermediate proxy/gateway.
6. **Code on Demand (Optional):** Servers can temporarily extend client functionality with scripts.

### Q2: Explain HTTP Method Idempotency.
**Answer:** An HTTP method is **idempotent** if making multiple identical requests leaves the server in the exact same state as making a single request:
- `GET`: Safe & Idempotent (only reads state).
- `PUT`: Idempotent (replaces a resource completely; repeating 5 times produces the exact same final state).
- `DELETE`: Idempotent (deleting once or 5 times leaves the resource absent).
- `POST`: **Non-idempotent** (sending 5 times creates 5 new distinct resources).
- `PATCH`: Generally non-idempotent depending on operation (e.g., append actions).

### Q3: Why does `PUT /api/visits/:id` in ClinicTrack append a new document instead of mutating the existing one?
**Answer:** In medical and clinical records, destructive in-place overwriting is unethical and illegal. While `PUT` semantically replaces the *current consultation representation*, our controller implements this by writing a new document with an incremented version number ($v_{n+1}$) and pointing to the parent version ID, preserving an immutable audit trail.

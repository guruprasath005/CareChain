# CareChain Backend API

A Node.js + Express + PostgreSQL backend for the CareChain healthcare job-matching platform.

## macOS: do not use port 5000 locally

If `curl` to `http://…:5000` returns **`403`** with **`Server: AirTunes`** and an **empty body**, that is **Apple AirPlay Receiver**, not this API. **Use `PORT=5001`** in `.env` (default in this repo) or turn off *AirPlay Receiver* in **System Settings → General → AirDrop & Handoff**.

## 📁 Project Structure

```
care-chain-backend/
├── src/
│   ├── config/                 # Configuration files
│   │   ├── index.ts           # Central config loader
│   │   ├── database.ts        # PostgreSQL connection
│   │   └── redis.ts           # Redis connection
│   │
│   ├── controllers/           # Route handlers (stubs)
│   │   ├── auth.controller.ts
│   │   ├── doctor.controller.ts
│   │   ├── hospital.controller.ts
│   │   ├── job.controller.ts
│   │   ├── attendance.controller.ts
│   │   ├── leave.controller.ts
│   │   ├── search.controller.ts
│   │   └── health.controller.ts
│   │
│   ├── middleware/            # Express middleware
│   │   ├── index.ts           # Central export
│   │   ├── authenticate.ts    # JWT authentication
│   │   ├── authorize.ts       # Role-based access control
│   │   ├── validate.ts        # Request validation (Zod)
│   │   ├── errorHandler.ts    # Global error handling
│   │   └── rateLimit.ts       # Rate limiting
│   │
│   ├── routes/                # Route definitions
│   │   ├── index.ts           # Route aggregator
│   │   ├── auth.routes.ts
│   │   ├── doctor.routes.ts
│   │   ├── hospital.routes.ts
│   │   ├── job.routes.ts
│   │   ├── attendance.routes.ts
│   │   ├── leave.routes.ts
│   │   ├── search.routes.ts
│   │   └── health.routes.ts
│   │
│   ├── validators/            # Zod validation schemas
│   │   └── auth.validator.ts
│   │
│   ├── types/                 # TypeScript type definitions
│   │   └── index.ts
│   │
│   ├── utils/                 # Utility functions
│   │   ├── logger.ts          # Winston logger
│   │   └── response.ts        # API response helpers
│   │
│   ├── services/              # Business logic (to be implemented)
│   ├── repositories/          # Database queries (to be implemented)
│   ├── models/                # Database models (to be implemented)
│   │
│   ├── app.ts                 # Express app setup
│   └── server.ts              # Server entry point
│
├── .env.example               # Environment variables template
├── package.json
├── tsconfig.json
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL 14+
- Redis 7+

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# - Database credentials
# - Redis credentials
# - JWT secrets
# - SMTP settings

# Start development server
npm run dev
```

### Scripts

```bash
npm run dev       # Start development server with hot reload
npm run build     # Compile TypeScript to JavaScript
npm run start     # Start production server
npm run lint      # Run ESLint
npm run test      # Run tests
```

## 🔐 Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    REGISTRATION FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. POST /auth/signup                                           │
│     └── { fullName, email, password }                           │
│     └── Creates user (email_verified=false, role='pending')     │
│     └── Generates OTP, stores in Redis, sends via email         │
│                                                                  │
│  2. POST /auth/verify-email                                     │
│     └── { email, otp }                                          │
│     └── Validates OTP from Redis                                │
│     └── Sets email_verified=true                                │
│                                                                  │
│  3. POST /auth/select-role                                      │
│     └── { email, role: 'doctor' | 'hospital' }                  │
│     └── Updates user role                                       │
│     └── Creates empty profile (doctor/hospital)                 │
│     └── Returns { user, accessToken, refreshToken }             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      LOGIN FLOW                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  POST /auth/login                                               │
│  └── { email, password }                                        │
│                                                                  │
│  Possible responses:                                             │
│  ├── { requiresVerification: true } - Email not verified        │
│  ├── { requiresRoleSelection: true } - Role not selected        │
│  └── { user, accessToken, refreshToken } - Success              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   TOKEN MANAGEMENT                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Access Token:                                                   │
│  ├── Short-lived (15 minutes)                                   │
│  ├── Used for API authentication                                │
│  └── Sent in Authorization header: Bearer <token>               │
│                                                                  │
│  Refresh Token:                                                  │
│  ├── Long-lived (7 days)                                        │
│  ├── Stored in Redis (allows invalidation)                      │
│  └── Used to get new access token                               │
│                                                                  │
│  POST /auth/refresh-token                                       │
│  └── { refreshToken } → { accessToken, refreshToken }           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🛡️ Middleware Stack

### 1. Authentication (`authenticate.ts`)

Verifies JWT access token from Authorization header.

```typescript
// Usage
router.get('/protected', authenticate, controller.method);

// Attaches to request:
// req.user = { id, email, fullName, role, isEmailVerified, isProfileComplete }
// req.tokenId = unique token identifier
```

### 2. Authorization (`authorize.ts`)

Role-based access control.

```typescript
// Single role
router.get('/doctor/profile', authenticate, authorize('doctor'), controller);

// Multiple roles
router.get('/shared', authenticate, authorize('doctor', 'hospital'), controller);

// Convenience helpers
router.get('/doctor-only', authenticate, doctorOnly, controller);
router.get('/hospital-only', authenticate, hospitalOnly, controller);
```

### 3. Validation (`validate.ts`)

Request validation using Zod schemas.

```typescript
import { z } from 'zod';
import { validate } from './middleware';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

router.post('/login', validate(schema), controller.login);
```

### 4. Rate Limiting (`rateLimit.ts`)

Prevents abuse and brute force attacks.

```typescript
// Available limiters:
generalLimiter    // 100 req/15min - All routes
authLimiter       // 10 req/15min - Auth endpoints
otpLimiter        // 3 req/1min - OTP requests
passwordResetLimiter // 5 req/1hr - Password reset
uploadLimiter     // 50 req/1hr - File uploads
```

## 📋 API Routes Summary

### Health Check
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/health` | Basic health check | ❌ |
| GET | `/health/ready` | Readiness check | ❌ |
| GET | `/health/live` | Liveness check | ❌ |

### Authentication
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/auth/signup` | Register user | ❌ |
| POST | `/auth/verify-email` | Verify email OTP | ❌ |
| POST | `/auth/select-role` | Select role | ❌ |
| POST | `/auth/resend-otp` | Resend OTP | ❌ |
| POST | `/auth/login` | User login | ❌ |
| POST | `/auth/forgot-password` | Request reset | ❌ |
| POST | `/auth/reset-password` | Reset password | ❌ |
| POST | `/auth/refresh-token` | Refresh token | ❌ |
| GET | `/auth/me` | Get current user | ✅ |
| POST | `/auth/change-password` | Change password | ✅ |
| POST | `/auth/logout` | Logout | ✅ |
| POST | `/auth/logout-all` | Logout all devices | ✅ |

### Doctor Routes (Role: Doctor)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/doctor/profile` | Get profile |
| PUT | `/doctor/profile/personal` | Update personal info |
| POST | `/doctor/education` | Add education |
| POST | `/doctor/experience` | Add experience |
| POST | `/doctor/skills` | Add skill |
| PUT | `/doctor/preferences` | Update preferences |
| GET | `/doctor/jobs` | Get available jobs |
| GET | `/doctor/applications` | Get my applications |
| GET | `/doctor/active-jobs` | Get active assignments |
| POST | `/doctor/leave-requests` | Request leave |

### Hospital Routes (Role: Hospital)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/hospital/profile` | Get profile |
| GET | `/hospital/dashboard` | Get dashboard stats |
| POST | `/hospital/jobs` | Create job posting |
| GET | `/hospital/jobs` | Get posted jobs |
| GET | `/hospital/applications` | Get all applications |
| PUT | `/hospital/applications/:id/status` | Update status |
| POST | `/hospital/applications/:id/hire` | Hire applicant |
| GET | `/hospital/employees` | Get employees |
| GET | `/hospital/candidates` | Search candidates |
| GET | `/hospital/leave-requests` | Get leave requests |

### Public Job Routes
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/jobs` | Search jobs |
| GET | `/jobs/filters` | Get filter options |
| GET | `/jobs/featured` | Get featured jobs |
| GET | `/jobs/:id` | Get job details |
| POST | `/jobs/:id/apply` | Apply to job (Doctor) |

### Search Routes (Public)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/search/hospitals` | Search hospitals |
| GET | `/search/doctors` | Search doctors |

## 📝 Implementation Checklist

### Phase 1: Core Authentication ✅ (Structure Ready)
- [ ] Database schema for users
- [ ] Password hashing with bcrypt
- [ ] JWT token generation/verification
- [ ] OTP generation and Redis storage
- [ ] Email sending with nodemailer
- [ ] Refresh token management

### Phase 2: Doctor Module
- [ ] Database schema for doctor profiles
- [ ] Profile CRUD operations
- [ ] Education/Experience/Skills management
- [ ] File upload for documents
- [ ] Aadhaar verification integration

### Phase 3: Hospital Module
- [ ] Database schema for hospital profiles
- [ ] Profile CRUD operations
- [ ] Department/Contact management
- [ ] File upload for logo/documents

### Phase 4: Jobs Module
- [ ] Database schema for jobs
- [ ] Job CRUD operations
- [ ] Search with filters
- [ ] Application management

### Phase 5: Assignments & Attendance
- [ ] Database schema for assignments
- [ ] Check-in/Check-out functionality
- [ ] Leave request management
- [ ] Attendance history

## 🔧 Environment Variables

See `.env.example` for all required environment variables.

Key configurations:
- `DB_*` - PostgreSQL connection
- `REDIS_*` - Redis connection
- `JWT_*` - Token secrets and expiry
- `SMTP_*` - Email configuration
- `OTP_*` - OTP settings

## 📄 License

ISC

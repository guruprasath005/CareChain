// src/validators/index.ts
// Route files import directly from their specific validator module.
// This barrel re-exports only what has unique names across all validators.

export * from './auth.validator';

// Doctor and hospital validators have overlapping names (sendPhoneOtpSchema etc.)
// so we export them namespaced to avoid ambiguity.
export * as doctorValidators from './doctor.validator';
export * as hospitalValidators from './hospital.validator';
export * as jobValidators from './job.validator';

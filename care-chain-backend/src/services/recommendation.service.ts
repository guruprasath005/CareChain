// src/services/recommendation.service.ts
//
// Matching Algorithm — ported exactly from CareChainX core/tasks.py
// `run_matching_algorithm_for_job`
//
// ── Weights (raw, same as CareChainX) ─────────────────────────────────────────
//   SKILL_SCORE_WEIGHT        = 3.0
//   EXPERIENCE_SCORE_WEIGHT   = 4.5
//   SALARY_SCORE_WEIGHT       = 5.0
//   AVAILABILITY_SCORE_WEIGHT = 10.0   ← highest weight
//   LOCATION_SCORE_WEIGHT     = 6.0
//
// ── Two-stage process ─────────────────────────────────────────────────────────
//   1. Hard filters  — discard unqualified candidates
//   2. Soft scoring  — rank remaining candidates
//
// ── Final score ───────────────────────────────────────────────────────────────
//   final_score = (job_score + pref_score) × candidate.average_quality_score
//   job_score   = skill_component + experience_component
//   pref_score  = salary_component + availability_component + location_component
//   (quality score is a MULTIPLIER, default 4.0 — same as CareChainX)

import { Op } from 'sequelize';
import { Job } from '../models/Job.model';
import { Doctor } from '../models/Doctor.model';
import { User } from '../models/User.model';
import { Application } from '../models/Application.model';
import { JobStatus, ApplicationStatus, UserRole } from '../models/types';
import { redis, REDIS_KEYS } from '../config/redis';
import { logger } from '../utils/logger';

// ─── CareChainX exact weights ─────────────────────────────────────────────────
const SKILL_SCORE_WEIGHT        = 3.0;
const EXPERIENCE_SCORE_WEIGHT   = 4.5;
const SALARY_SCORE_WEIGHT       = 5.0;
const AVAILABILITY_SCORE_WEIGHT = 10.0;
const LOCATION_SCORE_WEIGHT     = 6.0;

/** Default quality score for new doctors with no feedback history. */
const DEFAULT_QUALITY_SCORE = 4.0;

const CACHE_TTL = 300; // 5 minutes

// ─── Public types ─────────────────────────────────────────────────────────────

export interface MatchWeights {
  skill: number;
  experience: number;
  salary: number;
  availability: number;
  location: number;
}

export interface MatchDetails {
  skillScore: number;
  experienceScore: number;
  salaryScore: number;
  availabilityScore: number;
  locationScore: number;
  qualityMultiplier: number;
  jobScore: number;    // skill + experience
  prefScore: number;   // salary + availability + location
}

export interface RecommendedJob {
  job: Job;
  matchScore: number;
  matchDetails: MatchDetails;
  hasApplied: boolean;
}

export interface RecommendedDoctor {
  doctor: Doctor;
  user: User;
  matchScore: number;
  matchDetails: MatchDetails;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class RecommendationService {

  // ── Public: jobs for a doctor ──────────────────────────────────────────────

  async getRecommendedJobsForDoctor(
    doctorId: string,
    page = 1,
    limit = 20
  ): Promise<{ jobs: RecommendedJob[]; total: number }> {
    const doctor = await Doctor.findOne({
      where: { userId: doctorId },
      include: [{ association: 'user' }],
    });
    if (!doctor) throw new Error('Doctor profile not found');

    const cacheKey = REDIS_KEYS.CACHE(`recommendations:doctor:${doctorId}:${page}:${limit}`);
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch { /* ignore */ }

    const prefs = doctor.careerPreferences;

    // ── DB-level pre-filtering ────────────────────────────────────────────────
    // Push as much as possible to SQL to avoid loading every open job into memory.
    // Primary filters: status = OPEN, and specialization overlap when available.
    const dbWhere: Record<string, unknown> = { status: JobStatus.OPEN };

    if (doctor.specialization) {
      // PostgreSQL case-insensitive specialization filter
      dbWhere.specialization = { [Op.iLike]: `%${doctor.specialization.split(' ')[0]}%` };
    }

    const openJobs = await Job.findAll({
      where: dbWhere,
      include: [{
        association: 'hospital',
        attributes: ['id', 'fullName'],
        include: [{
          association: 'hospitalProfile',
          attributes: ['hospitalName', 'address', 'latitude', 'longitude', 'images'],
        }],
      }],
      order: [['createdAt', 'DESC']],
    });

    // Get doctor's existing applications
    const applications = await Application.findAll({
      where: {
        doctorId,
        status: { [Op.notIn]: [ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN] },
      },
      attributes: ['jobId'],
    });
    const appliedJobIds = new Set(applications.map((a) => a.jobId));

    const wantsShortTerm = prefs?.shortTermJobs !== false;
    const wantsLongTerm  = prefs?.longTermJobs  !== false;

    // Build doctor's degree set from actual education records
    const doctorDegrees = this.extractDegrees(doctor);

    // ── Stage 1: In-memory hard filters ──────────────────────────────────────
    const hardFiltered = openJobs.filter((job) => {
      const isShortTerm = this.isShortTermJob(job);

      // Hard filter 1: job type preference
      if (isShortTerm && !wantsShortTerm) return false;
      if (!isShortTerm && !wantsLongTerm)  return false;

      // Hard filter 2: prevent doctor from applying to their OWN hospital's job
      // (a doctor registered under a hospital account cannot apply to that hospital)
      if (job.hospitalId === doctorId) return false;

      // Hard filter 3: qualification / degree check
      // Checks job.required_qualifications against candidate.education.degree
      // (mirrors CareChainX candidate.education.degree filter)
      if (job.requirements?.qualifications?.length) {
        const hasRequiredDegree = this.hasRequiredQualification(
          job.requirements.qualifications,
          doctorDegrees,
          doctor.specialization,
          doctor.subSpecializations ?? []
        );
        if (!hasRequiredDegree) return false;
      }

      // Hard filter 4: 7×24 availability matrix (short-term jobs only)
      // • If job has a matrix → doctor MUST have a matrix AND have ≥1 overlapping hour
      // • If job has no matrix  → for short-term, penalise in soft score but don't exclude
      if (isShortTerm && job.weeklyAvailabilityMatrix?.length) {
        const docMatrix = prefs?.weeklyAvailabilityMatrix;
        if (!docMatrix?.length) return false; // doctor has no availability data — exclude
        if (!this.hasAvailabilityOverlap(job.weeklyAvailabilityMatrix, docMatrix)) return false;
      }

      return true;
    });

    // ── Stage 2: Soft scoring ─────────────────────────────────────────────────
    const scored: RecommendedJob[] = hardFiltered.map((job) => {
      const details = this.scoreJobForDoctor(doctor, job, doctorDegrees);
      return {
        job,
        matchScore: details.finalScore,
        matchDetails: {
          skillScore: details.skillScore,
          experienceScore: details.experienceScore,
          salaryScore: details.salaryScore,
          availabilityScore: details.availabilityScore,
          locationScore: details.locationScore,
          qualityMultiplier: details.qualityMultiplier,
          jobScore: details.jobScore,
          prefScore: details.prefScore,
        },
        hasApplied: appliedJobIds.has(job.id),
      };
    });

    // Non-applied first, then descending score
    scored.sort((a, b) => {
      if (a.hasApplied !== b.hasApplied) return a.hasApplied ? 1 : -1;
      return b.matchScore - a.matchScore;
    });

    const total  = scored.length;
    const offset = (page - 1) * limit;
    const result = { jobs: scored.slice(offset, offset + limit), total };

    try { await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result)); } catch { /* ignore */ }
    logger.debug(`Recommendations for doctor ${doctorId}: ${total} matches (page ${page})`);
    return result;
  }

  // ── Public: candidates for a job ───────────────────────────────────────────

  async getRecommendedCandidatesForJob(
    jobId: string,
    hospitalId: string,
    page = 1,
    limit = 20
  ): Promise<{ candidates: RecommendedDoctor[]; total: number }> {
    const job = await Job.findOne({ where: { id: jobId, hospitalId } });
    if (!job) throw new Error('Job not found');

    const cacheKey = REDIS_KEYS.CACHE(`recommendations:job:${jobId}:${page}:${limit}`);
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch { /* ignore */ }

    const isShortTerm = this.isShortTermJob(job);

    // ── DB-level pre-filtering ────────────────────────────────────────────────
    // Filter by role, active status, and specialization at DB level.
    const dbDoctorWhere: Record<string, unknown> = { isSearchable: true };
    if (job.specialization) {
      dbDoctorWhere.specialization = {
        [Op.iLike]: `%${job.specialization.split(' ')[0]}%`,
      };
    }

    const allDoctors = await Doctor.findAll({
      where: dbDoctorWhere,
      include: [{
        association: 'user',
        where: { role: UserRole.DOCTOR, isActive: true, isProfileComplete: true },
        required: true,
        attributes: ['id', 'fullName', 'email', 'avatarUrl'],
      }],
    });

    // Get existing applications for this job
    const applications = await Application.findAll({
      where: { jobId },
      attributes: ['doctorId', 'status'],
    });
    const applicationStatus = new Map(applications.map((a) => [a.doctorId, a.status]));

    // ── Stage 1: In-memory hard filters ──────────────────────────────────────
    const hardFiltered = allDoctors.filter((doctor) => {
      // Exclude already-active applicants (allow re-application after rejection)
      const status = applicationStatus.get(doctor.userId);
      if (status && status !== ApplicationStatus.REJECTED) return false;

      // Prevent doctor from being matched to their own hospital's job
      // (covers the edge case of a dual-role account)
      if (doctor.userId === hospitalId) return false;

      const prefs = doctor.careerPreferences;
      const wantsShortTerm = prefs?.shortTermJobs !== false;
      const wantsLongTerm  = prefs?.longTermJobs  !== false;

      // Hard filter 1: job type preference
      if (isShortTerm && !wantsShortTerm) return false;
      if (!isShortTerm && !wantsLongTerm)  return false;

      // Hard filter 2: qualification / degree check
      const doctorDegrees = this.extractDegrees(doctor);
      if (job.requirements?.qualifications?.length) {
        const hasRequiredDegree = this.hasRequiredQualification(
          job.requirements.qualifications,
          doctorDegrees,
          doctor.specialization,
          doctor.subSpecializations ?? []
        );
        if (!hasRequiredDegree) return false;
      }

      // Hard filter 3: 7×24 availability matrix
      if (isShortTerm && job.weeklyAvailabilityMatrix?.length) {
        const docMatrix = prefs?.weeklyAvailabilityMatrix;
        if (!docMatrix?.length) return false;
        if (!this.hasAvailabilityOverlap(job.weeklyAvailabilityMatrix, docMatrix)) return false;
      }

      return true;
    });

    // ── Stage 2: Soft scoring ─────────────────────────────────────────────────
    const scored: RecommendedDoctor[] = hardFiltered.map((doctor) => {
      const doctorDegrees = this.extractDegrees(doctor);
      const details = this.scoreJobForDoctor(doctor, job, doctorDegrees);
      return {
        doctor,
        user: doctor.user!,
        matchScore: details.finalScore,
        matchDetails: {
          skillScore: details.skillScore,
          experienceScore: details.experienceScore,
          salaryScore: details.salaryScore,
          availabilityScore: details.availabilityScore,
          locationScore: details.locationScore,
          qualityMultiplier: details.qualityMultiplier,
          jobScore: details.jobScore,
          prefScore: details.prefScore,
        },
      };
    });

    scored.sort((a, b) => b.matchScore - a.matchScore);

    const total  = scored.length;
    const offset = (page - 1) * limit;
    const result = { candidates: scored.slice(offset, offset + limit), total };

    try { await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result)); } catch { /* ignore */ }
    logger.debug(`Candidates for job ${jobId}: ${total} matches (page ${page})`);
    return result;
  }

  // ── Core scoring ─────────────────────────────────────────────────────────────

  private scoreJobForDoctor(
    doctor: Doctor,
    job: Job,
    doctorDegrees: Set<string>
  ): {
    skillScore: number;
    experienceScore: number;
    salaryScore: number;
    availabilityScore: number;
    locationScore: number;
    qualityMultiplier: number;
    jobScore: number;
    prefScore: number;
    finalScore: number;
  } {
    const prefs = doctor.careerPreferences;
    let jobScore  = 0; // Objective: skill + experience
    let prefScore = 0; // Preference: salary + availability + location

    // ── 1. Skill matching ──────────────────────────────────────────────────────
    // CareChainX: skills_matched / total_required_skills
    // Step 1: exact name match against doctor.skills
    // Step 2: fuzzy match against doctor.workExperience roles/departments
    //         (past employment history used to infer skills — CareChainX gap closed here)
    const requiredSkills = (job.requirements?.skills ?? []).map((s) => s.toLowerCase().trim());
    const totalRequired  = requiredSkills.length || 1; // avoid division by zero

    // Build doctor skill set: explicit skills + inferred from past employment
    const explicitSkills  = (doctor.skills ?? []).map((s) => s.name.toLowerCase().trim());
    const employmentTerms = (doctor.workExperience ?? []).flatMap((w) =>
      [w.role, w.department, w.description].filter(Boolean).map((t) => t!.toLowerCase())
    );
    const allDoctorSkills = [...explicitSkills, ...employmentTerms];

    const skillMatches = requiredSkills.filter((req) => {
      // Exact match first
      if (allDoctorSkills.includes(req)) return true;
      // Fuzzy: substring containment
      return allDoctorSkills.some((ds) => ds.includes(req) || req.includes(ds));
    }).length;

    const skillScore = skillMatches / totalRequired;
    jobScore += skillScore * SKILL_SCORE_WEIGHT;

    // ── 2. Experience matching ─────────────────────────────────────────────────
    // Calculate actual years from work_experience date ranges
    // (NOT from yearsOfExperience profile field — extra validation)
    const totalExpDays = (doctor.workExperience ?? []).reduce((acc, w) => {
      const start = w.startDate ? new Date(w.startDate).getTime() : null;
      const end   = w.isCurrent ? Date.now() : (w.endDate ? new Date(w.endDate).getTime() : null);
      if (start !== null && end !== null && end > start) {
        return acc + (end - start) / (1000 * 60 * 60 * 24);
      }
      return acc;
    }, 0);
    const candidateExpYears = totalExpDays / 365.25;
    const minExpYears = job.requirements?.minimumExperience ?? 0;

    let experienceScore = 0;
    if (candidateExpYears >= minExpYears) {
      // Bonus for exceeding the minimum — mirrors CareChainX formula
      experienceScore = EXPERIENCE_SCORE_WEIGHT *
        (candidateExpYears - minExpYears) / (minExpYears || 1);
    }
    jobScore += experienceScore;

    // ── 3. Salary matching ─────────────────────────────────────────────────────
    // CareChainX formula:
    //   salary_score = 0.5 + (job_pay - candidate_expectation) / (candidate_expectation × 2)
    //   0.5 = exact match, >0.5 = job pays more, <0.5 = job pays less
    let salaryScore = 0;
    const isShortTerm   = this.isShortTermJob(job);
    const jobPayType    = job.compensation?.type;
    const jobPayAmount  = job.compensation?.amount ?? 0;

    if (isShortTerm) {
      if (jobPayType === 'hourly' && prefs?.expectedHourlyRate) {
        salaryScore = 0.5 + (jobPayAmount - prefs.expectedHourlyRate) / (prefs.expectedHourlyRate * 2);
      } else if (jobPayType === 'per_patient' && prefs?.expectedPerPatientRate) {
        salaryScore = 0.5 + (jobPayAmount - prefs.expectedPerPatientRate) / (prefs.expectedPerPatientRate * 2);
      }
    } else {
      if (prefs?.expectedMonthlyRate && jobPayAmount) {
        const monthlyJob =
          jobPayType === 'monthly' ? jobPayAmount :
          jobPayType === 'daily'   ? jobPayAmount * 26 : jobPayAmount;
        salaryScore = 0.5 + (monthlyJob - prefs.expectedMonthlyRate) / (prefs.expectedMonthlyRate * 2);
      }
    }
    prefScore += SALARY_SCORE_WEIGHT * salaryScore;

    // ── 4. Availability matching ───────────────────────────────────────────────
    // Hard filter already guarantees ≥1 overlap for short-term jobs with a matrix.
    // Soft score = overlap_hours / required_hours (CareChainX ratio formula).
    // If doctor has no availability matrix, score = 0 (penalised, not excluded —
    // because the job may not have a matrix requirement either).
    let availabilityScore = 0;
    if (isShortTerm) {
      const jobMatrix = job.weeklyAvailabilityMatrix;
      const docMatrix = prefs?.weeklyAvailabilityMatrix;

      if (jobMatrix?.length && docMatrix?.length) {
        let overlap = 0;
        let requiredHours = 0;
        for (let day = 0; day < 7; day++) {
          for (let hour = 0; hour < 24; hour++) {
            const jobSlot = jobMatrix[day]?.[hour] ?? 0;
            if (jobSlot === 1) {
              requiredHours++;
              if ((docMatrix[day]?.[hour] ?? 0) === 1) overlap++;
            }
          }
        }
        availabilityScore = requiredHours > 0 ? overlap / requiredHours : 0;
      }
      // If job has no matrix: availability score stays 0 for all candidates (fair)
      // If job has a matrix but doctor has none: doctor was excluded by hard filter above
    }
    prefScore += availabilityScore * AVAILABILITY_SCORE_WEIGHT;

    // ── 5. Location matching (geodesic Haversine) ──────────────────────────────
    // CareChainX uses geopy.distance.geodesic(); we replicate with Haversine.
    // location_score = 1 - (distance_km / max_travel_km)
    // Contributes 0 if no coordinates or candidate has no max_travel_distance set.
    let locationScore = 0;
    const docLat = doctor.latitude  ? Number(doctor.latitude)  : null;
    const docLng = doctor.longitude ? Number(doctor.longitude) : null;
    const jobLat = job.latitude  ?? null;
    const jobLng = job.longitude ?? null;

    if (docLat !== null && docLng !== null && jobLat !== null && jobLng !== null) {
      const distanceKm = this.geodesicDistanceKm(docLat, docLng, jobLat, jobLng);
      const maxTravel  = prefs?.maxTravelDistance;
      if (maxTravel && distanceKm <= maxTravel) {
        locationScore = 1.0 - distanceKm / maxTravel;
        prefScore    += LOCATION_SCORE_WEIGHT * locationScore;
      }
      // Beyond max_travel_distance → location contributes 0
    }

    // ── Final: (job_score + pref_score) × average_quality_score ──────────────
    const qualityMultiplier = doctor.platformStats?.rating ?? DEFAULT_QUALITY_SCORE;
    const finalScore        = (jobScore + prefScore) * (qualityMultiplier || 1.0);

    return {
      skillScore:       Math.round(skillScore       * 1000) / 1000,
      experienceScore:  Math.round(experienceScore  * 1000) / 1000,
      salaryScore:      Math.round(salaryScore       * 1000) / 1000,
      availabilityScore:Math.round(availabilityScore * 1000) / 1000,
      locationScore:    Math.round(locationScore     * 1000) / 1000,
      qualityMultiplier,
      jobScore:  Math.round(jobScore  * 100) / 100,
      prefScore: Math.round(prefScore * 100) / 100,
      finalScore:Math.round(finalScore * 100) / 100,
    };
  }

  // ─── Qualification / degree helpers ──────────────────────────────────────────

  /**
   * Extract all degree strings from a doctor's education records.
   * Returns a Set of lowercased degree strings for fast lookup.
   */
  private extractDegrees(doctor: Doctor): Set<string> {
    const degrees = new Set<string>();
    (doctor.education ?? []).forEach((edu) => {
      if (edu.degree) degrees.add(edu.degree.toLowerCase().trim());
      if (edu.specialization) degrees.add(edu.specialization.toLowerCase().trim());
    });
    return degrees;
  }

  /**
   * Check whether a doctor meets the job's qualification requirements.
   *
   * Mirrors CareChainX: job.required_qualifications vs candidate.education.degree
   *
   * Matching order (most to least specific):
   *   1. Exact degree match (e.g. "MBBS" in doctor.education[].degree)
   *   2. Specialization match (doctor.specialization / subSpecializations)
   *   3. Fuzzy substring match (covers alternate naming, e.g. "M.B.B.S")
   */
  private hasRequiredQualification(
    requiredQuals: string[],
    doctorDegrees: Set<string>,
    specialization: string | null | undefined,
    subSpecializations: string[]
  ): boolean {
    const jobQuals = requiredQuals.map((q) => q.toLowerCase().trim());
    const docSpec  = specialization?.toLowerCase().trim() ?? '';
    const docSubSpecs = subSpecializations.map((s) => s.toLowerCase().trim());

    return jobQuals.some((req) => {
      // 1. Exact degree match
      if (doctorDegrees.has(req)) return true;
      // 2. Specialization match
      if (docSpec && (docSpec.includes(req) || req.includes(docSpec))) return true;
      if (docSubSpecs.some((s) => s.includes(req) || req.includes(s))) return true;
      // 3. Fuzzy degree match (e.g. "mbbs" vs "m.b.b.s")
      return [...doctorDegrees].some((d) => d.includes(req) || req.includes(d));
    });
  }

  // ─── Availability helpers ─────────────────────────────────────────────────────

  /**
   * Hard filter: returns true if the two 7×24 matrices share at least 1 hour.
   * Candidate is excluded if this returns false (CareChainX hard filter).
   */
  private hasAvailabilityOverlap(jobMatrix: number[][], docMatrix: number[][]): boolean {
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        if ((jobMatrix[day]?.[hour] ?? 0) === 1 && (docMatrix[day]?.[hour] ?? 0) === 1) {
          return true;
        }
      }
    }
    return false;
  }

  // ─── Job type helper ──────────────────────────────────────────────────────────

  /**
   * Short-term: locum_tenens, per_diem, part_time
   *   → uses availability matrix + hourly/per-patient salary matching
   * Long-term: full_time, contract
   *   → uses monthly salary matching, no matrix requirement
   */
  private isShortTermJob(job: Job): boolean {
    return ['locum_tenens', 'per_diem', 'part_time'].includes(job.jobType);
  }

  // ─── Geodesic distance (Haversine) ───────────────────────────────────────────

  /**
   * Returns distance in km between two lat/lng points.
   * Equivalent to geopy.distance.geodesic() used in CareChainX.
   */
  private geodesicDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R    = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a    =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ─── Cache management ─────────────────────────────────────────────────────────

  private async scanAndDelete(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== '0');
  }

  async clearDoctorCache(doctorId: string): Promise<void> {
    try { await this.scanAndDelete(`cache:recommendations:doctor:${doctorId}:*`); } catch { /* ignore */ }
  }

  async clearJobCache(jobId: string): Promise<void> {
    try { await this.scanAndDelete(`cache:recommendations:job:${jobId}:*`); } catch { /* ignore */ }
  }

  async clearAllCaches(): Promise<void> {
    try { await this.scanAndDelete('cache:recommendations:*'); } catch { /* ignore */ }
  }

  // ─── Utility endpoints ────────────────────────────────────────────────────────

  async getMatchScore(
    doctorId: string,
    jobId: string
  ): Promise<{ score: number; details: MatchDetails }> {
    const [doctor, job] = await Promise.all([
      Doctor.findOne({ where: { userId: doctorId } }),
      Job.findByPk(jobId),
    ]);
    if (!doctor || !job) throw new Error('Doctor or job not found');

    const doctorDegrees = this.extractDegrees(doctor);
    const details = this.scoreJobForDoctor(doctor, job, doctorDegrees);

    return {
      score: details.finalScore,
      details: {
        skillScore:        details.skillScore,
        experienceScore:   details.experienceScore,
        salaryScore:       details.salaryScore,
        availabilityScore: details.availabilityScore,
        locationScore:     details.locationScore,
        qualityMultiplier: details.qualityMultiplier,
        jobScore:          details.jobScore,
        prefScore:         details.prefScore,
      },
    };
  }

  async getSimilarJobs(jobId: string, limit = 5): Promise<Job[]> {
    const job = await Job.findByPk(jobId);
    if (!job) return [];

    return Job.findAll({
      where: {
        id: { [Op.ne]: jobId },
        status: JobStatus.OPEN,
        [Op.or]: [
          { specialization: job.specialization },
          { searchTags: { [Op.overlap]: job.searchTags ?? [] } },
        ],
      },
      include: [{
        association: 'hospital',
        attributes: ['id', 'fullName'],
        include: [{ association: 'hospitalProfile', attributes: ['hospitalName', 'address'] }],
      }],
      limit,
      order: [['createdAt', 'DESC']],
    });
  }

  async getQuickRecommendations(doctorId: string, limit = 5): Promise<RecommendedJob[]> {
    const result = await this.getRecommendedJobsForDoctor(doctorId, 1, limit);
    return result.jobs.filter((j) => !j.hasApplied && j.matchScore > 0);
  }

  /** Expose current weights (fixed to CareChainX constants — not user-configurable). */
  getWeights(): MatchWeights {
    return {
      skill:        SKILL_SCORE_WEIGHT,
      experience:   EXPERIENCE_SCORE_WEIGHT,
      salary:       SALARY_SCORE_WEIGHT,
      availability: AVAILABILITY_SCORE_WEIGHT,
      location:     LOCATION_SCORE_WEIGHT,
    };
  }
}

export const recommendationService = new RecommendationService();
export default recommendationService;

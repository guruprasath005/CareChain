// src/controllers/search.controller.ts
// Public search endpoints — no authentication required.

import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/response';
import { hospitalService } from '../services/hospital.service';
import { doctorService } from '../services/doctor.service';

export const searchController = {
  /**
   * GET /search/hospitals
   * Search hospitals with optional filters.
   *
   * Query params:
   *   city, state, hospitalType, isVerified, page, limit
   */
  async searchHospitals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        city,
        state,
        hospitalType,
        isVerified,
        page = '1',
        limit = '20',
      } = req.query as Record<string, string | undefined>;

      const result = await hospitalService.searchHospitals({
        city: city?.trim(),
        state: state?.trim(),
        hospitalType: hospitalType?.trim(),
        isVerified: isVerified !== undefined ? isVerified === 'true' : undefined,
        page: parseInt(page, 10) || 1,
        limit: Math.min(parseInt(limit, 10) || 20, 100),
      });

      ApiResponse.paginated(
        res,
        result.data,
        result.meta.page,
        result.meta.limit,
        result.meta.totalItems,
        'Hospitals retrieved'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /search/hospitals/:id
   * Get a single hospital's public profile.
   */
  async getHospitalProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const profile = await hospitalService.getPublicProfile(id);

      if (!profile) {
        ApiResponse.notFound(res, 'Hospital not found');
        return;
      }

      ApiResponse.success(res, profile, 'Hospital profile retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /search/doctors
   * Search doctors with optional filters.
   * Returns a public-safe subset of doctor information.
   *
   * Query params:
   *   q, specialization, city, state, minExperience, maxExperience,
   *   skills (comma-separated), isAvailable, sortBy, sortOrder, page, limit
   */
  async searchDoctors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        q,
        specialization,
        city,
        state,
        minExperience,
        maxExperience,
        skills,
        isAvailable,
        sortBy,
        sortOrder,
        page = '1',
        limit = '20',
      } = req.query as Record<string, string | undefined>;

      const result = await doctorService.searchDoctors({
        q: q?.trim(),
        specialization: specialization?.trim(),
        city: city?.trim(),
        state: state?.trim(),
        minExperience: minExperience !== undefined ? parseFloat(minExperience) : undefined,
        maxExperience: maxExperience !== undefined ? parseFloat(maxExperience) : undefined,
        skills: skills ? skills.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        isAvailable: isAvailable !== undefined ? isAvailable === 'true' : undefined,
        sortBy: sortBy?.trim(),
        sortOrder: sortOrder?.trim(),
        page: parseInt(page, 10) || 1,
        limit: Math.min(parseInt(limit, 10) || 20, 100),
      });

      ApiResponse.paginated(
        res,
        result.data,
        result.meta.page,
        result.meta.limit,
        result.meta.totalItems,
        'Doctors retrieved'
      );
    } catch (error) {
      next(error);
    }
  },
};

export default searchController;

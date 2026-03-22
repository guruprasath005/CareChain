// src/routes/search.routes.ts
// Search Routes
// Public search endpoints for hospitals and doctors

import { Router } from 'express';
import { searchController } from '../controllers/search.controller';

const router = Router();

// All search routes are public

/**
 * @route   GET /api/v1/search/hospitals
 * @desc    Search hospitals (public)
 * @access  Public
 * @query   q, page, limit, city, state, hospitalType
 * @returns Paginated list of hospitals (public info only)
 */
router.get('/hospitals', searchController.searchHospitals);

/**
 * @route   GET /api/v1/search/hospitals/:id
 * @desc    Get hospital public profile
 * @access  Public
 * @params  id - Hospital ID
 * @returns Hospital public profile with jobs count
 */
router.get('/hospitals/:id', searchController.getHospitalProfile);

/**
 * @route   GET /api/v1/search/doctors
 * @desc    Search doctors (public - limited info)
 * @access  Public
 * @query   q, page, limit, specialization, city, availability
 * @returns Paginated list of doctors (public info only)
 */
router.get('/doctors', searchController.searchDoctors);

export default router;

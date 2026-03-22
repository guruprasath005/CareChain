// services/api.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import ENV from '@/config/env';

// API Configuration
const API_BASE_URL = ENV.API_URL;

// Storage keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: '@carechain_access_token',
  REFRESH_TOKEN: '@carechain_refresh_token',
  USER: '@carechain_user',
};

// In-memory token cache — avoids AsyncStorage I/O on every API request.
// undefined = not yet loaded; null = confirmed empty; string = valid token.
let _memAccessToken: string | null | undefined = undefined;

// Types
export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'doctor' | 'hospital' | 'pending';
  isEmailVerified: boolean;
  isProfileComplete: boolean;
  avatar?: string;
  avatarUrl?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  meta?: any;
  error?: string;
  message?: string;
  statusCode?: number;
  timestamp?: string;
}

// API Error class
export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// Token management
export const tokenManager = {
  async getAccessToken(): Promise<string | null> {
    // Return from memory cache if already loaded (avoids AsyncStorage on every request)
    if (_memAccessToken !== undefined) return _memAccessToken;
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      _memAccessToken = token;
      return token;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  },

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      if (!accessToken || !refreshToken) {
        console.warn('Attempted to set empty tokens');
        return;
      }
      _memAccessToken = accessToken; // keep memory in sync
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.ACCESS_TOKEN, accessToken],
        [STORAGE_KEYS.REFRESH_TOKEN, refreshToken],
      ]);
    } catch (error) {
      console.error('Error setting tokens:', error);
      throw error;
    }
  },

  async clearTokens(): Promise<void> {
    try {
      _memAccessToken = null; // clear memory cache immediately
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER,
      ]);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  },

  async getUser(): Promise<User | null> {
    try {
      const userStr = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  },

  async setUser(user: User): Promise<void> {
    try {
      if (!user) {
        console.warn('Attempted to set null user');
        return;
      }
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } catch (error) {
      console.error('Error setting user:', error);
      throw error;
    }
  },
};

// Session expired callback (can be set by the app)
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredCallback(callback: () => void) {
  onSessionExpired = callback;
}

/**
 * Parse JSON from fetch Response. Empty bodies return null (avoids "JSON Parse error: Unexpected end of input").
 * Non-JSON bodies throw ApiError with a short preview for debugging wrong URLs / HTML error pages.
 */
async function parseJsonFromResponse<T = Record<string, unknown>>(
  response: Response
): Promise<T | null> {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const preview = trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed;
    throw new ApiError(
      `Server returned non-JSON (${response.status}). Check API base URL. Preview: ${preview}`,
      response.status,
      { rawPreview: preview }
    );
  }
}

function emptyResponseMessage(response: Response, requestUrl: string): string {
  if (response.status >= 500) {
    return `Server returned ${response.status} with an empty body (timeout, overload, or crash). URL: ${requestUrl}`;
  }
  if (response.status === 404) {
    return `Not found — API base URL may be wrong (missing /api/v1 or wrong host). URL: ${requestUrl}`;
  }
  return `Empty response (${response.status}). Check that the backend is running and EXPO_PUBLIC_API_URL is correct. URL: ${requestUrl}`;
}

// Base fetch function with auth handling
async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Add auth token if available
  const accessToken = await tokenManager.getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await parseJsonFromResponse<Record<string, unknown>>(response);

    if (data === null) {
      throw new ApiError(emptyResponseMessage(response, url), response.status);
    }

    if (!response.ok) {
      // Handle token expiration
      if (response.status === 401 && retry) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return fetchWithAuth<T>(endpoint, options, false);
        }
        // Token refresh failed, clear tokens
        await tokenManager.clearTokens();

        // Notify app to logout, but avoid loops if we are already hitting logout
        if (onSessionExpired && !endpoint.includes('/auth/logout')) {
          onSessionExpired();
        }

        throw new ApiError('Session expired. Please login again.', 401);
      }

      throw new ApiError(
        (data.error as string) || (data.message as string) || 'An error occurred',
        response.status,
        data
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    console.error(`[API] Network error for ${endpoint}:`, error, '→', url);
    const hint =
      `Cannot reach the API server (${API_BASE_URL}). ` +
      `Same Wi‑Fi as your computer, backend on port 5001 (not 5000 on Mac — AirPlay). ` +
      `Android emulator uses 10.0.2.2. iPhone + Expo Go + http://LAN often fails — set ` +
      `EXPO_PUBLIC_API_URL=https://care-chain-backend.onrender.com/api/v1 in .env or use a dev build.`;
    throw new ApiError(hint, 0, error);
  }
}

// Refresh access token
async function refreshAccessToken(): Promise<boolean> {
  try {
    const refreshToken = await tokenManager.getRefreshToken();
    if (!refreshToken) return false;

    const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const data = await parseJsonFromResponse<{
      success?: boolean;
      data?: { accessToken?: string; refreshToken?: string };
    }>(response);
    if (!data) return false;
    if (data.success && data.data?.accessToken) {
      await tokenManager.setTokens(
        data.data.accessToken,
        data.data.refreshToken || refreshToken
      );
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ============ AUTH API ============
export const authApi = {
  // Signup
  async signup(fullName: string, email: string, password: string) {
    return fetchWithAuth<ApiResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ fullName, email, password }),
    });
  },

  // Verify email with OTP
  async verifyEmail(email: string, otp: string) {
    const response = await fetchWithAuth<
      ApiResponse<{
        success?: boolean;
        message?: string;
        requiresRoleSelection?: boolean;
        email?: string;
        fullName?: string;
        user?: User;
        accessToken?: string;
        refreshToken?: string;
        expiresIn?: number;
      }>
    >('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });

    // If backend chose to issue tokens (non-pending role), persist them.
    if (response.success && response.data?.user && response.data?.accessToken && response.data?.refreshToken) {
      await tokenManager.setTokens(response.data.accessToken, response.data.refreshToken);
      await tokenManager.setUser(response.data.user);
    }

    return response;
  },

  // Resend OTP
  async resendOTP(email: string, type: 'email_verification' | 'password_reset' = 'email_verification') {
    return fetchWithAuth<ApiResponse>('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email, type }),
    });
  },

  // Select role after email verification
  async selectRole(email: string, role: 'doctor' | 'hospital') {
    const response = await fetchWithAuth<ApiResponse<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>>('/auth/select-role', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });

    // Save tokens and user
    if (response.success && response.data) {
      await tokenManager.setTokens(
        response.data.accessToken,
        response.data.refreshToken
      );
      await tokenManager.setUser(response.data.user);
    }

    return response;
  },

  // Login
  async login(email: string, password: string) {
    const response = await fetchWithAuth<ApiResponse<{
      user?: User;
      accessToken?: string;
      refreshToken?: string;
      requiresRoleSelection?: boolean;
      requiresVerification?: boolean;
      email?: string;
      fullName?: string;
    }>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    // Save tokens and user if login successful with role
    if (response.success && response.data?.accessToken && response.data?.user) {
      await tokenManager.setTokens(
        response.data.accessToken,
        response.data.refreshToken!
      );
      await tokenManager.setUser(response.data.user);
    }

    return response;
  },

  // Forgot password
  async forgotPassword(email: string) {
    return fetchWithAuth<ApiResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // Reset password
  async resetPassword(email: string, otp: string, newPassword: string) {
    return fetchWithAuth<ApiResponse>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    });
  },

  // Change password (authenticated)
  async changePassword(currentPassword: string, newPassword: string) {
    return fetchWithAuth<ApiResponse>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  // Logout
  async logout() {
    try {
      const refreshToken = await tokenManager.getRefreshToken();
      await fetchWithAuth<ApiResponse>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } finally {
      await tokenManager.clearTokens();
    }
  },

  // Get current user
  async getCurrentUser() {
    return fetchWithAuth<ApiResponse<{ user: User }>>('/auth/me');
  },
};

// ============ DOCTOR API ============
export const doctorApi = {
  // Get profile
  async getProfile() {
    return fetchWithAuth<ApiResponse>('/doctor/profile');
  },

  // Get edit profile (full edit DTO)
  async getEditProfile() {
    return fetchWithAuth<ApiResponse>('/doctor/profile/edit');
  },

  // Update personal info
  async updatePersonalInfo(data: any) {
    return fetchWithAuth<ApiResponse>('/doctor/profile/personal', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Update profile overview
  async updateBio(bio: string) {
    return fetchWithAuth<ApiResponse>('/doctor/profile/bio', {
      method: 'PUT',
      body: JSON.stringify({ bio }),
    });
  },

  // Upload avatar
  async uploadAvatar(formData: FormData) {
    const accessToken = await tokenManager.getAccessToken();
    const url = `${API_BASE_URL}/doctor/profile/avatar`;
    console.log('API Request: Upload Avatar');
    console.log('URL:', url);
    console.log('Token:', accessToken ? 'Exists' : 'Missing');
    // console.log('FormData:', JSON.stringify(formData)); 

    // Connectivity check
    try {
      console.log(`Checking connectivity to ${API_BASE_URL}...`);
      const healthCheck = await fetch(`${API_BASE_URL}`, { method: 'GET' });
      console.log('Connectivity check status:', healthCheck.status);
    } catch (err: any) {
      console.error('Connectivity Check Failed:', err.message);
      console.error('Possible causes: Backend not running, wrong IP/Port, firewall blocking.');
      return { success: false, error: `Network Error: Cannot reach server at ${API_BASE_URL}. ${err.message}` };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/json',
          // 'Content-Type': 'multipart/form-data', // Do NOT uncomment
        },
        body: formData,
      });

      console.log('Response Status:', response.status);
      const text = await response.text();
      console.log('Response Body:', text);

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}: ${text}`);
      }

      try {
        return JSON.parse(text);
      } catch (e) {
        console.error('JSON Parse Error:', e);
        return { success: false, error: 'Invalid JSON response from server' };
      }
    } catch (error) {
      console.error('Upload Fetch Error:', error);
      throw error;
    }
  },

  // Phone verification
  async sendPhoneOtp(phoneNumber: string, countryCode: string = '+91') {
    return fetchWithAuth<ApiResponse>('/doctor/phone/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, countryCode }),
    });
  },

  async verifyPhoneOtp(phoneNumber: string, otp: string, countryCode: string = '+91') {
    return fetchWithAuth<ApiResponse>('/doctor/phone/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, otp, countryCode }),
    });
  },

  async updateAadhaarInfo(aadhaarNumber: string) {
    return fetchWithAuth<ApiResponse>('/doctor/profile/aadhaar', {
      method: 'PUT',
      body: JSON.stringify({ aadhaarNumber }),
    });
  },

  async uploadAadhaarDocument(formData: FormData) {
    const accessToken = await tokenManager.getAccessToken();
    const response = await fetch(`${API_BASE_URL}/doctor/profile/aadhaar/document`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });
    return response.json();
  },

  async uploadEducationDocument(educationId: string, formData: FormData) {
    const accessToken = await tokenManager.getAccessToken();
    const response = await fetch(`${API_BASE_URL}/doctor/education/${educationId}/document`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });
    return response.json();
  },

  // Licenses (replaces old medical-license endpoints)
  async addLicense(data: any) {
    return fetchWithAuth<ApiResponse>('/doctor/licensure/licenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateLicense(licenseId: string, data: any) {
    return fetchWithAuth<ApiResponse>(`/doctor/licensure/licenses/${licenseId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteLicense(licenseId: string) {
    return fetchWithAuth<ApiResponse>(`/doctor/licensure/licenses/${licenseId}`, {
      method: 'DELETE',
    });
  },

  async uploadLicenseDocument(licenseId: string, formData: FormData) {
    const accessToken = await tokenManager.getAccessToken();
    const response = await fetch(`${API_BASE_URL}/doctor/licensure/licenses/${licenseId}/document`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });
    return response.json();
  },

  async uploadSkillCertificate(skillId: string, formData: FormData) {
    const accessToken = await tokenManager.getAccessToken();
    const response = await fetch(`${API_BASE_URL}/doctor/skills/${skillId}/certificate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });
    return response.json();
  },

  async uploadExperienceDocument(experienceId: string, formData: FormData) {
    const accessToken = await tokenManager.getAccessToken();
    const response = await fetch(`${API_BASE_URL}/doctor/experience/${experienceId}/document`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });
    return response.json();
  },

  // Get jobs for doctor
  async getJobs(params?: {
    page?: number;
    limit?: number;
    search?: string;
    specialization?: string;
    location?: string;
    jobType?: string;
    salaryMin?: number;
    salaryMax?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return fetchWithAuth<ApiResponse>(`/doctor/jobs${queryString}`);
  },

  // Get job details
  async getJobDetails(jobId: string) {
    return fetchWithAuth<ApiResponse>(`/jobs/${jobId}`);
  },

  // Apply to job
  async applyToJob(jobId: string, coverLetter?: string) {
    return fetchWithAuth<ApiResponse>(`/jobs/${jobId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ coverLetter }),
    });
  },

  // Get applications
  async getApplications(status?: string) {
    const queryString = status ? `?status=${status}` : '';
    return fetchWithAuth<ApiResponse>(`/doctor/applications${queryString}`);
  },

  // Get offer details for an application
  async getOfferDetails(applicationId: string) {
    return fetchWithAuth<ApiResponse>(`/doctor/applications/${applicationId}/offer`);
  },

  // Accept a job offer
  async acceptOffer(applicationId: string) {
    return fetchWithAuth<ApiResponse>(`/doctor/applications/${applicationId}/offer/accept`, {
      method: 'POST',
    });
  },

  // Decline a job offer
  async declineOffer(applicationId: string, reason?: string) {
    return fetchWithAuth<ApiResponse>(`/doctor/applications/${applicationId}/offer/decline`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Withdraw application
  async withdrawApplication(jobId: string) {
    return fetchWithAuth<ApiResponse>(`/jobs/${jobId}/application`, {
      method: 'DELETE',
    });
  },

  // Get active jobs (assignments)
  async getActiveJobs() {
    return fetchWithAuth<ApiResponse>('/doctor/active-jobs');
  },

  // Get schedule
  async getSchedule(assignmentId: string, startDate?: string, endDate?: string) {
    let queryString = '';
    if (startDate || endDate) {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      queryString = '?' + params.toString();
    }
    return fetchWithAuth<ApiResponse>(`/doctor/active-jobs/${assignmentId}/schedule${queryString}`);
  },

  // Mark attendance
  async markAttendance(assignmentId: string, type: 'check-in' | 'check-out', location?: { latitude: number; longitude: number }) {
    return fetchWithAuth<ApiResponse>(`/doctor/assignments/${assignmentId}/attendance`, {
      method: 'POST',
      body: JSON.stringify({ type, location }),
    });
  },

  // Request leave
  async requestLeave(assignmentId: string, data: {
    startDate: string;
    endDate: string;
    reason: string;
    type: string;
  }) {
    return fetchWithAuth<ApiResponse>(`/doctor/assignments/${assignmentId}/leave`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update preferences
  async updatePreferences(preferences: any) {
    return fetchWithAuth<ApiResponse>('/doctor/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  },

  // Add education
  async addEducation(education: any) {
    return fetchWithAuth<ApiResponse>('/doctor/education', {
      method: 'POST',
      body: JSON.stringify(education),
    });
  },

  // Update education
  async updateEducation(educationId: string, education: any) {
    return fetchWithAuth<ApiResponse>(`/doctor/education/${educationId}`, {
      method: 'PUT',
      body: JSON.stringify(education),
    });
  },

  // Add experience
  async addExperience(experience: any) {
    return fetchWithAuth<ApiResponse>('/doctor/experience', {
      method: 'POST',
      body: JSON.stringify(experience),
    });
  },

  // Update experience
  async updateExperience(experienceId: string, experience: any) {
    return fetchWithAuth<ApiResponse>(`/doctor/experience/${experienceId}`, {
      method: 'PUT',
      body: JSON.stringify(experience),
    });
  },

  // Add skill
  async addSkill(skill: any) {
    return fetchWithAuth<ApiResponse>('/doctor/skills', {
      method: 'POST',
      body: JSON.stringify(skill),
    });
  },

  // Update skill
  async updateSkill(skillId: string, skill: any) {
    return fetchWithAuth<ApiResponse>(`/doctor/skills/${skillId}`, {
      method: 'PUT',
      body: JSON.stringify(skill),
    });
  },

  async submitFeedback(assignmentId: string, data: any) {
    return fetchWithAuth<ApiResponse>('/feedback/submit', {
      method: 'POST',
      body: JSON.stringify({ assignmentId, ...data }),
    });
  },
};

// ============ HOSPITAL API ============
export const hospitalApi = {
  // Get profile
  async getProfile() {
    return fetchWithAuth<ApiResponse>('/hospital/profile');
  },

  // Get edit profile
  async getEditProfile() {
    return fetchWithAuth<ApiResponse>('/hospital/profile/edit');
  },

  // Get dashboard stats
  async getDashboard() {
    return fetchWithAuth<ApiResponse>('/hospital/dashboard');
  },

  // Phone verification
  async sendPhoneOtp(phoneNumber: string, countryCode: string = '+91') {
    return fetchWithAuth<ApiResponse>('/hospital/profile/phone/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, countryCode }),
    });
  },

  async verifyPhoneOtp(phoneNumber: string, otp: string, countryCode: string = '+91') {
    return fetchWithAuth<ApiResponse>('/hospital/profile/phone/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, otp, countryCode }),
    });
  },

  // Representative Email verification
  async sendRepresentativeEmailOtp(email: string) {
    return fetchWithAuth<ApiResponse>('/hospital/profile/representative/email/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async verifyRepresentativeEmailOtp(email: string, otp: string) {
    return fetchWithAuth<ApiResponse>('/hospital/profile/representative/email/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  },

  // Update profile (legacy)
  async updateProfile(data: any) {
    const mapped: any = { ...(data || {}) };
    if (mapped.name !== undefined && mapped.hospitalName === undefined) mapped.hospitalName = mapped.name;
    if (mapped.type !== undefined && mapped.hospitalType === undefined) mapped.hospitalType = mapped.type;
    if (mapped.typeOther !== undefined && mapped.hospitalTypeOther === undefined) mapped.hospitalTypeOther = mapped.typeOther;

    // Backend general-info endpoint doesn’t accept these.
    delete mapped.email;
    delete mapped.phone;
    delete mapped.name;
    delete mapped.type;
    delete mapped.typeOther;

    return fetchWithAuth<ApiResponse>('/hospital/profile/general-info', {
      method: 'PUT',
      body: JSON.stringify(mapped),
    });
  },

  // Update general info
  async updateGeneralInfo(data: any) {
    return fetchWithAuth<ApiResponse>('/hospital/profile/general-info', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Update employee details
  async updateEmployee(id: string, data: any) {
    return fetchWithAuth<ApiResponse>(`/hospital/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Update representative details
  async updateRepresentativeDetails(data: any) {
    return fetchWithAuth<ApiResponse>('/hospital/profile/representative', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Update representative Aadhaar
  async updateRepresentativeAadhaar(aadhaarNumber: string) {
    return fetchWithAuth<ApiResponse>('/hospital/profile/representative/aadhaar', {
      method: 'PUT',
      body: JSON.stringify({ aadhaarNumber }),
    });
  },

  // Upload representative Aadhaar document
  // Upload representative Aadhaar document
  async uploadRepresentativeAadhaarDocument(formData: FormData) {
    const accessToken = await tokenManager.getAccessToken();
    const url = `${API_BASE_URL}/hospital/profile/representative/aadhaar/document`;
    console.log('API Request: Upload Rep Aadhaar');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        body: formData,
      });

      console.log('Response Status:', response.status);
      const text = await response.text();

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}: ${text}`);
      }

      return JSON.parse(text);
    } catch (error) {
      console.error('Upload Fetch Error:', error);
      throw error;
    }
  },

  // Update staffing details
  async updateStaffingDetails(data: any) {
    return fetchWithAuth<ApiResponse>('/hospital/profile/staffing', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Update infrastructure details
  async updateInfrastructureDetails(data: any) {
    return fetchWithAuth<ApiResponse>('/hospital/profile/infrastructure-details', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Upload infrastructure photo
  // Upload infrastructure photo
  async uploadInfrastructurePhoto(formData: FormData) {
    const accessToken = await tokenManager.getAccessToken();
    const url = `${API_BASE_URL}/hospital/profile/infrastructure/photo`;
    console.log('API Request: Upload Infra Photo');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        body: formData,
      });

      console.log('Response Status:', response.status);
      const text = await response.text();

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}: ${text}`);
      }

      return JSON.parse(text);
    } catch (error) {
      console.error('Upload Fetch Error:', error);
      throw error;
    }
  },

  // Delete infrastructure photo
  async deleteInfrastructurePhoto(photoId: string) {
    return fetchWithAuth<ApiResponse>(`/hospital/profile/infrastructure/photo/${photoId}`, {
      method: 'DELETE',
    });
  },

  // Update credentials
  async updateCredentials(data: any) {
    return fetchWithAuth<ApiResponse>('/hospital/profile/credentials', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Upload credential document
  // Upload credential document
  async uploadCredentialDocument(docType: string, formData: FormData) {
    const accessToken = await tokenManager.getAccessToken();
    const url = `${API_BASE_URL}/hospital/profile/credentials/${docType}/document`;
    console.log(`API Request: Upload Credential (${docType})`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        body: formData,
      });

      console.log('Response Status:', response.status);
      const text = await response.text();

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}: ${text}`);
      }

      return JSON.parse(text);
    } catch (error) {
      console.error('Upload Fetch Error:', error);
      throw error;
    }
  },

  // Upload logo
  // Upload logo
  async uploadLogo(formData: FormData) {
    const accessToken = await tokenManager.getAccessToken();
    const url = `${API_BASE_URL}/hospital/profile/logo`;
    console.log('API Request: Upload Logo');

    // Connectivity check (mirrored from doctorApi)
    try {
      const healthCheck = await fetch(`${API_BASE_URL}`, { method: 'GET' });
      console.log('Connectivity check status:', healthCheck.status);
    } catch (err: any) {
      console.error('Connectivity Check Failed:', err.message);
      return { success: false, error: `Network Error: Cannot reach server. ${err.message}` };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        body: formData,
      });

      console.log('Response Status:', response.status);
      const text = await response.text();
      console.log('Response Body:', text);

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}: ${text}`);
      }

      try {
        return JSON.parse(text);
      } catch (e) {
        return { success: false, error: 'Invalid JSON response from server' };
      }
    } catch (error) {
      console.error('Upload Fetch Error:', error);
      throw error;
    }
  },

  // Upload banner
  // Upload banner
  async uploadBanner(formData: FormData) {
    const accessToken = await tokenManager.getAccessToken();
    const url = `${API_BASE_URL}/hospital/profile/banner`;
    console.log('API Request: Upload Banner');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        body: formData,
      });

      console.log('Response Status:', response.status);
      const text = await response.text();

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}: ${text}`);
      }

      return JSON.parse(text);
    } catch (error) {
      console.error('Upload Fetch Error:', error);
      throw error;
    }
  },

  // Post a job
  async postJob(jobData: any) {
    return fetchWithAuth<ApiResponse>('/hospital/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
  },

  // Get posted jobs
  async getPostedJobs(params?: {
    page?: number;
    limit?: number;
    status?: string;
    q?: string;
    filterStatus?: string;
    datePosted?: string;
    minApplicants?: number;
    maxApplicants?: number;
  }) {
    // Filter out undefined values to prevent them from being sent as string "undefined"
    const cleanParams: Record<string, string> = {};
    if (params) {
      if (params.page !== undefined) cleanParams.page = String(params.page);
      if (params.limit !== undefined) cleanParams.limit = String(params.limit);
      if (params.status !== undefined && params.status !== '') cleanParams.status = params.status;
      if (params.q !== undefined && params.q !== '') cleanParams.q = params.q;
      if (params.filterStatus !== undefined && params.filterStatus !== '') cleanParams.filterStatus = params.filterStatus;
      if (params.datePosted !== undefined && params.datePosted !== '') cleanParams.datePosted = params.datePosted;
      if (params.minApplicants !== undefined) cleanParams.minApplicants = String(params.minApplicants);
      if (params.maxApplicants !== undefined) cleanParams.maxApplicants = String(params.maxApplicants);
    }
    const queryString = Object.keys(cleanParams).length > 0
      ? '?' + new URLSearchParams(cleanParams).toString()
      : '';
    return fetchWithAuth<ApiResponse>(`/hospital/jobs${queryString}`);
  },

  // Get job details with applications
  async getJobWithApplications(jobId: string) {
    return fetchWithAuth<ApiResponse>(`/hospital/jobs/${jobId}`);
  },

  // Update job
  async updateJob(jobId: string, data: any) {
    return fetchWithAuth<ApiResponse>(`/hospital/jobs/${jobId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Close job
  async closeJob(jobId: string) {
    return fetchWithAuth<ApiResponse>(`/hospital/jobs/${jobId}/close`, {
      method: 'POST',
    });
  },

  // Delete job
  async deleteJob(jobId: string) {
    return fetchWithAuth<ApiResponse>(`/hospital/jobs/${jobId}`, {
      method: 'DELETE',
    });
  },

  // Restore job from trash
  async restoreJob(jobId: string) {
    return fetchWithAuth<ApiResponse>(`/hospital/jobs/${jobId}/restore`, {
      method: 'POST',
    });
  },

  // Permanently delete job
  async deleteJobPermanently(jobId: string) {
    return fetchWithAuth<ApiResponse>(`/hospital/jobs/${jobId}/permanent`, {
      method: 'DELETE',
    });
  },

  // Get applications for a job
  async getApplications(jobId: string, status?: string) {
    const queryString = status ? `?status=${status}` : '';
    return fetchWithAuth<ApiResponse>(`/hospital/jobs/${jobId}/applications${queryString}`);
  },

  // Update application status
  async updateApplicationStatus(
    applicationId: string,
    status:
      | 'under_review'
      | 'shortlisted'
      | 'interview_scheduled'
      | 'interviewed'
      | 'offer_made'
      | 'hired'
      | 'rejected',
    notes?: string
  ) {
    return fetchWithAuth<ApiResponse>(`/hospital/applications/${applicationId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    });
  },

  // Schedule interview
  async scheduleInterview(applicationId: string, interviewData: {
    scheduledAt: string;
    type: 'in_person' | 'video' | 'phone';
    location?: string;
    meetingLink?: string;
    notes?: string;
  }) {
    return fetchWithAuth<ApiResponse>(`/hospital/applications/${applicationId}/interview`, {
      method: 'POST',
      body: JSON.stringify(interviewData),
    });
  },

  // Send job offer with full details
  async sendOffer(applicationId: string, offerData: {
    salary: number;
    salaryType?: 'monthly' | 'annual' | 'hourly' | 'daily';
    currency?: string;
    joiningDate: string;
    reportingDate: string;
    notes?: string;
    offerConfirmationDate: string;
    terms?: string;
  }) {
    return fetchWithAuth<ApiResponse>(`/hospital/applications/${applicationId}/offer`, {
      method: 'POST',
      body: JSON.stringify(offerData),
    });
  },

  // Hire applicant
  async hireApplicant(applicationId: string, assignmentData: {
    startDate: string;
    endDate: string;
    salary: number;
    notes?: string;
  }) {
    return fetchWithAuth<ApiResponse>(`/hospital/applications/${applicationId}/hire`, {
      method: 'POST',
      body: JSON.stringify(assignmentData),
    });
  },

  // Get employees
  async getEmployees(status?: string) {
    const queryString = status ? `?status=${status}` : '';
    return fetchWithAuth<ApiResponse>(`/hospital/employees${queryString}`);
  },

  // Get leave requests
  async getLeaveRequests(params?: { status?: string; assignmentId?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.assignmentId) query.set('assignmentId', params.assignmentId);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return fetchWithAuth<ApiResponse>(`/hospital/leave-requests${queryString}`);
  },

  // Update employee status (assignment status)
  async updateEmployeeStatus(
    assignmentId: string,
    status: 'active' | 'paused' | 'on_leave' | 'completed' | 'terminated',
    reason?: string
  ) {
    return fetchWithAuth<ApiResponse>(`/hospital/employees/${assignmentId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason }),
    });
  },

  // Terminate employee
  async terminateEmployee(assignmentId: string, reason: string) {
    return fetchWithAuth<ApiResponse>(`/hospital/employees/${assignmentId}/terminate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Approve/reject leave request
  async handleLeaveRequest(leaveId: string, action: 'approve' | 'reject', notes?: string) {
    const status = action === 'approve' ? 'approved' : 'rejected';
    return fetchWithAuth<ApiResponse>(`/hospital/leave-requests/${leaveId}`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason: notes }),
    });
  },

  // Search candidates (private - hospital)
  async searchCandidates(params?: {
    page?: number;
    limit?: number;
    q?: string;
    specialization?: string;
    city?: string;
    state?: string;
    minExperience?: number;
    maxExperience?: number;
    experience?: number;
    skills?: string;
    availability?: boolean;
    isAvailable?: boolean;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.q) query.set('q', params.q);
    if (params?.specialization) query.set('specialization', params.specialization);
    if (params?.city) query.set('city', params.city);
    if (params?.state) query.set('state', params.state);

    // Handle experience parameters - support both minExperience and experience (for backward compatibility)
    if (params?.minExperience !== undefined) {
      query.set('experience', String(params.minExperience));
    } else if (params?.experience !== undefined) {
      query.set('experience', String(params.experience));
    }

    if (params?.skills) query.set('skills', params.skills);

    // Handle availability - support both isAvailable and availability (for backward compatibility)
    if (params?.isAvailable !== undefined) {
      query.set('availability', String(params.isAvailable));
    } else if (params?.availability !== undefined) {
      query.set('availability', String(params.availability));
    }

    // Handle sorting
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.sortOrder) query.set('sortOrder', params.sortOrder);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return fetchWithAuth<ApiResponse>(`/hospital/candidates${queryString}`);
  },

  // Candidate details (private - hospital)
  async getCandidateDetails(candidateId: string) {
    return fetchWithAuth<ApiResponse>(`/hospital/candidates/${candidateId}`);
  },

  // Get employee attendance history
  async getEmployeeAttendance(assignmentId: string, page: number = 1) {
    return fetchWithAuth<ApiResponse>(`/hospital/employees/${assignmentId}/attendance?page=${page}`);
  },

  // Get today's attendance status for employee
  async getEmployeeTodayStatus(assignmentId: string) {
    return fetchWithAuth<ApiResponse>(`/hospital/employees/${assignmentId}/attendance/today`);
  },

  // Get today's attendance status for multiple employees
  async getEmployeesTodayStatusBulk(assignmentIds: string[]) {
    return fetchWithAuth<ApiResponse>(`/hospital/employees/attendance/today/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ assignmentIds }),
    });
  },

  // Mark attendance for employee
  async markEmployeeAttendance(assignmentId: string, data: {
    status: 'present' | 'checked_in' | 'checked_out' | 'absent' | 'half_day';
    notes?: string;
    checkInTime?: string;
    checkOutTime?: string;
  }) {
    return fetchWithAuth<ApiResponse>(`/hospital/employees/${assignmentId}/attendance`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get employee schedule
  async getEmployeeSchedule(assignmentId: string, startDate?: string, endDate?: string) {
    let queryString = '';
    if (startDate || endDate) {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      queryString = '?' + params.toString();
    }
    return fetchWithAuth<ApiResponse>(`/hospital/employees/${assignmentId}/schedule${queryString}`);
  },

  // Add schedule entry
  async addScheduleEntry(assignmentId: string, data: {
    date: string;
    startTime: string;
    endTime: string;
    isWorkDay: boolean;
    notes?: string;
  }) {
    return fetchWithAuth<ApiResponse>(`/hospital/employees/${assignmentId}/schedule`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Add multiple schedule entries (bulk)
  async addScheduleEntries(assignmentId: string, entries: Array<{
    date: string;
    startTime: string;
    endTime: string;
    isWorkDay: boolean;
    notes?: string;
  }>) {
    return fetchWithAuth<ApiResponse>(`/hospital/employees/${assignmentId}/schedule/bulk`, {
      method: 'POST',
      body: JSON.stringify({ entries }),
    });
  },

  // Update schedule entry
  async updateScheduleEntry(assignmentId: string, scheduleId: string, data: {
    startTime?: string;
    endTime?: string;
    isWorkDay?: boolean;
    notes?: string;
  }) {
    return fetchWithAuth<ApiResponse>(`/hospital/employees/${assignmentId}/schedule/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete schedule entry
  async deleteScheduleEntry(assignmentId: string, scheduleId: string) {
    return fetchWithAuth<ApiResponse>(`/hospital/employees/${assignmentId}/schedule/${scheduleId}`, {
      method: 'DELETE',
    });
  },

  async submitFeedback(assignmentId: string, data: any) {
    return fetchWithAuth<ApiResponse>('/feedback/submit', {
      method: 'POST',
      body: JSON.stringify({ assignmentId, ...data }),
    });
  },
};

// ============ JOBS API (Public) ============
export const jobsApi = {
  // Search jobs (public)
  async searchJobs(params?: {
    page?: number;
    limit?: number;
    search?: string;
    specialization?: string;
    location?: string;
    jobType?: string;
    salaryMin?: number;
    salaryMax?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('q', params.search);
    if (params?.specialization) query.set('specialization', params.specialization);
    if (params?.location) {
      const [city] = params.location.split(',').map(s => s.trim());
      if (city) query.set('city', city);
    }
    if (params?.jobType) query.set('jobType', params.jobType);
    if (params?.salaryMin !== undefined) query.set('minSalary', String(params.salaryMin));
    if (params?.salaryMax !== undefined) query.set('maxSalary', String(params.salaryMax));

    if (params?.sortBy) {
      const sortField = params.sortBy;
      const sort = params.sortOrder === 'asc' ? sortField : `-${sortField}`;
      query.set('sortBy', sort);
    }

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return fetchWithAuth<ApiResponse>(`/jobs${queryString}`);
  },

  // Get job details
  async getJobDetails(jobId: string) {
    return fetchWithAuth<ApiResponse>(`/jobs/${jobId}`);
  },

  // Get filters
  async getFilters() {
    return fetchWithAuth<ApiResponse>('/jobs/filters');
  },

  // Get featured jobs
  async getFeaturedJobs() {
    return fetchWithAuth<ApiResponse>('/jobs/featured');
  },

  // Get recent jobs
  async getRecentJobs() {
    return fetchWithAuth<ApiResponse>('/jobs/recent');
  },

  // Get similar jobs
  async getSimilarJobs(jobId: string) {
    return fetchWithAuth<ApiResponse>(`/jobs/${jobId}/similar`);
  },
};

// ============ PUBLIC SEARCH API ============
export const searchApi = {
  async searchHospitals(params?: {
    q?: string;
    page?: number;
    limit?: number;
    city?: string;
    state?: string;
    hospitalType?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.city) query.set('city', params.city);
    if (params?.state) query.set('state', params.state);
    if (params?.hospitalType) query.set('hospitalType', params.hospitalType);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return fetchWithAuth<ApiResponse>(`/search/hospitals${queryString}`);
  },

  async getHospitalPublicProfile(id: string) {
    return fetchWithAuth<ApiResponse>(`/search/hospitals/${id}`);
  },

  async searchDoctors(params?: {
    q?: string;
    page?: number;
    limit?: number;
    specialization?: string;
    city?: string;
    availability?: boolean;
  }) {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.specialization) query.set('specialization', params.specialization);
    if (params?.city) query.set('city', params.city);
    if (params?.availability !== undefined) query.set('availability', String(params.availability));

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return fetchWithAuth<ApiResponse>(`/search/doctors${queryString}`);
  },
};

export default {
  auth: authApi,
  doctor: doctorApi,
  hospital: hospitalApi,
  jobs: jobsApi,
  search: searchApi,
};
// ============ ATTENDANCE API ============
export const attendanceApi = {
  // Check In (Doctor)
  async checkIn(assignmentId: string, location?: { latitude: number; longitude: number; }) {
    return fetchWithAuth<ApiResponse>('/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify({ assignmentId, location }),
    });
  },

  // Check Out (Doctor)
  async checkOut(assignmentId: string, location?: { latitude: number; longitude: number; }, notes?: string) {
    return fetchWithAuth<ApiResponse>('/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify({ assignmentId, location, notes }),
    });
  },

  // Get Today's Status
  async getTodayStatus(assignmentId: string) {
    return fetchWithAuth<ApiResponse>(`/attendance/status/${assignmentId}`);
  },

  // Get History
  async getHistory(assignmentId: string, page: number = 1) {
    return fetchWithAuth<ApiResponse>(`/attendance/history/${assignmentId}?page=${page}`);
  },

  // ===== Hospital Attendance Approval APIs =====

  // Get Pending Attendance Requests (Hospital)
  async getPendingRequests(page: number = 1, limit: number = 20) {
    return fetchWithAuth<ApiResponse>(`/hospital/attendance/pending?page=${page}&limit=${limit}`);
  },

  // Confirm Check-in (Hospital)
  async confirmCheckIn(attendanceId: string) {
    return fetchWithAuth<ApiResponse>(`/hospital/attendance/${attendanceId}/confirm-checkin`, {
      method: 'POST',
    });
  },

  // Confirm Check-out (Hospital)
  async confirmCheckOut(attendanceId: string) {
    return fetchWithAuth<ApiResponse>(`/hospital/attendance/${attendanceId}/confirm-checkout`, {
      method: 'POST',
    });
  },

  // Cancel Attendance (Hospital)
  async cancelAttendance(attendanceId: string, reason?: string) {
    return fetchWithAuth<ApiResponse>(`/hospital/attendance/${attendanceId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Mark Absent for existing record (Hospital)
  async markAbsent(attendanceId: string, reason?: string) {
    return fetchWithAuth<ApiResponse>(`/hospital/attendance/${attendanceId}/mark-absent`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Create Absent Record for employee (Hospital)
  async createAbsentRecord(assignmentId: string, date?: string, reason?: string) {
    return fetchWithAuth<ApiResponse>(`/hospital/employees/${assignmentId}/mark-absent`, {
      method: 'POST',
      body: JSON.stringify({ date, reason }),
    });
  },
};

// ============ LEAVE API ============
export const leaveApi = {
  async requestLeave(data: {
    assignmentId: string;
    leaveType: string;
    startDate: Date;
    endDate: Date;
    reason: string;
    isHalfDay?: boolean;
    halfDayPeriod?: string;
  }) {
    return fetchWithAuth<ApiResponse>('/doctor/leave-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assignmentId: data.assignmentId,
        leaveType: data.leaveType,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
        reason: data.reason,
        isHalfDay: data.isHalfDay || false,
        halfDayPeriod: data.halfDayPeriod,
      }),
    });
  },

  async getMyRequests(assignmentId?: string, status?: string) {
    let url = '/leave/my-requests';
    const params = [];
    if (assignmentId) params.push(`assignmentId=${assignmentId}`);
    if (status) params.push(`status=${status}`);
    if (params.length > 0) url += '?' + params.join('&');
    return fetchWithAuth<ApiResponse>(url);
  },
};

// ============ MESSAGING API ============
export const messageApi = {
  // Get conversations
  async getConversations(page: number = 1, limit: number = 20) {
    return fetchWithAuth<ApiResponse>(`/messages/conversations?page=${page}&limit=${limit}`);
  },

  // Get single conversation
  async getConversation(conversationId: string) {
    return fetchWithAuth<ApiResponse>(`/messages/conversations/${conversationId}`);
  },

  // Create or get conversation
  async createConversation(data: {
    participantId: string;
    jobId?: string;
    applicationId?: string;
    type?: string;
    initialMessage?: string;
  }) {
    return fetchWithAuth<ApiResponse>('/messages/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get messages for a conversation
  async getMessages(conversationId: string, page: number = 1, limit: number = 50) {
    return fetchWithAuth<ApiResponse>(`/messages/conversations/${conversationId}/messages?page=${page}&limit=${limit}`);
  },

  // Send message
  async sendMessage(conversationId: string, content: string, type: string = 'text', metadata?: any) {
    return fetchWithAuth<ApiResponse>(`/messages/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, type, metadata }),
    });
  },

  // Mark messages as read
  async markAsRead(conversationId: string) {
    return fetchWithAuth<ApiResponse>(`/messages/conversations/${conversationId}/read`, {
      method: 'POST',
    });
  },

  // Get unread count
  async getUnreadCount() {
    return fetchWithAuth<ApiResponse>('/messages/unread-count');
  },

  // Delete message
  async deleteMessage(messageId: string) {
    return fetchWithAuth<ApiResponse>(`/messages/${messageId}`, {
      method: 'DELETE',
    });
  },

  // Send invitation (hospital)
  async sendInvitation(doctorId: string, jobId: string, message?: string) {
    return fetchWithAuth<ApiResponse>('/messages/invite', {
      method: 'POST',
      body: JSON.stringify({ doctorId, jobId, message }),
    });
  },

  // Get pending invitations (doctor)
  async getPendingInvitations(page: number = 1, limit: number = 20) {
    return fetchWithAuth<ApiResponse>(`/messages/invitations?page=${page}&limit=${limit}`);
  },

  // Accept invitation (doctor)
  async acceptInvitation(conversationId: string) {
    return fetchWithAuth<ApiResponse>(`/messages/invitations/${conversationId}/accept`, {
      method: 'POST',
    });
  },

  // Decline invitation (doctor)
  async declineInvitation(conversationId: string) {
    return fetchWithAuth<ApiResponse>(`/messages/invitations/${conversationId}/decline`, {
      method: 'POST',
    });
  },

  // Archive conversation
  async archiveConversation(conversationId: string) {
    return fetchWithAuth<ApiResponse>(`/messages/conversations/${conversationId}/archive`, {
      method: 'POST',
    });
  },

  // Search messages
  async searchMessages(query: string, limit: number = 20) {
    return fetchWithAuth<ApiResponse>(`/messages/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  },

  // Get conversation with a specific hospital (for doctor)
  async getConversationWithHospital(hospitalId: string, jobId?: string) {
    const params = new URLSearchParams({ hospitalId });
    if (jobId) params.append('jobId', jobId);
    return fetchWithAuth<ApiResponse>(`/messages/conversations/with-hospital?${params.toString()}`);
  },
};

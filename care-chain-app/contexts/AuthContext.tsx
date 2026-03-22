// contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { authApi, tokenManager, User, ApiError, setSessionExpiredCallback } from '../services/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  // Auth actions
  signup: (fullName: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  verifyEmail: (email: string, otp: string) => Promise<{ success: boolean; user?: User; requiresRoleSelection?: boolean; error?: string }>;
  resendOTP: (email: string, type?: 'email_verification' | 'password_reset') => Promise<{ success: boolean; error?: string }>;
  selectRole: (email: string, role: 'doctor' | 'hospital') => Promise<{ success: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{
    success: boolean;
    user?: User;
    requiresRoleSelection?: boolean;
    requiresVerification?: boolean;
    email?: string;
    fullName?: string;
    error?: string
  }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();

    // Auto-logout if API returns 401
    setSessionExpiredCallback(() => {
      logout();
    });
  }, []);

  const checkAuthStatus = async () => {
    try {
      console.log('Checking auth status...');
      const [accessToken, user] = await Promise.all([
        tokenManager.getAccessToken(),
        tokenManager.getUser(),
      ]);
      console.log('Auth check results:', { hasToken: !!accessToken, hasUser: !!user });

      // If we have a token but no cached user, try fetching the current user.
      if (accessToken && !user) {
        console.log('Token found but no user, fetching current user...');
        try {
          const me = await authApi.getCurrentUser();
          if (me.data?.user) {
            console.log('Fetched user from API, updating cache');
            await tokenManager.setUser(me.data.user);
            setState({ user: me.data.user, isLoading: false, isAuthenticated: true });
            return;
          }
        } catch (error) {
          console.error('Failed to fetch user with existing token:', error);
          // Fall through to clearing state below.
        }
      }

      if (accessToken && user) {
        console.log('Restoring authenticated session for:', user.email);
        setState({ user, isLoading: false, isAuthenticated: true });
      } else {
        console.log('No valid session found');
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  };

  const signup = useCallback(async (fullName: string, email: string, password: string) => {
    try {
      const response = await authApi.signup(fullName, email, password);
      return { success: true };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Signup failed';
      return { success: false, error: message };
    }
  }, []);

  const verifyEmail = useCallback(async (email: string, otp: string) => {
    try {
      const response = await authApi.verifyEmail(email, otp);

      if (response.data?.requiresRoleSelection) {
        return { success: true, requiresRoleSelection: true };
      }

      // If user already has role, tokens would be set
      if (response.data?.user) {
        setState({
          user: response.data.user,
          isLoading: false,
          isAuthenticated: true,
        });
        return { success: true, user: response.data.user };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Verification failed';
      return { success: false, error: message };
    }
  }, []);

  const resendOTP = useCallback(async (email: string, type: 'email_verification' | 'password_reset' = 'email_verification') => {
    try {
      await authApi.resendOTP(email, type);
      return { success: true };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to resend OTP';
      return { success: false, error: message };
    }
  }, []);

  const selectRole = useCallback(async (email: string, role: 'doctor' | 'hospital') => {
    try {
      const response = await authApi.selectRole(email, role);

      if (response.data?.user) {
        setState({
          user: response.data.user,
          isLoading: false,
          isAuthenticated: true,
        });
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Role selection failed';
      return { success: false, error: message };
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);

      if (response.data?.requiresRoleSelection) {
        return {
          success: true,
          requiresRoleSelection: true,
          email: response.data.email,
          fullName: response.data.fullName,
        };
      }

      if (response.data?.requiresVerification) {
        return {
          success: true,
          requiresVerification: true,
          email: response.data.email,
        };
      }

      if (response.data?.user) {
        setState({
          user: response.data.user,
          isLoading: false,
          isAuthenticated: true,
        });
        return { success: true, user: response.data.user };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Login failed';
      return { success: false, error: message };
    }
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    try {
      await authApi.forgotPassword(email);
      return { success: true };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to send reset email';
      return { success: false, error: message };
    }
  }, []);

  const resetPassword = useCallback(async (email: string, otp: string, newPassword: string) => {
    try {
      await authApi.resetPassword(email, otp, newPassword);
      return { success: true };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Password reset failed';
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
      // Use dynamic import to avoid navigation context issues
      try {
        const { router } = require('expo-router');
        router.replace('/(auth)/login');
      } catch (e) {
        console.warn('Navigation not available during logout');
      }
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await authApi.getCurrentUser();
      if (response.data?.user) {
        await tokenManager.setUser(response.data.user);
        setState(prev => ({
          ...prev,
          user: response.data!.user,
        }));
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, []);

  // Memoize context value so consumers only re-render when state or actions change
  const contextValue = useMemo(() => ({
    ...state,
    signup,
    verifyEmail,
    resendOTP,
    selectRole,
    login,
    forgotPassword,
    resetPassword,
    logout,
    refreshUser,
  }), [state, signup, verifyEmail, resendOTP, selectRole, login, forgotPassword, resetPassword, logout, refreshUser]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;

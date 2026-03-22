// hooks/useAttendance.ts
import { useState, useCallback, useEffect } from 'react';
import { attendanceApi, ApiError } from '../services/api';
import { setSocketEventHandlers, clearSocketEventHandlers, AttendanceNotification } from '../services/socket';

export interface AttendanceRecord {
    id: string;
    doctor: string;
    assignment: string;
    date: string;
    checkIn: {
        time: string;
        location?: {
            type: string;
            coordinates: number[];
        };
    };
    checkOut?: {
        time: string;
        location?: {
            type: string;
            coordinates: number[];
        };
    };
    status: string;
    workDuration?: {
        hours: number;
        minutes: number;
    };
    isApproved?: boolean;
    approvedAt?: string;
}

// Extended status to include pending states
export type AttendanceStatus = 
    | 'none' 
    | 'checkin_pending' 
    | 'checked_in' 
    | 'checkout_pending' 
    | 'checked_out'
    | 'absent'
    | 'cancelled';

export type ApprovalStatus = 'none' | 'pending' | 'confirmed' | 'cancelled' | 'absent';

export function useAttendance(assignmentId: string) {
    const [status, setStatus] = useState<AttendanceStatus>('none');
    const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>('none');
    const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
    const [history, setHistory] = useState<AttendanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);

    const fetchStatus = useCallback(async () => {
        if (!assignmentId) return;

        setIsLoading(true);
        setError(null);
        try {
            const response = await attendanceApi.getTodayStatus(assignmentId);
            if (response.success) {
                setStatus(response.data.status as AttendanceStatus);
                setApprovalStatus(response.data.approvalStatus as ApprovalStatus);
                setTodayRecord(response.data.attendance);
            }
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'Failed to fetch status';
            // Don't set global error for status check as it might just be no record
        } finally {
            setIsLoading(false);
        }
    }, [assignmentId]);

    const fetchHistory = useCallback(async (page = 1) => {
        if (!assignmentId) return;

        setIsLoading(true);
        try {
            const response = await attendanceApi.getHistory(assignmentId, page);
            if (response.success) {
                // Handle paginated response
                const items = Array.isArray(response.data)
                    ? response.data
                    : (response.data as any).items || [];

                setHistory(items);
            }
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'Failed to fetch history';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [assignmentId]);

    const checkIn = useCallback(async (location?: { latitude: number; longitude: number }) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await attendanceApi.checkIn(assignmentId, location);
            if (response.success) {
                await fetchStatus(); // Update status
                setNotification(response.data?.message || 'Check-in recorded - awaiting hospital confirmation');
                return { success: true, message: response.data?.message };
            }
            return { success: false, error: 'Failed to check in' };
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'Failed to check in';
            setError(message);
            return { success: false, error: message };
        } finally {
            setIsLoading(false);
        }
    }, [assignmentId, fetchStatus]);

    const checkOut = useCallback(async (location?: { latitude: number; longitude: number }, notes?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await attendanceApi.checkOut(assignmentId, location, notes);
            if (response.success) {
                await fetchStatus(); // Update status
                setNotification(response.data?.message || 'Check-out recorded - awaiting hospital confirmation');
                return { success: true, message: response.data?.message };
            }
            return { success: false, error: 'Failed to check out' };
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'Failed to check out';
            setError(message);
            return { success: false, error: message };
        } finally {
            setIsLoading(false);
        }
    }, [assignmentId, fetchStatus]);

    // Handle real-time socket notifications
    useEffect(() => {
        const handleCheckInConfirmed = (data: AttendanceNotification) => {
            if (data.assignmentId === assignmentId) {
                setStatus('checked_in');
                setApprovalStatus('confirmed');
                setNotification(data.message);
                fetchStatus(); // Refresh full status
            }
        };

        const handleCheckOutConfirmed = (data: AttendanceNotification) => {
            if (data.assignmentId === assignmentId) {
                setStatus('checked_out');
                setApprovalStatus('confirmed');
                setNotification(data.message);
                fetchStatus();
            }
        };

        const handleAttendanceCancelled = (data: AttendanceNotification) => {
            if (data.assignmentId === assignmentId) {
                setStatus('cancelled');
                setApprovalStatus('cancelled');
                setNotification(data.message);
                fetchStatus();
            }
        };

        const handleMarkedAbsent = (data: AttendanceNotification) => {
            if (data.assignmentId === assignmentId) {
                setStatus('absent');
                setApprovalStatus('absent');
                setNotification(data.message);
                fetchStatus();
            }
        };

        setSocketEventHandlers({
            onAttendanceCheckInConfirmed: handleCheckInConfirmed,
            onAttendanceCheckOutConfirmed: handleCheckOutConfirmed,
            onAttendanceCancelled: handleAttendanceCancelled,
            onAttendanceMarkedAbsent: handleMarkedAbsent,
        });

        return () => {
            clearSocketEventHandlers([
                'onAttendanceCheckInConfirmed',
                'onAttendanceCheckOutConfirmed',
                'onAttendanceCancelled',
                'onAttendanceMarkedAbsent',
            ]);
        };
    }, [assignmentId, fetchStatus]);

    useEffect(() => {
        if (assignmentId) {
            fetchStatus();
            fetchHistory();
        }
    }, [assignmentId, fetchStatus, fetchHistory]);

    const clearNotification = useCallback(() => {
        setNotification(null);
    }, []);

    return {
        status,
        approvalStatus,
        todayRecord,
        history,
        isLoading,
        error,
        notification,
        checkIn,
        checkOut,
        clearNotification,
        refresh: () => { fetchStatus(); fetchHistory(); }
    };
}

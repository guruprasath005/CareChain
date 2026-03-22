import { useState, useEffect, useCallback } from 'react';
import { leaveApi, ApiError } from '../services/api';

export interface LeaveRequest {
    id: string;
    assignment: {
        _id: string;
        title: string;
        hospital: string; // Assuming populated name or ID
    };
    leaveType: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    reason: string;
    createdAt: string;
}

export function useLeave(assignmentId?: string) {
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchRequests = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await leaveApi.getMyRequests(assignmentId);
            if (response.success && response.data?.requests) {
                setRequests(response.data.requests);
            }
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'Failed to fetch leave requests';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [assignmentId]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const requestLeave = async (data: {
        assignmentId: string;
        leaveType: string;
        startDate: Date;
        endDate: Date;
        reason: string;
        isHalfDay?: boolean;
        halfDayPeriod?: string;
    }) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await leaveApi.requestLeave(data);
            if (response.success) {
                await fetchRequests(); // Refresh list
                return { success: true };
            }
            return { success: false, error: 'Failed to request leave' };
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'Failed to request leave';
            setError(message);
            return { success: false, error: message };
        } finally {
            setIsLoading(false);
        }
    };

    return {
        requests,
        isLoading,
        error,
        requestLeave,
        refresh: fetchRequests
    };
}

import { useState, useCallback } from 'react';
import { doctorApi, hospitalApi, ApiError } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export interface ScheduleEntry {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    isWorkDay: boolean;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface UseEmployeeScheduleReturn {
    schedule: ScheduleEntry[];
    isLoading: boolean;
    error: string | null;
    fetchSchedule: (startDate?: string, endDate?: string) => Promise<void>;
    addEntry: (data: Omit<ScheduleEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; error?: string }>;
    addEntries: (entries: Array<Omit<ScheduleEntry, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<{ success: boolean; error?: string }>;
    updateEntry: (scheduleId: string, data: Partial<Omit<ScheduleEntry, 'id' | 'date' | 'createdAt' | 'updatedAt'>>) => Promise<{ success: boolean; error?: string }>;
    deleteEntry: (scheduleId: string) => Promise<{ success: boolean; error?: string }>;
}

export function useEmployeeSchedule(assignmentId: string): UseEmployeeScheduleReturn {
    const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();
    const isDoctor = user?.role === 'doctor';

    const fetchSchedule = useCallback(async (startDate?: string, endDate?: string) => {
        if (!assignmentId) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = isDoctor
                ? await doctorApi.getSchedule(assignmentId, startDate, endDate)
                : await hospitalApi.getEmployeeSchedule(assignmentId, startDate, endDate);

            if (response.success && response.data) {
                const raw = (response.data as any).schedule;
                const scheduleData = Array.isArray(raw)
                    ? raw
                    : Array.isArray(raw?.entries)
                        ? raw.entries
                        : [];
                setSchedule(scheduleData);
            } else {
                setError(response.error || 'Failed to fetch schedule');
                setSchedule([]);
            }
        } catch (err: any) {
            const message = err instanceof ApiError ? err.message : 'An error occurred while fetching schedule';
            setError(message);
            setSchedule([]);
        } finally {
            setIsLoading(false);
        }
    }, [assignmentId, isDoctor]);

    const addEntry = useCallback(async (data: Omit<ScheduleEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
        if (!assignmentId) return { success: false, error: 'No assignment ID' };
        if (isDoctor) return { success: false, error: 'Doctors cannot edit schedules' };

        try {
            const response = await hospitalApi.addScheduleEntry(assignmentId, data);

            if (response.success) {
                await fetchSchedule();
                return { success: true };
            }
            return { success: false, error: response.error || 'Failed to add schedule entry' };
        } catch (err: any) {
            const message = err instanceof ApiError ? err.message : 'An error occurred';
            return { success: false, error: message };
        }
    }, [assignmentId, fetchSchedule, isDoctor]);

    const addEntries = useCallback(async (entries: Array<Omit<ScheduleEntry, 'id' | 'createdAt' | 'updatedAt'>>) => {
        if (!assignmentId) return { success: false, error: 'No assignment ID' };
        if (isDoctor) return { success: false, error: 'Doctors cannot edit schedules' };

        try {
            const response = await hospitalApi.addScheduleEntries(assignmentId, entries);
            if (response.success) {
                await fetchSchedule();
                return { success: true };
            }
            return { success: false, error: response.error || 'Failed to add schedule entries' };
        } catch (err: any) {
            const message = err instanceof ApiError ? err.message : 'An error occurred';
            return { success: false, error: message };
        }
    }, [assignmentId, fetchSchedule, isDoctor]);

    const updateEntry = useCallback(async (scheduleId: string, data: Partial<Omit<ScheduleEntry, 'id' | 'date' | 'createdAt' | 'updatedAt'>>) => {
        if (!assignmentId) return { success: false, error: 'No assignment ID' };
        if (isDoctor) return { success: false, error: 'Doctors cannot edit schedules' };

        try {
            const response = await hospitalApi.updateScheduleEntry(assignmentId, scheduleId, data);
            if (response.success) {
                await fetchSchedule();
                return { success: true };
            }
            return { success: false, error: response.error || 'Failed to update schedule entry' };
        } catch (err: any) {
            const message = err instanceof ApiError ? err.message : 'An error occurred';
            return { success: false, error: message };
        }
    }, [assignmentId, fetchSchedule, isDoctor]);

    const deleteEntry = useCallback(async (scheduleId: string) => {
        if (!assignmentId) return { success: false, error: 'No assignment ID' };
        if (isDoctor) return { success: false, error: 'Doctors cannot edit schedules' };

        try {
            const response = await hospitalApi.deleteScheduleEntry(assignmentId, scheduleId);
            if (response.success) {
                await fetchSchedule();
                return { success: true };
            }
            return { success: false, error: response.error || 'Failed to delete schedule entry' };
        } catch (err: any) {
            const message = err instanceof ApiError ? err.message : 'An error occurred';
            return { success: false, error: message };
        }
    }, [assignmentId, fetchSchedule, isDoctor]);

    return {
        schedule,
        isLoading,
        error,
        fetchSchedule,
        addEntry,
        addEntries,
        updateEntry,
        deleteEntry,
    };
}

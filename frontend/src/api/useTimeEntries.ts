import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { TimeEntry } from './types';

export function useMyTimeEntries(from?: string, to?: string) {
  return useQuery({
    queryKey: ['time-entries', { from, to }],
    queryFn: () => api.get<TimeEntry[]>('/time-entries', { from, to }),
  });
}

export interface CreateTimeEntryInput {
  projectId: string;
  workDate: string;
  startMinute: number;
  endMinute: number;
}

export function useCreateTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTimeEntryInput) => api.post<TimeEntry>('/time-entries', dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-entries'] }),
  });
}

export function useUpdateTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string; projectId?: string; startMinute?: number; endMinute?: number }) =>
      api.patch<TimeEntry>(`/time-entries/${id}`, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-entries'] }),
  });
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/time-entries/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-entries'] }),
  });
}

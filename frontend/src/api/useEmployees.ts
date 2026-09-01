import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { ManagerAssignment, ManagerEdge, Member, TimeEntry } from './types';

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<Member[]>('/employees'),
  });
}

export function useMyTeam() {
  return useQuery({
    queryKey: ['employees', 'my-team'],
    queryFn: () => api.get<ManagerEdge[]>('/employees/my-team'),
  });
}

export function useMyTeamTimeEntries(from?: string, to?: string) {
  return useQuery({
    queryKey: ['employees', 'my-team', 'time-entries', { from, to }],
    queryFn: () => api.get<TimeEntry[]>('/employees/my-team/time-entries', { from, to }),
  });
}

export function useManagerAssignments() {
  return useQuery({
    queryKey: ['employees', 'managers'],
    queryFn: () => api.get<ManagerAssignment[]>('/employees/managers'),
  });
}

export function useCreateManagerEdge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { managerId: string; employeeId: string }) => api.post<void>('/employees/managers', dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useRemoveManagerEdge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (edgeId: string) => api.delete<void>(`/employees/managers/${edgeId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });
}

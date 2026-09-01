import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { Project, ProjectAssignee, ProjectKind, TimeEntry } from './types';

export function useProjects(kind?: ProjectKind) {
  return useQuery({
    queryKey: ['projects', { kind }],
    queryFn: () => api.get<Project[]>('/projects', { kind }),
  });
}

export function useMyProjects() {
  return useQuery({
    queryKey: ['projects', 'mine'],
    queryFn: () => api.get<Project[]>('/projects/mine'),
  });
}

export function useManagedProjects() {
  return useQuery({
    queryKey: ['projects', 'managed'],
    queryFn: () => api.get<Project[]>('/projects/managed'),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { kind: ProjectKind; name: string; parentProjectId?: string }) =>
      api.post<Project>('/projects', dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string; name?: string; isArchived?: boolean }) =>
      api.patch<Project>(`/projects/${id}`, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/projects/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useProjectAssignments(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projects', projectId, 'assignments'],
    queryFn: () => api.get<ProjectAssignee[]>(`/projects/${projectId}/assignments`),
    enabled: !!projectId,
  });
}

export function useAssignEmployee(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.post<void>(`/projects/${projectId}/assignments`, { userId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'assignments'] }),
  });
}

export function useUnassignEmployee(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete<void>(`/projects/${projectId}/assignments/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'assignments'] }),
  });
}

export function useProjectManagers(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projects', projectId, 'managers'],
    queryFn: () => api.get<ProjectAssignee[]>(`/projects/${projectId}/managers`),
    enabled: !!projectId,
  });
}

export function useAssignManager(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.post<void>(`/projects/${projectId}/managers`, { userId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId] }),
  });
}

export function useUnassignManager(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete<void>(`/projects/${projectId}/managers/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId] }),
  });
}

export function useProjectTimeEntries(projectId: string | undefined, from?: string, to?: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'time-entries', { from, to }],
    queryFn: () => api.get<TimeEntry[]>(`/projects/${projectId}/time-entries`, { from, to }),
    enabled: !!projectId,
  });
}

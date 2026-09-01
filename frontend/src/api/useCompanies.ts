import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { ME_QUERY_KEY } from './useMe';
import { Company, CompanyRole, Member } from './types';

export function useOnboardStandalone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>('/onboarding/standalone'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  });
}

export function useOnboardCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (companyName: string) => api.post<Company>('/onboarding/company', { companyName }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  });
}

export function useCurrentCompany(enabled: boolean) {
  return useQuery({
    queryKey: ['companies', 'current'],
    queryFn: () => api.get<Company>('/companies/current'),
    enabled,
  });
}

export function useRenameCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.patch<Company>('/companies/current', { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies', 'current'] }),
  });
}

export function useCompanyMembers(enabled: boolean) {
  return useQuery({
    queryKey: ['companies', 'current', 'members'],
    queryFn: () => api.get<Member[]>('/companies/current/members'),
    enabled,
  });
}

export function useAddMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => api.post<Member>('/companies/current/members', { email }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies', 'current', 'members'] }),
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete<void>(`/companies/current/members/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies', 'current', 'members'] }),
  });
}

export function useUpdateMemberRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: CompanyRole[] }) =>
      api.patch<Member>(`/companies/current/members/${userId}/roles`, { roles }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies', 'current', 'members'] });
      queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { Locale, Me } from './types';

export const ME_QUERY_KEY = ['me'];

export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => api.get<Me>('/me'),
    enabled,
    retry: false,
  });
}

export function useUpdateLocale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (locale: Locale) => api.patch<Me>('/me/locale', { locale }),
    onSuccess: (me) => queryClient.setQueryData(ME_QUERY_KEY, me),
  });
}

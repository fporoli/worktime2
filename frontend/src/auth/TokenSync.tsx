import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { tokenHolder } from '../api/client';

export function TokenSync() {
  const auth = useAuth();

  useEffect(() => {
    tokenHolder.token = auth.user?.access_token;
  }, [auth.user]);

  return null;
}

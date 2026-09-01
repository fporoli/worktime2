import { Alert } from '@mantine/core';
import { useAuth } from 'react-oidc-context';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import { useMe } from '../api/useMe';

export function AdminRoute() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { data: me } = useMe(auth.isAuthenticated);

  if (!me?.roles.includes('ADMIN')) {
    return (
      <Alert color="red" title={t('auth.adminRequiredTitle')} m="md">
        {t('auth.adminRequiredBody')}
      </Alert>
    );
  }

  return <Outlet />;
}

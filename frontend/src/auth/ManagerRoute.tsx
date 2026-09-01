import { Alert } from '@mantine/core';
import { useAuth } from 'react-oidc-context';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import { useMe } from '../api/useMe';

export function ManagerRoute() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { data: me } = useMe(auth.isAuthenticated);

  if (!me || !(me.roles.includes('ADMIN') || me.roles.includes('EMPLOYEE_MANAGER'))) {
    return (
      <Alert color="red" title={t('auth.managerRequiredTitle')} m="md">
        {t('auth.managerRequiredBody')}
      </Alert>
    );
  }

  return <Outlet />;
}

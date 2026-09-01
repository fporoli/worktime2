import { Center, Loader } from '@mantine/core';
import { useAuth } from 'react-oidc-context';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMe } from '../api/useMe';

export function OnboardingGate() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { data: me, isLoading, isError } = useMe(auth.isAuthenticated);
  const location = useLocation();

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (isError || !me) {
    return <Center h="100vh">{t('auth.loadFailed')}</Center>;
  }

  const onOnboardingPage = location.pathname === '/onboarding';

  if (me.needsOnboarding && !onOnboardingPage) {
    return <Navigate to="/onboarding" replace />;
  }
  if (!me.needsOnboarding && onOnboardingPage) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

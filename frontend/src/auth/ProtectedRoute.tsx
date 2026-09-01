import { useEffect } from 'react';
import { Center, Loader } from '@mantine/core';
import { useAuth } from 'react-oidc-context';
import { Outlet } from 'react-router-dom';

export function ProtectedRoute() {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated && !auth.activeNavigator) {
      void auth.signinRedirect();
    }
  }, [auth]);

  if (!auth.isAuthenticated) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  return <Outlet />;
}

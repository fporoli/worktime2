import { AppShell as MantineAppShell, Burger, Button, Group, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useAuth } from 'react-oidc-context';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import { NavBar } from './NavBar';

export function AppLayout() {
  const { t } = useTranslation();
  const [opened, { toggle }] = useDisclosure();
  const auth = useAuth();

  return (
    <MantineAppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={700}>{t('common.appName')}</Text>
          </Group>
          <Group>
            <Text size="sm" c="dimmed">
              {auth.user?.profile.email}
            </Text>
            <Button variant="subtle" size="xs" onClick={() => void auth.signoutRedirect()}>
              {t('common.signOut')}
            </Button>
          </Group>
        </Group>
      </MantineAppShell.Header>
      <MantineAppShell.Navbar>
        <NavBar />
      </MantineAppShell.Navbar>
      <MantineAppShell.Main>
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}

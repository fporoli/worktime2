import { NavLink as MantineNavLink, Stack } from '@mantine/core';
import {
  IconBuilding,
  IconCalendarTime,
  IconFolder,
  IconFolders,
  IconSettings,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react';
import { useAuth } from 'react-oidc-context';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useMe } from '../../api/useMe';
import { useManagedProjects } from '../../api/useProjects';

export function NavBar() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { data: me } = useMe(auth.isAuthenticated);
  const { data: managedProjects } = useManagedProjects();

  const isAdmin = me?.roles.includes('ADMIN') ?? false;
  const isManager = isAdmin || (me?.roles.includes('EMPLOYEE_MANAGER') ?? false);
  const managesAnyProject = (managedProjects?.length ?? 0) > 0;

  return (
    <Stack gap={4} p="sm" justify="space-between" h="100%">
      <Stack gap={4}>
        <MantineNavLink
          component={NavLink}
          to="/"
          label={t('nav.myTime')}
          leftSection={<IconCalendarTime size={18} />}
        />
        {isManager && (
          <MantineNavLink
            component={NavLink}
            to="/manager/team"
            label={t('nav.myTeamTime')}
            leftSection={<IconUsersGroup size={18} />}
          />
        )}
        {managesAnyProject && (
          <MantineNavLink
            component={NavLink}
            to="/manager/projects"
            label={t('nav.managedProjects')}
            leftSection={<IconFolder size={18} />}
          />
        )}
        {isAdmin && (
          <>
            <MantineNavLink
              component={NavLink}
              to="/admin/projects"
              label={t('nav.projects')}
              leftSection={<IconFolders size={18} />}
            />
            <MantineNavLink
              component={NavLink}
              to="/admin/employees"
              label={t('nav.employees')}
              leftSection={<IconUsers size={18} />}
            />
            <MantineNavLink
              component={NavLink}
              to="/admin/company"
              label={t('nav.company')}
              leftSection={<IconBuilding size={18} />}
            />
          </>
        )}
      </Stack>
      <MantineNavLink
        component={NavLink}
        to="/settings"
        label={t('nav.settings')}
        leftSection={<IconSettings size={18} />}
      />
    </Stack>
  );
}

import { useState } from 'react';
import { Alert, Anchor, Group, Paper, Stack, Table, Text, Title } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useManagedProjects, useProjectTimeEntries } from '../../api/useProjects';
import { formatDuration, minutesToHHMM } from '../../lib/time';

export function ProjectTimeOverviewPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <ManagedProjectsList />;
  }
  return <ProjectDetail projectId={id} />;
}

function ManagedProjectsList() {
  const { t } = useTranslation();
  const { data: projects, isLoading } = useManagedProjects();

  return (
    <Stack gap="lg" maw={700}>
      <Title order={2}>{t('manager.project.listTitle')}</Title>
      {isLoading && <Text c="dimmed">{t('common.loading')}</Text>}
      {!isLoading && (projects ?? []).length === 0 && (
        <Text c="dimmed">{t('manager.project.noManagedProjects')}</Text>
      )}
      <Stack gap="xs">
        {(projects ?? []).map((project) => (
          <Anchor component={Link} to={`/manager/projects/${project.id}`} key={project.id}>
            {project.name}
          </Anchor>
        ))}
      </Stack>
    </Stack>
  );
}

function ProjectDetail({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const [from, setFrom] = useState<Date>(dayjs().subtract(7, 'day').toDate());
  const [to, setTo] = useState<Date>(new Date());

  const { data: entries, isLoading, isError, error } = useProjectTimeEntries(
    projectId,
    dayjs(from).format('YYYY-MM-DD'),
    dayjs(to).format('YYYY-MM-DD'),
  );

  return (
    <Stack gap="lg" maw={900}>
      <Anchor component={Link} to="/manager/projects" size="sm">
        ← {t('manager.project.backLink')}
      </Anchor>
      <Title order={2}>{t('manager.project.title')}</Title>

      <Group>
        <DateInput label={t('manager.team.fromLabel')} value={from} onChange={(v) => v && setFrom(v)} w={160} />
        <DateInput label={t('manager.team.toLabel')} value={to} onChange={(v) => v && setTo(v)} w={160} />
      </Group>

      {isError && (
        <Alert color="red" title={t('manager.project.loadError')}>
          {error.message}
        </Alert>
      )}

      <Paper withBorder p="md" radius="md">
        {isLoading && <Text c="dimmed">{t('common.loading')}</Text>}
        {!isLoading && (entries ?? []).length === 0 && <Text c="dimmed">{t('manager.project.noEntries')}</Text>}
        {(entries ?? []).length > 0 && (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('manager.project.columnEmployee')}</Table.Th>
                <Table.Th>{t('manager.project.columnDate')}</Table.Th>
                <Table.Th>{t('manager.project.columnTime')}</Table.Th>
                <Table.Th>{t('manager.project.columnDuration')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(entries ?? []).map((entry) => (
                <Table.Tr key={entry.id}>
                  <Table.Td>{entry.user?.displayName}</Table.Td>
                  <Table.Td>{entry.workDate}</Table.Td>
                  <Table.Td>
                    {minutesToHHMM(entry.startMinute)} – {minutesToHHMM(entry.endMinute)}
                  </Table.Td>
                  <Table.Td>{formatDuration(entry.startMinute, entry.endMinute)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}

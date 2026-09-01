import { useState } from 'react';
import { Group, Paper, Stack, Table, Text, Title } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useMyTeam, useMyTeamTimeEntries } from '../../api/useEmployees';
import { formatDuration, minutesToHHMM } from '../../lib/time';

export function TeamTimeOverviewPage() {
  const { t } = useTranslation();
  const [from, setFrom] = useState<Date>(dayjs().subtract(7, 'day').toDate());
  const [to, setTo] = useState<Date>(new Date());

  const { data: team } = useMyTeam();
  const { data: entries, isLoading } = useMyTeamTimeEntries(
    dayjs(from).format('YYYY-MM-DD'),
    dayjs(to).format('YYYY-MM-DD'),
  );

  return (
    <Stack gap="lg" maw={900}>
      <Title order={2}>{t('manager.team.title')}</Title>

      <Text c="dimmed">{t('manager.team.directReportsCount', { count: (team ?? []).length })}</Text>

      <Group>
        <DateInput label={t('manager.team.fromLabel')} value={from} onChange={(v) => v && setFrom(v)} w={160} />
        <DateInput label={t('manager.team.toLabel')} value={to} onChange={(v) => v && setTo(v)} w={160} />
      </Group>

      <Paper withBorder p="md" radius="md">
        {isLoading && <Text c="dimmed">{t('common.loading')}</Text>}
        {!isLoading && (entries ?? []).length === 0 && <Text c="dimmed">{t('manager.team.noEntries')}</Text>}
        {(entries ?? []).length > 0 && (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('manager.team.columnEmployee')}</Table.Th>
                <Table.Th>{t('manager.team.columnDate')}</Table.Th>
                <Table.Th>{t('manager.team.columnProject')}</Table.Th>
                <Table.Th>{t('manager.team.columnTime')}</Table.Th>
                <Table.Th>{t('manager.team.columnDuration')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(entries ?? []).map((entry) => (
                <Table.Tr key={entry.id}>
                  <Table.Td>{entry.user?.displayName}</Table.Td>
                  <Table.Td>{entry.workDate}</Table.Td>
                  <Table.Td>{entry.project?.name}</Table.Td>
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

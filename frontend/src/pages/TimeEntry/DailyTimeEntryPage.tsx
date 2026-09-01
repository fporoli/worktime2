import { useMemo, useState } from 'react';
import { Alert, Button, Group, Paper, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useMyProjects } from '../../api/useProjects';
import { useCreateTimeEntry, useDeleteTimeEntry, useMyTimeEntries } from '../../api/useTimeEntries';
import { TimeSegmentRow } from '../../components/time-entry/TimeSegmentRow';
import { hhmmToMinutes, roundToStep } from '../../lib/time';

export function DailyTimeEntryPage() {
  const { t } = useTranslation();
  const [date, setDate] = useState<Date>(new Date());
  const workDate = dayjs(date).format('YYYY-MM-DD');

  const { data: projects } = useMyProjects();
  const { data: entries, isLoading } = useMyTimeEntries(workDate, workDate);
  const createEntry = useCreateTimeEntry();
  const deleteEntry = useDeleteTimeEntry();

  const [projectId, setProjectId] = useState<string | null>(null);
  const [startText, setStartText] = useState('09:00');
  const [endText, setEndText] = useState('17:00');
  const [formError, setFormError] = useState<string | null>(null);

  const projectOptions = useMemo(() => {
    if (!projects) return [];
    const work = projects.filter((p) => p.kind !== 'ACTIVITY');
    const activities = projects.filter((p) => p.kind === 'ACTIVITY');
    const groups = [];
    if (work.length > 0) {
      groups.push({ group: t('timeEntry.companyProjectsGroup'), items: work.map((p) => ({ value: p.id, label: p.name })) });
    }
    if (activities.length > 0) {
      groups.push({ group: t('timeEntry.activitiesGroup'), items: activities.map((p) => ({ value: p.id, label: p.name })) });
    }
    return groups;
  }, [projects, t]);

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    (projects ?? []).forEach((p) => map.set(p.id, p.name));
    return map;
  }, [projects]);

  const todaysEntries = (entries ?? []).slice().sort((a, b) => a.startMinute - b.startMinute);

  function handleAddSegment() {
    setFormError(null);
    if (!projectId) {
      setFormError(t('timeEntry.errorChooseProject'));
      return;
    }
    const rawStart = hhmmToMinutes(startText);
    const rawEnd = hhmmToMinutes(endText);
    if (rawStart === undefined || rawEnd === undefined) {
      setFormError(t('timeEntry.errorInvalidTimes'));
      return;
    }
    const startMinute = roundToStep(rawStart);
    const endMinute = roundToStep(rawEnd);
    if (endMinute <= startMinute) {
      setFormError(t('timeEntry.errorEndBeforeStart'));
      return;
    }

    createEntry.mutate(
      { projectId, workDate, startMinute, endMinute },
      {
        onError: (error) => setFormError(error.message),
      },
    );
  }

  return (
    <Stack gap="lg" maw={720}>
      <Title order={2}>{t('timeEntry.title')}</Title>

      <DateInput value={date} onChange={(value) => value && setDate(value)} label={t('timeEntry.dateLabel')} maw={220} />

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Text fw={600}>{t('timeEntry.addSegmentTitle')}</Text>
          <Group align="flex-end" wrap="wrap">
            <Select
              label={t('timeEntry.projectLabel')}
              placeholder={t('common.selectPlaceholder')}
              data={projectOptions}
              value={projectId}
              onChange={setProjectId}
              searchable
              w={240}
            />
            <TextInput
              label={t('timeEntry.startLabel')}
              type="time"
              step={300}
              value={startText}
              onChange={(event) => setStartText(event.currentTarget.value)}
              w={120}
            />
            <TextInput
              label={t('timeEntry.endLabel')}
              type="time"
              step={300}
              value={endText}
              onChange={(event) => setEndText(event.currentTarget.value)}
              w={120}
            />
            <Button loading={createEntry.isPending} onClick={handleAddSegment}>
              {t('timeEntry.addSegment')}
            </Button>
          </Group>
          {formError && (
            <Alert color="red" variant="light">
              {formError}
            </Alert>
          )}
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="sm">
          {t('timeEntry.entriesFor', { date: workDate })}
        </Text>
        {isLoading && <Text c="dimmed">{t('common.loading')}</Text>}
        {!isLoading && todaysEntries.length === 0 && <Text c="dimmed">{t('timeEntry.noEntries')}</Text>}
        {todaysEntries.length > 0 && (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('timeEntry.columnProject')}</Table.Th>
                <Table.Th>{t('timeEntry.columnTime')}</Table.Th>
                <Table.Th>{t('timeEntry.columnDuration')}</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {todaysEntries.map((entry) => (
                <TimeSegmentRow
                  key={entry.id}
                  entry={entry}
                  projectName={projectNameById.get(entry.projectId) ?? '—'}
                  deleting={deleteEntry.isPending && deleteEntry.variables === entry.id}
                  onDelete={(id) => deleteEntry.mutate(id)}
                />
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}

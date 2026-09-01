import { ActionIcon, Group, Table, Text } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { TimeEntry } from '../../api/types';
import { formatDuration, minutesToHHMM } from '../../lib/time';

interface TimeSegmentRowProps {
  entry: TimeEntry;
  projectName: string;
  onDelete: (id: string) => void;
  deleting: boolean;
}

export function TimeSegmentRow({ entry, projectName, onDelete, deleting }: TimeSegmentRowProps) {
  return (
    <Table.Tr>
      <Table.Td>{projectName}</Table.Td>
      <Table.Td>
        {minutesToHHMM(entry.startMinute)} – {minutesToHHMM(entry.endMinute)}
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">
          {formatDuration(entry.startMinute, entry.endMinute)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Group justify="flex-end">
          <ActionIcon color="red" variant="subtle" loading={deleting} onClick={() => onDelete(entry.id)}>
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

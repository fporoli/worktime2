import { useState } from 'react';
import { ActionIcon, Alert, Button, Group, MultiSelect, Paper, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  useAddMember,
  useCompanyMembers,
  useRemoveMember,
  useUpdateMemberRoles,
} from '../../api/useCompanies';
import {
  useCreateManagerEdge,
  useManagerAssignments,
  useRemoveManagerEdge,
} from '../../api/useEmployees';
import { CompanyRole } from '../../api/types';

export function EmployeesPage() {
  const { t } = useTranslation();
  const { data: members } = useCompanyMembers(true);
  const addMember = useAddMember();
  const removeMember = useRemoveMember();
  const updateRoles = useUpdateMemberRoles();

  const { data: managerAssignments } = useManagerAssignments();
  const createEdge = useCreateManagerEdge();
  const removeEdge = useRemoveManagerEdge();

  const [email, setEmail] = useState('');
  const [managerId, setManagerId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const memberOptions = (members ?? []).map((m) => ({ value: m.userId, label: m.displayName || m.email }));
  const roleOptions = [
    { value: 'ADMIN', label: t('admin.employees.roleAdmin') },
    { value: 'EMPLOYEE_MANAGER', label: t('admin.employees.roleEmployeeManager') },
  ];

  return (
    <Stack gap="lg" maw={900}>
      <Title order={2}>{t('admin.employees.title')}</Title>

      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="sm">
          {t('admin.employees.addEmployeeTitle')}
        </Text>
        <Text size="sm" c="dimmed" mb="xs">
          {t('admin.employees.addEmployeeHint')}
        </Text>
        <Group align="flex-end">
          <TextInput
            label={t('admin.employees.emailLabel')}
            placeholder={t('admin.employees.emailPlaceholder')}
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            w={280}
          />
          <Button
            loading={addMember.isPending}
            onClick={() =>
              addMember.mutate(email.trim(), {
                onSuccess: () => setEmail(''),
              })
            }
          >
            {t('common.add')}
          </Button>
        </Group>
        {addMember.error && (
          <Alert color="red" variant="light" mt="sm">
            {addMember.error.message}
          </Alert>
        )}
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('admin.employees.columnName')}</Table.Th>
              <Table.Th>{t('admin.employees.columnEmail')}</Table.Th>
              <Table.Th>{t('admin.employees.columnRoles')}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(members ?? []).map((member) => (
              <Table.Tr key={member.userId}>
                <Table.Td>{member.displayName}</Table.Td>
                <Table.Td>{member.email}</Table.Td>
                <Table.Td>
                  <MultiSelect
                    data={roleOptions}
                    value={member.roles}
                    onChange={(roles) =>
                      updateRoles.mutate({ userId: member.userId, roles: roles as CompanyRole[] })
                    }
                    w={260}
                  />
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => removeMember.mutate(member.userId)}
                    title={t('admin.employees.removeFromCompany')}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="sm">
          {t('admin.employees.directReportsTitle')}
        </Text>
        <Text size="sm" c="dimmed" mb="xs">
          {t('admin.employees.directReportsHint')}
        </Text>
        <Stack gap="xs" mb="sm">
          {(managerAssignments ?? []).map((edge) => (
            <Group key={edge.id} justify="space-between">
              <Text size="sm">
                {t('admin.employees.managesEmployee', { manager: edge.managerName, employee: edge.employeeName })}
              </Text>
              <ActionIcon
                color="red"
                variant="subtle"
                onClick={() => removeEdge.mutate(edge.id)}
                title={t('common.remove')}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
        <Group align="flex-end">
          <Select
            label={t('admin.employees.managerLabel')}
            placeholder={t('common.selectPlaceholder')}
            data={memberOptions}
            value={managerId}
            onChange={setManagerId}
            searchable
            w={220}
          />
          <Select
            label={t('admin.employees.employeeLabel')}
            placeholder={t('common.selectPlaceholder')}
            data={memberOptions}
            value={employeeId}
            onChange={setEmployeeId}
            searchable
            w={220}
          />
          <Button
            disabled={!managerId || !employeeId}
            loading={createEdge.isPending}
            onClick={() => {
              if (managerId && employeeId) {
                createEdge.mutate(
                  { managerId, employeeId },
                  { onSuccess: () => { setManagerId(null); setEmployeeId(null); } },
                );
              }
            }}
          >
            {t('common.assign')}
          </Button>
        </Group>
      </Paper>
    </Stack>
  );
}

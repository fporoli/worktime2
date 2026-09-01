import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconArchive, IconArchiveOff, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useCompanyMembers } from '../../api/useCompanies';
import {
  useAssignEmployee,
  useAssignManager,
  useCreateProject,
  useDeleteProject,
  useProjectAssignments,
  useProjectManagers,
  useProjects,
  useUnassignEmployee,
  useUnassignManager,
  useUpdateProject,
} from '../../api/useProjects';
import { Project, ProjectKind } from '../../api/types';

export function ProjectsPage() {
  const { t } = useTranslation();
  const { data: projects } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const KIND_LABEL: Record<ProjectKind, string> = {
    PROJECT: t('admin.projects.typeProject'),
    SUBPROJECT: t('admin.projects.typeSubproject'),
    ACTIVITY: t('admin.projects.typeActivity'),
  };

  const [kind, setKind] = useState<ProjectKind>('PROJECT');
  const [name, setName] = useState('');
  const [parentProjectId, setParentProjectId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const topLevelProjects = useMemo(
    () => (projects ?? []).filter((p) => p.kind === 'PROJECT' && !p.isArchived),
    [projects],
  );

  function handleCreate() {
    if (!name.trim()) return;
    createProject.mutate(
      {
        kind,
        name: name.trim(),
        parentProjectId: kind === 'SUBPROJECT' ? parentProjectId ?? undefined : undefined,
      },
      { onSuccess: () => setName('') },
    );
  }

  const selectedProject = (projects ?? []).find((p) => p.id === selectedProjectId) ?? null;

  return (
    <Stack gap="lg" maw={900}>
      <Title order={2}>{t('admin.projects.title')}</Title>

      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="sm">
          {t('admin.projects.newProjectTitle')}
        </Text>
        <Group align="flex-end" wrap="wrap">
          <Select
            label={t('admin.projects.typeLabel')}
            data={[
              { value: 'PROJECT', label: t('admin.projects.typeProject') },
              { value: 'SUBPROJECT', label: t('admin.projects.typeSubproject') },
              { value: 'ACTIVITY', label: t('admin.projects.typeActivity') },
            ]}
            value={kind}
            onChange={(value) => setKind((value as ProjectKind) ?? 'PROJECT')}
            w={180}
          />
          {kind === 'SUBPROJECT' && (
            <Select
              label={t('admin.projects.parentProjectLabel')}
              placeholder={t('common.selectPlaceholder')}
              data={topLevelProjects.map((p) => ({ value: p.id, label: p.name }))}
              value={parentProjectId}
              onChange={setParentProjectId}
              w={220}
            />
          )}
          <TextInput
            label={t('admin.projects.nameLabel')}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            w={240}
          />
          <Button loading={createProject.isPending} onClick={handleCreate}>
            {t('common.create')}
          </Button>
        </Group>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('admin.projects.columnName')}</Table.Th>
              <Table.Th>{t('admin.projects.columnType')}</Table.Th>
              <Table.Th>{t('admin.projects.columnStatus')}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(projects ?? []).map((project) => (
              <Table.Tr
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                style={{ cursor: 'pointer', fontWeight: project.id === selectedProjectId ? 600 : undefined }}
              >
                <Table.Td>{project.name}</Table.Td>
                <Table.Td>{KIND_LABEL[project.kind]}</Table.Td>
                <Table.Td>
                  {project.isArchived ? (
                    <Badge color="gray">{t('admin.projects.statusArchived')}</Badge>
                  ) : (
                    <Badge color="green">{t('admin.projects.statusActive')}</Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group justify="flex-end" onClick={(event) => event.stopPropagation()}>
                    <ActionIcon
                      variant="subtle"
                      onClick={() => updateProject.mutate({ id: project.id, isArchived: !project.isArchived })}
                      title={project.isArchived ? t('admin.projects.unarchive') : t('admin.projects.archive')}
                    >
                      {project.isArchived ? <IconArchiveOff size={16} /> : <IconArchive size={16} />}
                    </ActionIcon>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => deleteProject.mutate(project.id)}
                      title={t('admin.projects.delete')}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      {selectedProject && selectedProject.kind !== 'ACTIVITY' && (
        <ProjectAssignmentsPanel project={selectedProject} />
      )}
    </Stack>
  );
}

function ProjectAssignmentsPanel({ project }: { project: Project }) {
  const { t } = useTranslation();
  const { data: members } = useCompanyMembers(true);
  const { data: assignments } = useProjectAssignments(project.id);
  const { data: managers } = useProjectManagers(project.id);
  const assignEmployee = useAssignEmployee(project.id);
  const unassignEmployee = useUnassignEmployee(project.id);
  const assignManager = useAssignManager(project.id);
  const unassignManager = useUnassignManager(project.id);

  const [employeeToAdd, setEmployeeToAdd] = useState<string | null>(null);
  const [managerToAdd, setManagerToAdd] = useState<string | null>(null);

  const memberOptions = (members ?? []).map((m) => ({ value: m.userId, label: m.displayName || m.email }));

  return (
    <Paper withBorder p="md" radius="md">
      <Title order={4} mb="md">
        {t('admin.projects.assignmentsTitle', { name: project.name })}
      </Title>

      <Stack gap="lg">
        <Stack gap="xs">
          <Text fw={600}>{t('admin.projects.assignedEmployees')}</Text>
          {(assignments ?? []).map((a) => (
            <Group key={a.userId} justify="space-between">
              <Text size="sm">{a.displayName || a.email}</Text>
              <ActionIcon
                color="red"
                variant="subtle"
                onClick={() => unassignEmployee.mutate(a.userId)}
                title={t('common.remove')}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
          <Group>
            <Select
              placeholder={t('admin.projects.addEmployeePlaceholder')}
              data={memberOptions}
              value={employeeToAdd}
              onChange={setEmployeeToAdd}
              searchable
              w={220}
            />
            <Button
              size="xs"
              disabled={!employeeToAdd}
              loading={assignEmployee.isPending}
              onClick={() => {
                if (employeeToAdd) {
                  assignEmployee.mutate(employeeToAdd);
                  setEmployeeToAdd(null);
                }
              }}
            >
              {t('common.assign')}
            </Button>
          </Group>
        </Stack>

        <Stack gap="xs">
          <Text fw={600}>{t('admin.projects.projectManagers')}</Text>
          {(managers ?? []).map((m) => (
            <Group key={m.userId} justify="space-between">
              <Text size="sm">{m.displayName || m.email}</Text>
              <ActionIcon
                color="red"
                variant="subtle"
                onClick={() => unassignManager.mutate(m.userId)}
                title={t('common.remove')}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
          <Group>
            <Select
              placeholder={t('admin.projects.addManagerPlaceholder')}
              data={memberOptions}
              value={managerToAdd}
              onChange={setManagerToAdd}
              searchable
              w={220}
            />
            <Button
              size="xs"
              disabled={!managerToAdd}
              loading={assignManager.isPending}
              onClick={() => {
                if (managerToAdd) {
                  assignManager.mutate(managerToAdd);
                  setManagerToAdd(null);
                }
              }}
            >
              {t('admin.projects.assignManager')}
            </Button>
          </Group>
        </Stack>
      </Stack>
    </Paper>
  );
}

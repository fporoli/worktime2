import { useEffect, useState } from 'react';
import { Button, Group, Paper, Stack, TextInput, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useCurrentCompany, useRenameCompany } from '../../api/useCompanies';

export function CompanySettingsPage() {
  const { t } = useTranslation();
  const { data: company } = useCurrentCompany(true);
  const renameCompany = useRenameCompany();
  const [name, setName] = useState('');

  useEffect(() => {
    if (company) setName(company.name);
  }, [company]);

  return (
    <Stack gap="lg" maw={480}>
      <Title order={2}>{t('admin.company.title')}</Title>
      <Paper withBorder p="md" radius="md">
        <Group align="flex-end">
          <TextInput
            label={t('admin.company.nameLabel')}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            w={280}
          />
          <Button
            loading={renameCompany.isPending}
            disabled={!name.trim() || name === company?.name}
            onClick={() => renameCompany.mutate(name.trim())}
          >
            {t('common.save')}
          </Button>
        </Group>
      </Paper>
    </Stack>
  );
}

import { useAuth } from 'react-oidc-context';
import { useTranslation } from 'react-i18next';
import { Alert, Paper, Select, Stack, Text, Title } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useMe, useUpdateLocale } from '../../api/useMe';
import { Locale } from '../../api/types';

const LANGUAGE_OPTIONS: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
];

export function SettingsPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { data: me } = useMe(auth.isAuthenticated);
  const updateLocale = useUpdateLocale();

  return (
    <Stack gap="lg" maw={480}>
      <Title order={2}>{t('settings.title')}</Title>

      <Paper withBorder p="md" radius="md">
        <Stack gap="xs">
          <Select
            label={t('settings.languageLabel')}
            description={t('settings.languageHint')}
            data={LANGUAGE_OPTIONS}
            value={me?.locale ?? 'en'}
            onChange={(value) => value && updateLocale.mutate(value as Locale)}
            allowDeselect={false}
            w={260}
          />
          {updateLocale.isSuccess && (
            <Alert color="green" variant="light" icon={<IconCheck size={16} />} py={6}>
              <Text size="sm">{t('settings.saved')}</Text>
            </Alert>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

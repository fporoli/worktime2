import { useState } from 'react';
import { Button, Card, Center, Stack, Tabs, Text, TextInput, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useOnboardCompany, useOnboardStandalone } from '../../api/useCompanies';

export function OnboardingPage() {
  const { t } = useTranslation();
  const [companyName, setCompanyName] = useState('');
  const onboardStandalone = useOnboardStandalone();
  const onboardCompany = useOnboardCompany();

  const error = onboardStandalone.error ?? onboardCompany.error;

  return (
    <Center h="100vh" p="md">
      <Card withBorder radius="md" p="xl" maw={480} w="100%">
        <Stack gap="md">
          <Title order={2}>{t('onboarding.title')}</Title>
          <Text c="dimmed">{t('onboarding.subtitle')}</Text>

          <Tabs defaultValue="standalone">
            <Tabs.List grow>
              <Tabs.Tab value="standalone">{t('onboarding.tabStandalone')}</Tabs.Tab>
              <Tabs.Tab value="company">{t('onboarding.tabCompany')}</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="standalone" pt="md">
              <Stack gap="sm">
                <Text size="sm">{t('onboarding.standaloneDescription')}</Text>
                <Button loading={onboardStandalone.isPending} onClick={() => onboardStandalone.mutate()}>
                  {t('onboarding.continueIndividual')}
                </Button>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="company" pt="md">
              <Stack gap="sm">
                <Text size="sm">{t('onboarding.companyDescription')}</Text>
                <TextInput
                  label={t('onboarding.companyNameLabel')}
                  placeholder={t('onboarding.companyNamePlaceholder')}
                  value={companyName}
                  onChange={(event) => setCompanyName(event.currentTarget.value)}
                />
                <Button
                  loading={onboardCompany.isPending}
                  disabled={!companyName.trim()}
                  onClick={() => onboardCompany.mutate(companyName.trim())}
                >
                  {t('onboarding.createCompany')}
                </Button>
              </Stack>
            </Tabs.Panel>
          </Tabs>

          {error && (
            <Text c="red" size="sm">
              {error.message}
            </Text>
          )}
        </Stack>
      </Card>
    </Center>
  );
}

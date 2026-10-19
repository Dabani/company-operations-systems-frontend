import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { IconLock, IconMapOff } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function Msg({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  const nav = useNavigate();
  const { t } = useTranslation();
  return (
    <Center py={80}>
      <Stack align="center" gap="xs" maw={420} ta="center">
        {icon}
        <Title order={3}>{title}</Title>
        <Text c="dimmed" size="sm">{text}</Text>
        <Button mt="sm" onClick={() => nav('/dashboard')}>{t('errors.go_home')}</Button>
      </Stack>
    </Center>
  );
}

export const ForbiddenPage = () => {
  const { t } = useTranslation();
  return <Msg icon={<IconLock size={48} color="var(--mantine-color-orange-6)" />} title={t('errors.forbidden_title')} text={t('errors.forbidden_text')} />;
};

export const NotFoundPage = () => {
  const { t } = useTranslation();
  return <Msg icon={<IconMapOff size={48} color="var(--mantine-color-brand-6)" />} title={t('errors.not_found_title')} text={t('errors.not_found_text')} />;
};

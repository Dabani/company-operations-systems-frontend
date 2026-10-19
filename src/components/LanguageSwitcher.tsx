import { ActionIcon, Menu } from '@mantine/core';
import { IconLanguage, IconCheck } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { LANGS } from '@/i18n';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useQuery } from '@tanstack/react-query';
import type { Language } from '@/types';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const { me, refresh } = useAuth();
  const langs = useQuery({
    queryKey: ['languages'], enabled: !!me,
    queryFn: async () => (await api.get<{ data: Language[] }>('/languages')).data.data,
  });

  const change = async (code: string) => {
    await i18n.changeLanguage(code);
    const id = langs.data?.find((l) => l.code === code)?.id;
    if (me && id) { try { await api.patch('/me', { language_id: id }); await refresh(); } catch { /* preference sync is best-effort */ } }
  };

  return (
    <Menu shadow="md" width={180} position="bottom-end">
      <Menu.Target>
        <ActionIcon variant="subtle" size="lg" aria-label={t('common.language')}><IconLanguage size={20} /></ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {LANGS.map((l) => (
          <Menu.Item key={l.code} onClick={() => change(l.code)} rightSection={i18n.language === l.code ? <IconCheck size={14} /> : null}>{l.label}</Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

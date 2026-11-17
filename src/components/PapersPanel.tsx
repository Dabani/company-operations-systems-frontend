import { ActionIcon, Button, Group, Stack, Text } from '@mantine/core';
import { IconDownload, IconUpload } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, downloadFile } from '@/api/client';
import { FileTypeIcon } from '@/components/FileTypeIcon';
import { UploadModal } from '@/components/UploadModal';
import { formatBytes } from '@/lib/format';
import { toastError } from '@/lib/ui';
import type { FileRow } from '@/types';

/** Papers (documents) attached to a meeting or to one agenda item. They are controlled files: classification and access rules of the Files module apply. */
export function PapersPanel({ kind, id, canUpload }: { kind: 'meeting' | 'agenda-item'; id: string; canUpload: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const key = ['meeting-papers', kind, id];
  const files = useQuery({ queryKey: key, queryFn: async () => (await api.get<{ data: FileRow[] }>(`/${kind}-papers/${id}`)).data.data });
  const rows = files.data ?? [];
  return (
    <Stack gap="xs">
      {rows.length === 0 && <Text size="sm" c="dimmed">{t('meet.no_papers')}</Text>}
      {rows.map((f) => (
        <Group key={f.id} justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap"><FileTypeIcon ext={f.extension} size={30} /><div><Text size="sm" fw={500}>{f.name}</Text><Text size="xs" c="dimmed">{formatBytes(f.size_bytes)} · {f.classification.label}</Text></div></Group>
          <ActionIcon variant="subtle" aria-label={t('meet.download')} title={t('meet.download')} onClick={() => { downloadFile(f.id, f.name).catch(toastError); }}><IconDownload size={18} /></ActionIcon>
        </Group>
      ))}
      {canUpload && <Group><Button size="compact-sm" variant="light" leftSection={<IconUpload size={14} />} onClick={() => setOpen(true)}>{t('meet.add_papers')}</Button></Group>}
      <UploadModal opened={open} onClose={() => setOpen(false)} onDone={() => { void qc.invalidateQueries({ queryKey: key }); }} endpoint={`/${kind}-papers/${id}`} allowRestricted={false} />
    </Stack>
  );
}

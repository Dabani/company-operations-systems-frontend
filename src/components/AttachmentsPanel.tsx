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

/** Controlled Files attached to one record. `endpoint` serves GET (list) and POST (upload), for example /rfq-quote-files/{id}. */
export function AttachmentsPanel({ endpoint, canUpload, title }: { endpoint: string; canUpload: boolean; title?: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const key = ['attachments', endpoint];
  const [up, setUp] = useState(false);
  const files = useQuery({ queryKey: key, queryFn: async () => (await api.get<{ data: FileRow[] }>(endpoint)).data.data });
  return (
    <Stack gap={4}>
      {title && <Text size="sm" fw={600}>{title}</Text>}
      {(files.data ?? []).length === 0 && <Text size="xs" c="dimmed">{t('att.none')}</Text>}
      {(files.data ?? []).map((f) => (
        <Group key={f.id} gap="xs" wrap="nowrap"><FileTypeIcon ext={f.extension} size={22} /><Text size="xs" style={{ flex: 1 }}>{f.name} ({formatBytes(f.size_bytes)})</Text>
          <ActionIcon variant="subtle" aria-label={t('meet.download')} onClick={() => { downloadFile(f.id, f.name).catch(toastError); }}><IconDownload size={14} /></ActionIcon></Group>))}
      {canUpload && <Button size="compact-xs" variant="light" leftSection={<IconUpload size={12} />} onClick={() => setUp(true)} style={{ alignSelf: 'flex-start' }}>{t('att.add')}</Button>}
      <UploadModal opened={up} onClose={() => setUp(false)} onDone={() => { void qc.invalidateQueries({ queryKey: key }); }} endpoint={endpoint} allowRestricted={false} />
    </Stack>
  );
}

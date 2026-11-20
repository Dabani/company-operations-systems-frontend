import { ActionIcon, Button, FileButton, Group, Loader, Modal, Stack, Text } from '@mantine/core';
import { IconDownload, IconPaperclip } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, downloadFile } from '@/api/client';
import { formatBytes } from '@/lib/format';
import { toastError, toastOk } from '@/lib/ui';

interface Props { opened: boolean; onClose: () => void; title: string; listUrl: string; canUpload: boolean; hint?: string }
interface Row { id: string; name: string; size_bytes: number }

/** Supporting documents linked to one record (a leave request, a trip expense receipt): list, download, upload. The API checks access and scans every upload. */
export function LinkedFilesModal({ opened, onClose, title, listUrl, canUpload, hint }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['linked-files', listUrl], enabled: opened, queryFn: async () => (await api.get<{ data: Row[] }>(listUrl)).data.data });
  const up = useMutation({
    mutationFn: async (file: File) => { const fd = new FormData(); fd.append('file', file); return api.post(listUrl, fd); },
    onSuccess: () => { toastOk(t('doc.uploaded')); void qc.invalidateQueries({ queryKey: ['linked-files', listUrl] }); void qc.invalidateQueries({ queryKey: ['trip'] }); },
    onError: toastError,
  });
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Stack gap="sm">
        {hint && <Text size="sm" c="dimmed">{hint}</Text>}
        {q.isLoading && <Loader size="sm" />}
        {q.data?.length === 0 && <Text size="sm" c="dimmed">{t('doc.none')}</Text>}
        {(q.data ?? []).map((f) => (
          <Group key={f.id} justify="space-between" wrap="nowrap">
            <Text size="sm" truncate>{f.name} <Text span size="xs" c="dimmed">({formatBytes(f.size_bytes)})</Text></Text>
            <ActionIcon variant="subtle" aria-label={t('files.download')} onClick={() => void downloadFile(f.id, f.name).catch(toastError)}><IconDownload size={16} /></ActionIcon>
          </Group>
        ))}
        {canUpload && <FileButton onChange={(file) => file && up.mutate(file)}>{(p) => <Button {...p} variant="light" leftSection={<IconPaperclip size={16} />} loading={up.isPending}>{t('doc.attach')}</Button>}</FileButton>}
      </Stack>
    </Modal>
  );
}

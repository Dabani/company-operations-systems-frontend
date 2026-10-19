import { Alert, Button, Group, Modal, Progress, Select, Stack, Text } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { IconAlertCircle, IconCircleCheck, IconCloudUpload, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { FileTypeIcon } from '@/components/FileTypeIcon';
import { RichTextField } from '@/components/RichTextField';
import { formatBytes } from '@/lib/format';
import { useLookup } from '@/lib/useLookup';

interface Item { file: File; state: 'queued' | 'uploading' | 'done' | 'error'; progress: number; error?: string }

interface Props {
  opened: boolean;
  onClose: () => void;
  onDone: () => void;
  endpoint: string;                 // '/files' or `/cases/{id}/attachments`
  allowRestricted?: boolean;        // case attachments cannot be "restricted"
  maxMb?: number;
}

/** Multi-file upload with per-file progress. Validation of type/size/content is enforced by the server. */
export function UploadModal({ opened, onClose, onDone, endpoint, allowRestricted = true, maxMb = 20 }: Props) {
  const { t } = useTranslation();
  const classes = useLookup('file_classification');
  const [items, setItems] = useState<Item[]>([]);
  const [classId, setClassId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const options = classes.items.filter((c) => allowRestricted || c.code !== 'restricted').map((c) => ({ value: c.id, label: c.label }));
  useEffect(() => { if (!classId && classes.items.length) setClassId(classes.items.find((c) => c.code === 'internal')?.id ?? null); }, [classes.items, classId]);
  useEffect(() => { if (opened) { setItems([]); setDescription(''); } }, [opened]);

  const patch = (i: number, p: Partial<Item>) => setItems((cur) => cur.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const start = async () => {
    setBusy(true);
    let failed = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].state === 'done') continue;
      patch(i, { state: 'uploading', progress: 0, error: undefined });
      const fd = new FormData();
      fd.append('file', items[i].file);
      if (classId) fd.append('classification_id', classId);
      if (description) fd.append('description', description);
      try {
        await api.post(endpoint, fd, { onUploadProgress: (e) => patch(i, { progress: e.total ? Math.round((e.loaded / e.total) * 100) : 50 }) });
        patch(i, { state: 'done', progress: 100 });
      } catch (e) {
        failed = true;
        const p = parseError(e);
        patch(i, { state: 'error', error: p.fields.file ?? p.message });
      }
    }
    setBusy(false);
    onDone();
    if (!failed) onClose();
  };

  return (
    <Modal opened={opened} onClose={busy ? () => undefined : onClose} title={t('files.upload')} size="lg" centered>
      <Stack gap="sm">
        <Dropzone onDrop={(files) => setItems((cur) => [...cur, ...files.map((file) => ({ file, state: 'queued' as const, progress: 0 }))])}
          maxSize={maxMb * 1024 * 1024} disabled={busy} multiple>
          <Group justify="center" gap="md" mih={110} style={{ pointerEvents: 'none' }}>
            <Dropzone.Accept><IconCloudUpload size={40} /></Dropzone.Accept>
            <Dropzone.Reject><IconX size={40} color="var(--mantine-color-red-6)" /></Dropzone.Reject>
            <Dropzone.Idle><IconCloudUpload size={40} color="var(--mantine-color-dimmed)" /></Dropzone.Idle>
            <div><Text fw={600}>{t('files.drop')}</Text><Text size="xs" c="dimmed">{t('files.drop_hint', { mb: maxMb })}</Text></div>
          </Group>
        </Dropzone>

        {items.map((it, i) => (
          <Group key={i} wrap="nowrap" gap="sm" align="flex-start">
            <FileTypeIcon ext={it.file.name.split('.').pop()} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Group justify="space-between" wrap="nowrap"><Text size="sm" truncate>{it.file.name}</Text><Text size="xs" c="dimmed">{formatBytes(it.file.size)}</Text></Group>
              {it.state === 'uploading' && <Progress value={it.progress} size="sm" mt={4} animated />}
              {it.state === 'error' && <Text size="xs" c="red" mt={2}><IconAlertCircle size={12} style={{ verticalAlign: -2 }} /> {it.error}</Text>}
            </div>
            {it.state === 'done' ? <IconCircleCheck size={18} color="var(--mantine-color-green-6)" /> : !busy && <IconX size={16} style={{ cursor: 'pointer' }} onClick={() => setItems((c) => c.filter((_, j) => j !== i))} />}
          </Group>
        ))}

        <Select label={t('files.classification')} data={options} value={classId} onChange={setClassId} allowDeselect={false} />
        {!allowRestricted && <Alert variant="light" color="blue" py={6}>{t('files.restricted_note')}</Alert>}
        <RichTextField label={t('common.description')} value={description} onChange={setDescription} minHeight={70} />

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button onClick={start} loading={busy} disabled={items.every((i) => i.state === 'done') || items.length === 0} leftSection={<IconCloudUpload size={16} />}>{t('common.upload')}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

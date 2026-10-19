import { Button, Group, Modal, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';

interface Props { opened: boolean; onClose: () => void; onConfirm: () => void; loading?: boolean; title?: string; text?: string }

export function ConfirmModal({ opened, onClose, onConfirm, loading, title, text }: Props) {
  const { t } = useTranslation();
  return (
    <Modal opened={opened} onClose={onClose} title={title ?? t('confirm.delete_title')} centered size="sm">
      <Text size="sm" c="dimmed">{text ?? t('confirm.delete_text')}</Text>
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onClose}>{t('common.cancel')}</Button>
        <Button color="red" loading={loading} onClick={onConfirm}>{t('common.delete')}</Button>
      </Group>
    </Modal>
  );
}

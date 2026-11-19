import { Button, type ButtonProps } from '@mantine/core';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '@/components/ConfirmModal';

interface Props extends Omit<ButtonProps, 'onClick'> { onConfirm: () => void; title: string; text: string; children: ReactNode }

/** A button that asks "are you sure?" first (blue Confirm button, not the red Delete one). The dialog closes as soon as it is confirmed. */
export function ConfirmButton({ onConfirm, title, text, children, ...button }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button {...button} onClick={() => setOpen(true)}>{children}</Button>
      <ConfirmModal opened={open} onClose={() => setOpen(false)} title={title} text={text} confirmLabel={t('common.confirm')} confirmColor="blue" onConfirm={() => { setOpen(false); onConfirm(); }} />
    </>
  );
}

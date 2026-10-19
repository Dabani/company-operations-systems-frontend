import { notifications } from '@mantine/notifications';
import i18n from '@/i18n';
import { parseError } from '@/api/client';

export const toastOk = (message?: string) => notifications.show({ color: 'green', message: message ?? i18n.t('common.saved') });
export const toastError = (e: unknown) => notifications.show({ color: 'red', message: parseError(e).message });

export const MANTINE_COLORS = ['gray', 'blue', 'cyan', 'teal', 'green', 'lime', 'yellow', 'orange', 'red', 'pink', 'grape', 'violet', 'indigo'];

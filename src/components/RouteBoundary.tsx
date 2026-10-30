import { Alert, Button, Center, Group, Loader, Stack } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

function Fallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Alert color="red" icon={<IconAlertTriangle size={18} />} title={t('route.error_title')} role="alert">
      <Stack gap="sm">
        {t('route.error_text')}
        <Group gap="xs">
          <Button size="xs" variant="light" onClick={onRetry}>{t('route.retry')}</Button>
          <Button size="xs" variant="default" onClick={() => window.location.reload()}>{t('route.reload')}</Button>
        </Group>
      </Stack>
    </Alert>
  );
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Route error', error, info.componentStack); }
  render() { return this.state.failed ? <Fallback onRetry={() => this.setState({ failed: false })} /> : this.props.children; }
}

/** Error boundary + Suspense for lazily loaded pages. Keyed by path so the error clears when the user navigates away. */
export function RouteBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <Boundary key={pathname}>
      <Suspense fallback={<Center py={80}><Loader /></Center>}>{children}</Suspense>
    </Boundary>
  );
}

import { ActionIcon, Box, Checkbox, Group, Menu, Pagination, Paper, Select, Skeleton, Stack, Table, Text, TextInput, Button, Collapse, SimpleGrid } from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { IconArrowDown, IconArrowUp, IconArrowsSort, IconDownload, IconFilter, IconPrinter, IconSearch, IconFileSpreadsheet, IconFileTypeCsv, IconInbox } from '@tabler/icons-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { api, downloadExport } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import type { Paginated } from '@/types';

export interface Column<T> { key: string; label: string; sortable?: boolean; render?: (row: T) => ReactNode; visibleFrom?: 'xs' | 'sm' | 'md' | 'lg' }
export interface FilterDef { key: string; label: string; options: { value: string; label: string }[] }

interface Props<T extends { id: string }> {
  title: string;
  endpoint: string;
  queryKey: string;
  columns: Column<T>[];
  filters?: FilterDef[];
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  toolbar?: ReactNode;
  rowActions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  exportable?: boolean;
  extraParams?: Record<string, unknown>;   // fixed query params, e.g. { mine: 1 }
  /** Enables row checkboxes; the returned buttons are shown in a bar while rows are selected. */
  bulk?: (selected: T[], clear: () => void) => ReactNode;
  /** Rows that cannot be selected (e.g. yourself). */
  selectableRow?: (row: T) => boolean;
}

/** Enhanced list: search, filter, sort, pagination, CSV/XLSX export (server-side), print. */
export function DataList<T extends { id: string }>({ title, endpoint, queryKey, columns, filters = [], defaultSort, toolbar, rowActions, onRowClick, exportable = true, extraParams, bulk, selectableRow }: Props<T>) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search, 350);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState('15');
  const [sort, setSort] = useState(defaultSort ?? null);
  const [filterValues, setFilterValues] = useState<Record<string, string | null>>({});
  const [showFilters, { toggle: toggleFilters }] = useDisclosure(false);

  const [picked, setPicked] = useState<Record<string, T>>({});
  useEffect(() => { setPage(1); }, [debounced, perPage, sort, filterValues, JSON.stringify(extraParams)]);
  useEffect(() => { setPicked({}); }, [debounced, perPage, sort, filterValues, JSON.stringify(extraParams)]);

  const params = {
    ...extraParams,
    search: debounced || undefined, page, per_page: perPage,
    sort: sort?.key, direction: sort?.direction,
    filter: Object.fromEntries(Object.entries(filterValues).filter(([, v]) => v)),
  };

  const q = useQuery({
    queryKey: [queryKey, params],
    queryFn: async () => (await api.get<Paginated<T>>(endpoint, { params })).data,
    placeholderData: keepPreviousData,
  });

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? (s.direction === 'asc' ? { key, direction: 'desc' } : null) : { key, direction: 'asc' }));

  const rows = q.data?.data ?? [];
  const meta = q.data?.meta;
  const canExport = exportable && can('data.export');
  const selectable = rows.filter((r) => !selectableRow || selectableRow(r));
  const selected = Object.values(picked);
  const allOnPage = selectable.length > 0 && selectable.every((r) => picked[r.id]);
  const toggleRow = (r: T) => setPicked((p) => { const n = { ...p }; if (n[r.id]) delete n[r.id]; else n[r.id] = r; return n; });
  const toggleAll = () => setPicked((p) => { const n = { ...p }; if (allOnPage) selectable.forEach((r) => delete n[r.id]); else selectable.forEach((r) => { n[r.id] = r; }); return n; });

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" className="no-print">
        <TextInput placeholder={t('common.search_placeholder')} leftSection={<IconSearch size={16} />} value={search}
          onChange={(e) => setSearch(e.currentTarget.value)} w={{ base: '100%', sm: 300 }} />
        <Group gap="xs" wrap="wrap">
          {filters.length > 0 && <Button variant="default" leftSection={<IconFilter size={16} />} onClick={toggleFilters}>{t('common.filters')}</Button>}
          {canExport && (
            <Menu position="bottom-end">
              <Menu.Target><Button variant="default" leftSection={<IconDownload size={16} />}>{t('common.export')}</Button></Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconFileTypeCsv size={16} />} onClick={() => downloadExport(endpoint, params, 'csv')}>CSV</Menu.Item>
                <Menu.Item leftSection={<IconFileSpreadsheet size={16} />} onClick={() => downloadExport(endpoint, params, 'xlsx')}>Excel (XLSX)</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
          <Button variant="default" leftSection={<IconPrinter size={16} />} onClick={() => window.print()}>{t('common.print')}</Button>
          {toolbar}
        </Group>
      </Group>

      <Collapse expanded={showFilters} className="no-print">
        <Paper withBorder p="sm">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
            {filters.map((f) => (
              <Select key={f.key} label={f.label} data={f.options} clearable value={filterValues[f.key] ?? null}
                onChange={(v) => setFilterValues((s) => ({ ...s, [f.key]: v }))} placeholder={t('common.all')} />
            ))}
          </SimpleGrid>
        </Paper>
      </Collapse>

      <Text className="print-only" fw={700}>{title} — {new Date().toLocaleString()}</Text>

      {bulk && selected.length > 0 && (
        <Paper withBorder p="xs" className="no-print" bg="var(--mantine-primary-color-light)">
          <Group justify="space-between" wrap="wrap" gap="xs">
            <Text size="sm" fw={600}>{t('common.selected', { count: selected.length })}</Text>
            <Group gap="xs" wrap="wrap">{bulk(selected, () => setPicked({}))}<Button size="xs" variant="subtle" color="gray" onClick={() => setPicked({})}>{t('common.clear_selection')}</Button></Group>
          </Group>
        </Paper>
      )}

      <Paper withBorder>
        <Table.ScrollContainer minWidth={640}>
          <Table highlightOnHover={!!onRowClick} verticalSpacing="sm" striped="odd">
            <Table.Thead>
              <Table.Tr>
                {bulk && <Table.Th w={1} className="no-print"><Checkbox aria-label={t('common.select_all')} checked={allOnPage} indeterminate={!allOnPage && selected.length > 0} onChange={toggleAll} disabled={selectable.length === 0} /></Table.Th>}
                {columns.map((c) => (
                  <Table.Th key={c.key} visibleFrom={c.visibleFrom} style={{ cursor: c.sortable ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
                    onClick={c.sortable ? () => toggleSort(c.key) : undefined}>
                    <Group gap={4} wrap="nowrap">
                      {c.label}
                      {c.sortable && (sort?.key === c.key
                        ? (sort.direction === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />)
                        : <IconArrowsSort size={14} opacity={0.4} />)}
                    </Group>
                  </Table.Th>
                ))}
                {rowActions && <Table.Th className="no-print" w={1}>{t('common.actions')}</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {q.isLoading && Array.from({ length: 5 }).map((_, i) => (
                <Table.Tr key={i}>{bulk && <Table.Td />}{columns.map((c) => <Table.Td key={c.key}><Skeleton h={14} /></Table.Td>)}{rowActions && <Table.Td />}</Table.Tr>
              ))}
              {rows.map((row) => (
                <Table.Tr key={row.id} onClick={onRowClick ? () => onRowClick(row) : undefined} style={{ cursor: onRowClick ? 'pointer' : 'default' }} bg={picked[row.id] ? 'var(--mantine-primary-color-light)' : undefined}>
                  {bulk && <Table.Td className="no-print" onClick={(e) => e.stopPropagation()}><Checkbox aria-label={t('common.select_row')} checked={!!picked[row.id]} onChange={() => toggleRow(row)} disabled={!!selectableRow && !selectableRow(row)} /></Table.Td>}
                  {columns.map((c) => (
                    <Table.Td key={c.key} visibleFrom={c.visibleFrom}>
                      {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '—')}
                    </Table.Td>
                  ))}
                  {rowActions && <Table.Td className="no-print" onClick={(e) => e.stopPropagation()}><Group gap={4} wrap="nowrap">{rowActions(row)}</Group></Table.Td>}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {!q.isLoading && rows.length === 0 && (
          <Stack align="center" py="xl" c="dimmed" gap={4}><IconInbox size={32} /><Text size="sm">{t('common.no_data')}</Text></Stack>
        )}
      </Paper>

      <Group justify="space-between" className="no-print" wrap="wrap">
        <Group gap="xs">
          <Text size="sm" c="dimmed">{t('common.rows')}</Text>
          <Select w={80} size="xs" data={['10', '15', '25', '50', '100']} value={perPage} onChange={(v) => setPerPage(v ?? '15')} allowDeselect={false} />
          {meta && <Text size="sm" c="dimmed">{t('common.total')}: {meta.total}</Text>}
        </Group>
        <Box>{meta && meta.last_page > 1 && <Pagination value={page} onChange={setPage} total={meta.last_page} size="sm" />}</Box>
      </Group>
    </Stack>
  );
}

export function RowIconButton({ label, onClick, children, color }: { label: string; onClick: () => void; children: ReactNode; color?: string }) {
  return <ActionIcon variant="subtle" color={color} aria-label={label} title={label} onClick={onClick}>{children}</ActionIcon>;
}

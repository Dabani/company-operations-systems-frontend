import { Button, Group, Modal, Select, SimpleGrid, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';

export interface SupplierForEdit { id: string; name: string; legal_name?: string | null; tax_number?: string | null; registration_number?: string | null; country_code: string | null; email?: string | null; phone?: string | null; contact_name?: string | null; address?: string | null; category_id: string | null }
const blank = { name: '', legal_name: '', tax_number: '', registration_number: '', country_code: '', email: '', phone: '', contact_name: '', address: '', category_id: null as string | null };

export function SupplierFormModal({ opened, onClose, supplier, onSaved }: { opened: boolean; onClose: () => void; supplier?: SupplierForEdit | null; onSaved: (id: string) => void }) {
  const { t } = useTranslation();
  const cats = useLookup('supplier_category', opened);
  const form = useForm({ initialValues: blank });
  useEffect(() => {
    if (!opened) return;
    form.setValues(supplier ? { name: supplier.name, legal_name: supplier.legal_name ?? '', tax_number: supplier.tax_number ?? '', registration_number: supplier.registration_number ?? '', country_code: supplier.country_code ?? '',
      email: supplier.email ?? '', phone: supplier.phone ?? '', contact_name: supplier.contact_name ?? '', address: supplier.address ?? '', category_id: supplier.category_id } : blank);
    form.clearErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, supplier?.id]);
  const save = useMutation({
    mutationFn: async (v: typeof blank) => {
      const body = { ...v, legal_name: v.legal_name || null, tax_number: v.tax_number || null, registration_number: v.registration_number || null, country_code: v.country_code || null, email: v.email || null, phone: v.phone || null, contact_name: v.contact_name || null, address: v.address || null };
      return (await (supplier ? api.patch<{ data: { id: string } }>(`/suppliers/${supplier.id}`, body) : api.post<{ data: { id: string } }>('/suppliers', body))).data.data;
    },
    onSuccess: (r) => { toastOk(); onSaved(r.id); onClose(); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  return (
    <Modal opened={opened} onClose={onClose} centered size="lg" title={supplier ? t('sup.edit') : t('sup.new')}>
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label={t('sup.name')} required maxLength={190} {...form.getInputProps('name')} />
            <TextInput label={t('sup.legal_name')} maxLength={190} {...form.getInputProps('legal_name')} />
            <TextInput label={t('sup.tax_number')} maxLength={60} {...form.getInputProps('tax_number')} />
            <TextInput label={t('sup.registration_number')} maxLength={60} {...form.getInputProps('registration_number')} />
            <TextInput label={t('sup.country')} description={t('sup.country_help')} maxLength={2} {...form.getInputProps('country_code')} />
            <Select label={t('sup.category')} clearable data={cats.options} {...form.getInputProps('category_id')} />
            <TextInput label={t('common.email')} type="email" maxLength={190} {...form.getInputProps('email')} />
            <TextInput label={t('common.phone')} maxLength={40} {...form.getInputProps('phone')} />
            <TextInput label={t('sup.contact')} maxLength={150} {...form.getInputProps('contact_name')} />
            <TextInput label={t('sup.address')} maxLength={500} {...form.getInputProps('address')} />
          </SimpleGrid>
          <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
        </Stack>
      </form>
    </Modal>
  );
}

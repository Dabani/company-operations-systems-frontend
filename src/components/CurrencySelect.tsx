import { Select } from '@mantine/core';
import { useLookup } from '@/lib/useLookup';

interface Props { value?: string | null; onChange: (code: string) => void; label?: string; error?: string; required?: boolean; disabled?: boolean; description?: string }

/** Currency picker backed by the "currency" lookup list (ISO 4217 codes). The stored value is the code, e.g. RWF. */
export function CurrencySelect({ value, onChange, label, error, required, disabled, description }: Props) {
  const { items } = useLookup('currency');
  const data = items.map((c) => ({ value: c.code, label: `${c.code} — ${c.label}` }));
  if (value && !data.some((d) => d.value === value)) data.push({ value, label: value });      // keep a legacy / deactivated code visible
  return <Select label={label} description={description} error={error} required={required} disabled={disabled} searchable data={data} value={value || null} onChange={(v) => onChange(v ?? '')} />;
}

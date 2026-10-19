import { ThemeIcon } from '@mantine/core';
import { IconFile, IconFileSpreadsheet, IconFileText, IconFileTypePdf, IconFileTypePpt, IconFileWord, IconPhoto } from '@tabler/icons-react';

const MAP: Record<string, { icon: typeof IconFile; color: string }> = {
  pdf: { icon: IconFileTypePdf, color: 'red' }, doc: { icon: IconFileWord, color: 'blue' }, docx: { icon: IconFileWord, color: 'blue' },
  xls: { icon: IconFileSpreadsheet, color: 'green' }, xlsx: { icon: IconFileSpreadsheet, color: 'green' }, csv: { icon: IconFileSpreadsheet, color: 'teal' },
  ppt: { icon: IconFileTypePpt, color: 'orange' }, pptx: { icon: IconFileTypePpt, color: 'orange' },
  png: { icon: IconPhoto, color: 'grape' }, jpg: { icon: IconPhoto, color: 'grape' }, jpeg: { icon: IconPhoto, color: 'grape' }, gif: { icon: IconPhoto, color: 'grape' }, webp: { icon: IconPhoto, color: 'grape' },
  txt: { icon: IconFileText, color: 'gray' }, rtf: { icon: IconFileText, color: 'gray' }, odt: { icon: IconFileText, color: 'blue' }, ods: { icon: IconFileSpreadsheet, color: 'green' },
};

export function FileTypeIcon({ ext, size = 34 }: { ext?: string | null; size?: number }) {
  const m = MAP[(ext ?? '').toLowerCase()] ?? { icon: IconFile, color: 'gray' };
  const I = m.icon;
  return <ThemeIcon size={size} radius="md" variant="light" color={m.color}><I size={size * 0.6} /></ThemeIcon>;
}

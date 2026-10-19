import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Brand: primary blue #3773b8 (shade 6), secondary green #1c9d67 (shade 6).
const brand: MantineColorsTuple = ['#eef4fb', '#dbe7f5', '#b6cfeb', '#8fb5e0', '#6d9fd6', '#5089c8', '#3773b8', '#2d6099', '#244d7b', '#1b3a5d'];
const secondary: MantineColorsTuple = ['#e8f7f0', '#cdeedf', '#9bddc0', '#66cba0', '#3dbb88', '#25ab77', '#1c9d67', '#168054', '#116441', '#0b482e'];

export const FONT = 'Verdana, Geneva, Tahoma, sans-serif';

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 5 },
  colors: { brand, secondary },
  fontFamily: FONT,
  headings: { fontFamily: FONT, fontWeight: '700' },
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    Button: { defaultProps: { fw: 600 } },
    Card: { defaultProps: { withBorder: true, radius: 'md' } },
    Paper: { defaultProps: { radius: 'md' } },
    TextInput: { defaultProps: { size: 'sm' } },
  },
});

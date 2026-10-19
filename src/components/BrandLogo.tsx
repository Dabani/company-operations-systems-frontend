import { Group, Image, Text, ThemeIcon } from '@mantine/core';
import { IconBuildingSkyscraper } from '@tabler/icons-react';

interface Props { name: string; hasLogo?: boolean; size?: number; hideName?: boolean }

/** Organization logo with a replaceable placeholder icon (upload a logo under Administration > Organization). */
export function BrandLogo({ name, hasLogo, size = 32, hideName }: Props) {
  return (
    <Group gap="xs" wrap="nowrap">
      {hasLogo ? (
        <Image src="/api/v1/public/logo" w={size} h={size} fit="contain" alt={name} radius="sm" />
      ) : (
        <ThemeIcon size={size} radius="md" variant="gradient" gradient={{ from: 'brand.6', to: 'secondary.6', deg: 135 }}>
          <IconBuildingSkyscraper size={size * 0.62} />
        </ThemeIcon>
      )}
      {!hideName && <Text fw={700} size="sm" lh={1.2} lineClamp={2}>{name}</Text>}
    </Group>
  );
}

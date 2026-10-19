import { Avatar, type AvatarProps } from '@mantine/core';
import { IconUser } from '@tabler/icons-react';

interface Props extends Omit<AvatarProps, 'src'> { userId?: string; hasAvatar?: boolean; name?: string; bust?: number }

/** Profile photo, or initials / a user icon placeholder when none is uploaded. */
export function UserAvatar({ userId, hasAvatar, name, bust, ...rest }: Props) {
  const src = userId && hasAvatar ? `/api/v1/users/${userId}/avatar${bust ? `?v=${bust}` : ''}` : undefined;
  return (
    <Avatar src={src} name={name} color="initials" radius="xl" {...rest}>
      {!name && <IconUser size="60%" />}
    </Avatar>
  );
}

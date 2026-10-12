import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, UserRoundCheck } from 'lucide-react';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../../../design-system';
import { devAuthEnabled, setDevIdentity, type DevIdentity } from '../../../auth/dev-session';
import styles from '../pages/LoginPage.module.css';

interface DevUser extends DevIdentity {
  status: string;
  roleKeys: string[];
}

/**
 * Local sign-in shortcut: pick one of the seeded demo identities instead of going
 * to Microsoft. Renders nothing unless the SPA is in development with
 * VITE_DEV_AUTH on and the API reports the same, so it cannot appear in a build
 * that would not work anyway.
 *
 * A menu rather than a stack of buttons: this is scaffolding sitting beside the real
 * sign-in, and it should not be the largest thing on the panel.
 */
export function DevIdentityPicker({ onPicked }: { onPicked: () => void }) {
  const { t } = useTranslation('login');
  const [users, setUsers] = useState<DevUser[]>([]);

  useEffect(() => {
    if (!devAuthEnabled) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const base = import.meta.env.VITE_API_BASE_URL;
        if (!base) return;
        const response = await fetch(new URL('/api/dev/users', base), {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) return;
        const body = (await response.json()) as { enabled?: boolean; users?: DevUser[] };
        if (body.enabled) setUsers(body.users ?? []);
      } catch {
        // The picker is a convenience; a failure just leaves Microsoft sign-in.
      }
    })();
    return () => controller.abort();
  }, []);

  if (!devAuthEnabled || users.length === 0) return null;

  return (
    <div className={styles.devPicker}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" iconLeft={<UserRoundCheck size={14} aria-hidden="true" />}>
            {t('devPickerAction')}
            <ChevronDown size={14} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={styles.devPickerMenu}>
          <DropdownMenuLabel>{t('devPickerTitle')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {users.map((user) => (
            <DropdownMenuItem
              key={user.subject}
              onSelect={() => {
                setDevIdentity({
                  subject: user.subject,
                  email: user.email,
                  displayName: user.displayName,
                });
                onPicked();
              }}
            >
              <span className={styles.devPickerItem}>
                <strong>{user.displayName}</strong>
                <small>{user.roleKeys.length > 0 ? user.roleKeys.join(', ') : t('devPickerNoRoles')}</small>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <p>{t('devPickerDescription')}</p>
    </div>
  );
}

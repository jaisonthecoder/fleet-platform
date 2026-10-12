import { forwardRef, type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check, X } from 'lucide-react';

import { cn } from '../utils';
import { Button } from '../primitives/button';
import styles from './ConfirmationDialog.module.css';

export interface ConfirmationDialogProps extends Omit<DialogPrimitive.DialogProps, 'children'> {
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  icon?: ReactNode;
  pending?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  tone?: 'default' | 'destructive';
  error?: ReactNode;
  className?: string;
}

/** FB-03 confirmation dialog composed directly from Radix/shadcn primitives. */
export const ConfirmationDialog = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  ConfirmationDialogProps
>(function ConfirmationDialog(
  {
    title,
    description,
    confirmLabel,
    cancelLabel,
    closeLabel,
    icon,
    pending = false,
    confirmDisabled = false,
    onConfirm,
    tone = 'default',
    error,
    className,
    ...rootProps
  },
  ref,
) {
  return (
    <DialogPrimitive.Root {...rootProps}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(styles.content, tone === 'destructive' && styles.destructive, className)}
        >
          <DialogPrimitive.Close className={styles.close} aria-label={closeLabel}>
            <X aria-hidden="true" />
          </DialogPrimitive.Close>
          <span className={styles.icon} aria-hidden="true">
            {icon ?? <Check />}
          </span>
          <DialogPrimitive.Title className={styles.title}>{title}</DialogPrimitive.Title>
          <span className={styles.rule} aria-hidden="true" />
          <DialogPrimitive.Description className={styles.description}>
            {description}
          </DialogPrimitive.Description>
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}
          <div className={styles.actions}>
            <DialogPrimitive.Close asChild>
              <Button variant="outline">{cancelLabel}</Button>
            </DialogPrimitive.Close>
            <Button
              aria-busy={pending || undefined}
              disabled={pending || confirmDisabled || Boolean(error)}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
});

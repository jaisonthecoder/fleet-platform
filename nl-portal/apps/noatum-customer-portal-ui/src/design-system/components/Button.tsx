import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';

import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'outline' | 'quiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks interaction. Keeps the label so width does not jump. */
  loading?: boolean;
  fullWidth?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  /** Square, label-free button. Pass the label through aria-label. */
  iconOnly?: boolean;
  /**
   * The button is sitting on the navy band.
   *
   * `outline` on a dark surface is otherwise a red rule on a red-on-navy label,
   * which is both unreadable and off-brand — on dark it becomes a white rule and
   * a white label, and `primary` keeps the brand red with a glow so it still
   * reads as the one action on the band.
   */
  onDark?: boolean;
}

const buttonVariants = cva(styles.button, {
  variants: {
    variant: { primary: styles.primary, outline: styles.outline, quiet: styles.quiet },
    size: { sm: styles.sm, md: styles.md, lg: styles.lg },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

/**
 * Rendered as a plain button rather than through the shadcn primitive: its Tailwind
 * variants (fixed h-9, px-4, shadow, hover:bg-accent) merged over this stylesheet and
 * fought every size and colour rule the brand sets.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    iconOnly = false,
    onDark = false,
    iconLeft,
    iconRight,
    disabled,
    children,
    className,
    type = 'button',
    ...rest
  }: ButtonProps,
  ref,
) {
  const classes = [
    buttonVariants({ variant, size }),
    fullWidth ? styles.fullWidth : '',
    iconOnly ? styles.iconOnly : '',
    onDark ? styles.onDark : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : iconLeft}
      {/* Icons are commonly passed as children, so the label itself has to align them. */}
      {iconOnly ? children : <span className={styles.label}>{children}</span>}
      {!loading && iconRight}
    </button>
  );
});

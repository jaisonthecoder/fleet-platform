import * as React from 'react';

import { cn } from '@/design-system/utils';

/**
 * shadcn Input, wearing the kit's IN-01 field treatment.
 *
 * The appearance lives in the `.noa-control` class rather than here, so a
 * native input, a Radix select trigger and a textarea are the same object on
 * screen and there is one place to change them.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} className={cn('noa-control', className)} ref={ref} {...props} />
  ),
);
Input.displayName = 'Input';

export { Input };

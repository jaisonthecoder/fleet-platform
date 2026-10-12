import { forwardRef, useId, type SVGProps } from 'react';

import {
  LOGISTICS_ICONS,
  type LogisticsIconName,
  type LogisticsIconSize,
} from './logistics-icon-data';

type IconAccessibility =
  { decorative?: true; label?: never } | { decorative: false; label: string };

export type LogisticsIconProps = Omit<SVGProps<SVGSVGElement>, 'name'> &
  IconAccessibility & {
    name: LogisticsIconName;
    size?: LogisticsIconSize;
  };

/** FN-07 logistics icon rendered from the exact UI-kit path registry. */
export const LogisticsIcon = forwardRef<SVGSVGElement, LogisticsIconProps>(function LogisticsIcon(
  { name, size = 24, decorative = true, label, ...rest },
  ref,
) {
  const titleId = useId();
  const [, path] = LOGISTICS_ICONS[name];

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden={decorative ? true : undefined}
      aria-labelledby={decorative ? undefined : titleId}
      role={decorative ? undefined : 'img'}
      {...rest}
    >
      {!decorative && <title id={titleId}>{label}</title>}
      <path d={path} />
    </svg>
  );
});

import { forwardRef, type SVGProps } from 'react';
import {
  ArrowLeftRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Home,
  List,
  Menu,
  Minus,
  Plus,
  Search,
  X,
} from 'lucide-react';

const UI_GLYPHS = {
  bell: Bell,
  calendar: CalendarDays,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevrons-left': ChevronsLeft,
  'chevrons-right': ChevronsRight,
  close: X,
  document: FileText,
  home: Home,
  list: List,
  menu: Menu,
  minus: Minus,
  plus: Plus,
  search: Search,
  swap: ArrowLeftRight,
} as const;
export type UiGlyphName = keyof typeof UI_GLYPHS;
export interface UiGlyphProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: UiGlyphName;
  label?: string;
}
export const UiGlyph = forwardRef<SVGSVGElement, UiGlyphProps>(function UiGlyph(
  { name, label, ...rest },
  ref,
) {
  const Glyph = UI_GLYPHS[name];
  return (
    <Glyph
      ref={ref}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      {...rest}
    />
  );
});

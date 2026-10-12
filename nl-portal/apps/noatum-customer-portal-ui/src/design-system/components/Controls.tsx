import {
  forwardRef,
  useId,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from 'react';
import { Dialog as DialogRoot, DialogTrigger as ShadcnDialogTrigger, DialogClose as ShadcnDialogClose, DialogTitle as ShadcnDialogTitle, DialogDescription as ShadcnDialogDescription, DialogContent as ShadcnDialogContent } from '../primitives/dialog';
import { Checkbox as ShadcnCheckbox } from '../primitives/checkbox';
import { Switch as ShadcnSwitch } from '../primitives/switch';
import { TooltipProvider, Tooltip as TooltipRoot, TooltipTrigger, TooltipContent } from '../primitives/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../primitives/tabs';
import { Badge as ShadcnBadge } from '../primitives/badge';
import { Label } from '../primitives/label';
import { cn } from '../utils';

export const Dialog = DialogRoot;
export const DialogTrigger = ShadcnDialogTrigger;
export const DialogClose = ShadcnDialogClose;
export const DialogTitle = ShadcnDialogTitle;
export const DialogDescription = ShadcnDialogDescription;

export const DialogContent = forwardRef<
  ElementRef<typeof ShadcnDialogContent>,
  ComponentPropsWithoutRef<typeof ShadcnDialogContent> & {
    closeLabel: string;
    side?: 'left' | 'right';
  }
>(function DialogContent({ children, className, closeLabel, side, ...props }, ref) {
  return (
      <ShadcnDialogContent
        ref={ref}
        className={cn('noa-dialog', side && `noa-sheet-${side}`, className)}
        closeLabel={closeLabel}
        {...props}
      >
        {children}
      </ShadcnDialogContent>
  );
});

export function Checkbox({
  label,
  labelHidden = false,
  ...props
}: ComponentPropsWithoutRef<typeof ShadcnCheckbox> & {
  label: string;
  /**
   * Hides the label without removing it. A row's select box has no room for
   * words, but "Select Q-000112" is the only thing that tells a screen reader
   * which row it is about - so the label is always written, never omitted.
   */
  labelHidden?: boolean;
}) {
  const id = useId();
  return (
    <div className="noa-choice">
      <ShadcnCheckbox {...props} id={id} className="noa-checkbox" />
      <Label htmlFor={id} className={labelHidden ? 'noa-visually-hidden' : undefined}>
        {label}
      </Label>
    </div>
  );
}

export function Switch({
  label,
  ...props
}: ComponentPropsWithoutRef<typeof ShadcnSwitch> & { label: string }) {
  const id = useId();
  return (
    <div className="noa-choice">
      <ShadcnSwitch {...props} id={id} className="noa-switch" />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={250}>
      <TooltipRoot>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent sideOffset={6} className="noa-tooltip">
            {label}
          </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}

export const TabGroup = Tabs;
export const TabPanel = TabsContent;
export function TabList(props: ComponentPropsWithoutRef<typeof TabsList>) {
  return <TabsList {...props} className={cn('noa-tab-list', props.className)} />;
}
export function Tab(props: ComponentPropsWithoutRef<typeof TabsTrigger>) {
  return <TabsTrigger {...props} className={cn('noa-tab', props.className)} />;
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'info' | 'error' | 'success' | 'warning';
}) {
  return <ShadcnBadge className={cn('noa-badge', `noa-badge-${tone}`)}>{children}</ShadcnBadge>;
}

export function StatePanel({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="noa-state">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

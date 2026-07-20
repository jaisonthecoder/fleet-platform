import { createElement } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

type Tone = 'ok' | 'warn' | 'danger' | 'info'

interface NotifyOptions {
  description?: string
  duration?: number
  action?: { label: string; onClick: () => void }
}

const toneIcon: Record<Tone, LucideIcon> = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  danger: XCircle,
  info: Info,
}

const toneIconClass: Record<Tone, string> = {
  ok: 'text-success',
  warn: 'text-warning',
  danger: 'text-destructive',
  info: 'text-info',
}

function make(tone: Tone) {
  return (message: string, opts?: NotifyOptions) =>
    toast(message, {
      description: opts?.description,
      duration: opts?.duration,
      action: opts?.action,
      icon: createElement(toneIcon[tone], {
        className: `size-[18px] ${toneIconClass[tone]}`,
        'aria-hidden': true,
      }),
    })
}

/**
 * Tone-aware toast helpers on top of sonner. Colour is never the only signal —
 * each tone carries its own icon. Messages are announced via sonner's live region.
 */
export const notify = {
  ok: make('ok'),
  warn: make('warn'),
  danger: make('danger'),
  info: make('info'),
  message: (message: string, opts?: NotifyOptions) => toast(message, opts),
  promise: toast.promise,
  dismiss: toast.dismiss,
}

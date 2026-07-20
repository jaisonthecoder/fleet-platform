import { type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ResourceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  submitLabel?: string
  cancelLabel?: string
  isPending?: boolean
  submitDisabled?: boolean
  /** Form-level server error (e.g. a mapped RFC-7807 reason). */
  error?: string | null
  /** Invoked on submit — the consumer wires `form.handleSubmit(...)` here. */
  onSubmit: () => void
  children: ReactNode
}

/**
 * Create/edit dialog scaffold: title/description, a form-level error slot, the
 * consumer's fields, and a Cancel / Save footer with a pending state. Reused by
 * every admin write flow (consumer owns the RHF form + submit handler).
 */
export function ResourceFormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  cancelLabel,
  isPending,
  submitDisabled,
  error,
  onSubmit,
  children,
}: ResourceFormDialogProps) {
  const { t } = useTranslation()
  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault()
    onSubmit()
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {error ? (
            <Alert tone="danger">
              <AlertTriangle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {children}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {cancelLabel ?? t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending || submitDisabled}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {submitLabel ?? t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

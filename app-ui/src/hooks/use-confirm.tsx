import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/**
 * Provides an imperative `confirm()` returning a promise. Renders a single
 * app-level AlertDialog. `tone:'danger'` styles the confirm button destructive.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useMemo<ConfirmFn>(
    () => (opts) => {
      setOptions(opts)
      return new Promise<boolean>((resolve) => {
        resolver.current = resolve
      })
    },
    [],
  )

  const settle = (result: boolean): void => {
    resolver.current?.(result)
    resolver.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext value={confirm}>
      {children}
      <AlertDialog
        open={options !== null}
        onOpenChange={(open) => {
          if (!open) settle(false)
        }}
      >
        {options ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{options.title}</AlertDialogTitle>
              {options.description ? (
                <AlertDialogDescription>
                  {options.description}
                </AlertDialogDescription>
              ) : null}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => settle(false)}>
                {options.cancelLabel ?? t('common.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  variant={
                    options.tone === 'danger' ? 'destructive' : 'default'
                  }
                  onClick={() => settle(true)}
                >
                  {options.confirmLabel ?? t('common.confirm')}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </ConfirmContext>
  )
}

/** Returns the imperative `confirm()`; throws outside a `ConfirmProvider`. */
export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return context
}

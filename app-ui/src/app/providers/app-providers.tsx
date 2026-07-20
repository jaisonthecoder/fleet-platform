import { useEffect, useState, type ReactNode } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { ConfirmProvider } from '@/hooks/use-confirm'
import i18n, { directionFor } from '@/i18n/config'
import { createQueryClient } from './query-client'
import { ScopeProvider } from './scope-provider'
import { SidebarProvider } from './sidebar-provider'
import { ThemeProvider } from './theme-provider'

/** Keeps the document `lang`/`dir` in sync with the active language. */
function useDocumentLanguage(): void {
  useEffect(() => {
    const apply = (language: string): void => {
      const root = document.documentElement
      root.lang = language
      root.dir = directionFor(language)
    }
    apply(i18n.language)
    i18n.on('languageChanged', apply)
    return () => i18n.off('languageChanged', apply)
  }, [])
}

interface AppProvidersProps {
  children: ReactNode
  /** Optional client injection for tests; defaults to the app client. */
  queryClient?: QueryClient
}

/** Composes the global providers (query, i18n, theme, tooltips). */
export function AppProviders({ children, queryClient }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createQueryClient())
  useDocumentLanguage()

  return (
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <SidebarProvider>
            <ScopeProvider>
              <TooltipProvider>
                <ConfirmProvider>{children}</ConfirmProvider>
                <Toaster />
              </TooltipProvider>
            </ScopeProvider>
          </SidebarProvider>
        </ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  )
}

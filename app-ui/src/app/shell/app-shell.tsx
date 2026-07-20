import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { AppHeader } from './app-header'
import { AppSidebar } from './app-sidebar'
import { CommandPalette } from './command-palette'

/** The application shell: collapsible navy sidebar + sticky header + content. */
export function AppShell() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <CommandPalette />
      <a
        href="#main-content"
        className="sr-only left-2 top-2 z-50 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:absolute"
      >
        {t('common.skipToContent')}
      </a>

      <AppSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main
          id="main-content"
          className="flex-1 px-5 pb-16 pt-7 md:px-[34px]"
          tabIndex={-1}
        >
          <div className="w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

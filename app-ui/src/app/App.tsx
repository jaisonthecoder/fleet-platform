import { useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { AppProviders } from '@/app/providers/app-providers'
import { AuthProvider } from '@/features/auth/auth-context'
import { ErrorBoundary } from './error-boundary'
import { createAppRouter } from './routing/router'

/** Application root: global providers + auth + error boundary wrapping the router. */
export function App() {
  const [router] = useState(createAppRouter)
  return (
    <AppProviders>
      <AuthProvider>
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
      </AuthProvider>
    </AppProviders>
  )
}

export default App

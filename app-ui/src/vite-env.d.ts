/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: 'development' | 'ut' | 'production'
  readonly VITE_APP_NAME: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_PROXY?: string
  readonly VITE_API_URL?: string
  readonly VITE_ENABLE_MSW?: string
  readonly VITE_USE_FIXTURE_API?: string
  // Azure AD / Entra — preferred VITE_AAD_* names.
  readonly VITE_AAD_TENANT_ID?: string
  readonly VITE_AAD_CLIENT_ID?: string
  readonly VITE_AAD_AUTHORITY?: string
  readonly VITE_AAD_REDIRECT_URI?: string
  readonly VITE_AAD_POST_LOGOUT_REDIRECT_URI?: string
  readonly VITE_AAD_API_SCOPE?: string
  readonly VITE_DEV_LOGIN?: string
  // Legacy Entra names (still supported as a fallback).
  readonly VITE_ENTRA_CLIENT_ID?: string
  readonly VITE_ENTRA_TENANT_ID?: string
  readonly VITE_ENTRA_AUTHORITY?: string
  readonly VITE_ENTRA_API_SCOPE?: string
  readonly VITE_ENTRA_REDIRECT_URI?: string
  readonly VITE_ENTRA_POST_LOGOUT_REDIRECT_URI?: string
  readonly VITE_AUTH_DEV_LOGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

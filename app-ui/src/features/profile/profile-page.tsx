import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CredentialPanel } from './credential-panel'
import { useMyCredentials, useUpdateMyCredentials } from './use-credentials'

/**
 * Self-service profile hub (P6 seed). Phase 1 lands the driver-credential
 * section so an employee can view and capture their own licence / Emirates ID;
 * later phases add documents, bookings, requests and issues.
 */
export function ProfilePage() {
  const { t } = useTranslation()
  const credentials = useMyCredentials()
  const update = useUpdateMyCredentials()

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('profile.eyebrow')}
        title={t('profile.title')}
        description={t('profile.subtitle')}
      />

      {credentials.isPending ? (
        <p className="p-10 text-center text-sm text-muted-foreground">
          {t('profile.loading')}
        </p>
      ) : credentials.isError ? (
        <Alert tone="danger" className="w-auto">
          <AlertTitle>{t('profile.errorTitle')}</AlertTitle>
          <AlertDescription>{t('profile.errorBody')}</AlertDescription>
        </Alert>
      ) : (
        <CredentialPanel
          title={t('profile.credentials.title')}
          credentials={credentials.data}
          onSave={(input) => update.mutateAsync(input)}
          saving={update.isPending}
        />
      )}
    </div>
  )
}

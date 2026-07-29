import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useLookupValues } from '@/features/config/hooks/use-lookups'
import type { CreateLeaseContractInput } from './vendors.contract'

interface LeaseContractFormProps {
  pending: boolean
  onCancel: () => void
  onSubmit: (input: CreateLeaseContractInput) => void
}

/** Captures the backend-supported commercial terms for a new lease contract. */
export function LeaseContractForm({
  pending,
  onCancel,
  onSubmit,
}: LeaseContractFormProps) {
  const { t, i18n } = useTranslation()
  const currencies = useLookupValues('currency')
  const [contractRef, setContractRef] = useState('')
  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [currency, setCurrency] = useState('AED')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [offHireNoticeDays, setOffHireNoticeDays] = useState('30')
  const [earlyTerminationPenalty, setEarlyTerminationPenalty] = useState('')
  const [renewalOptions, setRenewalOptions] = useState('')
  const [escalationClause, setEscalationClause] = useState('')
  const [replacementClause, setReplacementClause] = useState('')
  const [alertLadder, setAlertLadder] = useState('90/60/30')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      contractRef: contractRef.trim(),
      monthlyAmount: monthlyAmount || undefined,
      currency,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      offHireNoticeDays: offHireNoticeDays
        ? Number(offHireNoticeDays)
        : undefined,
      earlyTerminationPenalty: earlyTerminationPenalty.trim() || undefined,
      renewalOptions: renewalOptions.trim() || undefined,
      escalationClause: escalationClause.trim() || undefined,
      replacementClause: replacementClause.trim() || undefined,
      alertLadder: alertLadder.trim() || undefined,
    })
  }

  return (
    <form
      className="border-border mb-4 space-y-3 rounded-md border p-3"
      onSubmit={submit}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <LeaseInput
          id="lease-reference"
          label={t('vendors.leases.fields.contractRef')}
          value={contractRef}
          onChange={setContractRef}
          required
        />
        <LeaseInput
          id="lease-monthly-amount"
          label={t('vendors.leases.fields.monthlyAmount')}
          value={monthlyAmount}
          onChange={setMonthlyAmount}
          type="number"
        />
        <div className="space-y-1">
          <Label htmlFor="lease-currency">
            {t('vendors.leases.fields.currency')}
          </Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id="lease-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(currencies.data ?? []).map((option) => (
                <SelectItem key={option.id} value={option.code}>
                  {(i18n.resolvedLanguage ?? i18n.language).startsWith('ar')
                    ? option.labelAr
                    : option.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <LeaseInput
          id="lease-off-hire-notice"
          label={t('vendors.leases.fields.offHireNoticeDays')}
          value={offHireNoticeDays}
          onChange={setOffHireNoticeDays}
          type="number"
        />
        <LeaseInput
          id="lease-start-date"
          label={t('vendors.leases.fields.startDate')}
          value={startDate}
          onChange={setStartDate}
          type="date"
        />
        <LeaseInput
          id="lease-end-date"
          label={t('vendors.leases.fields.endDate')}
          value={endDate}
          onChange={setEndDate}
          type="date"
        />
      </div>
      <LeaseInput
        id="lease-penalty"
        label={t('vendors.leases.fields.earlyTerminationPenalty')}
        value={earlyTerminationPenalty}
        onChange={setEarlyTerminationPenalty}
      />
      <LeaseInput
        id="lease-renewal-options"
        label={t('vendors.leases.fields.renewalOptions')}
        value={renewalOptions}
        onChange={setRenewalOptions}
      />
      <LeaseInput
        id="lease-escalation-clause"
        label={t('vendors.leases.fields.escalationClause')}
        value={escalationClause}
        onChange={setEscalationClause}
      />
      <LeaseInput
        id="lease-replacement-clause"
        label={t('vendors.leases.fields.replacementClause')}
        value={replacementClause}
        onChange={setReplacementClause}
      />
      <LeaseInput
        id="lease-alert-ladder"
        label={t('vendors.leases.fields.alertLadder')}
        value={alertLadder}
        onChange={setAlertLadder}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={pending || !contractRef.trim()}>
          {t('vendors.leases.create')}
        </Button>
      </div>
    </form>
  )
}

interface LeaseInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number' | 'date'
  required?: boolean
}

/** Renders one labelled lease-contract field. */
function LeaseInput({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: LeaseInputProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </div>
  )
}

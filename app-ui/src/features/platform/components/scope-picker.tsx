import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { useHierarchy } from '../hooks/use-hierarchy'
import { flattenHierarchy } from '../platform.contract'

interface ScopePickerProps {
  value?: string
  onChange: (scopeNodeId: string) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
}

/**
 * Form control for choosing a hierarchy scope node (reused by role assignment
 * and any scope-bound form). Options are indented by tree depth and labelled
 * `<level> · <name>`; the value is the node id.
 */
export function ScopePicker({
  value,
  onChange,
  placeholder,
  disabled,
  invalid,
  className,
}: ScopePickerProps) {
  const { t } = useTranslation()
  const { data } = useHierarchy()

  const options = useMemo<ComboboxOption[]>(
    () =>
      flattenHierarchy(data ?? []).map((node) => ({
        value: node.id,
        label: `${'— '.repeat(node.depth)}${node.levelLabel} · ${node.name}`,
      })),
    [data],
  )

  return (
    <Combobox
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder ?? t('scope.placeholder')}
      searchPlaceholder={t('scope.search')}
      emptyText={t('scope.empty')}
      disabled={disabled}
      invalid={invalid}
      className={className}
    />
  )
}

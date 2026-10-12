import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../utils';
import styles from './Provenance.module.css';
export interface ProvenanceOverride {
  label: string;
  reasonLabel: string;
  reason: string;
  onReasonChange: (reason: string) => void;
  onOverride: () => void;
  disabled?: boolean;
}
export interface ProvenanceProps extends HTMLAttributes<HTMLDivElement> {
  sourceLabel: ReactNode;
  source: ReactNode;
  versionLabel?: ReactNode;
  version?: ReactNode;
  confidenceLabel?: ReactNode;
  confidence?: ReactNode;
  override?: ProvenanceOverride;
}
export const Provenance = forwardRef<HTMLDivElement, ProvenanceProps>(function Provenance(
  {
    sourceLabel,
    source,
    versionLabel,
    version,
    confidenceLabel,
    confidence,
    override,
    className,
    ...rest
  },
  ref,
) {
  return (
    <div ref={ref} className={cn(styles.provenance, className)} {...rest}>
      <dl>
        <div>
          <dt>{sourceLabel}</dt>
          <dd>{source}</dd>
        </div>
        {versionLabel && version && (
          <div>
            <dt>{versionLabel}</dt>
            <dd>{version}</dd>
          </div>
        )}
        {confidenceLabel && confidence && (
          <div>
            <dt>{confidenceLabel}</dt>
            <dd>{confidence}</dd>
          </div>
        )}
      </dl>
      {override && (
        <div>
          <label>
            {override.reasonLabel}
            <input
              value={override.reason}
              onChange={(event) => override.onReasonChange(event.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={override.disabled || !override.reason.trim()}
            onClick={override.onOverride}
          >
            {override.label}
          </button>
        </div>
      )}
    </div>
  );
});

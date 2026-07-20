import { useId, useState } from 'react'
import { Camera, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CameraCapture } from '@/components/patterns/camera-capture'

export interface DamageMark {
  id: string
  /** Position as a percentage of the diagram box (0–100). */
  x: number
  y: number
  note: string
  /** Attached photos as data URLs (optional, multiple supported). */
  photos: string[]
  /** Carried over from a previous booking — read-only evidence. */
  existing?: boolean
}

interface DamageMarkerProps {
  marks: DamageMark[]
  onChange: (marks: DamageMark[]) => void
  className?: string
  /** Hint shown when a new mark has no photo yet. */
  requirePhotoHint?: boolean
}

/** Portrait car top-view (from the fleet-manager handover screen), tokenised. */
function CarOutline() {
  return (
    <svg
      viewBox="0 0 200 380"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 m-auto h-full"
    >
      <rect
        x="35"
        y="20"
        rx="42"
        ry="52"
        width="130"
        height="340"
        fill="var(--surface)"
        stroke="var(--ink)"
        strokeWidth={2.5}
      />
      <path
        d="M50 120 Q100 96 150 120"
        fill="none"
        stroke="var(--ink-2)"
        strokeWidth={1.6}
      />
      <path
        d="M50 250 Q100 272 150 250"
        fill="none"
        stroke="var(--ink-2)"
        strokeWidth={1.6}
      />
      <rect
        x="58"
        y="132"
        width="84"
        height="106"
        rx="12"
        fill="none"
        stroke="var(--ink-2)"
        strokeWidth={1.6}
      />
      <line
        x1="35"
        y1="86"
        x2="12"
        y2="96"
        stroke="var(--ink-2)"
        strokeWidth={1.6}
      />
      <line
        x1="165"
        y1="86"
        x2="188"
        y2="96"
        stroke="var(--ink-2)"
        strokeWidth={1.6}
      />
      <line
        x1="35"
        y1="290"
        x2="12"
        y2="300"
        stroke="var(--ink-2)"
        strokeWidth={1.6}
      />
      <line
        x1="165"
        y1="290"
        x2="188"
        y2="300"
        stroke="var(--ink-2)"
        strokeWidth={1.6}
      />
    </svg>
  )
}

/**
 * Reusable damage/scratch marker. Tap the vehicle diagram to drop a numbered
 * pin; each pin holds a note and any number of photos captured from the device
 * camera. Existing marks (from the previous booking) are read-only evidence.
 */
export function DamageMarker({
  marks,
  onChange,
  className,
  requirePhotoHint = true,
}: DamageMarkerProps) {
  const uid = useId()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cameraFor, setCameraFor] = useState<string | null>(null)

  const addMark = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const keyboard = event.clientX === 0 && event.clientY === 0
    const x = keyboard ? 50 : ((event.clientX - rect.left) / rect.width) * 100
    const y = keyboard ? 50 : ((event.clientY - rect.top) / rect.height) * 100
    const id = `${uid}-${Date.now()}`
    onChange([...marks, { id, x, y, note: '', photos: [] }])
    setSelectedId(id)
  }

  const update = (id: string, patch: Partial<DamageMark>) =>
    onChange(marks.map((m) => (m.id === id ? { ...m, ...patch } : m)))

  const remove = (id: string) => {
    onChange(marks.filter((m) => m.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  return (
    <div
      className={cn('grid gap-4 sm:grid-cols-[minmax(0,300px)_1fr]', className)}
    >
      {/* Diagram */}
      <div className="relative mx-auto h-[360px] w-full max-w-[300px] overflow-hidden rounded-[3px] border border-border bg-surface-2">
        <CarOutline />
        <button
          type="button"
          onClick={addMark}
          aria-label="Tap the vehicle to mark damage"
          className="absolute inset-0 cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        />
        {marks.map((mark, index) => (
          <button
            key={mark.id}
            type="button"
            onClick={() => setSelectedId(mark.id)}
            aria-label={`Damage ${index + 1}${mark.existing ? ' (existing)' : ''}`}
            style={{ left: `${mark.x}%`, top: `${mark.y}%` }}
            className={cn(
              'absolute grid size-[26px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-destructive font-data text-[12px] font-bold text-destructive-foreground shadow-[0_1px_3px_rgba(0,0,0,0.35)] outline-none',
              selectedId === mark.id && 'ring-2 ring-signal ring-offset-1',
            )}
          >
            {index + 1}
          </button>
        ))}
      </div>

      {/* Details */}
      <div className="space-y-3">
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Existing marks carry over from the last return. New pins are
          timestamped, photographed and countersigned — they become evidence,
          not argument.
        </p>

        {marks.length === 0 ? (
          <p className="rounded-[3px] border border-dashed border-border bg-card px-3 py-4 text-center text-sm text-muted-foreground">
            No damage pinned — tap the diagram to add a mark.
          </p>
        ) : (
          <ul className="space-y-2">
            {marks.map((mark, index) => (
              <li key={mark.id}>
                <div
                  className={cn(
                    'rounded-[3px] border bg-card p-3',
                    selectedId === mark.id ? 'border-signal' : 'border-border',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-destructive font-data text-[11px] font-bold text-destructive-foreground">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedId(mark.id)}
                      className="flex-1 text-start text-[13.5px] font-semibold outline-none hover:text-brand"
                    >
                      {mark.existing
                        ? 'Existing mark · previous booking'
                        : mark.note || 'New mark · tap to describe'}
                    </button>
                    {mark.existing ? (
                      <span className="eyebrow">logged</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => remove(mark.id)}
                        aria-label={`Remove damage ${index + 1}`}
                        className="grid size-7 place-items-center rounded-[3px] text-muted-foreground hover:bg-surface-hover hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>

                  {selectedId === mark.id && !mark.existing ? (
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      <textarea
                        value={mark.note}
                        onChange={(e) =>
                          update(mark.id, { note: e.target.value })
                        }
                        placeholder="Describe the damage (e.g. scratch, front-left wing)"
                        className="min-h-16 w-full rounded-[3px] border border-input bg-surface-2 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        {mark.photos.map((photo, i) => (
                          <span
                            key={i}
                            className="relative size-14 overflow-hidden rounded-[3px] border border-border"
                          >
                            <img
                              src={photo}
                              alt={`Damage ${index + 1} evidence ${i + 1}`}
                              className="size-full object-cover"
                            />
                            <button
                              type="button"
                              aria-label={`Remove photo ${i + 1}`}
                              onClick={() =>
                                update(mark.id, {
                                  photos: mark.photos.filter((_, j) => j !== i),
                                })
                              }
                              className="absolute end-0 top-0 grid size-4 place-items-center bg-destructive text-destructive-foreground"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() => setCameraFor(mark.id)}
                          className="flex size-14 flex-col items-center justify-center gap-1 rounded-[3px] border border-dashed border-input text-[10px] font-semibold text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                        >
                          <Camera className="size-4" aria-hidden="true" />
                          Photo
                        </button>
                      </div>
                      {requirePhotoHint && mark.photos.length === 0 ? (
                        <p className="text-[12px] text-warning">
                          Attach at least one photo as evidence.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CameraCapture
        open={cameraFor !== null}
        onOpenChange={(open) => {
          if (!open) setCameraFor(null)
        }}
        onCapture={(dataUrl) => {
          if (cameraFor) {
            const mark = marks.find((m) => m.id === cameraFor)
            if (mark) update(cameraFor, { photos: [...mark.photos, dataUrl] })
          }
        }}
        title="Photograph the damage"
        description="Capture the marked area as evidence."
      />
    </div>
  )
}

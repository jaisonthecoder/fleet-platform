import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react'
import { cn } from '@/lib/utils'

export interface SignaturePadHandle {
  clear: () => void
  toDataURL: () => string | null
  isSigned: () => boolean
  /** 'drawn' → data URL; 'typed' → the typed name. */
  getValue: () => { mode: 'draw' | 'type'; value: string | null }
}

interface SignaturePadProps {
  ref?: Ref<SignaturePadHandle>
  /** Designated signer — pre-fills the typed-signature field. */
  signerName?: string
  onSignedChange?: (signed: boolean) => void
  className?: string
  height?: number
}

/**
 * Signature capture with two modes: free-draw (pointer/touch, DPR-accurate) or
 * a typed signature using the designated user's name. Reports signed state and
 * exposes clear()/toDataURL()/getValue() via ref.
 */
export function SignaturePad({
  ref,
  signerName = '',
  onSignedChange,
  className,
  height = 170,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<'draw' | 'type'>('draw')
  const [drawn, setDrawn] = useState(false)
  const [typed, setTyped] = useState(signerName)
  const drawnRef = useRef(false)

  // Reset the typed name if the designated signer changes.
  useEffect(() => {
    setTyped(signerName)
  }, [signerName])

  const signed = mode === 'draw' ? drawn : typed.trim().length > 0
  useEffect(() => {
    onSignedChange?.(signed)
    // onSignedChange is a stable setter in practice
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signed])

  // Canvas drawing (only while in draw mode).
  useEffect(() => {
    if (mode !== 'draw') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const ink =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--ink')
        .trim() || '#10181f'

    const setup = () => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const dpr = window.devicePixelRatio || 1
      let prev: ImageData | null = null
      try {
        prev = ctx.getImageData(0, 0, canvas.width, canvas.height)
      } catch {
        prev = null
      }
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineWidth = 2.2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = ink
      if (prev) {
        try {
          ctx.putImageData(prev, 0, 0)
        } catch {
          /* size changed — nothing to restore */
        }
      }
    }
    setup()
    const observer = new ResizeObserver(setup)
    observer.observe(canvas)

    let drawing = false
    const at = (e: PointerEvent) => {
      // Canvas is borderless, so the rect is the exact drawing surface.
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const down = (e: PointerEvent) => {
      drawing = true
      canvas.setPointerCapture(e.pointerId)
      const p = at(e)
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x + 0.1, p.y + 0.1) // dot on a tap
      ctx.stroke()
      if (!drawnRef.current) {
        drawnRef.current = true
        setDrawn(true)
      }
    }
    const move = (e: PointerEvent) => {
      if (!drawing) return
      e.preventDefault()
      const p = at(e)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
    const up = () => {
      drawing = false
    }

    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      observer.disconnect()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [mode])

  const clearDrawing = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawnRef.current = false
    setDrawn(false)
  }

  useImperativeHandle(ref, () => ({
    clear: () => {
      clearDrawing()
      setTyped('')
    },
    toDataURL: () =>
      mode === 'draw'
        ? (canvasRef.current?.toDataURL('image/png') ?? null)
        : null,
    isSigned: () =>
      mode === 'draw' ? drawnRef.current : typed.trim().length > 0,
    getValue: () =>
      mode === 'draw'
        ? { mode, value: canvasRef.current?.toDataURL('image/png') ?? null }
        : { mode, value: typed },
  }))

  return (
    <div className={cn('space-y-2', className)}>
      <div
        role="tablist"
        aria-label="Signature method"
        className="inline-flex gap-1 rounded-[3px] bg-surface-2 p-1"
      >
        {(['draw', 'type'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              'rounded-[2px] px-3 py-1.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              mode === m
                ? 'bg-brand text-brand-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m === 'draw' ? 'Draw' : 'Type'}
          </button>
        ))}
      </div>

      <div
        className={cn(
          'overflow-hidden rounded-[3px] border bg-surface-2',
          signed ? 'border-brand' : 'border-dashed border-input',
        )}
        style={{ height }}
      >
        {mode === 'draw' ? (
          <canvas
            ref={canvasRef}
            aria-label="Signature area. Sign with finger, stylus or mouse."
            className="block size-full touch-none"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-4">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={signerName || 'Type your full name'}
              aria-label="Type your full name to sign"
              className="w-full bg-transparent text-center text-2xl italic tracking-wide outline-none placeholder:text-base placeholder:not-italic placeholder:text-ink-3"
            />
            <span className="mt-2 border-t border-dashed border-input px-10 pt-1.5 text-[11px] uppercase tracking-[0.08em] text-ink-3">
              Signature
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

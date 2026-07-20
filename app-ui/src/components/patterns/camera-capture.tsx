import { useEffect, useRef, useState } from 'react'
import { Camera, ImageUp, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface CameraCaptureProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Receives the captured image as a JPEG data URL. */
  onCapture: (dataUrl: string) => void
  title?: string
  description?: string
}

/**
 * Reusable device-camera capture. Opens a live `getUserMedia` preview (rear
 * camera by default) with a snapshot button; falls back to the native file /
 * camera picker (`capture="environment"`) when a live stream isn't available.
 */
export function CameraCapture({
  open,
  onOpenChange,
  onCapture,
  title = 'Capture photo',
  description = 'Point the camera at the vehicle, then capture.',
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const stop = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setReady(false)
    }

    const start = async () => {
      const media = navigator.mediaDevices
      if (!media?.getUserMedia) {
        setUnavailable(true)
        return
      }
      try {
        const stream = await media.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => undefined)
          setReady(true)
        }
      } catch {
        setUnavailable(true)
      }
    }

    setUnavailable(false)
    void start()
    return () => {
      cancelled = true
      stop()
    }
  }, [open])

  const snap = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    onCapture(canvas.toDataURL('image/jpeg', 0.8))
    onOpenChange(false)
  }

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      onCapture(String(reader.result))
      onOpenChange(false)
    }
    reader.readAsDataURL(file)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {unavailable ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A live camera isn&apos;t available here. Take or choose a photo
              instead.
            </p>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[3px] border border-dashed border-input bg-surface-2 px-4 py-6 text-sm font-semibold text-muted-foreground hover:bg-surface-hover hover:text-foreground">
              <ImageUp className="size-4" aria-hidden="true" />
              Take / choose a photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={onFile}
              />
            </label>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-[3px] border border-border bg-black/90">
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-video w-full object-cover"
              />
            </div>
            <DialogFooter className="sm:justify-between">
              <label className="flex cursor-pointer items-center gap-2 rounded-[3px] border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-hover hover:text-foreground">
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Use a file
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={onFile}
                />
              </label>
              <Button onClick={snap} disabled={!ready}>
                <Camera className="size-4" aria-hidden="true" />
                Capture
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

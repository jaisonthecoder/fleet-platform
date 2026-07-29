import { type ReactNode } from 'react'
import { Drawer } from './drawer'

interface DetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

/**
 * @deprecated Use `Drawer` from `./drawer` directly — it supports dynamic width,
 * an eyebrow, and a header accessory. This thin wrapper is kept for compatibility.
 */
export function DetailDrawer(props: DetailDrawerProps) {
  return <Drawer {...props} />
}

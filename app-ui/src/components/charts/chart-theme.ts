import { useMemo } from 'react'
import { useTheme } from '@/app/providers/theme-provider'

export interface ChartTheme {
  palette: string[]
  brand: string
  signal: string
  ok: string
  warn: string
  danger: string
  info: string
  grid: string
  axis: string
  surface: string
  ink: string
  fontFamily: string
}

function readVar(name: string): string {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}

/**
 * Resolves the current design tokens into concrete colours for charts. Recomputes
 * when the theme changes so charts recolour on light/dark toggle. No hardcoded
 * chart colours anywhere — everything comes from `src/index.css` tokens.
 */
export function useChartTheme(): ChartTheme {
  const { theme } = useTheme()
  return useMemo<ChartTheme>(() => {
    const v = readVar
    return {
      palette: [
        v('--brand'),
        v('--signal'),
        v('--info'),
        v('--ok'),
        v('--warn'),
        v('--danger'),
        v('--plum'),
      ],
      brand: v('--brand'),
      signal: v('--signal'),
      ok: v('--ok'),
      warn: v('--warn'),
      danger: v('--danger'),
      info: v('--info'),
      grid: v('--line'),
      axis: v('--ink-2'),
      surface: v('--surface'),
      ink: v('--ink'),
      fontFamily: "'IBM Plex Sans', sans-serif",
    }
    // theme drives the recompute; readVar has no other deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])
}

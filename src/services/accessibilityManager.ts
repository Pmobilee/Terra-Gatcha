import { highContrastMode, reduceMotionMode, textSize, type TextSize } from './cardPreferences'

const TEXT_SCALE: Record<TextSize, number> = {
  small: 0.85,
  medium: 1,
  large: 1.2,
}

let initialized = false

function applyTextScale(size: TextSize): void {
  if (typeof document === 'undefined') return
  const scale = TEXT_SCALE[size]
  document.documentElement.style.setProperty('--text-scale', String(scale))
}

function applyClass(flag: boolean, className: string): void {
  if (typeof document === 'undefined') return
  document.body.classList.toggle(className, flag)
}

/**
 * Initializes global accessibility UI state.
 * - `textSize` -> `--text-scale`
 * - `highContrastMode` -> `body.high-contrast`
 * - `reduceMotionMode` -> `body.reduced-motion`
 */
export function initAccessibilityManager(): void {
  if (initialized) return
  initialized = true

  textSize.subscribe((value) => applyTextScale(value))
  highContrastMode.subscribe((value) => applyClass(value, 'high-contrast'))
  reduceMotionMode.subscribe((value) => applyClass(value, 'reduced-motion'))
}

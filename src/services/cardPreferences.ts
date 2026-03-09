import { writable } from 'svelte/store'
import type { Writable } from 'svelte/store'

export type DifficultyMode = 'explorer' | 'standard' | 'scholar'
export type TextSize = 'small' | 'medium' | 'large'

export interface OnboardingState {
  hasCompletedOnboarding: boolean
  hasSeenCardTapTooltip: boolean
  hasSeenCastTooltip: boolean
  hasSeenAnswerTooltip: boolean
  hasSeenEndTurnTooltip: boolean
  hasSeenAPTooltip: boolean
  runsCompleted: number
}

const defaultOnboardingState: OnboardingState = {
  hasCompletedOnboarding: false,
  hasSeenCardTapTooltip: false,
  hasSeenCastTooltip: false,
  hasSeenAnswerTooltip: false,
  hasSeenEndTurnTooltip: false,
  hasSeenAPTooltip: false,
  runsCompleted: 0,
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function persistedWritable<T>(key: string, initial: T): Writable<T> {
  const store = writable<T>(read(key, initial))
  if (typeof window !== 'undefined') {
    store.subscribe((value) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // ignore storage failures
      }
    })
  }
  return store
}

export const difficultyMode = persistedWritable<DifficultyMode>('card:difficultyMode', 'standard')
export const isSlowReader = persistedWritable<boolean>('card:isSlowReader', false)
export const textSize = persistedWritable<TextSize>('card:textSize', 'medium')
export const highContrastMode = persistedWritable<boolean>('card:highContrastMode', false)
export const reduceMotionMode = persistedWritable<boolean>('card:reduceMotionMode', false)
export const onboardingState = persistedWritable<OnboardingState>('card:onboardingState', defaultOnboardingState)

export function markOnboardingComplete(): void {
  onboardingState.update((state) => ({
    ...state,
    hasCompletedOnboarding: true,
    runsCompleted: Math.max(1, state.runsCompleted),
  }))
}

export function incrementRunsCompleted(): void {
  onboardingState.update((state) => ({
    ...state,
    runsCompleted: state.runsCompleted + 1,
  }))
}

export function markOnboardingTooltipSeen(
  key: keyof Pick<
    OnboardingState,
    'hasSeenCardTapTooltip' | 'hasSeenCastTooltip' | 'hasSeenAnswerTooltip' | 'hasSeenEndTurnTooltip' | 'hasSeenAPTooltip'
  >,
): void {
  onboardingState.update((state) => ({ ...state, [key]: true }))
}

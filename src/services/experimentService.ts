import { analyticsService } from './analyticsService'

export type ExperimentKey =
  | 'slow_reader_default'
  | 'starting_ap_3_vs_4'
  | 'starter_deck_15_vs_18'

interface ExperimentValueMap {
  slow_reader_default: boolean
  starting_ap_3_vs_4: number
  starter_deck_15_vs_18: number
}

export interface ExperimentVariant<TKey extends ExperimentKey> {
  key: TKey
  group: 'control' | 'test'
  value: ExperimentValueMap[TKey]
}

const experimentValues: {
  [K in ExperimentKey]: (group: 'control' | 'test') => ExperimentValueMap[K]
} = {
  slow_reader_default: (group) => group === 'test',
  starting_ap_3_vs_4: (group) => (group === 'test' ? 4 : 3),
  starter_deck_15_vs_18: (group) => (group === 'test' ? 18 : 15),
}

function hashUserId(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function storageKey(userId: string, key: ExperimentKey): string {
  return `exp:${userId}:${key}`
}

function readStoredGroup(userId: string, key: ExperimentKey): 'control' | 'test' | null {
  try {
    const value = localStorage.getItem(storageKey(userId, key))
    if (value === 'control' || value === 'test') return value
  } catch {
    // ignore
  }
  return null
}

function storeGroup(userId: string, key: ExperimentKey, group: 'control' | 'test'): void {
  try {
    localStorage.setItem(storageKey(userId, key), group)
  } catch {
    // ignore
  }
}

function resolveGroup(userId: string, key: ExperimentKey): 'control' | 'test' {
  const stored = readStoredGroup(userId, key)
  if (stored) return stored
  const hash = hashUserId(`${userId}:${key}`)
  const group: 'control' | 'test' = (hash % 2 === 0) ? 'control' : 'test'
  storeGroup(userId, key, group)
  analyticsService.track({
    name: 'experiment_assigned',
    properties: {
      experiment_key: key,
      variant: group,
      session_id: analyticsService.getSessionId(),
    },
  })
  return group
}

export function getExperimentVariant(key: 'slow_reader_default', userId: string): ExperimentVariant<'slow_reader_default'>
export function getExperimentVariant(key: 'starting_ap_3_vs_4', userId: string): ExperimentVariant<'starting_ap_3_vs_4'>
export function getExperimentVariant(key: 'starter_deck_15_vs_18', userId: string): ExperimentVariant<'starter_deck_15_vs_18'>
export function getExperimentVariant<TKey extends ExperimentKey>(key: TKey, userId: string): ExperimentVariant<TKey> {
  const group = resolveGroup(userId, key)
  const value = experimentValues[key](group)
  return { key, group, value }
}

export function getExperimentValue(key: 'slow_reader_default', userId: string): boolean
export function getExperimentValue(key: 'starting_ap_3_vs_4', userId: string): number
export function getExperimentValue(key: 'starter_deck_15_vs_18', userId: string): number
export function getExperimentValue<TKey extends ExperimentKey>(key: TKey, userId: string): ExperimentValueMap[TKey] {
  return experimentValues[key](resolveGroup(userId, key))
}

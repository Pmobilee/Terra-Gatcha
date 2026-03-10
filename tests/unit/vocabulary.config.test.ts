import { describe, expect, it } from 'vitest'
import {
  LAUNCH_LANGUAGE_CODES,
  SUPPORTED_LANGUAGES,
  getLanguageConfig,
  getLanguageFlag,
} from '../../src/types/vocabulary'

describe('vocabulary language config', () => {
  it('includes the 6 launch languages for onboarding and settings', () => {
    expect(LAUNCH_LANGUAGE_CODES).toEqual(['ja', 'es', 'fr', 'de', 'ko', 'zh'])
  })

  it('keeps language definitions aligned with launch language codes', () => {
    const configCodes = SUPPORTED_LANGUAGES.map((language) => language.code)
    expect(configCodes).toEqual(expect.arrayContaining(LAUNCH_LANGUAGE_CODES))
  })

  it('ensures each language has sorted and unique levels', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const levelIds = language.levels.map((level) => level.id)
      const orders = language.levels.map((level) => level.order)

      expect(new Set(levelIds).size).toBe(levelIds.length)
      expect(orders).toEqual([...orders].sort((a, b) => a - b))
      expect(language.levels.length).toBeGreaterThan(0)
    }
  })

  it('resolves known language configs and flag badges', () => {
    expect(getLanguageConfig('ko')?.levels[0]?.id).toBe('TOPIK1')
    expect(getLanguageConfig('zh')?.levels[0]?.id).toBe('HSK1')
    expect(getLanguageFlag('fr')).toBe('\u{1F1EB}\u{1F1F7}')
    expect(getLanguageFlag('unknown')).toBe('\u{1F310}')
  })
})

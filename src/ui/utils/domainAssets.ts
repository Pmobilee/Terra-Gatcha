import type { CardType, FactDomain } from '../../data/card-types'

export const DOMAIN_ICON_PATHS: Record<FactDomain, string> = {
  science: '/assets/sprites/icons/icon_science.png',
  history: '/assets/sprites/icons/icon_history.png',
  geography: '/assets/sprites/icons/icon_geography.png',
  language: '/assets/sprites/icons/icon_language.png',
  math: '/assets/sprites/icons/icon_math.png',
  arts: '/assets/sprites/icons/icon_arts.png',
  medicine: '/assets/sprites/icons/icon_medicine.png',
  technology: '/assets/sprites/icons/icon_technology.png',
}

export function getDomainIconPath(domain: FactDomain): string {
  return DOMAIN_ICON_PATHS[domain]
}

export function getCardFramePath(type: CardType): string {
  return `/assets/sprites/cards/frame_${type}.png`
}

export function getDoorSpritePath(type: 'combat' | 'mystery' | 'rest' | 'treasure' | 'shop'): string {
  return `/assets/sprites/doors/door_${type}.png`
}

import type { CardType, FactDomain } from '../../data/card-types'

export const DOMAIN_ICON_PATHS: Record<FactDomain, string> = {
  general_knowledge: '/assets/sprites/icons/icon_science.png',
  natural_sciences: '/assets/sprites/icons/icon_science.png',
  space_astronomy: '/assets/sprites/icons/icon_science.png',
  history: '/assets/sprites/icons/icon_history.png',
  geography: '/assets/sprites/icons/icon_geography.png',
  language: '/assets/sprites/icons/icon_language.png',
  mythology_folklore: '/assets/sprites/icons/icon_arts.png',
  animals_wildlife: '/assets/sprites/icons/icon_medicine.png',
  human_body_health: '/assets/sprites/icons/icon_medicine.png',
  food_cuisine: '/assets/sprites/icons/icon_arts.png',
  art_architecture: '/assets/sprites/icons/icon_arts.png',
  // Legacy aliases.
  science: '/assets/sprites/icons/icon_science.png',
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

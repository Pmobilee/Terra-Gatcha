/**
 * Hub Ambient Life VFX System (C2)
 * CSS-only micro-animations for hub sprites.
 * These are applied via CampSpriteButton's ambientClass prop.
 */

/**
 * Map sprite labels to their ambient animation class.
 * Returns empty string if no ambient animation applies.
 */
export function getAmbientClass(label: string): string {
  switch (label.toLowerCase()) {
    case 'pet':
      return ''
    case 'campfire':
      return '' // handled by CampfireCanvas
    case 'profile':
      return ''
    case 'relics':
      return 'ambient-spark'
    default:
      return ''
  }
}

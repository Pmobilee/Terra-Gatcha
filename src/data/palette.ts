/**
 * Biome palette system — formal color definitions for per-biome visual consistency.
 * Phase 9 (DD-V2-237, DD-V2-272)
 */

/** Core 3-color palette used for biome identification. */
export interface BiomePalette {
  /** Primary fill color — 40-50% of visual surface (0xRRGGBB) */
  dominant: number
  /** Secondary highlight or detail color */
  accent: number
  /** Brightest point — specular, glow edge */
  highlight: number
}

/**
 * Full fog-of-war palette for a biome.
 * Controls the visual appearance of unrevealed and scanner-visible cells.
 * Phase 33.4 (DD-V2-271)
 */
export interface FogPalette {
  /** Color of fully hidden (unrevealed) cells — the "darkness" fill */
  hidden: number
  /** Color tint for Ring-1 scanner cells (silhouette outline) */
  ring1: number
  /** Color tint for Ring-2 scanner cells (dim, readable) */
  ring2: number
  /** Alpha of the dark overlay applied on top of Ring-1 sprites (0.0–1.0) */
  ring1DimAlpha: number
  /** Alpha of the dark overlay applied on top of Ring-2 sprites (0.0–1.0) */
  ring2DimAlpha: number
}

/**
 * Derives a FogPalette from a biome's ambient color.
 * hidden = heavily darkened ambient, ring1 = 50% darkened, ring2 = 30% darkened.
 */
export function fogPaletteFromAmbient(ambientColor: number): FogPalette {
  const darken = (c: number, f: number): number => {
    const r = Math.floor(((c >> 16) & 0xff) * f)
    const g = Math.floor(((c >> 8) & 0xff) * f)
    const b = Math.floor((c & 0xff) * f)
    return (r << 16) | (g << 8) | b
  }
  return {
    hidden:        darken(ambientColor, 0.15),
    ring1:         darken(ambientColor, 0.50),
    ring2:         darken(ambientColor, 0.70),
    ring1DimAlpha: 0.55,
    ring2DimAlpha: 0.25,
  }
}

/** Returns a CSS hex string from a 0xRRGGBB color number. */
export function toHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0')
}

/** Returns the approximate hue (0-360) of a 0xRRGGBB color. */
export function hue(color: number): number {
  const r = ((color >> 16) & 0xFF) / 255
  const g = ((color >> 8) & 0xFF) / 255
  const b = (color & 0xFF) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
  else if (max === g) h = ((b - r) / d + 2) * 60
  else h = ((r - g) / d + 4) * 60
  return Math.round(h)
}

/** Returns true if two hues are within threshold degrees of each other on the hue wheel. */
export function huesClash(h1: number, h2: number, threshold = 30): boolean {
  const diff = Math.abs(h1 - h2)
  return Math.min(diff, 360 - diff) < threshold
}

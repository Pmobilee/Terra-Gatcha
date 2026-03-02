/**
 * domeLayout.ts
 *
 * Data model and default layout for the Terraria-style tile-based dome hub.
 * The dome is a 2D grid with four layers: sky background, background wall,
 * foreground structure, and interactive objects.
 *
 * Grid: 192 columns × 128 rows, each tile rendered at TILE_SIZE pixels.
 * Canvas: 192 × 4 = 768px wide, 128 × 4 = 512px tall (same as before).
 * The 8× finer grid allows smooth elliptical dome curves.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base tile size in logical pixels (lo-res mode). Hi-res scales this up. */
export const TILE_SIZE = 4

/** Dome grid dimensions. */
export const DOME_WIDTH = 192
export const DOME_HEIGHT = 128

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Tile types for the background layer.
 * Drawn behind everything else; typically sky or interior wall fill.
 */
export enum BgTile {
  /** Nothing — sky colour / transparent shows through */
  Empty = 0,
  /** Night sky texture, tiled across the upper sky area */
  Sky = 1,
  /** Dark sci-fi wall panels — interior dome background */
  InteriorWall = 2,
  /** Brown earth / foundation below the dome */
  DirtGround = 3,
}

/**
 * Tile types for the foreground / structural layer.
 * These form the visible dome shell, floors, and platforms.
 */
export enum FgTile {
  /** No tile — open space */
  Empty = 0,
  /** Translucent blue-green glass panels */
  DomeGlass = 1,
  /** Dark metal structural beam */
  DomeFrame = 2,
  /** Curved dome top piece (arch apex) */
  DomeGlassCurved = 3,
  /** Polished stone floor */
  StoneFloor = 4,
  /** Metal grate walkway / sub-floor platform */
  MetalPlatform = 5,
}

// ---------------------------------------------------------------------------
// Sprite key maps
// ---------------------------------------------------------------------------

/**
 * Maps each BgTile enum value to its sprite filename key (without extension).
 * `null` means no sprite is drawn for that tile.
 */
export const BG_TILE_SPRITES: Record<BgTile, string | null> = {
  [BgTile.Empty]: null,
  [BgTile.Sky]: 'sky_stars',
  [BgTile.InteriorWall]: 'interior_wall',
  [BgTile.DirtGround]: 'dirt_ground',
}

/**
 * Maps each FgTile enum value to its sprite filename key (without extension).
 * `null` means no sprite is drawn for that tile.
 */
export const FG_TILE_SPRITES: Record<FgTile, string | null> = {
  [FgTile.Empty]: null,
  [FgTile.DomeGlass]: 'dome_glass',
  [FgTile.DomeFrame]: 'dome_frame',
  [FgTile.DomeGlassCurved]: 'dome_glass_curved',
  [FgTile.StoneFloor]: 'stone_floor',
  [FgTile.MetalPlatform]: 'metal_platform',
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * A single object / furniture piece placed on the dome grid.
 * Multi-tile objects have an anchor (top-left) position plus width/height.
 */
export interface DomeObject {
  /** Unique identifier for this object instance. */
  id: string
  /** Sprite filename key matching the sprite asset (no extension). */
  spriteKey: string
  /** Human-readable display name shown in tooltips / UI. */
  label: string
  /**
   * Which room panel this object opens when clicked.
   * Special values: `'dive'` triggers a mine dive; `'none'` is decorative only.
   */
  room: string
  /** Anchor column (0-indexed, left edge of the object). */
  gridX: number
  /** Anchor row (0-indexed, top edge of the object). */
  gridY: number
  /** Width of this object in tiles. */
  gridW: number
  /** Height of this object in tiles. */
  gridH: number
  /** Whether the player can interact with / click this object. */
  interactive: boolean
}

/**
 * The complete dome layout, comprising all four data layers.
 * This is the single source of truth consumed by DomeCanvas.svelte.
 */
export interface DomeLayout {
  /** Number of grid columns. */
  width: number
  /** Number of grid rows. */
  height: number
  /** Base tile size in pixels (logical resolution). */
  tileSize: number
  /**
   * Background layer — indexed as `bg[row][col]`.
   * Drawn first; sky and wall fill.
   */
  bg: BgTile[][]
  /**
   * Foreground / structure layer — indexed as `fg[row][col]`.
   * Drawn above the background; dome shell, floors, platforms.
   */
  fg: FgTile[][]
  /**
   * Objects, furniture, and decorations placed at specific grid positions.
   * Rendered above both tile layers.
   */
  objects: DomeObject[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a 2D grid of `height` rows × `width` columns, every cell set to
 * `fill`. The returned array is indexed as `grid[row][col]`.
 *
 * @param w     Number of columns.
 * @param h     Number of rows.
 * @param fill  Initial value for every cell.
 * @returns     A freshly allocated 2D array.
 */
export function createEmptyGrid<T>(w: number, h: number, fill: T): T[][] {
  return Array.from({ length: h }, () => Array<T>(w).fill(fill))
}

// ---------------------------------------------------------------------------
// Default layout factory
// ---------------------------------------------------------------------------

/**
 * Returns the canonical starting dome layout.
 *
 * Dome cross-section (192 cols × 128 rows, TILE_SIZE = 4):
 * Canvas is still 768×512 pixels — just with 8× finer tile resolution.
 *
 * Elliptical arch math:
 *   - Center X:     col 96
 *   - Left base:    col 24
 *   - Right base:   col 167
 *   - Half-width a: 72 tiles
 *   - Apex row:     row 12
 *   - Base row:     row 80
 *   - Half-height b: 68 tiles (80 - 12)
 *
 * For each column x, dome glass top edge:
 *   y_top = 80 - 68 * sqrt(1 - ((x - 96) / 72)²)
 *
 * Layer regions:
 *   Rows   0-7:   pure sky (above dome)
 *   Rows   8-79:  dome arch area — sky outside ellipse, glass+frame+interior inside
 *   Rows  80-83:  stone floor (inside dome, cols 25-166)
 *   Rows  84-91:  metal platform (sub-floor, cols 25-166)
 *   Rows  92-103: sky outside dome legs, transitioning to dirt
 *   Rows 104-127: dirt ground (underground foundation)
 */
export function getDefaultDomeLayout(): DomeLayout {
  const W = DOME_WIDTH   // 192
  const H = DOME_HEIGHT  // 128

  // Ellipse parameters
  const CX = 96       // dome centre column
  const APEX = 12     // dome apex row
  const BASE = 80     // dome base (floor level) row
  const A = 72        // half-width in tiles
  const B = BASE - APEX  // half-height in tiles (68)

  // Dome left/right column extents
  const DOME_LEFT = CX - A    // 24
  const DOME_RIGHT = CX + A   // 168 (exclusive right edge)

  // --- Background layer ---------------------------------------------------
  const bg = createEmptyGrid<BgTile>(W, H, BgTile.Empty)

  // Rows 0-7: sky above the dome
  for (let row = 0; row <= 7; row++) {
    for (let col = 0; col < W; col++) {
      bg[row][col] = BgTile.Sky
    }
  }

  // Rows 8-79: dome arch area — fill by column using ellipse formula
  for (let col = 0; col < W; col++) {
    const dx = col - CX
    let yTop: number

    if (Math.abs(dx) < A) {
      // Inside the ellipse horizontal extent — compute dome glass top edge
      const ratio = dx / A
      yTop = Math.round(BASE - B * Math.sqrt(1 - ratio * ratio))
    } else {
      // Outside the ellipse — pure sky
      yTop = H // below visible rows, means no interior here
    }

    for (let row = 8; row <= 79; row++) {
      if (row < yTop || col < DOME_LEFT || col >= DOME_RIGHT) {
        // Above or outside the dome — sky
        bg[row][col] = BgTile.Sky
      } else {
        // Below glass curve, inside dome — interior wall
        bg[row][col] = BgTile.InteriorWall
      }
    }
  }

  // Rows 80-83: stone floor inside dome
  for (let row = 80; row <= 83; row++) {
    for (let col = 0; col < W; col++) {
      if (col >= DOME_LEFT + 1 && col < DOME_RIGHT - 1) {
        bg[row][col] = BgTile.InteriorWall
      } else {
        bg[row][col] = BgTile.Sky
      }
    }
  }

  // Rows 84-91: metal platform / sub-floor
  for (let row = 84; row <= 91; row++) {
    for (let col = 0; col < W; col++) {
      if (col >= DOME_LEFT + 1 && col < DOME_RIGHT - 1) {
        bg[row][col] = BgTile.InteriorWall
      } else {
        bg[row][col] = BgTile.Sky
      }
    }
  }

  // Rows 92-103: sky outside dome legs, transitioning to surface
  for (let row = 92; row <= 103; row++) {
    for (let col = 0; col < W; col++) {
      bg[row][col] = BgTile.Sky
    }
  }

  // Rows 104-127: dirt ground (underground foundation)
  for (let row = 104; row <= 127; row++) {
    for (let col = 0; col < W; col++) {
      bg[row][col] = BgTile.DirtGround
    }
  }

  // --- Foreground / structure layer ----------------------------------------
  const fg = createEmptyGrid<FgTile>(W, H, FgTile.Empty)

  // Paint the dome glass curve column by column
  // For each column within the ellipse horizontal extent, calculate the y_top
  // and paint: 2 tiles of DomeFrame at the outer edge, then DomeGlass/DomeGlassCurved inside
  for (let col = DOME_LEFT; col < DOME_RIGHT; col++) {
    const dx = col - CX
    const ratio = dx / A
    const absRatio = Math.abs(ratio)

    if (absRatio >= 1) continue

    const yTop = Math.round(BASE - B * Math.sqrt(1 - ratio * ratio))

    // Determine if we're near the apex for curved tile variant
    const isApex = yTop <= APEX + 8

    // Paint outer frame (2 tiles thick at the top of the dome at this column)
    fg[yTop][col] = FgTile.DomeFrame
    if (yTop + 1 < BASE) {
      fg[yTop + 1][col] = isApex ? FgTile.DomeGlassCurved : FgTile.DomeGlass
    }
    if (yTop + 2 < BASE) {
      fg[yTop + 2][col] = isApex ? FgTile.DomeGlassCurved : FgTile.DomeGlass
    }
  }

  // Also add DomeFrame at the very outer left and right edges (vertical legs)
  // Left leg: col DOME_LEFT, from where it meets the ground down to dirt
  for (let row = BASE; row <= 127; row++) {
    fg[row][DOME_LEFT] = FgTile.DomeFrame
    fg[row][DOME_RIGHT - 1] = FgTile.DomeFrame
  }

  // Stone floor at rows 80-83 inside dome
  for (let row = 80; row <= 83; row++) {
    for (let col = DOME_LEFT + 1; col < DOME_RIGHT - 1; col++) {
      fg[row][col] = FgTile.StoneFloor
    }
    // Frame at edges of floor row
    fg[row][DOME_LEFT] = FgTile.DomeFrame
    fg[row][DOME_RIGHT - 1] = FgTile.DomeFrame
  }

  // Metal platform at rows 84-91 inside dome
  for (let row = 84; row <= 91; row++) {
    for (let col = DOME_LEFT + 1; col < DOME_RIGHT - 1; col++) {
      fg[row][col] = FgTile.MetalPlatform
    }
    fg[row][DOME_LEFT] = FgTile.DomeFrame
    fg[row][DOME_RIGHT - 1] = FgTile.DomeFrame
  }

  // Frame legs from sub-floor down to dirt
  for (let row = 92; row <= 127; row++) {
    fg[row][DOME_LEFT] = FgTile.DomeFrame
    fg[row][DOME_RIGHT - 1] = FgTile.DomeFrame
  }

  // --- Objects layer -------------------------------------------------------
  // All positions multiplied by 8 from the original 24×16 layout
  const objects: DomeObject[] = [
    // ---- Functional objects ----

    {
      id: 'gaia_terminal',
      spriteKey: 'obj_gaia_terminal',
      label: 'G.A.I.A. Terminal',
      room: 'command',
      gridX: 32,
      gridY: 64,
      gridW: 16,
      gridH: 16,
      interactive: true,
    },
    {
      id: 'knowledge_tree',
      spriteKey: 'obj_knowledge_tree',
      label: 'Knowledge Tree',
      room: 'lab',
      gridX: 56,
      gridY: 56,
      gridW: 16,
      gridH: 24,
      interactive: true,
    },
    {
      id: 'streak_board',
      spriteKey: 'obj_streak_board',
      label: 'Streak Board',
      room: 'command',
      gridX: 72,
      gridY: 72,
      gridW: 8,
      gridH: 8,
      interactive: true,
    },
    {
      id: 'dive_hatch',
      spriteKey: 'obj_dive_hatch',
      label: 'Mine Entrance',
      room: 'dive',
      gridX: 88,
      gridY: 80,
      gridW: 16,
      gridH: 8,
      interactive: true,
    },
    {
      id: 'locked_placeholder',
      spriteKey: 'obj_locked_silhouette',
      label: 'Locked Room',
      room: 'none',
      gridX: 104,
      gridY: 56,
      gridW: 16,
      gridH: 16,
      interactive: false,
    },
    {
      id: 'display_case',
      spriteKey: 'obj_display_case',
      label: 'Display Case',
      room: 'museum',
      gridX: 80,
      gridY: 64,
      gridW: 16,
      gridH: 16,
      interactive: true,
    },
    {
      id: 'workbench',
      spriteKey: 'obj_workbench',
      label: 'Materializer',
      room: 'workshop',
      gridX: 112,
      gridY: 64,
      gridW: 24,
      gridH: 16,
      interactive: true,
    },
    {
      id: 'market_stall',
      spriteKey: 'obj_market_stall',
      label: 'Market Stall',
      room: 'market',
      gridX: 128,
      gridY: 64,
      gridW: 24,
      gridH: 16,
      interactive: true,
    },
    {
      id: 'bookshelf',
      spriteKey: 'obj_bookshelf',
      label: 'Archive Shelf',
      room: 'archive',
      gridX: 144,
      gridY: 56,
      gridW: 16,
      gridH: 24,
      interactive: true,
    },
    {
      id: 'farm_plot',
      spriteKey: 'obj_farm_plot',
      label: 'Hydroponic Farm',
      room: 'market',
      gridX: 16,
      gridY: 72,
      gridW: 24,
      gridH: 8,
      interactive: true,
    },

    // ---- Decorations (non-interactive) ----

    {
      id: 'ceiling_light_1',
      spriteKey: 'deco_ceiling_light',
      label: 'Ceiling Light',
      room: 'none',
      gridX: 40,
      gridY: 40,
      gridW: 8,
      gridH: 8,
      interactive: false,
    },
    {
      id: 'ceiling_light_2',
      spriteKey: 'deco_ceiling_light',
      label: 'Ceiling Light',
      room: 'none',
      gridX: 80,
      gridY: 40,
      gridW: 8,
      gridH: 8,
      interactive: false,
    },
    {
      id: 'ceiling_light_3',
      spriteKey: 'deco_ceiling_light',
      label: 'Ceiling Light',
      room: 'none',
      gridX: 120,
      gridY: 40,
      gridW: 8,
      gridH: 8,
      interactive: false,
    },
    {
      id: 'ceiling_light_4',
      spriteKey: 'deco_ceiling_light',
      label: 'Ceiling Light',
      room: 'none',
      gridX: 152,
      gridY: 40,
      gridW: 8,
      gridH: 8,
      interactive: false,
    },
    {
      id: 'wall_monitor_1',
      spriteKey: 'deco_wall_monitor',
      label: 'Wall Monitor',
      room: 'none',
      gridX: 40,
      gridY: 48,
      gridW: 8,
      gridH: 8,
      interactive: false,
    },
    {
      id: 'wall_monitor_2',
      spriteKey: 'deco_wall_monitor',
      label: 'Wall Monitor',
      room: 'none',
      gridX: 136,
      gridY: 48,
      gridW: 8,
      gridH: 8,
      interactive: false,
    },
    {
      id: 'plant_pot_1',
      spriteKey: 'deco_plant_pot',
      label: 'Plant Pot',
      room: 'none',
      gridX: 48,
      gridY: 80,
      gridW: 8,
      gridH: 8,
      interactive: false,
    },
    {
      id: 'plant_pot_2',
      spriteKey: 'deco_plant_pot',
      label: 'Plant Pot',
      room: 'none',
      gridX: 104,
      gridY: 80,
      gridW: 8,
      gridH: 8,
      interactive: false,
    },
    {
      id: 'plant_pot_3',
      spriteKey: 'deco_plant_pot',
      label: 'Plant Pot',
      room: 'none',
      gridX: 152,
      gridY: 80,
      gridW: 8,
      gridH: 8,
      interactive: false,
    },
  ]

  return {
    width: W,
    height: H,
    tileSize: TILE_SIZE,
    bg,
    fg,
    objects,
  }
}

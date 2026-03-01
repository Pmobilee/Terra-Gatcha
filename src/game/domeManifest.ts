import type { SpriteResolution } from '../ui/stores/settings';

// Low-res dome sprite URLs (32px)
const lowResDomeSprites = import.meta.glob<string>(
  '../assets/sprites/dome/*.png',
  { eager: true, query: '?url', import: 'default' }
);

// High-res dome sprite URLs (256px)
const highResDomeSprites = import.meta.glob<string>(
  '../assets/sprites-hires/dome/*.png',
  { eager: true, query: '?url', import: 'default' }
);

/**
 * Union type of all known dome sprite keys (filenames without extension).
 */
export type DomeSpriteKey =
  | 'dome_shell'
  | 'obj_gaia_terminal'
  | 'obj_knowledge_tree'
  | 'obj_workbench'
  | 'obj_display_case'
  | 'obj_market_stall'
  | 'obj_bookshelf'
  | 'obj_dive_hatch'
  | 'obj_farm_plot'
  | 'surface_terrain'
  | 'gaia_neutral'
  | 'gaia_happy'
  | 'gaia_excited'
  | 'gaia_thinking';

/**
 * A single interactive hotspot in the dome scene.
 * Positions and dimensions are normalized (0–1) relative to the 800×600 canvas.
 */
export interface DomeObject {
  /** Sprite key matching a DomeSpriteKey and the filename in the dome sprite directory. */
  id: string;
  /** Human-readable display name shown in the UI. */
  label: string;
  /** The room/screen this hotspot opens when clicked. */
  room: 'command' | 'lab' | 'workshop' | 'museum' | 'market' | 'archive';
  /** Normalized x position (0–1) of the hotspot's left edge on the canvas. */
  x: number;
  /** Normalized y position (0–1) of the hotspot's top edge on the canvas. */
  y: number;
  /** Normalized width (0–1) of the hotspot relative to canvas width. */
  width: number;
  /** Normalized height (0–1) of the hotspot relative to canvas height. */
  height: number;
  /** The sprite key used to render this object. */
  spriteKey: DomeSpriteKey;
}

/**
 * Get dome sprite URLs for the specified resolution.
 * Extracts sprite keys from filenames and returns a mapping of key → URL.
 * @param resolution - The desired sprite resolution ('low' or 'high')
 * @returns A record mapping dome sprite keys to their URL strings
 */
export function getDomeSpriteUrls(resolution: SpriteResolution): Record<string, string> {
  const spriteMap = resolution === 'high' ? highResDomeSprites : lowResDomeSprites;
  const result: Record<string, string> = {};

  for (const [path, url] of Object.entries(spriteMap)) {
    // Extract filename without extension
    // e.g., '../assets/sprites/dome/obj_gaia_terminal.png' → 'obj_gaia_terminal'
    const filename = path.split('/').pop() || '';
    const spriteKey = filename.replace(/\.png$/, '');
    result[spriteKey] = url;
  }

  return result;
}

/**
 * Interactive hotspot definitions for dome scene objects.
 * Positions and dimensions are normalized (0–1) relative to the 800×600 canvas.
 * Each entry corresponds to a clickable region that opens a specific dome room.
 */
export const DOME_OBJECTS: DomeObject[] = [
  {
    id: 'obj_dive_hatch',
    label: 'Dive Hatch',
    room: 'command',
    x: 0.42,
    y: 0.72,
    width: 0.16,
    height: 0.18,
    spriteKey: 'obj_dive_hatch',
  },
  {
    id: 'obj_gaia_terminal',
    label: 'G.A.I.A. Terminal',
    room: 'command',
    x: 0.15,
    y: 0.45,
    width: 0.14,
    height: 0.2,
    spriteKey: 'obj_gaia_terminal',
  },
  {
    id: 'obj_knowledge_tree',
    label: 'Knowledge Tree',
    room: 'lab',
    x: 0.05,
    y: 0.25,
    width: 0.18,
    height: 0.3,
    spriteKey: 'obj_knowledge_tree',
  },
  {
    id: 'obj_workbench',
    label: 'Workbench',
    room: 'workshop',
    x: 0.7,
    y: 0.48,
    width: 0.14,
    height: 0.18,
    spriteKey: 'obj_workbench',
  },
  {
    id: 'obj_display_case',
    label: 'Display Case',
    room: 'museum',
    x: 0.5,
    y: 0.35,
    width: 0.12,
    height: 0.2,
    spriteKey: 'obj_display_case',
  },
  {
    id: 'obj_market_stall',
    label: 'Market Stall',
    room: 'market',
    x: 0.82,
    y: 0.42,
    width: 0.14,
    height: 0.2,
    spriteKey: 'obj_market_stall',
  },
  {
    id: 'obj_bookshelf',
    label: 'Archive Shelf',
    room: 'archive',
    x: 0.02,
    y: 0.55,
    width: 0.12,
    height: 0.2,
    spriteKey: 'obj_bookshelf',
  },
  {
    id: 'obj_farm_plot',
    label: 'Farm Plot',
    room: 'market',
    x: 0.72,
    y: 0.7,
    width: 0.15,
    height: 0.14,
    spriteKey: 'obj_farm_plot',
  },
];

/**
 * Pet animation frame definitions for dome hub rendering.
 * Actual sprite sheets generated in Phase 10.9.
 * (DD-V2-265)
 */
export interface PetAnimationDef {
  /** Sprite sheet key for walk animation. */
  walkSpriteKey: string
  /** Sprite sheet key for idle animation. */
  idleSpriteKey: string
  /** Number of frames in the walk animation. */
  walkFrames: number
  /** Number of frames in the idle animation. */
  idleFrames: number
  /** Frame display duration in milliseconds. */
  frameDurationMs: number
  /** Width of one frame in the sprite sheet (pixels). */
  frameWidth: number
  /** Height of one frame. */
  frameHeight: number
  /** Rendered width in logical floor pixels. */
  renderWidth: number
  /** Rendered height in logical floor pixels. */
  renderHeight: number
}

/** Walk speed in logical floor pixels per second. */
export const PET_WALK_SPEED = 40

/** Seconds idle before idle animation has 30% chance to trigger. */
export const PET_IDLE_DELAY = 3

/** Duration of idle pause in seconds. */
export const PET_IDLE_DURATION = 1.5

export const PET_ANIMATIONS: Record<string, PetAnimationDef> = {
  comp_borebot: {
    walkSpriteKey: 'pet_borebot_walk',
    idleSpriteKey: 'pet_borebot_idle',
    walkFrames: 4, idleFrames: 2,
    frameDurationMs: 150,
    frameWidth: 64, frameHeight: 64,
    renderWidth: 48, renderHeight: 48,
  },
  comp_lumis: {
    walkSpriteKey: 'pet_lumis_walk',
    idleSpriteKey: 'pet_lumis_idle',
    walkFrames: 4, idleFrames: 2,
    frameDurationMs: 150,
    frameWidth: 64, frameHeight: 64,
    renderWidth: 48, renderHeight: 48,
  },
  comp_medi: {
    walkSpriteKey: 'pet_medi_walk',
    idleSpriteKey: 'pet_medi_idle',
    walkFrames: 4, idleFrames: 2,
    frameDurationMs: 200,
    frameWidth: 64, frameHeight: 64,
    renderWidth: 48, renderHeight: 48,
  },
  comp_archivist: {
    walkSpriteKey: 'pet_archivist_walk',
    idleSpriteKey: 'pet_archivist_idle',
    walkFrames: 4, idleFrames: 2,
    frameDurationMs: 200,
    frameWidth: 64, frameHeight: 64,
    renderWidth: 48, renderHeight: 48,
  },
  comp_carapace: {
    walkSpriteKey: 'pet_carapace_walk',
    idleSpriteKey: 'pet_carapace_idle',
    walkFrames: 4, idleFrames: 2,
    frameDurationMs: 180,
    frameWidth: 96, frameHeight: 96,
    renderWidth: 56, renderHeight: 56,
  },
}

/**
 * Returns the pet animation definition for a given companion ID.
 * Returns null if no animation is defined for the species.
 */
export function getPetAnimation(companionId: string): PetAnimationDef | null {
  return PET_ANIMATIONS[companionId] ?? null
}

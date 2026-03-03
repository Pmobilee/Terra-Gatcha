/**
 * DomeScene.ts
 *
 * Phaser scene for the multi-floor glass hub (Phase 10.10).
 * Replaces FloorCanvas.svelte as the tile/object renderer.
 * Svelte DOM overlays (resource bars, panels) remain layered above the canvas via CSS.
 *
 * Scene key: 'DomeScene'
 */
import Phaser from 'phaser'
import {
  FLOOR_TILE_SIZE, FLOOR_COLS, FLOOR_ROWS, FLOOR_CANVAS_W, FLOOR_CANVAS_H,
  FloorBgTile, FloorFgTile,
  type HubFloor, type FloorUpgradeTier,
} from '../../data/hubLayout'
import { getDefaultHubStack } from '../../data/hubFloors'
import { getTreeStage } from '../../data/knowledgeTreeStages'
import { hubEvents } from '../hubEvents'

/** Theme ambient configs — one per floor theme. */
interface AmbientConfig {
  /** Phaser tint color for particles (e.g. 0x4ecca3). */
  particleColor: number
  /** How many ambient particles to spawn on this floor. */
  particleCount: number
  /** Hex color for the object glow ring. */
  glowColor: number
  /** Alpha of the glow fill. */
  glowAlpha: number
}

const THEME_AMBIENT: Record<string, AmbientConfig> = {
  'sci-fi':      { particleColor: 0x4ecca3, particleCount: 12, glowColor: 0x4ecca3, glowAlpha: 0.3 },
  'organic':     { particleColor: 0x90ee90, particleCount: 18, glowColor: 0x90ee90, glowAlpha: 0.25 },
  'crystal':     { particleColor: 0x6495ed, particleCount: 20, glowColor: 0x6495ed, glowAlpha: 0.35 },
  'observatory': { particleColor: 0xffffc8, particleCount: 35, glowColor: 0xffffc8, glowAlpha: 0.2 },
  'archive':     { particleColor: 0xc8b478, particleCount: 8,  glowColor: 0xc8b478, glowAlpha: 0.25 },
  'market':      { particleColor: 0xffa050, particleCount: 14, glowColor: 0xffa050, glowAlpha: 0.3 },
  'industrial':  { particleColor: 0xff6432, particleCount: 10, glowColor: 0xff6432, glowAlpha: 0.3 },
}

/** Background tile fill colors. */
const BG_COLORS: Record<number, number> = {
  [FloorBgTile.SkyStars]:      0x0a0a2e,
  [FloorBgTile.InteriorWall]:  0x2a2a3e,
  [FloorBgTile.DirtGround]:    0x4a3728,
  [FloorBgTile.StoneWall]:     0x3a3a4a,
  [FloorBgTile.CrystalWall]:   0x1a2a4a,
}

/** Foreground tile styles (color + alpha). */
const FG_COLORS: Record<number, { color: number; alpha: number }> = {
  [FloorFgTile.GlassWall]:    { color: 0x64b4ff, alpha: 0.3 },
  [FloorFgTile.MetalFrame]:   { color: 0x555568, alpha: 1.0 },
  [FloorFgTile.StoneFloor]:   { color: 0x5a5a6a, alpha: 1.0 },
  [FloorFgTile.MetalGrate]:   { color: 0x4a4a5a, alpha: 1.0 },
  [FloorFgTile.GlassCeiling]: { color: 0x78c8ff, alpha: 0.25 },
  [FloorFgTile.WoodPlanks]:   { color: 0x6a5038, alpha: 1.0 },
  [FloorFgTile.CrystalFloor]: { color: 0x2a4a6a, alpha: 1.0 },
}

/** Per-particle state. */
interface ParticleState {
  x: number
  y: number
  speed: number
  size: number
  alpha: number
}

/**
 * DomeScene renders the multi-floor hub via Phaser graphics primitives.
 * It is started/stopped by GameManager when the player enters/leaves the hub.
 */
export class DomeScene extends Phaser.Scene {
  /** Index within the unlocked floors array. */
  private floorIndex = 0
  /** All floors from the hub stack. */
  private floors: HubFloor[] = []
  /** Which floor IDs the player has unlocked. */
  private unlockedIds: string[] = ['starter']
  /** Upgrade tier per floor ID. */
  private floorTiers: Record<string, number> = { starter: 0 }
  /** Number of facts the player has mastered (for Knowledge Tree stage label). */
  private masteredCount = 0

  // ---- Graphics layers ----
  private tileGraphics!: Phaser.GameObjects.Graphics
  private objectGraphics!: Phaser.GameObjects.Graphics
  private glowGraphics!: Phaser.GameObjects.Graphics
  private particleGraphics!: Phaser.GameObjects.Graphics
  /** Text labels placed over floor objects. */
  private labelTexts: Phaser.GameObjects.Text[] = []

  /** Live particle state array — rebuilt when the floor changes. */
  private particleData: ParticleState[] = []

  constructor() {
    super({ key: 'DomeScene' })
  }

  /**
   * Called by Phaser when the scene is started.
   * Accepts optional hub state passed via GameManager.startDome().
   */
  init(data?: {
    unlockedIds?: string[]
    floorTiers?: Record<string, number>
    masteredCount?: number
    floorIndex?: number
  }): void {
    const hubStack = getDefaultHubStack()
    this.floors = hubStack.floors
    if (data?.unlockedIds) this.unlockedIds = data.unlockedIds
    if (data?.floorTiers) this.floorTiers = data.floorTiers
    if (data?.masteredCount !== undefined) this.masteredCount = data.masteredCount
    if (data?.floorIndex !== undefined) this.floorIndex = data.floorIndex
  }

  /** Create all persistent graphics layers and kick off the first render. */
  create(): void {
    this.tileGraphics    = this.add.graphics().setDepth(0)
    this.glowGraphics    = this.add.graphics().setDepth(1)
    this.objectGraphics  = this.add.graphics().setDepth(2)
    this.particleGraphics = this.add.graphics().setDepth(3)

    this.renderFloor()
    this.setupInput()
    this.initParticles()
  }

  /** Animate particles every frame. */
  update(_time: number, delta: number): void {
    this.updateParticles(delta)
  }

  // =========================================================
  // Public API — called from HubView.svelte / GameManager
  // =========================================================

  /**
   * Called from Svelte when playerSave changes so the scene stays in sync
   * without needing to be restarted.
   */
  setHubState(
    unlockedIds: string[],
    floorTiers: Record<string, number>,
    masteredCount: number,
  ): void {
    this.unlockedIds   = unlockedIds
    this.floorTiers    = floorTiers
    this.masteredCount = masteredCount
    this.renderFloor()
  }

  /**
   * Navigate to a specific floor index (within the unlocked list).
   * Plays a short fade transition.
   */
  goToFloor(index: number): void {
    if (index === this.floorIndex) return
    this.floorIndex = index

    this.cameras.main.fadeOut(200, 10, 10, 30)
    this.time.delayedCall(200, () => {
      this.renderFloor()
      this.initParticles()
      this.cameras.main.fadeIn(200, 10, 10, 30)
    })

    hubEvents.emit('floorChanged', index)
  }

  // =========================================================
  // Private rendering helpers
  // =========================================================

  /** Returns only the floors the player has unlocked. */
  private getUnlockedFloors(): HubFloor[] {
    return this.floors.filter(f => this.unlockedIds.includes(f.id))
  }

  /** Returns the currently displayed floor, or undefined if the list is empty. */
  private getCurrentFloor(): HubFloor | undefined {
    const unlocked = this.getUnlockedFloors()
    return unlocked[this.floorIndex]
  }

  /**
   * Full re-render of the current floor.
   * Clears all graphics layers, redraws tiles and objects, rebuilds labels.
   */
  private renderFloor(): void {
    const floor = this.getCurrentFloor()
    if (!floor) return

    const tier = (this.floorTiers[floor.id] ?? 0) as FloorUpgradeTier

    // ---- Clear all layers ----
    this.tileGraphics.clear()
    this.glowGraphics.clear()
    this.objectGraphics.clear()

    // Destroy old text labels
    for (const t of this.labelTexts) t.destroy()
    this.labelTexts = []

    // ---- Camera: scale floor to fill the viewport ----
    const cam = this.cameras.main
    const scaleX = cam.width  / FLOOR_CANVAS_W
    const scaleY = cam.height / FLOOR_CANVAS_H
    const scale  = Math.min(scaleX, scaleY)
    cam.setZoom(scale)
    cam.centerOn(FLOOR_CANVAS_W / 2, FLOOR_CANVAS_H / 2)

    // ---- Background tiles ----
    for (let r = 0; r < floor.bg.length && r < FLOOR_ROWS; r++) {
      for (let c = 0; c < floor.bg[r].length && c < FLOOR_COLS; c++) {
        const bgType = floor.bg[r][c]
        if (bgType === FloorBgTile.Empty) continue
        const color = BG_COLORS[bgType]
        if (color === undefined) continue
        this.tileGraphics.fillStyle(color, 1)
        this.tileGraphics.fillRect(
          c * FLOOR_TILE_SIZE, r * FLOOR_TILE_SIZE,
          FLOOR_TILE_SIZE, FLOOR_TILE_SIZE,
        )
      }
    }

    // ---- Foreground tiles ----
    for (let r = 0; r < floor.fg.length && r < FLOOR_ROWS; r++) {
      for (let c = 0; c < floor.fg[r].length && c < FLOOR_COLS; c++) {
        const fgType = floor.fg[r][c]
        if (fgType === FloorFgTile.Empty) continue
        const style = FG_COLORS[fgType]
        if (!style) continue
        this.tileGraphics.fillStyle(style.color, style.alpha)
        this.tileGraphics.fillRect(
          c * FLOOR_TILE_SIZE, r * FLOOR_TILE_SIZE,
          FLOOR_TILE_SIZE, FLOOR_TILE_SIZE,
        )
      }
    }

    // ---- Objects ----
    const ambient = THEME_AMBIENT[floor.theme] ?? THEME_AMBIENT['sci-fi']
    const visibleObjects = floor.objects.filter(obj => tier >= (obj.minTier ?? 0))

    for (const obj of visibleObjects) {
      const x = obj.gridX * FLOOR_TILE_SIZE
      const y = obj.gridY * FLOOR_TILE_SIZE
      const w = obj.gridW * FLOOR_TILE_SIZE
      const h = obj.gridH * FLOOR_TILE_SIZE

      // Glow ring for interactive objects
      if (obj.interactive) {
        this.glowGraphics.fillStyle(ambient.glowColor, ambient.glowAlpha)
        this.glowGraphics.fillRect(x - 2, y - 2, w + 4, h + 4)
      }

      // Object body
      const fillColor = obj.interactive ? 0x50c8a0 : 0x3c3c50
      const fillAlpha = obj.interactive ? 0.4 : 0.3
      this.objectGraphics.fillStyle(fillColor, fillAlpha)
      this.objectGraphics.fillRect(x, y, w, h)

      // Border for interactive objects
      if (obj.interactive) {
        this.objectGraphics.lineStyle(2, 0x50c8a0, 0.6)
        this.objectGraphics.strokeRect(x + 1, y + 1, w - 2, h - 2)
      }

      // Label
      const effectiveLabel = this.getEffectiveLabel(obj.action, obj.label)
      const labelText = effectiveLabel.length > 12
        ? effectiveLabel.slice(0, 11) + '\u2026'
        : effectiveLabel
      const text = this.add.text(x + w / 2, y + h / 2, labelText, {
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '10px',
        color: '#e0e0e0',
        align: 'center',
        wordWrap: { width: w - 4, useAdvancedWrap: true },
      }).setOrigin(0.5).setDepth(5)
      this.labelTexts.push(text)
    }
  }

  /**
   * For special objects, the label may differ from the static floor definition.
   * Currently only 'knowledgeTree' is dynamic (shows the tree growth stage name).
   */
  private getEffectiveLabel(action: string, defaultLabel: string): string {
    if (action === 'knowledgeTree') {
      return getTreeStage(this.masteredCount).label
    }
    return defaultLabel
  }

  // =========================================================
  // Input
  // =========================================================

  /** Wire up pointer-up hit-testing against floor objects. */
  private setupInput(): void {
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const floor = this.getCurrentFloor()
      if (!floor) return
      const tier = (this.floorTiers[floor.id] ?? 0) as FloorUpgradeTier

      // Convert screen coords → world coords (accounts for camera zoom + offset)
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
      const visibleObjects = floor.objects.filter(obj => tier >= (obj.minTier ?? 0))

      // Test from front to back so the topmost object wins
      for (let i = visibleObjects.length - 1; i >= 0; i--) {
        const obj = visibleObjects[i]
        if (!obj.interactive) continue
        const ox = obj.gridX * FLOOR_TILE_SIZE
        const oy = obj.gridY * FLOOR_TILE_SIZE
        const ow = obj.gridW * FLOOR_TILE_SIZE
        const oh = obj.gridH * FLOOR_TILE_SIZE
        if (
          worldPoint.x >= ox && worldPoint.x < ox + ow &&
          worldPoint.y >= oy && worldPoint.y < oy + oh
        ) {
          hubEvents.emit('objectTap', obj.id, obj.action)
          return
        }
      }
    })
  }

  // =========================================================
  // Particles
  // =========================================================

  /** Seed and build the particleData array for the current floor. */
  private initParticles(): void {
    const floor = this.getCurrentFloor()
    if (!floor) return
    const ambient = THEME_AMBIENT[floor.theme] ?? THEME_AMBIENT['sci-fi']

    // Deterministic seeding from floor ID so particles are stable across renders
    let seed = 0
    for (let i = 0; i < floor.id.length; i++) {
      seed = (seed * 31 + floor.id.charCodeAt(i)) >>> 0
    }
    const rng = this.seededRng(seed)

    this.particleData = Array.from({ length: ambient.particleCount }, () => ({
      x:     rng() * FLOOR_CANVAS_W,
      y:     rng() * FLOOR_CANVAS_H,
      speed: 0.15 + rng() * 0.35,
      size:  1.5  + rng() * 1.5,
      alpha: 0.3  + rng() * 0.5,
    }))
  }

  /** Advance and redraw all particles for this frame. */
  private updateParticles(delta: number): void {
    this.particleGraphics.clear()

    const floor = this.getCurrentFloor()
    if (!floor) return
    const ambient = THEME_AMBIENT[floor.theme] ?? THEME_AMBIENT['sci-fi']

    for (const p of this.particleData) {
      p.y -= p.speed * delta * 0.06
      // Wrap around when particle drifts above the top
      if (p.y < -p.size) {
        p.y = FLOOR_CANVAS_H + p.size
      }
      this.particleGraphics.fillStyle(ambient.particleColor, p.alpha * 0.5)
      this.particleGraphics.fillCircle(p.x, p.y, p.size)
    }
  }

  // =========================================================
  // Utilities
  // =========================================================

  /**
   * Fast deterministic PRNG (mulberry32 variant).
   * Returns a closure that generates floats in [0, 1).
   */
  private seededRng(seed: number): () => number {
    let s = seed >>> 0
    return () => {
      s += 0x6d2b79f5
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
      return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff
    }
  }
}

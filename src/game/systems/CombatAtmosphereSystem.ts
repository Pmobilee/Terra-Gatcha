import Phaser from 'phaser'
import { getDeviceTier } from '../../services/deviceTierService'

/** Floor theme determines particle tint and behavior. */
type FloorTheme = 'dust' | 'embers' | 'ice' | 'arcane' | 'void'

function getFloorTheme(floor: number): FloorTheme {
  if (floor <= 3) return 'dust'
  if (floor <= 6) return 'embers'
  if (floor <= 9) return 'ice'
  if (floor <= 12) return 'arcane'
  return 'void'
}

const THEME_TINTS: Record<FloorTheme, number[]> = {
  dust: [0xd4c4a0, 0xc8b888, 0xbca870],
  embers: [0xff6600, 0xff4400, 0xff8800],
  ice: [0x88ccff, 0xaaddff, 0x66bbee],
  arcane: [0xcc88ff, 0xaa66ee, 0xdd99ff],
  void: [0x8844cc, 0x6633aa, 0xaa55dd],
}

function isReduceMotionEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return JSON.parse(window.localStorage.getItem('card:reduceMotionMode') ?? 'false') === true
  } catch {
    return false
  }
}

/**
 * CombatAtmosphereSystem manages ambient particles and fog overlays
 * that give each floor a distinct atmospheric feel.
 */
export class CombatAtmosphereSystem {
  private scene: Phaser.Scene
  private fogGfx: Phaser.GameObjects.Graphics | null = null
  private fogTween: Phaser.Tweens.Tween | null = null
  private ambientTimer: Phaser.Time.TimerEvent | null = null
  private activeEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = []
  private reduceMotion: boolean
  private effectScale: number
  private ambientBudget: number
  private currentTheme: FloorTheme = 'dust'
  private isActive = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.reduceMotion = isReduceMotionEnabled()
    const tier = getDeviceTier()
    this.effectScale = tier === 'low-end' ? 0.65 : 1
    this.ambientBudget = tier === 'low-end' ? 10 : tier === 'mid' ? 20 : 50
  }

  /**
   * Start atmosphere effects for a given floor.
   * @param floor Current dungeon floor number
   * @param isBoss Whether this is a boss encounter
   */
  public start(floor: number, isBoss: boolean): void {
    this.stop()
    if (this.reduceMotion) return

    this.isActive = true
    this.currentTheme = getFloorTheme(floor)
    const w = this.scene.scale.width
    const h = this.scene.scale.height

    // ── Front fog layer ──────────────────────────────
    this.fogGfx = this.scene.add.graphics().setDepth(2).setAlpha(isBoss ? 0.15 : 0.08)
    const fogAlpha = isBoss ? 0.12 : 0.06
    this.fogGfx.fillStyle(0x000000, fogAlpha)
    this.fogGfx.fillRect(0, h * 0.6, w, h * 0.4)

    // Gentle horizontal drift via alpha oscillation
    this.fogTween = this.scene.tweens.add({
      targets: this.fogGfx,
      alpha: { from: isBoss ? 0.15 : 0.08, to: isBoss ? 0.22 : 0.12 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // ── Ensure ambient particle texture ──────────────
    if (!this.scene.textures.exists('ambient_particle')) {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 })
      gfx.fillStyle(0xffffff)
      gfx.fillCircle(3, 3, 3)
      gfx.generateTexture('ambient_particle', 6, 6)
      gfx.destroy()
    }

    // ── Ambient particles by theme ───────────────────
    const tints = THEME_TINTS[this.currentTheme]
    const spawnInterval = 500
    let spawnedCount = 0

    this.ambientTimer = this.scene.time.addEvent({
      delay: spawnInterval,
      loop: true,
      callback: () => {
        if (!this.isActive || spawnedCount >= this.ambientBudget) return

        const px = Math.random() * w
        const py = h * 0.2 + Math.random() * (h * 0.5)
        const tint = tints[Math.floor(Math.random() * tints.length)]

        const gravY = this.currentTheme === 'embers' ? -40 :
                       this.currentTheme === 'dust' ? 10 :
                       this.currentTheme === 'ice' ? 5 : -15

        const emitter = this.scene.add.particles(px, py, 'ambient_particle', {
          speed: { min: 5, max: 15 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.3 * this.effectScale, end: 0 },
          alpha: { start: 0.4, end: 0 },
          tint: [tint],
          lifespan: 3000,
          gravityY: gravY,
          emitting: false,
        })
        emitter.setDepth(2)
        emitter.explode(1, 0, 0)
        this.activeEmitters.push(emitter)
        spawnedCount++

        // Cleanup after lifespan
        this.scene.time.delayedCall(3500, () => {
          emitter.destroy()
          this.activeEmitters = this.activeEmitters.filter(e => e !== emitter)
          spawnedCount = Math.max(0, spawnedCount - 1)
        })
      },
    })
  }

  /** Stop all atmosphere effects and clean up. */
  public stop(): void {
    this.isActive = false

    if (this.fogTween) {
      this.fogTween.destroy()
      this.fogTween = null
    }
    if (this.fogGfx) {
      this.fogGfx.destroy()
      this.fogGfx = null
    }
    if (this.ambientTimer) {
      this.ambientTimer.destroy()
      this.ambientTimer = null
    }
    for (const emitter of this.activeEmitters) {
      emitter.destroy()
    }
    this.activeEmitters = []
  }

  /** Clean up all resources. */
  public destroy(): void {
    this.stop()
  }
}

import Phaser from 'phaser'
import { getDeviceTier } from '../../services/deviceTierService'

/** Status effect types that have visual overlays. */
type VisualEffectType = 'poison' | 'burn' | 'freeze' | 'bleed' | 'buff' | 'debuff'

interface ActiveVisual {
  type: VisualEffectType
  timer: Phaser.Time.TimerEvent
  emitters: Phaser.GameObjects.Particles.ParticleEmitter[]
  aura?: Phaser.GameObjects.Arc
  auraTween?: Phaser.Tweens.Tween
}

const EFFECT_CONFIG: Record<VisualEffectType, {
  tint: number
  gravityY: number
  rate: number // particles per second
  speed: { min: number; max: number }
}> = {
  poison: { tint: 0x44ff44, gravityY: 60, rate: 3, speed: { min: 10, max: 25 } },
  burn: { tint: 0xff6600, gravityY: -40, rate: 3, speed: { min: 15, max: 30 } },
  freeze: { tint: 0x88ccff, gravityY: 5, rate: 2, speed: { min: 5, max: 15 } },
  bleed: { tint: 0xcc0000, gravityY: 80, rate: 2, speed: { min: 8, max: 20 } },
  buff: { tint: 0xffd700, gravityY: 0, rate: 0, speed: { min: 0, max: 0 } },
  debuff: { tint: 0x9b59b6, gravityY: 0, rate: 0, speed: { min: 0, max: 0 } },
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
 * StatusEffectVisualSystem manages persistent visual overlays
 * on enemies showing active status effects (poison drips, burn embers, etc.).
 */
export class StatusEffectVisualSystem {
  private scene: Phaser.Scene
  private activeVisuals: Map<VisualEffectType, ActiveVisual> = new Map()
  private reduceMotion: boolean
  private effectScale: number
  private enemyX = 0
  private enemyY = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.reduceMotion = isReduceMotionEnabled()
    this.effectScale = getDeviceTier() === 'low-end' ? 0.65 : 1
  }

  /** Set enemy position for particle spawning. */
  public setEnemyPosition(x: number, y: number): void {
    this.enemyX = x
    this.enemyY = y
  }

  /**
   * Update the set of active status effects.
   * Adds new visuals, removes expired ones.
   */
  public updateEffects(effects: Array<{ type: string }>): void {
    if (this.reduceMotion) return

    // Ensure particle texture
    if (!this.scene.textures.exists('status_particle')) {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 })
      gfx.fillStyle(0xffffff)
      gfx.fillRect(0, 0, 3, 3)
      gfx.generateTexture('status_particle', 3, 3)
      gfx.destroy()
    }

    // Map effect types to visual types
    const activeTypes = new Set<VisualEffectType>()
    for (const eff of effects) {
      const vType = this.mapToVisualType(eff.type)
      if (vType) activeTypes.add(vType)
    }

    // Remove visuals for effects no longer active
    for (const [type, visual] of this.activeVisuals) {
      if (!activeTypes.has(type)) {
        this.removeVisual(visual)
        this.activeVisuals.delete(type)
      }
    }

    // Add visuals for new effects
    for (const type of activeTypes) {
      if (!this.activeVisuals.has(type)) {
        const visual = this.createVisual(type)
        if (visual) this.activeVisuals.set(type, visual)
      }
    }
  }

  /** Remove all active visuals. */
  public clearAll(): void {
    for (const [, visual] of this.activeVisuals) {
      this.removeVisual(visual)
    }
    this.activeVisuals.clear()
  }

  /** Destroy the system. */
  public destroy(): void {
    this.clearAll()
  }

  private mapToVisualType(effectType: string): VisualEffectType | null {
    switch (effectType) {
      case 'poison': return 'poison'
      case 'burn': return 'burn'
      case 'freeze': return 'freeze'
      case 'bleed': return 'bleed'
      case 'strength_up':
      case 'empower':
      case 'quicken': return 'buff'
      case 'weaken':
      case 'expose':
      case 'slow': return 'debuff'
      default: return null
    }
  }

  private createVisual(type: VisualEffectType): ActiveVisual | null {
    const config = EFFECT_CONFIG[type]
    const emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = []

    if (type === 'buff' || type === 'debuff') {
      // Aura ring effect — no particles, just a rotating ring
      const color = config.tint
      const aura = this.scene.add.circle(this.enemyX, this.enemyY, 60, color, 0)
        .setStrokeStyle(2, color, 0.3)
        .setDepth(4)

      const auraTween = this.scene.tweens.add({
        targets: aura,
        angle: 360,
        duration: 4000,
        repeat: -1,
        ease: 'Linear',
      })

      // Pulsing alpha
      this.scene.tweens.add({
        targets: aura,
        alpha: { from: 0.1, to: 0.25 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })

      const timer = this.scene.time.addEvent({ delay: 999999, callback: () => {} })

      return { type, timer, emitters, aura, auraTween }
    }

    // Particle-based effects
    const interval = Math.round(1000 / config.rate)

    const timer = this.scene.time.addEvent({
      delay: interval,
      loop: true,
      callback: () => {
        const offsetX = (Math.random() - 0.5) * 60
        const offsetY = (Math.random() - 0.5) * 60
        const px = this.enemyX + offsetX
        const py = this.enemyY + offsetY

        const emitter = this.scene.add.particles(px, py, 'status_particle', {
          speed: config.speed,
          angle: config.gravityY < 0 ? { min: 250, max: 290 } : { min: 70, max: 110 },
          scale: { start: 0.5 * this.effectScale, end: 0 },
          alpha: { start: 0.6, end: 0 },
          tint: [config.tint],
          lifespan: 800,
          gravityY: config.gravityY,
          emitting: false,
        })
        emitter.setDepth(999)
        emitter.explode(1, 0, 0)
        emitters.push(emitter)

        // Cleanup after lifespan
        this.scene.time.delayedCall(900, () => {
          emitter.destroy()
          const idx = emitters.indexOf(emitter)
          if (idx >= 0) emitters.splice(idx, 1)
        })
      },
    })

    return { type, timer, emitters }
  }

  private removeVisual(visual: ActiveVisual): void {
    visual.timer.destroy()
    for (const emitter of visual.emitters) {
      emitter.destroy()
    }
    visual.emitters.length = 0
    if (visual.auraTween) {
      visual.auraTween.destroy()
    }
    if (visual.aura) {
      visual.aura.destroy()
    }
  }
}

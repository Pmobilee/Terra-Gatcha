/**
 * Campfire Living Fire VFX System (C1)
 * Renders animated fire particles with streak-based intensity.
 * Uses Canvas2D with 30fps throttling for performance.
 */

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  alpha: number
  color: number
}

/**
 * Check if reduced motion is enabled in localStorage.
 */
function isReduceMotionEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return JSON.parse(window.localStorage.getItem('card:reduceMotionMode') ?? 'false') === true
  } catch {
    return false
  }
}

export class CampfireEffect {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D | null
  private streak: number
  private particles: Particle[] = []
  private maxParticles: number = 30
  private animationFrameId: number | null = null
  private lastFrameTime: number = 0
  private frameThrottle: number = 1000 / 30 // 30fps
  private reduceMotion: boolean = false
  private glowAlpha: number = 0.12
  private glowRadius: number = 80
  private emissionRate: number = 10

  constructor(canvas: HTMLCanvasElement, streak: number) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: true })
    this.streak = streak
    this.reduceMotion = isReduceMotionEnabled()
    this.updateIntensityFromStreak(streak)
    this.initParticlePool()
  }

  /**
   * Initialize empty particle pool.
   */
  private initParticlePool(): void {
    this.particles = []
  }

  /**
   * Update intensity based on streak.
   * - 0 streak: 10 particles, 80px glow, 0.10 alpha
   * - 3-day streak: 20 particles, 100px glow, 0.14 alpha
   * - 7+ day streak: 30 particles, 120px glow, 0.18 alpha
   */
  private updateIntensityFromStreak(streak: number): void {
    if (streak >= 7) {
      this.maxParticles = 30
      this.glowRadius = 120
      this.glowAlpha = 0.18
      this.emissionRate = 30
    } else if (streak >= 3) {
      this.maxParticles = 20
      this.glowRadius = 100
      this.glowAlpha = 0.14
      this.emissionRate = 20
    } else {
      this.maxParticles = 10
      this.glowRadius = 80
      this.glowAlpha = 0.10
      this.emissionRate = 10
    }
  }

  /**
   * Emit new particles at the base of the flame.
   */
  private emitParticles(): void {
    if (this.reduceMotion) return

    const centerX = this.canvas.width / 2
    const baseY = this.canvas.height * 0.85

    while (this.particles.length < this.maxParticles) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.5 + Math.random() * 1.5

      this.particles.push({
        x: centerX + (Math.random() - 0.5) * 20,
        y: baseY,
        vx: Math.cos(angle) * speed * 0.3,
        vy: -speed,
        life: 1,
        maxLife: 1 + Math.random() * 0.5,
        size: 8 + Math.random() * 6,
        alpha: 1,
        color: 0xff6b1a, // orange base
      })
    }
  }

  /**
   * Update particle positions and lifecycle.
   */
  private updateParticles(deltaTime: number): void {
    const dt = Math.min(deltaTime / 1000, 0.016) // cap at ~60fps

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]

      // Update position with drift
      const driftPhase = performance.now() * 0.002 + i * 0.5
      const horizontalDrift = Math.sin(driftPhase) * 0.4
      p.x += (p.vx + horizontalDrift) * (dt * 60)
      p.y += p.vy * (dt * 60)

      // Update life
      p.life -= dt / p.maxLife
      p.alpha = Math.max(0, p.life)

      // Color interpolation: orange to yellow
      const t = 1 - p.life
      const r = Math.round(0xff - (0xff - 0xcc) * t)
      const g = Math.round(0x6b + (0xcc - 0x6b) * t)
      const b = 0x1a
      p.color = (r << 16) | (g << 8) | b

      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1)
      }
    }
  }

  /**
   * Render particles and glow to the canvas.
   */
  private render(): void {
    if (!this.ctx) return

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height * 0.85

    if (this.reduceMotion) {
      // Static glow only
      const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, this.glowRadius)
      gradient.addColorStop(0, `rgba(255, 107, 26, ${this.glowAlpha})`)
      gradient.addColorStop(1, 'rgba(255, 107, 26, 0)')
      this.ctx.fillStyle = gradient
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
      return
    }

    // Draw glow with sine-wave flicker
    const flicker = 0.12 + Math.sin(performance.now() * 0.003) * 0.06
    const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, this.glowRadius)
    gradient.addColorStop(0, `rgba(255, 107, 26, ${flicker})`)
    gradient.addColorStop(1, 'rgba(255, 107, 26, 0)')
    this.ctx.fillStyle = gradient
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Draw particles
    for (const p of this.particles) {
      const r = (p.color >> 16) & 0xff
      const g = (p.color >> 8) & 0xff
      const b = p.color & 0xff

      this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.alpha * 0.8})`
      this.ctx.beginPath()
      this.ctx.arc(p.x, p.y, p.size * (p.alpha * 0.5 + 0.5), 0, Math.PI * 2)
      this.ctx.fill()
    }
  }

  /**
   * Main animation loop with 30fps throttling.
   */
  private animate = (now: number): void => {
    const deltaTime = now - this.lastFrameTime

    if (deltaTime >= this.frameThrottle) {
      this.lastFrameTime = now - (deltaTime % this.frameThrottle)
      this.emitParticles()
      this.updateParticles(deltaTime)
      this.render()
    }

    this.animationFrameId = requestAnimationFrame(this.animate)
  }

  /**
   * Start the fire animation.
   */
  start(): void {
    this.lastFrameTime = performance.now()
    this.animationFrameId = requestAnimationFrame(this.animate)
  }

  /**
   * Stop the animation and clear particles.
   */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    this.particles = []
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }
  }

  /**
   * Update the streak and adjust intensity dynamically.
   */
  updateStreak(streak: number): void {
    this.streak = streak
    this.updateIntensityFromStreak(streak)
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.stop()
    this.ctx = null
  }
}

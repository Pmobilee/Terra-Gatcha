<script lang="ts">
  import { get } from 'svelte/store'
  import { getDomeSpriteUrls, DOME_OBJECTS } from '../../game/domeManifest'
  import type { DomeObject } from '../../game/domeManifest'
  import { spriteResolution } from '../stores/settings'

  /**
   * Props for the DomeCanvas interactive pixel-art dome scene.
   */
  interface Props {
    /** Called when an interactive dome object is tapped/clicked. */
    onObjectTap: (objectId: string, room: string) => void
    /** Current GAIA expression sprite key. Defaults to 'neutral'. */
    gaiaExpression?: string
    /** Canvas render width in pixels. Defaults to 800. */
    width?: number
    /** Canvas render height in pixels. Defaults to 600. */
    height?: number
  }

  let {
    onObjectTap,
    gaiaExpression = 'neutral',
    width = 800,
    height = 600,
  }: Props = $props()

  // ── Canvas ref ────────────────────────────────────────────────────────────
  let canvasEl = $state<HTMLCanvasElement | null>(null)

  // ── Reactive state ────────────────────────────────────────────────────────
  let imagesLoaded = $state(false)
  let hoveredObject = $state<DomeObject | null>(null)
  let dirty = $state(true)

  // ── Image cache ───────────────────────────────────────────────────────────
  const imageMap = new Map<string, HTMLImageElement>()

  // ── Star positions (seeded, stable between frames) ────────────────────────
  interface Star {
    x: number
    y: number
    r: number
    color: string
  }

  /**
   * Generate deterministic star positions using a simple seeded LCG.
   * Stars are placed in the sky area (top 70% of canvas).
   */
  function generateStars(count: number, canvasW: number, canvasH: number): Star[] {
    const stars: Star[] = []
    // Simple LCG parameters (Numerical Recipes)
    const a = 1664525
    const c = 1013904223
    const m = 2 ** 32
    let seed = 0xdeadbeef

    function rand(): number {
      seed = (a * seed + c) % m
      return seed / m
    }

    const skyHeight = canvasH * 0.72

    for (let i = 0; i < count; i++) {
      const x = rand() * canvasW
      const y = rand() * skyHeight
      const r = rand() * 1.2 + 0.4
      const bright = Math.floor(rand() * 80 + 175)
      // Occasional warm-tinted star
      const warm = rand() > 0.75
      const color = warm
        ? `rgb(${bright}, ${bright - 20}, ${bright - 60})`
        : `rgb(${bright}, ${bright}, ${bright})`
      stars.push({ x, y, r, color })
    }

    return stars
  }

  let stars: Star[] = []

  // ── RAF handle ────────────────────────────────────────────────────────────
  let rafId: number | null = null
  let lastGaiaOffset = 0

  /**
   * Load all dome sprite images for the given resolution.
   * Calls the provided callback when all images are ready.
   */
  function loadImages(onAllLoaded: () => void): void {
    const res = get(spriteResolution)
    const urls = getDomeSpriteUrls(res)

    // Collect keys we need: all DOME_OBJECTS sprites + GAIA sprites + scene sprites
    const needed = new Set<string>([
      'dome_shell',
      'surface_terrain',
      'gaia_neutral',
      'gaia_happy',
      'gaia_excited',
      'gaia_thinking',
      ...DOME_OBJECTS.map(o => o.spriteKey),
    ])

    let remaining = 0

    for (const key of needed) {
      const url = urls[key]
      if (!url) continue

      // Avoid re-loading if already cached
      if (imageMap.has(key)) continue

      remaining++
      const img = new Image()
      img.onload = () => {
        remaining--
        if (remaining === 0) {
          onAllLoaded()
        }
      }
      img.onerror = () => {
        // Count errored images as loaded so we don't block indefinitely
        remaining--
        if (remaining === 0) {
          onAllLoaded()
        }
      }
      img.src = url
      imageMap.set(key, img)
    }

    // If all keys were already cached (or none needed loading)
    if (remaining === 0) {
      onAllLoaded()
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  /**
   * Draw a sky gradient with scattered star dots.
   */
  function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, '#0a0a2e')
    grad.addColorStop(1, '#1a0a3e')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    // Draw stars
    for (const star of stars) {
      ctx.beginPath()
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
      ctx.fillStyle = star.color
      ctx.fill()
    }
  }

  /**
   * Draw the surface terrain: wavy ground line at ~70% height filled with dark brown.
   * Tiles the surface_terrain sprite along the ground.
   */
  function drawTerrain(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const groundY = h * 0.70

    // Draw wavy ground path
    ctx.beginPath()
    ctx.moveTo(0, groundY)

    // Gentle sine wave along the ground line
    const segments = 20
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * w
      const wave = Math.sin((i / segments) * Math.PI * 4) * 4
      ctx.lineTo(x, groundY + wave)
    }

    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()

    ctx.fillStyle = '#2a1810'
    ctx.fill()

    // Tile surface_terrain sprite along the ground line
    const terrainImg = imageMap.get('surface_terrain')
    if (terrainImg && terrainImg.complete && terrainImg.naturalWidth > 0) {
      const tileH = h * 0.08
      const tileW = terrainImg.naturalWidth * (tileH / terrainImg.naturalHeight)
      const tileY = groundY - tileH * 0.35

      ctx.save()
      // Clip to a thin strip around the ground line
      ctx.beginPath()
      ctx.rect(0, tileY - 4, w, tileH + 8)
      ctx.clip()

      let tx = 0
      while (tx < w) {
        ctx.drawImage(terrainImg, tx, tileY, tileW, tileH)
        tx += tileW
      }
      ctx.restore()
    }
  }

  /**
   * Draw the dome shell sprite, centered horizontally, spanning ~80% width,
   * as a semi-transparent overlay.
   */
  function drawDomeShell(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const shellImg = imageMap.get('dome_shell')
    if (!shellImg || !shellImg.complete || shellImg.naturalWidth === 0) return

    const domeW = w * 0.80
    // Maintain aspect ratio of the sprite
    const domeH = shellImg.naturalHeight * (domeW / shellImg.naturalWidth)
    const domeX = (w - domeW) / 2
    const domeY = h - domeH

    ctx.save()
    ctx.globalAlpha = 0.72
    ctx.drawImage(shellImg, domeX, domeY, domeW, domeH)
    ctx.restore()
  }

  /**
   * Draw glow highlight behind the hovered object.
   */
  function drawHoverGlow(
    ctx: CanvasRenderingContext2D,
    obj: DomeObject,
    w: number,
    h: number,
  ): void {
    const cx = (obj.x + obj.width / 2) * w
    const cy = (obj.y + obj.height / 2) * h
    const rx = (obj.width * w) / 2 + 10
    const ry = (obj.height * h) / 2 + 10
    const r = Math.max(rx, ry)

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, 'rgba(255,255,255,0.22)')
    grad.addColorStop(0.5, 'rgba(255,255,255,0.10)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')

    ctx.save()
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx + 12, ry + 12, 0, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
    ctx.restore()
  }

  /**
   * Draw all interactive dome objects.
   */
  function drawObjects(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    hovered: DomeObject | null,
  ): void {
    for (const obj of DOME_OBJECTS) {
      // Draw glow before drawing the sprite (so glow is behind)
      if (hovered && hovered.id === obj.id) {
        drawHoverGlow(ctx, obj, w, h)
      }

      const img = imageMap.get(obj.spriteKey)
      if (img && img.complete && img.naturalWidth > 0) {
        const px = obj.x * w
        const py = obj.y * h
        const pw = obj.width * w
        const ph = obj.height * h
        ctx.drawImage(img, px, py, pw, ph)
      }
    }
  }

  /**
   * Draw the GAIA avatar at position (0.28, 0.52) with a vertical float bob.
   */
  function drawGaia(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    expressionKey: string,
    floatOffset: number,
  ): void {
    // Resolve the expression key: fall back to neutral if not found
    const validKeys = ['neutral', 'happy', 'excited', 'thinking']
    const key = validKeys.includes(expressionKey) ? expressionKey : 'neutral'
    const imgKey = `gaia_${key}`
    const img = imageMap.get(imgKey)

    if (!img || !img.complete || img.naturalWidth === 0) return

    const GAIA_X = 0.28
    const GAIA_Y = 0.52
    // Render at ~12% of canvas width
    const gw = w * 0.12
    const gh = img.naturalHeight * (gw / img.naturalWidth)
    const gx = GAIA_X * w - gw / 2
    const gy = GAIA_Y * h - gh / 2 + floatOffset

    ctx.drawImage(img, gx, gy, gw, gh)
  }

  /**
   * Draw a tooltip label below the hovered object.
   */
  function drawTooltip(
    ctx: CanvasRenderingContext2D,
    obj: DomeObject,
    w: number,
    h: number,
  ): void {
    const cx = (obj.x + obj.width / 2) * w
    const bottomY = (obj.y + obj.height) * h + 6

    const label = obj.label
    const fontSize = Math.max(10, Math.round(w * 0.018))
    ctx.font = `${fontSize}px "Courier New", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    const textW = ctx.measureText(label).width
    const padX = 8
    const padY = 4
    const boxW = textW + padX * 2
    const boxH = fontSize + padY * 2
    const boxX = cx - boxW / 2
    const boxY = bottomY

    // Background pill
    ctx.save()
    ctx.fillStyle = 'rgba(10, 10, 46, 0.82)'
    ctx.beginPath()
    const r = 4
    ctx.moveTo(boxX + r, boxY)
    ctx.lineTo(boxX + boxW - r, boxY)
    ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + r, r)
    ctx.lineTo(boxX + boxW, boxY + boxH - r)
    ctx.arcTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH, r)
    ctx.lineTo(boxX + r, boxY + boxH)
    ctx.arcTo(boxX, boxY + boxH, boxX, boxY + boxH - r, r)
    ctx.lineTo(boxX, boxY + r)
    ctx.arcTo(boxX, boxY, boxX + r, boxY, r)
    ctx.closePath()
    ctx.fill()

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Text
    ctx.fillStyle = '#e8e8f0'
    ctx.fillText(label, cx, boxY + padY)
    ctx.restore()
  }

  /**
   * Main render function. Draws all layers onto the canvas.
   */
  function render(): void {
    const canvas = canvasEl
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = width
    const h = height

    // GAIA float animation: continuous sine-based vertical bob
    const floatOffset = Math.sin(Date.now() / 1000) * 3

    // Only re-render if dirty or GAIA offset has changed (for animation)
    const gaiaChanged = Math.abs(floatOffset - lastGaiaOffset) > 0.05
    if (!dirty && !gaiaChanged) return

    lastGaiaOffset = floatOffset
    dirty = false

    // 1. Sky gradient + stars
    drawSky(ctx, w, h)

    // 2. Surface terrain
    drawTerrain(ctx, w, h)

    // 3. Dome shell
    drawDomeShell(ctx, w, h)

    // 4. Interactive objects (with hover glow)
    drawObjects(ctx, w, h, hoveredObject)

    // 5. GAIA avatar with float animation
    drawGaia(ctx, w, h, gaiaExpression, floatOffset)

    // 6. Tooltip for hovered object
    if (hoveredObject) {
      drawTooltip(ctx, hoveredObject, w, h)
    }
  }

  /**
   * The animation loop. Schedules re-renders via requestAnimationFrame.
   */
  function loop(): void {
    render()
    rafId = requestAnimationFrame(loop)
  }

  // ── Pointer coordinate scaling ────────────────────────────────────────────

  /**
   * Convert a pointer event's client coordinates to canvas-space coordinates,
   * accounting for CSS scaling (canvas may be displayed smaller than its pixel size).
   */
  function getCanvasCoords(e: PointerEvent | MouseEvent | Touch): { x: number; y: number } {
    const canvas = canvasEl
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = width / rect.width
    const scaleY = height / rect.height

    const clientX = 'clientX' in e ? e.clientX : (e as Touch).clientX
    const clientY = 'clientY' in e ? e.clientY : (e as Touch).clientY

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  /**
   * Find the topmost dome object whose bounding box contains the given canvas point.
   * Returns null if none matched.
   */
  function hitTest(canvasX: number, canvasY: number): DomeObject | null {
    // Iterate in reverse so front-rendered objects take priority
    for (let i = DOME_OBJECTS.length - 1; i >= 0; i--) {
      const obj = DOME_OBJECTS[i]
      const ox = obj.x * width
      const oy = obj.y * height
      const ow = obj.width * width
      const oh = obj.height * height
      if (canvasX >= ox && canvasX <= ox + ow && canvasY >= oy && canvasY <= oy + oh) {
        return obj
      }
    }
    return null
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  function handlePointerMove(e: PointerEvent): void {
    const { x, y } = getCanvasCoords(e)
    const hit = hitTest(x, y)
    if (hit?.id !== hoveredObject?.id) {
      hoveredObject = hit
      dirty = true
      if (canvasEl) {
        canvasEl.style.cursor = hit ? 'pointer' : 'default'
      }
    }
  }

  function handlePointerLeave(): void {
    if (hoveredObject !== null) {
      hoveredObject = null
      dirty = true
      if (canvasEl) {
        canvasEl.style.cursor = 'default'
      }
    }
  }

  function handleClick(e: MouseEvent): void {
    const { x, y } = getCanvasCoords(e)
    const hit = hitTest(x, y)
    if (hit) {
      onObjectTap(hit.id, hit.room)
    }
  }

  function handleTouchStart(e: TouchEvent): void {
    // Prevent scroll so the tap is handled as a click on the canvas
    e.preventDefault()
    const touch = e.changedTouches[0]
    if (!touch) return
    const { x, y } = getCanvasCoords(touch)
    const hit = hitTest(x, y)
    if (hit) {
      onObjectTap(hit.id, hit.room)
    }
  }

  // ── Svelte 5 lifecycle via $effect ────────────────────────────────────────

  $effect(() => {
    // Re-run whenever canvas element is bound or width/height change
    const canvas = canvasEl
    if (!canvas) return

    // Set canvas pixel dimensions
    canvas.width = width
    canvas.height = height

    // Generate stable star field for this canvas size
    stars = generateStars(120, width, height)

    // Attach event listeners
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerleave', handlePointerLeave)
    canvas.addEventListener('click', handleClick)
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })

    // Load images, then start the render loop
    imagesLoaded = false
    dirty = true

    loadImages(() => {
      imagesLoaded = true
      dirty = true
    })

    // Start animation loop
    rafId = requestAnimationFrame(loop)

    return () => {
      // Cleanup on unmount or re-run
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
      canvas.removeEventListener('click', handleClick)
      canvas.removeEventListener('touchstart', handleTouchStart)
    }
  })

  // Re-mark dirty whenever gaiaExpression prop changes (handled by loop naturally,
  // but we set dirty so first frame after change renders immediately)
  $effect(() => {
    // Track gaiaExpression reactively
    void gaiaExpression
    dirty = true
  })
</script>

<!--
  DomeCanvas: Interactive pixel-art dome scene rendered on a 2D canvas.
  Objects are tappable/clickable to navigate dome rooms.
-->
<canvas
  bind:this={canvasEl}
  aria-label="Dome scene — tap an object to explore"
  style="
    width: 100%;
    height: auto;
    display: block;
    pointer-events: auto;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  "
></canvas>

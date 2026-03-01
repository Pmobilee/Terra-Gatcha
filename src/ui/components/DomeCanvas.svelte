<script lang="ts">
  import { get } from 'svelte/store'
  import { getDomeSpriteUrls } from '../../game/domeManifest'
  import {
    getDefaultDomeLayout,
    BG_TILE_SPRITES,
    FG_TILE_SPRITES,
    BgTile,
    FgTile,
    TILE_SIZE,
    DOME_WIDTH,
    DOME_HEIGHT,
  } from '../../data/domeLayout'
  import type { DomeLayout, DomeObject } from '../../data/domeLayout'
  import { spriteResolution } from '../stores/settings'

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  /**
   * Props for the tile-based DomeCanvas scene.
   */
  interface Props {
    /** Called when an interactive dome object is tapped/clicked. */
    onObjectTap: (objectId: string, room: string) => void
    /** Current GAIA expression sprite key. Defaults to 'neutral'. */
    gaiaExpression?: string
  }

  let { onObjectTap, gaiaExpression = 'neutral' }: Props = $props()

  // ---------------------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------------------

  let containerEl = $state<HTMLDivElement | null>(null)
  let canvasEl = $state<HTMLCanvasElement | null>(null)

  // ---------------------------------------------------------------------------
  // Reactive state
  // ---------------------------------------------------------------------------

  let imagesLoaded = $state(false)
  let hoveredObject = $state<DomeObject | null>(null)
  let dirty = $state(true)

  // ---------------------------------------------------------------------------
  // Layout & image cache
  // ---------------------------------------------------------------------------

  /** The dome layout data model (grid + objects). */
  const layout: DomeLayout = getDefaultDomeLayout()

  /** Internal canvas pixel width — the full grid width at TILE_SIZE per cell. */
  const CANVAS_W = DOME_WIDTH * TILE_SIZE   // 24 * 32 = 768
  const CANVAS_H = DOME_HEIGHT * TILE_SIZE  // 16 * 32 = 512

  /** Cached HTMLImageElement instances, keyed by sprite key. */
  const imageMap = new Map<string, HTMLImageElement>()

  // ---------------------------------------------------------------------------
  // Star field (seeded, stable)
  // ---------------------------------------------------------------------------

  interface Star {
    x: number
    y: number
    r: number
    color: string
  }

  /**
   * Generate deterministic star positions using a simple seeded LCG.
   * Stars are scattered across the sky area of the canvas.
   */
  function generateStars(count: number, w: number, h: number): Star[] {
    const stars: Star[] = []
    const a = 1664525
    const c = 1013904223
    const m = 2 ** 32
    let seed = 0xdeadbeef

    function rand(): number {
      seed = (a * seed + c) % m
      return seed / m
    }

    // Sky occupies approximately the top ~4 rows (BgTile.Sky rows 0-3)
    const skyHeight = h * 0.28

    for (let i = 0; i < count; i++) {
      const x = rand() * w
      const y = rand() * skyHeight
      const r = rand() * 1.0 + 0.5
      const bright = Math.floor(rand() * 80 + 175)
      const warm = rand() > 0.78
      const color = warm
        ? `rgb(${bright}, ${bright - 20}, ${bright - 55})`
        : `rgb(${bright}, ${bright}, ${bright})`
      stars.push({ x, y, r, color })
    }

    return stars
  }

  const stars: Star[] = generateStars(90, CANVAS_W, CANVAS_H)

  // ---------------------------------------------------------------------------
  // RAF / animation
  // ---------------------------------------------------------------------------

  let rafId: number | null = null
  let lastGaiaOffset = 0

  // ---------------------------------------------------------------------------
  // Image loading
  // ---------------------------------------------------------------------------

  /**
   * Load all dome sprite images for the current resolution setting.
   * Invokes onAllLoaded when every pending image has resolved.
   */
  function loadImages(onAllLoaded: () => void): void {
    const res = get(spriteResolution)
    const urls = getDomeSpriteUrls(res)

    // Collect every sprite key referenced by the layout
    const needed = new Set<string>()

    for (const key of Object.values(BG_TILE_SPRITES)) {
      if (key) needed.add(key)
    }
    for (const key of Object.values(FG_TILE_SPRITES)) {
      if (key) needed.add(key)
    }
    for (const obj of layout.objects) {
      needed.add(obj.spriteKey)
    }
    // GAIA expressions
    needed.add('gaia_neutral')
    needed.add('gaia_happy')
    needed.add('gaia_thinking')
    // Surface horizon
    needed.add('surface_ground')

    let remaining = 0

    for (const key of needed) {
      const url = urls[key]
      if (!url) continue
      if (imageMap.has(key)) continue

      remaining++
      const img = new Image()
      img.onload = () => {
        remaining--
        if (remaining === 0) onAllLoaded()
      }
      img.onerror = () => {
        remaining--
        if (remaining === 0) onAllLoaded()
      }
      img.src = url
      imageMap.set(key, img)
    }

    if (remaining === 0) onAllLoaded()
  }

  // ---------------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------------

  /**
   * Draw an image into a grid cell, with an optional globalAlpha override.
   * Silently skips if the image is not yet loaded.
   */
  function drawTile(
    ctx: CanvasRenderingContext2D,
    key: string,
    col: number,
    row: number,
    alpha = 1,
  ): void {
    const img = imageMap.get(key)
    if (!img || !img.complete || img.naturalWidth === 0) return

    const x = col * TILE_SIZE
    const y = row * TILE_SIZE

    if (alpha !== 1) {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.drawImage(img, x, y, TILE_SIZE, TILE_SIZE)
      ctx.restore()
    } else {
      ctx.drawImage(img, x, y, TILE_SIZE, TILE_SIZE)
    }
  }

  /**
   * Draw a sky gradient + procedural stars across the full canvas.
   * This is the base layer visible through BgTile.Empty / sky cells.
   */
  function drawSkyGradient(ctx: CanvasRenderingContext2D): void {
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
    grad.addColorStop(0, '#0a0a2e')
    grad.addColorStop(1, '#1a0e30')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    for (const star of stars) {
      ctx.beginPath()
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
      ctx.fillStyle = star.color
      ctx.fill()
    }
  }

  /**
   * Draw all background tiles (BgTile layer), row by row.
   * BgTile.Empty cells are skipped — the sky gradient shows through.
   */
  function drawBgLayer(ctx: CanvasRenderingContext2D): void {
    for (let row = 0; row < layout.height; row++) {
      for (let col = 0; col < layout.width; col++) {
        const tile = layout.bg[row][col]
        const key = BG_TILE_SPRITES[tile]
        if (!key) continue
        drawTile(ctx, key, col, row)
      }
    }
  }

  /**
   * Draw the surface_ground sprite as a horizon band at the sky/dome transition.
   * It is drawn full-width, centred vertically on the row-13 boundary.
   */
  function drawSurfaceHorizon(ctx: CanvasRenderingContext2D): void {
    const img = imageMap.get('surface_ground')
    if (!img || !img.complete || img.naturalWidth === 0) return

    // Draw it along the transition between sky and dirt (row 13 = y 416)
    const horizonY = 13 * TILE_SIZE
    const tileH = TILE_SIZE * 2  // two tiles tall for a nice horizon band
    const tileW = img.naturalWidth * (tileH / img.naturalHeight)

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, horizonY - TILE_SIZE, CANVAS_W, tileH + TILE_SIZE)
    ctx.clip()

    let x = 0
    while (x < CANVAS_W) {
      ctx.drawImage(img, x, horizonY - Math.floor(tileH * 0.4), tileW, tileH)
      x += tileW
    }
    ctx.restore()
  }

  /**
   * Draw all foreground / structural tiles (FgTile layer).
   * DomeGlass and DomeGlassCurved tiles are rendered at 0.7 alpha.
   */
  function drawFgLayer(ctx: CanvasRenderingContext2D): void {
    for (let row = 0; row < layout.height; row++) {
      for (let col = 0; col < layout.width; col++) {
        const tile = layout.fg[row][col]
        const key = FG_TILE_SPRITES[tile]
        if (!key) continue

        const alpha =
          tile === FgTile.DomeGlass || tile === FgTile.DomeGlassCurved ? 0.7 : 1

        drawTile(ctx, key, col, row, alpha)
      }
    }
  }

  /**
   * Draw a radial glow highlight centred on the given object's grid area.
   * Called before drawing the object sprite so the glow sits behind it.
   */
  function drawHoverGlow(ctx: CanvasRenderingContext2D, obj: DomeObject): void {
    const px = obj.gridX * TILE_SIZE
    const py = obj.gridY * TILE_SIZE
    const pw = obj.gridW * TILE_SIZE
    const ph = obj.gridH * TILE_SIZE

    const cx = px + pw / 2
    const cy = py + ph / 2
    const r = Math.max(pw, ph) * 0.65 + 8

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, 'rgba(255,255,255,0.24)')
    grad.addColorStop(0.5, 'rgba(180,220,255,0.12)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')

    ctx.save()
    ctx.beginPath()
    ctx.ellipse(cx, cy, pw * 0.6 + 10, ph * 0.6 + 10, 0, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
    ctx.restore()
  }

  /**
   * Draw all dome objects and furniture.
   * Interactive objects get a hover glow when they are the current hoveredObject.
   */
  function drawObjects(ctx: CanvasRenderingContext2D, hovered: DomeObject | null): void {
    for (const obj of layout.objects) {
      if (hovered && hovered.id === obj.id && obj.interactive) {
        drawHoverGlow(ctx, obj)
      }

      const img = imageMap.get(obj.spriteKey)
      if (!img || !img.complete || img.naturalWidth === 0) continue

      const px = obj.gridX * TILE_SIZE
      const py = obj.gridY * TILE_SIZE
      const pw = obj.gridW * TILE_SIZE
      const ph = obj.gridH * TILE_SIZE

      ctx.drawImage(img, px, py, pw, ph)
    }
  }

  /**
   * Draw the GAIA avatar with a gentle sinusoidal vertical float.
   * GAIA is positioned at grid column 12, row 7, occupying 1.5 × 2 tiles.
   */
  function drawGaia(
    ctx: CanvasRenderingContext2D,
    expressionKey: string,
    floatOffset: number,
    hovered: DomeObject | null,
  ): void {
    const validKeys = ['neutral', 'happy', 'thinking']
    const key = validKeys.includes(expressionKey) ? expressionKey : 'neutral'
    const img = imageMap.get(`gaia_${key}`)
    if (!img || !img.complete || img.naturalWidth === 0) return

    const GAIA_GRID_COL = 12
    const GAIA_GRID_ROW = 7
    const GAIA_W = TILE_SIZE * 1.5
    const GAIA_H = TILE_SIZE * 2

    const gx = GAIA_GRID_COL * TILE_SIZE - GAIA_W / 2
    const gy = GAIA_GRID_ROW * TILE_SIZE + floatOffset

    // Hover glow for GAIA
    if (hovered && hovered.id === 'gaia') {
      const cx = gx + GAIA_W / 2
      const cy = gy + GAIA_H / 2
      const r = Math.max(GAIA_W, GAIA_H) * 0.6 + 8
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      grad.addColorStop(0, 'rgba(100,200,255,0.28)')
      grad.addColorStop(1, 'rgba(100,200,255,0)')
      ctx.save()
      ctx.beginPath()
      ctx.ellipse(cx, cy, GAIA_W * 0.7, GAIA_H * 0.6, 0, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
      ctx.restore()
    }

    ctx.drawImage(img, gx, gy, GAIA_W, GAIA_H)
  }

  /**
   * Draw a rounded-rect tooltip label below the hovered object.
   */
  function drawTooltip(ctx: CanvasRenderingContext2D, obj: DomeObject): void {
    const label = obj.id === 'gaia' ? 'G.A.I.A.' : obj.label

    // Bottom-centre of the object in canvas pixels
    const cx = (obj.gridX + obj.gridW / 2) * TILE_SIZE
    const bottomY = (obj.gridY + obj.gridH) * TILE_SIZE + 4

    const fontSize = 9
    ctx.font = `${fontSize}px "Courier New", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    const textW = ctx.measureText(label).width
    const padX = 6
    const padY = 3
    const boxW = textW + padX * 2
    const boxH = fontSize + padY * 2
    const boxX = cx - boxW / 2
    const boxY = bottomY
    const r = 3

    ctx.save()

    // Background pill
    ctx.fillStyle = 'rgba(8,8,40,0.84)'
    ctx.beginPath()
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
    ctx.strokeStyle = 'rgba(180,220,255,0.22)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Label text
    ctx.fillStyle = '#ddeeff'
    ctx.fillText(label, cx, boxY + padY)

    ctx.restore()
  }

  // ---------------------------------------------------------------------------
  // GAIA virtual object (for hit detection)
  // ---------------------------------------------------------------------------

  /** Virtual DomeObject representing GAIA for hit detection purposes. */
  const GAIA_OBJECT: DomeObject = {
    id: 'gaia',
    spriteKey: 'gaia_neutral',
    label: 'G.A.I.A.',
    room: 'command',
    gridX: 11,
    gridY: 7,
    gridW: 2,
    gridH: 2,
    interactive: true,
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  /**
   * Render all layers onto the canvas in back-to-front order.
   */
  function render(): void {
    const canvas = canvasEl
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const floatOffset = Math.sin(Date.now() / 800) * 2
    const gaiaChanged = Math.abs(floatOffset - lastGaiaOffset) > 0.04
    if (!dirty && !gaiaChanged) return

    lastGaiaOffset = floatOffset
    dirty = false

    // Layer 1: sky gradient + stars (base)
    drawSkyGradient(ctx)

    // Layer 2: background tiles (sky_stars, interior_wall, dirt_ground)
    drawBgLayer(ctx)

    // Layer 3: surface horizon (sky-to-ground transition band)
    drawSurfaceHorizon(ctx)

    // Layer 4: foreground / structural tiles (dome glass, frame, floor)
    drawFgLayer(ctx)

    // Layer 5: objects and furniture
    drawObjects(ctx, hoveredObject)

    // Layer 6: GAIA avatar (with float bob)
    drawGaia(ctx, gaiaExpression, floatOffset, hoveredObject)

    // Layer 7: tooltip for hovered object/GAIA
    if (hoveredObject) {
      drawTooltip(ctx, hoveredObject)
    }
  }

  /**
   * The main animation loop — runs every frame via requestAnimationFrame.
   */
  function loop(): void {
    render()
    rafId = requestAnimationFrame(loop)
  }

  // ---------------------------------------------------------------------------
  // Hit detection
  // ---------------------------------------------------------------------------

  /**
   * Convert a pointer/touch client coordinate to canvas-internal grid coordinates,
   * accounting for the CSS scale applied by the container.
   */
  function clientToGrid(clientX: number, clientY: number): { gridX: number; gridY: number } {
    const canvas = canvasEl
    if (!canvas) return { gridX: -1, gridY: -1 }

    const rect = canvas.getBoundingClientRect()
    // canvas.width / rect.width gives the CSS-to-internal-pixel scale
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const canvasPx = (clientX - rect.left) * scaleX
    const canvasPy = (clientY - rect.top) * scaleY

    return {
      gridX: Math.floor(canvasPx / TILE_SIZE),
      gridY: Math.floor(canvasPy / TILE_SIZE),
    }
  }

  /**
   * Find the frontmost interactive object whose grid bounds contain (gx, gy).
   * GAIA is checked as a virtual object. Returns null if no hit.
   */
  function hitTest(gx: number, gy: number): DomeObject | null {
    // Check GAIA first (highest visual priority)
    if (
      gx >= GAIA_OBJECT.gridX &&
      gx < GAIA_OBJECT.gridX + GAIA_OBJECT.gridW &&
      gy >= GAIA_OBJECT.gridY &&
      gy < GAIA_OBJECT.gridY + GAIA_OBJECT.gridH
    ) {
      return GAIA_OBJECT
    }

    // Check layout objects in reverse render order (front = last in array)
    for (let i = layout.objects.length - 1; i >= 0; i--) {
      const obj = layout.objects[i]
      if (!obj.interactive) continue
      if (
        gx >= obj.gridX &&
        gx < obj.gridX + obj.gridW &&
        gy >= obj.gridY &&
        gy < obj.gridY + obj.gridH
      ) {
        return obj
      }
    }

    return null
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  function handlePointerMove(e: PointerEvent): void {
    const { gridX, gridY } = clientToGrid(e.clientX, e.clientY)
    const hit = hitTest(gridX, gridY)
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
    const { gridX, gridY } = clientToGrid(e.clientX, e.clientY)
    const hit = hitTest(gridX, gridY)
    if (hit) {
      onObjectTap(hit.id, hit.room)
    }
  }

  function handleTouchStart(e: TouchEvent): void {
    e.preventDefault()
    const touch = e.changedTouches[0]
    if (!touch) return
    const { gridX, gridY } = clientToGrid(touch.clientX, touch.clientY)
    const hit = hitTest(gridX, gridY)
    if (hit) {
      onObjectTap(hit.id, hit.room)
    }
  }

  // ---------------------------------------------------------------------------
  // Svelte 5 lifecycle
  // ---------------------------------------------------------------------------

  $effect(() => {
    const canvas = canvasEl
    if (!canvas) return

    // Set internal canvas resolution to the full grid pixel size (1:1 pixel art)
    canvas.width = CANVAS_W
    canvas.height = CANVAS_H

    // Attach event listeners
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerleave', handlePointerLeave)
    canvas.addEventListener('click', handleClick)
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })

    // Load sprites then start the render loop
    imagesLoaded = false
    dirty = true

    loadImages(() => {
      imagesLoaded = true
      dirty = true
    })

    rafId = requestAnimationFrame(loop)

    return () => {
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

  // Mark dirty when gaiaExpression changes so the first frame renders immediately
  $effect(() => {
    void gaiaExpression
    dirty = true
  })
</script>

<!--
  DomeCanvas: Terraria-style tile-based dome hub rendered on a 2D canvas.
  The canvas internal resolution is 768×512 (24×16 tiles at 32px each).
  CSS scales it up with image-rendering: pixelated to fill the container width.
-->
<div class="dome-canvas-container" bind:this={containerEl}>
  <canvas
    bind:this={canvasEl}
    aria-label="Dome hub — tap an object to explore a room"
  ></canvas>
</div>

<style>
  .dome-canvas-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
  }

  canvas {
    display: block;
    width: 100%;
    height: auto;
    pointer-events: auto;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }
</style>

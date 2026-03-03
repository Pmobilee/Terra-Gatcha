<script lang="ts">
  import {
    FLOOR_TILE_SIZE, FLOOR_CANVAS_W, FLOOR_CANVAS_H, FLOOR_RENDER_SCALE,
    FloorBgTile, FloorFgTile,
    type HubFloor, type FloorUpgradeTier,
  } from '../../data/hubLayout'
  import { getDomeSpriteUrls } from '../../game/domeManifest'

  interface Props {
    floor: HubFloor
    upgradeTier: FloorUpgradeTier
    onObjectTap: (objectId: string, action: string) => void
  }

  const { floor, upgradeTier, onObjectTap }: Props = $props()

  let canvasEl: HTMLCanvasElement | undefined = $state()

  const BG_COLORS: Record<FloorBgTile, string> = {
    [FloorBgTile.Empty]: 'transparent',
    [FloorBgTile.SkyStars]: '#0a0a2e',
    [FloorBgTile.InteriorWall]: '#2a2a3e',
    [FloorBgTile.DirtGround]: '#4a3728',
    [FloorBgTile.StoneWall]: '#3a3a4a',
    [FloorBgTile.CrystalWall]: '#1a2a4a',
  }

  const FG_COLORS: Record<FloorFgTile, string | null> = {
    [FloorFgTile.Empty]: null,
    [FloorFgTile.GlassWall]: 'rgba(100,180,255,0.3)',
    [FloorFgTile.MetalFrame]: '#555568',
    [FloorFgTile.StoneFloor]: '#5a5a6a',
    [FloorFgTile.MetalGrate]: '#4a4a5a',
    [FloorFgTile.GlassCeiling]: 'rgba(120,200,255,0.25)',
    [FloorFgTile.WoodPlanks]: '#6a5038',
    [FloorFgTile.CrystalFloor]: '#2a4a6a',
  }

  /** Color for objects — fallback when sprites aren't loaded */
  const OBJ_COLOR = 'rgba(80,200,160,0.4)'

  function drawFloor(): void {
    if (!canvasEl) return
    const ctx = canvasEl.getContext('2d')
    if (!ctx) return

    const scale = FLOOR_RENDER_SCALE
    const tileW = FLOOR_TILE_SIZE * scale
    const tileH = FLOOR_TILE_SIZE * scale

    // Clear
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)

    // Draw background tiles
    for (let r = 0; r < floor.bg.length; r++) {
      for (let c = 0; c < floor.bg[r].length; c++) {
        const bgType = floor.bg[r][c]
        if (bgType === FloorBgTile.Empty) continue
        ctx.fillStyle = BG_COLORS[bgType] ?? '#1a1a2e'
        ctx.fillRect(c * tileW, r * tileH, tileW, tileH)
      }
    }

    // Draw foreground tiles
    for (let r = 0; r < floor.fg.length; r++) {
      for (let c = 0; c < floor.fg[r].length; c++) {
        const fgType = floor.fg[r][c]
        const color = FG_COLORS[fgType]
        if (!color) continue
        ctx.fillStyle = color
        ctx.fillRect(c * tileW, r * tileH, tileW, tileH)
      }
    }

    // Draw objects (filtered by upgrade tier)
    const visibleObjects = floor.objects.filter(obj => upgradeTier >= (obj.minTier ?? 0))
    for (const obj of visibleObjects) {
      const x = obj.gridX * tileW
      const y = obj.gridY * tileH
      const w = obj.gridW * tileW
      const h = obj.gridH * tileH

      // Object background fill
      ctx.fillStyle = obj.interactive ? OBJ_COLOR : 'rgba(60,60,80,0.3)'
      ctx.fillRect(x, y, w, h)

      // Object border
      if (obj.interactive) {
        ctx.strokeStyle = 'rgba(80,200,160,0.6)'
        ctx.lineWidth = 2
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
      }

      // Label
      ctx.fillStyle = '#e0e0e0'
      ctx.font = `${10 * scale}px 'Press Start 2P', monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const labelText = obj.label.length > 12 ? obj.label.slice(0, 11) + '\u2026' : obj.label
      ctx.fillText(labelText, x + w / 2, y + h / 2)
    }
  }

  $effect(() => {
    // Redraw whenever floor or tier changes
    floor; upgradeTier;
    // Use requestAnimationFrame to ensure canvas is mounted
    requestAnimationFrame(() => drawFloor())
  })

  function handleClick(event: MouseEvent): void {
    if (!canvasEl) return
    const rect = canvasEl.getBoundingClientRect()
    const scaleX = canvasEl.width / rect.width
    const scaleY = canvasEl.height / rect.height
    const px = (event.clientX - rect.left) * scaleX
    const py = (event.clientY - rect.top) * scaleY

    const tileW = FLOOR_TILE_SIZE * FLOOR_RENDER_SCALE
    const tileH = FLOOR_TILE_SIZE * FLOOR_RENDER_SCALE

    // Find clicked object (check in reverse for z-order priority)
    const visibleObjects = floor.objects.filter(obj => upgradeTier >= (obj.minTier ?? 0))
    for (let i = visibleObjects.length - 1; i >= 0; i--) {
      const obj = visibleObjects[i]
      if (!obj.interactive) continue
      const ox = obj.gridX * tileW
      const oy = obj.gridY * tileH
      const ow = obj.gridW * tileW
      const oh = obj.gridH * tileH
      if (px >= ox && px < ox + ow && py >= oy && py < oy + oh) {
        onObjectTap(obj.id, obj.action)
        return
      }
    }
  }
</script>

<canvas
  bind:this={canvasEl}
  width={FLOOR_CANVAS_W * FLOOR_RENDER_SCALE}
  height={FLOOR_CANVAS_H * FLOOR_RENDER_SCALE}
  class="floor-canvas"
  onclick={handleClick}
  role="img"
  aria-label={`${floor.name} floor`}
></canvas>

<style>
  .floor-canvas {
    width: 100%;
    max-width: 768px;
    height: auto;
    image-rendering: pixelated;
    display: block;
    margin: 0 auto;
  }
</style>

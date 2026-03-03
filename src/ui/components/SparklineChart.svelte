<script lang="ts">
  interface Props {
    dailyActivity: number[]
    width: number
    height: number
  }

  const { dailyActivity, width, height }: Props = $props()

  let canvasEl: HTMLCanvasElement | undefined = $state()

  $effect(() => {
    if (!canvasEl) return
    const ctx = canvasEl.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvasEl.width = width * dpr
    canvasEl.height = height * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width, height)

    const n = dailyActivity.length
    if (n === 0) return

    const maxVal = Math.max(1, ...dailyActivity)
    const padding = 4
    const plotW = width - padding * 2
    const plotH = height - padding * 2

    // Baseline
    ctx.beginPath()
    ctx.moveTo(padding, height - padding)
    ctx.lineTo(width - padding, height - padding)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Build path
    const points: Array<{ x: number; y: number }> = []
    for (let i = 0; i < n; i++) {
      const x = padding + (i / Math.max(1, n - 1)) * plotW
      const v = dailyActivity[i] / maxVal
      const y = (height - padding) - v * plotH
      points.push({ x, y })
    }

    // Fill area
    ctx.beginPath()
    ctx.moveTo(points[0].x, height - padding)
    for (const p of points) ctx.lineTo(p.x, p.y)
    ctx.lineTo(points[points.length - 1].x, height - padding)
    ctx.closePath()
    ctx.fillStyle = 'rgba(78, 204, 163, 0.15)'
    ctx.fill()

    // Stroke line
    ctx.beginPath()
    for (let i = 0; i < points.length; i++) {
      if (i === 0) ctx.moveTo(points[i].x, points[i].y)
      else ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.strokeStyle = '#4ecca3'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Highlight today (last point)
    if (points.length > 0) {
      const last = points[points.length - 1]
      ctx.beginPath()
      ctx.arc(last.x, last.y, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#7ff5d0'
      ctx.fill()
    }
  })
</script>

<canvas
  bind:this={canvasEl}
  style="width: {width}px; height: {height}px;"
></canvas>

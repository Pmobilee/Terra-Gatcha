<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import RadarChart from './RadarChart.svelte'
  import SparklineChart from './SparklineChart.svelte'

  interface Props {
    onBack: () => void
  }

  const { onBack }: Props = $props()

  const save = $derived($playerSave)

  // Summary stats
  const totalLearned = $derived(save?.learnedFacts.length ?? 0)
  const totalMastered = $derived(
    save?.reviewStates.filter(rs => rs.repetitions >= 6).length ?? 0
  )
  const accuracyRate = $derived((): number => {
    if (!save) return 0
    const total = save.stats.totalQuizCorrect + save.stats.totalQuizWrong
    return total > 0 ? Math.round(100 * save.stats.totalQuizCorrect / total) : 0
  })
  const totalDives = $derived(save?.stats.totalDivesCompleted ?? 0)
  const deepestLayer = $derived(save?.stats.deepestLayerReached ?? 0)
  const streak = $derived(save?.stats.currentStreak ?? 0)

  const createdDate = $derived((): string => {
    if (!save) return '—'
    return new Date(save.createdAt).toLocaleDateString()
  })

  // Category breakdown for radar chart
  const categories = ['Biology', 'History', 'Geology', 'Language', 'Physics', 'Culture']

  // Radar values: ratio of mastered facts across categories (approximated)
  const radarValues = $derived((): number[] => {
    if (!save || totalMastered === 0) return categories.map(() => 0)
    // Distribute mastered facts roughly equally for now
    // In future this would query the facts DB by category
    const perCat = totalMastered / categories.length
    const maxPerCat = Math.max(1, Math.ceil(totalLearned / categories.length))
    return categories.map(() => Math.min(1, perCat / maxPerCat))
  })

  // 30-day activity sparkline — uses lastReviewAt field from ReviewState
  const last30Days = $derived((): number[] => {
    if (!save) return Array(30).fill(0) as number[]
    const now = new Date()
    const days: number[] = []
    for (let i = 29; i >= 0; i--) {
      const day = new Date(now)
      day.setDate(day.getDate() - i)
      const dayStr = day.toISOString().split('T')[0]
      // Count review states that were last reviewed on this day
      const count = save.reviewStates.filter(rs => {
        if (!rs.lastReviewAt) return false
        const rDate = new Date(rs.lastReviewAt).toISOString().split('T')[0]
        return rDate === dayStr
      }).length
      days.push(count)
    }
    return days
  })

  // Weekly summary
  const weeklySummary = $derived((): string => {
    if (!save) return ''
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const thisWeekLearned = save.reviewStates.filter(rs => {
      return rs.repetitions >= 1 && rs.lastReviewAt > weekAgo
    }).length
    const thisWeekMastered = save.reviewStates.filter(rs => {
      return rs.repetitions >= 6 && rs.lastReviewAt > weekAgo
    }).length
    const depthMsg = save.stats.deepestLayerReached >= 10
      ? `You've reached the mid-depths — the rarest minerals await below.`
      : `Keep diving to unlock deeper biomes and rarer relics.`
    return `This week you learned ${thisWeekLearned} new fact${thisWeekLearned !== 1 ? 's' : ''} and mastered ${thisWeekMastered}. ${depthMsg}`
  })

  function handleShare(): void {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 400
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Dark background
    ctx.fillStyle = '#0a0a1a'
    ctx.fillRect(0, 0, 600, 400)

    // Border
    ctx.strokeStyle = '#4ecca3'
    ctx.lineWidth = 2
    ctx.strokeRect(4, 4, 592, 392)

    // Title
    ctx.fillStyle = '#4ecca3'
    ctx.font = '16px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('G.A.I.A. LEARNING REPORT', 300, 40)

    // Stats
    ctx.fillStyle = '#e0c97f'
    ctx.font = '12px monospace'
    ctx.textAlign = 'left'
    const stats = [
      `Facts Learned: ${totalLearned}`,
      `Facts Mastered: ${totalMastered}`,
      `Accuracy: ${accuracyRate()}%`,
      `Total Dives: ${totalDives}`,
      `Deepest Layer: ${deepestLayer}`,
      `Day Streak: ${streak}`,
    ]
    stats.forEach((s, i) => {
      ctx.fillText(s, 40, 80 + i * 28)
    })

    // Footer
    ctx.fillStyle = '#555'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Terra Gacha — Mine. Discover. Learn.', 300, 380)

    // Download
    const dataUrl = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = 'terra-gacha-report.png'
    a.click()
  }
</script>

<div class="report-view">
  <div class="report-header">
    <button class="back-btn" onclick={onBack}>← Back</button>
    <h1 class="report-title">G.A.I.A. LEARNING REPORT</h1>
  </div>

  <div class="report-scroll">
    <p class="since">Explorer since: {createdDate()}</p>

    <!-- Stats grid -->
    <div class="stats-grid">
      <div class="stat-box">
        <span class="stat-value">{totalLearned}</span>
        <span class="stat-label">Facts Learned</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">{totalMastered}</span>
        <span class="stat-label">Mastered</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">{accuracyRate()}%</span>
        <span class="stat-label">Accuracy</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">{totalDives}</span>
        <span class="stat-label">Total Dives</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">{deepestLayer}</span>
        <span class="stat-label">Max Layer</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">{streak}</span>
        <span class="stat-label">Day Streak</span>
      </div>
    </div>

    <!-- Radar chart -->
    <div class="chart-section">
      <h2 class="section-title">Category Mastery</h2>
      <div class="chart-center">
        <RadarChart labels={categories} values={radarValues()} size={260} />
      </div>
      <p class="chart-caption">Relative mastery by category</p>
    </div>

    <!-- Sparkline -->
    <div class="chart-section">
      <h2 class="section-title">30-Day Activity</h2>
      <div class="chart-center">
        <SparklineChart dailyActivity={last30Days()} width={320} height={60} />
      </div>
    </div>

    <!-- Weekly summary -->
    <div class="summary-section">
      <h2 class="section-title">Weekly Summary</h2>
      <p class="summary-text">"{weeklySummary()}"</p>
      <span class="summary-sig">— G.A.I.A.</span>
    </div>

    <!-- Share button -->
    <button class="share-btn" onclick={handleShare}>Share My Progress</button>
  </div>
</div>

<style>
  .report-view {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: #0a0a1a;
    display: flex;
    flex-direction: column;
    font-family: 'Press Start 2P', monospace;
    color: #ccc;
  }
  .report-header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #222;
    gap: 12px;
  }
  .back-btn {
    background: none;
    border: none;
    color: #4ecca3;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    padding: 4px 8px;
  }
  .report-title {
    color: #4ecca3;
    font-size: 10px;
    margin: 0;
    flex: 1;
    text-align: center;
  }
  .report-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .since { color: #666; font-size: 7px; text-align: center; margin: 0; }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .stat-box {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #222;
    border-radius: 4px;
    padding: 12px 8px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .stat-value { color: #e0c97f; font-size: 14px; }
  .stat-label { color: #666; font-size: 6px; }
  .chart-section { text-align: center; }
  .section-title { color: #4ecca3; font-size: 9px; margin: 0 0 12px; }
  .chart-center { display: flex; justify-content: center; }
  .chart-caption { color: #555; font-size: 7px; margin: 8px 0 0; }
  .summary-section { text-align: center; }
  .summary-text {
    color: #aaa;
    font-size: 8px;
    line-height: 1.6;
    font-style: italic;
    margin: 0;
  }
  .summary-sig { color: #4ecca3; font-size: 7px; }
  .share-btn {
    padding: 12px;
    background: rgba(78, 204, 163, 0.15);
    border: 1px solid #4ecca3;
    color: #4ecca3;
    border-radius: 4px;
    font-family: inherit;
    font-size: 9px;
    cursor: pointer;
    min-height: 44px;
    align-self: center;
    width: 80%;
  }
</style>

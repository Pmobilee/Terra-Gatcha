<script lang="ts">
  import { shareRunSummaryCard } from '../../services/runShareService'

  interface Props {
    result: 'victory' | 'defeat' | 'retreat'
    floorReached: number
    factsAnswered: number
    correctAnswers: number
    accuracy: number
    bestCombo: number
    cardsEarned: number
    newFactsLearned: number
    factsMastered: number
    encountersWon: number
    encountersTotal: number
    completedBounties: string[]
    runDurationMs?: number
    rewardMultiplier: number
    currencyEarned: number
    onplayagain: () => void
    onhome: () => void
  }

  let {
    result,
    floorReached,
    factsAnswered,
    correctAnswers,
    accuracy,
    bestCombo,
    cardsEarned,
    newFactsLearned,
    factsMastered,
    encountersWon,
    encountersTotal,
    completedBounties,
    runDurationMs = 0,
    rewardMultiplier,
    currencyEarned,
    onplayagain,
    onhome,
  }: Props = $props()

  let isVictory = $derived(result === 'victory' || result === 'retreat')
  let headerText = $derived(result === 'retreat' ? 'SAFE RETREAT' : isVictory ? 'EXPEDITION COMPLETE' : 'EXPEDITION FAILED')
  let headerColor = $derived(isVictory ? '#F1C40F' : '#E74C3C')
  let shareStatus = $state<'idle' | 'sharing' | 'done' | 'error'>('idle')

  function formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  }

  async function handleShare(): Promise<void> {
    shareStatus = 'sharing'
    try {
      await shareRunSummaryCard({
        result,
        floorReached,
        factsAnswered,
        correctAnswers,
        accuracy,
        bestCombo,
        cardsEarned,
        newFactsLearned,
        factsMastered,
        encountersWon,
        encountersTotal,
        completedBounties,
        duration: runDurationMs,
        runDurationMs,
        rewardMultiplier,
        currencyEarned,
      })
      shareStatus = 'done'
    } catch {
      shareStatus = 'error'
    } finally {
      setTimeout(() => {
        shareStatus = 'idle'
      }, 1500)
    }
  }
</script>

<div class="run-end-overlay">
  <h1 class="header" style="color: {headerColor}">{headerText}</h1>

  <div class="stats-list">
    <div class="stat-row">
      <span class="stat-label">Floor Reached</span>
      <span class="stat-value">{floorReached}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Facts Answered</span>
      <span class="stat-value">{factsAnswered}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Accuracy</span>
      <span class="stat-value">{accuracy}%</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Correct Answers</span>
      <span class="stat-value">{correctAnswers}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Best Combo</span>
      <span class="stat-value">{bestCombo}x</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Cards Earned</span>
      <span class="stat-value">{cardsEarned}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Reward Multiplier</span>
      <span class="stat-value">{Math.round(rewardMultiplier * 100)}%</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Currency Earned</span>
      <span class="stat-value">{currencyEarned}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">New Facts Learned</span>
      <span class="stat-value">{newFactsLearned}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Facts Mastered</span>
      <span class="stat-value">{factsMastered}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Encounters</span>
      <span class="stat-value">{encountersWon}/{encountersTotal}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Run Time</span>
      <span class="stat-value">{formatDuration(runDurationMs)}</span>
    </div>
    {#if completedBounties.length > 0}
      <div class="bounty-list">
        <strong>Bounties Cleared</strong>
        {#each completedBounties as bounty}
          <span class="bounty-item">{bounty}</span>
        {/each}
      </div>
    {/if}
  </div>

  <div class="btn-row">
    <button
      class="btn btn-share"
      data-testid="btn-share-run"
      onclick={handleShare}
      disabled={shareStatus === 'sharing'}
    >
      {shareStatus === 'sharing' ? 'Sharing...' : shareStatus === 'done' ? 'Shared' : shareStatus === 'error' ? 'Retry Share' : 'Share'}
    </button>
    <button
      class="btn btn-play-again"
      data-testid="btn-play-again"
      onclick={onplayagain}
    >
      Play Again
    </button>
    <button
      class="btn btn-home"
      data-testid="btn-home"
      onclick={onhome}
    >
      Home
    </button>
  </div>
</div>

<style>
  .run-end-overlay {
    position: fixed;
    inset: 0;
    background: #0D1117;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    z-index: 200;
  }

  .header {
    font-size: 24px;
    font-weight: 800;
    margin-bottom: 32px;
    text-align: center;
    letter-spacing: 2px;
  }

  .stats-list {
    width: 100%;
    max-width: 300px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 40px;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #161B22;
    border-radius: 8px;
  }

  .stat-label {
    font-size: 14px;
    color: #8B949E;
  }

  .stat-value {
    font-size: 16px;
    color: #E6EDF3;
    font-weight: 700;
  }

  .btn-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .btn {
    min-width: 120px;
    height: 48px;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.1s;
  }

  .btn:hover {
    transform: scale(1.03);
  }

  .btn-play-again {
    background: #27AE60;
    color: #fff;
  }

  .btn-home {
    background: #2D333B;
    color: #8B949E;
  }

  .btn-share {
    background: #1d4ed8;
    color: #e2e8f0;
  }

  .bounty-list {
    background: rgba(241, 196, 15, 0.08);
    border: 1px solid rgba(241, 196, 15, 0.4);
    border-radius: 8px;
    padding: 8px 10px;
    display: grid;
    gap: 4px;
  }

  .bounty-list strong {
    color: #f4d35e;
    font-size: 12px;
  }

  .bounty-item {
    font-size: 11px;
    color: #e7f0ff;
  }
</style>

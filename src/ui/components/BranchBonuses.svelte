<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import { ALL_BRANCH_BONUSES } from '../../data/branchBonuses'
  import { factsDB } from '../../services/factsDB'
  import { CATEGORIES } from '../../data/types'

  interface Props {
    onClose: () => void
  }

  let { onClose }: Props = $props()

  /** Compute branch completion stats for each category */
  const branchStats = $derived.by(() => {
    const save = $playerSave
    if (!save) return []
    const learnedSet = new Set(save.learnedFacts)
    const allFacts = factsDB.getAll()
    const awarded = new Set(save.awardedBranchMilestones ?? [])

    return CATEGORIES.map(cat => {
      const totalInCat = allFacts.filter(f => f.category[0] === cat).length
      const learnedInCat = allFacts.filter(f => f.category[0] === cat && learnedSet.has(f.id)).length
      const pct = totalInCat > 0 ? Math.round((learnedInCat / totalInCat) * 100) : 0
      const bonuses = ALL_BRANCH_BONUSES.filter(b => b.category === cat)

      return {
        category: cat,
        learned: learnedInCat,
        total: totalInCat,
        percent: pct,
        bonuses: bonuses.map(b => ({
          ...b,
          unlocked: pct >= b.threshold,
          awarded: awarded.has(`${cat}:${b.threshold}`),
        })),
      }
    })
  })
</script>

<section class="branch-bonuses-overlay" aria-label="Branch Bonuses">
  <div class="branch-bonuses-panel">
    <header class="panel-header">
      <h2>Branch Bonuses</h2>
      <button class="close-btn" type="button" onclick={onClose} aria-label="Close">✕</button>
    </header>

    <div class="bonus-list">
      {#each branchStats as branch (branch.category)}
        <div class="branch-row">
          <div class="branch-info">
            <span class="branch-name">{branch.category}</span>
            <span class="branch-pct">{branch.percent}% ({branch.learned}/{branch.total})</span>
          </div>

          {#each branch.bonuses as bonus (bonus.id)}
            <div class="bonus-item" class:unlocked={bonus.unlocked} class:locked={!bonus.unlocked}>
              <div class="bonus-header">
                <span class="bonus-threshold">{bonus.threshold}%</span>
                <span class="bonus-name">{bonus.unlocked ? '✓' : '🔒'} {bonus.displayName}</span>
              </div>
              <p class="bonus-desc">
                {bonus.unlocked ? bonus.description : `Reach ${bonus.threshold}% to unlock`}
              </p>
            </div>
          {/each}

          {#if branch.bonuses.length === 0}
            <p class="no-bonus">No bonuses defined yet</p>
          {/if}
        </div>
      {/each}
    </div>

    <p class="coming-soon">More bonus tiers coming at 50% and 100%!</p>
  </div>
</section>

<style>
  .branch-bonuses-overlay {
    position: fixed;
    inset: 0;
    z-index: 55;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.85);
    font-family: 'Courier New', monospace;
    pointer-events: auto;
    animation: fade-in 200ms ease-out;
  }

  .branch-bonuses-panel {
    width: min(100%, 420px);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    background: var(--color-surface, #1a1a2e);
    border: 2px solid rgba(78, 204, 163, 0.3);
    border-radius: 16px;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .panel-header h2 {
    font-size: 1rem;
    color: #4ecca3;
    letter-spacing: 1px;
    margin: 0;
  }

  .close-btn {
    width: 36px;
    height: 36px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    background: transparent;
    color: #aaa;
    font-size: 16px;
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .bonus-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .branch-row {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.03);
  }

  .branch-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .branch-name {
    font-size: 0.85rem;
    font-weight: bold;
    color: var(--color-text, #e0e0e0);
  }

  .branch-pct {
    font-size: 0.72rem;
    color: var(--color-text-dim, #8b8b8b);
  }

  .bonus-item {
    padding: 6px 8px;
    border-radius: 6px;
    margin-top: 4px;
  }

  .bonus-item.unlocked {
    background: rgba(78, 204, 163, 0.1);
    border: 1px solid rgba(78, 204, 163, 0.25);
  }

  .bonus-item.locked {
    background: rgba(100, 100, 100, 0.08);
    border: 1px solid rgba(100, 100, 100, 0.15);
    opacity: 0.6;
  }

  .bonus-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .bonus-threshold {
    font-size: 0.7rem;
    font-weight: bold;
    color: #4ecca3;
    background: rgba(78, 204, 163, 0.15);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .locked .bonus-threshold {
    color: #888;
    background: rgba(100, 100, 100, 0.15);
  }

  .bonus-name {
    font-size: 0.78rem;
    color: var(--color-text, #e0e0e0);
    font-weight: bold;
  }

  .bonus-desc {
    font-size: 0.72rem;
    color: var(--color-text-dim, #8b8b8b);
    margin: 4px 0 0;
    line-height: 1.3;
  }

  .no-bonus {
    font-size: 0.72rem;
    color: var(--color-text-dim, #8b8b8b);
    font-style: italic;
  }

  .coming-soon {
    text-align: center;
    font-size: 0.72rem;
    color: var(--color-text-dim, #8b8b8b);
    padding: 10px;
    font-style: italic;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>

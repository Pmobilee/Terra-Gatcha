<script lang="ts">
  import { getMasteryLevel } from '../../services/sm2'
  import { pendingArtifacts } from '../stores/gameState'
  import { getDueReviews, playerSave } from '../stores/playerData'

  interface Props {
    onDive: () => void
    onStudy: () => void
    onReviewArtifact: () => void
  }

  let { onDive, onStudy, onReviewArtifact }: Props = $props()

  const dueReviews = $derived.by(() => {
    $playerSave
    return getDueReviews()
  })

  const dueReviewCount = $derived(dueReviews.length)
  const hasDueReviews = $derived(dueReviewCount > 0)
  const artifactCount = $derived($pendingArtifacts.length)
  const hasArtifacts = $derived(artifactCount > 0)

  const learnedFactsWithMastery = $derived.by(() => {
    const save = $playerSave

    if (!save) {
      return [] as Array<{ factId: string; mastery: string }>
    }

    return save.learnedFacts.map((factId: string) => {
      const reviewState = save.reviewStates.find((state: { factId: string }) => state.factId === factId)

      return {
        factId,
        mastery: reviewState ? getMasteryLevel(reviewState) : 'new',
      }
    })
  })

  const stats = $derived(
    $playerSave?.stats ?? {
      totalBlocksMined: 0,
      totalDivesCompleted: 0,
      deepestLayerReached: 0,
      totalFactsLearned: 0,
      totalFactsSold: 0,
      totalQuizCorrect: 0,
      totalQuizWrong: 0,
      currentStreak: 0,
      bestStreak: 0,
    },
  )

  const oxygen = $derived($playerSave?.oxygen ?? 0)
  const dust = $derived($playerSave?.minerals.dust ?? 0)
  const shard = $derived($playerSave?.minerals.shard ?? 0)
  const crystal = $derived($playerSave?.minerals.crystal ?? 0)

  function formatMasteryLabel(level: string): string {
    return level.charAt(0).toUpperCase() + level.slice(1)
  }
</script>

<section class="base-view" aria-label="Terra Base hub">
  <div class="card title-card">
    <h1>Terra Base</h1>
    <p class="subtitle">
      Pilot {$playerSave?.playerId ?? 'Unknown'} | Dives: {stats.totalDivesCompleted} | Facts:
      {$playerSave?.learnedFacts.length ?? 0}
    </p>
  </div>

  <div class="card resources-card" aria-label="Resources">
    <div class="resource-item">
      <span class="resource-dot oxygen-dot" aria-hidden="true"></span>
      <span class="resource-label">Oxygen Tanks</span>
      <span class="resource-value">{oxygen}</span>
    </div>
    <div class="resource-item">
      <span class="resource-dot dust-dot" aria-hidden="true"></span>
      <span class="resource-label">Dust</span>
      <span class="resource-value">{dust}</span>
    </div>
    <div class="resource-item">
      <span class="resource-dot shard-dot" aria-hidden="true"></span>
      <span class="resource-label">Shard</span>
      <span class="resource-value">{shard}</span>
    </div>
    <div class="resource-item">
      <span class="resource-dot crystal-dot" aria-hidden="true"></span>
      <span class="resource-label">Crystal</span>
      <span class="resource-value">{crystal}</span>
    </div>
  </div>

  <div class="card actions-card" aria-label="Base actions">
    <button class="action-button dive-button" type="button" onclick={onDive}>Dive</button>

    <button
      class="action-button study-button"
      class:dimmed={!hasDueReviews}
      type="button"
      onclick={onStudy}
      aria-label="Start study session"
    >
      <span>Study</span>
      {#if hasDueReviews}
        <span class="count-badge">{dueReviewCount}</span>
      {:else}
        <span class="empty-note">No reviews due</span>
      {/if}
    </button>

    {#if hasArtifacts}
      <button class="action-button artifact-button" type="button" onclick={onReviewArtifact}>
        <span>Artifacts</span>
        <span class="count-badge">{artifactCount}</span>
      </button>
    {/if}
  </div>

  <div class="card knowledge-card" aria-label="Learned facts">
    <h2>Knowledge</h2>
    {#if learnedFactsWithMastery.length === 0}
      <p class="empty-note">No learned facts yet. Start a dive to discover artifacts.</p>
    {:else}
      <div class="facts-list">
        {#each learnedFactsWithMastery as entry}
          <div class="fact-row">
            <span class="fact-id">{entry.factId}</span>
            <span class={`mastery-badge mastery-${entry.mastery}`}>{formatMasteryLabel(entry.mastery)}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="card stats-card" aria-label="Player statistics">
    <h2>Stats</h2>
    <div class="stats-grid">
      <span>Total dives: {stats.totalDivesCompleted}</span>
      <span>Blocks mined: {stats.totalBlocksMined}</span>
      <span>Facts learned: {stats.totalFactsLearned}</span>
      <span>Deepest layer: {stats.deepestLayerReached}</span>
      <span>Current streak: {stats.currentStreak}</span>
      <span>Best streak: {stats.bestStreak}</span>
    </div>
  </div>
</section>

<style>
  .base-view {
    position: fixed;
    inset: 0;
    z-index: 30;
    overflow-y: auto;
    background: var(--color-bg);
    padding: 8px;
    font-family: 'Courier New', monospace;
    -webkit-overflow-scrolling: touch;
  }

  .card {
    background: var(--color-surface);
    border-radius: 12px;
    padding: 16px;
    margin: 8px;
  }

  h1,
  h2 {
    margin: 0;
  }

  h1 {
    color: var(--color-warning);
    font-size: clamp(1.8rem, 5vw, 2.4rem);
    line-height: 1.1;
  }

  h2 {
    color: var(--color-text);
    font-size: 1rem;
    margin-bottom: 10px;
  }

  .subtitle {
    margin-top: 8px;
    color: var(--color-text-dim);
    font-size: 0.9rem;
    line-height: 1.35;
  }

  .resources-card {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .resource-item {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 38px;
    background: color-mix(in srgb, var(--color-bg) 35%, var(--color-surface) 65%);
    border-radius: 10px;
    padding: 8px 10px;
  }

  .resource-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .oxygen-dot {
    background: #45b3ff;
  }

  .dust-dot {
    background: #4ecca3;
  }

  .shard-dot {
    background: #ffd369;
  }

  .crystal-dot {
    background: #e94560;
  }

  .resource-label {
    color: var(--color-text-dim);
    font-size: 0.85rem;
  }

  .resource-value {
    margin-left: auto;
    color: var(--color-text);
    font-size: 1rem;
    font-weight: 700;
  }

  .actions-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .action-button {
    min-height: 56px;
    border: 0;
    border-radius: 12px;
    color: var(--color-text);
    font-family: inherit;
    font-size: 1.1rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    cursor: pointer;
  }

  .action-button:active {
    transform: translateY(1px);
  }

  .dive-button {
    min-height: 64px;
    font-size: 1.25rem;
    background: var(--color-success);
    color: #0b231a;
  }

  .study-button {
    background: var(--color-primary);
  }

  .artifact-button {
    background: color-mix(in srgb, var(--color-accent) 32%, var(--color-surface) 68%);
  }

  .dimmed {
    opacity: 0.7;
  }

  .count-badge {
    min-width: 28px;
    height: 28px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-text) 92%, var(--color-bg) 8%);
    color: var(--color-bg);
    display: grid;
    place-items: center;
    font-size: 0.9rem;
    font-weight: 800;
    padding: 0 8px;
  }

  .knowledge-card {
    display: flex;
    flex-direction: column;
    min-height: 160px;
    max-height: 38dvh;
  }

  .facts-list {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 4px;
  }

  .fact-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: color-mix(in srgb, var(--color-bg) 45%, var(--color-surface) 55%);
    border-radius: 9px;
    padding: 8px 10px;
  }

  .fact-id {
    color: var(--color-text);
    font-size: 0.85rem;
    overflow-wrap: anywhere;
  }

  .mastery-badge {
    border-radius: 999px;
    padding: 5px 10px;
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-weight: 700;
    flex-shrink: 0;
  }

  .mastery-new {
    background: color-mix(in srgb, var(--color-text-dim) 32%, var(--color-surface) 68%);
    color: var(--color-text);
  }

  .mastery-learning {
    background: color-mix(in srgb, var(--color-warning) 35%, var(--color-surface) 65%);
    color: #342500;
  }

  .mastery-familiar {
    background: color-mix(in srgb, var(--color-primary) 62%, var(--color-surface) 38%);
    color: var(--color-text);
  }

  .mastery-known {
    background: color-mix(in srgb, var(--color-success) 40%, var(--color-surface) 60%);
    color: #0b231a;
  }

  .mastery-mastered {
    background: color-mix(in srgb, var(--color-accent) 40%, var(--color-surface) 60%);
    color: #fff;
  }

  .stats-card {
    margin-bottom: 20px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 10px;
    font-size: 0.82rem;
    color: var(--color-text-dim);
    line-height: 1.25;
  }

  .empty-note {
    color: var(--color-text-dim);
    font-size: 0.85rem;
  }

  @media (max-width: 520px) {
    .card {
      margin: 6px;
      padding: 14px;
    }

    .resources-card,
    .stats-grid {
      grid-template-columns: 1fr;
    }

    .action-button {
      font-size: 1rem;
    }
  }
</style>

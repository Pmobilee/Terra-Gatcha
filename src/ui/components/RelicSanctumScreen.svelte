<script lang="ts">
  import { PASSIVE_RELIC_BY_ID } from '../../data/passiveRelics'
  import { factsDB } from '../../services/factsDB'
  import { getCardTier } from '../../services/tierDerivation'
  import { applyRelicSanctumSelection, playerSave } from '../stores/playerData'

  interface Props {
    onBack: () => void
  }

  interface RelicEntry {
    factId: string
    relicId: string
    relicName: string
    factLabel: string
    masteredAt: number
    dormant: boolean
  }

  let { onBack }: Props = $props()

  let statusMessage = $state('Select up to 12 active relics.')
  let hasLocalEdits = $state(false)
  let selectedFactIds = $state<string[]>([])

  let entries = $derived.by((): RelicEntry[] => {
    const states = $playerSave?.reviewStates ?? []
    const built: RelicEntry[] = []
    for (const state of states) {
      const relicId = state.graduatedRelicId
      if (!relicId) continue
      const tier = getCardTier({
        stability: state.stability ?? state.interval ?? 0,
        consecutiveCorrect: state.consecutiveCorrect ?? state.repetitions ?? 0,
        passedMasteryTrial: state.passedMasteryTrial ?? false,
      })
      if (tier !== '3') continue

      const relic = PASSIVE_RELIC_BY_ID[relicId]
      if (!relic) continue
      const fact = factsDB.isReady() ? factsDB.getById(state.factId) : null

      built.push({
        factId: state.factId,
        relicId,
        relicName: relic.name,
        factLabel: fact?.statement ?? state.factId,
        masteredAt: state.masteredAt ?? 0,
        dormant: (state.retrievability ?? 1) < 0.7,
      })
    }
    return built.sort((left, right) => right.masteredAt - left.masteredAt)
  })

  $effect(() => {
    if (hasLocalEdits) return
    selectedFactIds = entries.slice(0, 12).map((entry) => entry.factId)
  })

  let selectedSet = $derived(new Set(selectedFactIds))
  let selectedCount = $derived(selectedFactIds.length)
  let canManage = $derived(entries.length > 12)

  let activeEntries = $derived.by(() => {
    const byId = new Map(entries.map((entry) => [entry.factId, entry]))
    return selectedFactIds
      .map((factId) => byId.get(factId))
      .filter((entry): entry is RelicEntry => entry != null)
  })

  let reserveEntries = $derived(entries.filter((entry) => !selectedSet.has(entry.factId)))

  function toggleEntry(factId: string): void {
    if (selectedSet.has(factId)) {
      selectedFactIds = selectedFactIds.filter((id) => id !== factId)
      hasLocalEdits = true
      statusMessage = 'Relic moved to reserve.'
      return
    }

    if (selectedFactIds.length >= 12) {
      statusMessage = 'Active relic cap reached (12). Reserve one first.'
      return
    }

    selectedFactIds = [...selectedFactIds, factId]
    hasLocalEdits = true
    statusMessage = 'Relic moved into active loadout.'
  }

  function applySelection(): void {
    if (selectedFactIds.length === 0) {
      statusMessage = 'Pick at least one relic to save.'
      return
    }
    applyRelicSanctumSelection(selectedFactIds)
    hasLocalEdits = false
    statusMessage = `Saved ${selectedFactIds.length} active relics.`
  }
</script>

<section class="sanctum-screen" aria-label="Relic Sanctum">
  <header class="header">
    <h2>Relic Sanctum</h2>
    <button type="button" class="back-btn" onclick={onBack}>Back</button>
  </header>

  <p class="helper">
    Between runs, choose which Tier-3 relics stay active. Only 12 can be active at once.
  </p>

  <div class="meta-row">
    <span>Total relics: {entries.length}</span>
    <span>Active: {selectedCount}/12</span>
  </div>

  {#if !canManage}
    <div class="notice">
      Relic Sanctum unlocks for management once you exceed 12 mastered relics.
    </div>
  {/if}

  <div class="columns">
    <article class="column">
      <h3>Active Relics</h3>
      {#if activeEntries.length === 0}
        <p class="empty">No active relics selected.</p>
      {:else}
        <div class="list">
          {#each activeEntries as entry (entry.factId)}
            <button type="button" class="row active" onclick={() => toggleEntry(entry.factId)}>
              <span class="title">{entry.relicName}</span>
              <span class="detail">{entry.factLabel}</span>
              <span class={`state ${entry.dormant ? 'dormant' : 'ready'}`}>{entry.dormant ? 'Dormant' : 'Ready'}</span>
            </button>
          {/each}
        </div>
      {/if}
    </article>

    <article class="column">
      <h3>Reserve Relics</h3>
      {#if reserveEntries.length === 0}
        <p class="empty">No reserve relics.</p>
      {:else}
        <div class="list">
          {#each reserveEntries as entry (entry.factId)}
            <button type="button" class="row reserve" onclick={() => toggleEntry(entry.factId)}>
              <span class="title">{entry.relicName}</span>
              <span class="detail">{entry.factLabel}</span>
              <span class={`state ${entry.dormant ? 'dormant' : 'ready'}`}>{entry.dormant ? 'Dormant' : 'Ready'}</span>
            </button>
          {/each}
        </div>
      {/if}
    </article>
  </div>

  <div class="footer">
    <p class="status">{statusMessage}</p>
    <button type="button" class="save-btn" onclick={applySelection} disabled={!hasLocalEdits}>Apply Loadout</button>
  </div>
</section>

<style>
  .sanctum-screen {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    padding: 16px 16px 96px;
    background:
      radial-gradient(circle at 20% 0%, rgba(250, 204, 21, 0.14), transparent 34%),
      radial-gradient(circle at 90% 8%, rgba(59, 130, 246, 0.12), transparent 30%),
      linear-gradient(180deg, #0b1120, #111827);
    color: #e2e8f0;
    display: grid;
    gap: 10px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header h2 {
    margin: 0;
    color: #fde68a;
    font-size: calc(22px * var(--text-scale, 1));
  }

  .back-btn,
  .save-btn {
    min-height: 44px;
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.45);
    background: rgba(30, 41, 59, 0.85);
    color: #e2e8f0;
    padding: 0 12px;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 700;
  }

  .save-btn {
    border-color: rgba(250, 204, 21, 0.55);
    background: rgba(120, 53, 15, 0.75);
    color: #fef3c7;
  }

  .save-btn:disabled {
    opacity: 0.5;
  }

  .helper {
    margin: 0;
    font-size: calc(12px * var(--text-scale, 1));
    color: #bfdbfe;
  }

  .meta-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
  }

  .notice {
    border-radius: 10px;
    border: 1px dashed rgba(148, 163, 184, 0.5);
    padding: 10px;
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
    background: rgba(2, 6, 23, 0.45);
  }

  .columns {
    display: grid;
    gap: 10px;
  }

  .column {
    border-radius: 12px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: rgba(15, 23, 42, 0.78);
    padding: 10px;
    display: grid;
    gap: 8px;
  }

  .column h3 {
    margin: 0;
    font-size: calc(14px * var(--text-scale, 1));
    color: #f8fafc;
  }

  .empty {
    margin: 0;
    font-size: calc(12px * var(--text-scale, 1));
    color: #94a3b8;
  }

  .list {
    display: grid;
    gap: 6px;
  }

  .row {
    width: 100%;
    min-height: 52px;
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: rgba(2, 6, 23, 0.5);
    color: #e2e8f0;
    padding: 8px;
    display: grid;
    gap: 2px;
    text-align: left;
  }

  .row.active {
    border-color: rgba(250, 204, 21, 0.45);
    background: rgba(120, 53, 15, 0.24);
  }

  .row.reserve {
    border-color: rgba(125, 211, 252, 0.4);
  }

  .title {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    color: #f8fafc;
  }

  .detail {
    font-size: calc(11px * var(--text-scale, 1));
    color: #cbd5e1;
  }

  .state {
    justify-self: start;
    font-size: calc(10px * var(--text-scale, 1));
    text-transform: uppercase;
    letter-spacing: 0.4px;
    border-radius: 999px;
    padding: 2px 8px;
    border: 1px solid transparent;
  }

  .state.ready {
    color: #bbf7d0;
    border-color: rgba(74, 222, 128, 0.45);
    background: rgba(20, 83, 45, 0.4);
  }

  .state.dormant {
    color: #fecaca;
    border-color: rgba(248, 113, 113, 0.45);
    background: rgba(127, 29, 29, 0.4);
  }

  .footer {
    position: sticky;
    bottom: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: space-between;
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: rgba(15, 23, 42, 0.92);
    padding: 8px;
  }

  .status {
    margin: 0;
    font-size: calc(11px * var(--text-scale, 1));
    color: #cbd5e1;
  }
</style>

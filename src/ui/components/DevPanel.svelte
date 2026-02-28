<script lang="ts">
  import { BALANCE } from '../../data/balance'
  import type { Fact } from '../../data/types'
  import { deleteSave } from '../../services/saveService'
  import { GameManager } from '../../game/GameManager'
  import { currentScreen } from '../stores/gameState'
  import { addLearnedFact, addMinerals, initPlayer, persistPlayer, playerSave } from '../stores/playerData'

  let open = $state(false)
  const gm = GameManager.getInstance()

  function toggle(): void {
    open = !open
  }

  function giveOxygen(): void {
    playerSave.update(s => {
      if (!s) return s
      return { ...s, oxygen: s.oxygen + 3 }
    })
    persistPlayer()
  }

  function giveDust(): void {
    addMinerals('dust', 100)
  }

  function giveShards(): void {
    addMinerals('shard', 50)
  }

  function giveCrystals(): void {
    addMinerals('crystal', 20)
  }

  function learnAllFacts(): void {
    const facts = gm.getFacts()
    for (const fact of facts) {
      addLearnedFact(fact.id)
    }
  }

  function learn10Facts(): void {
    const facts = gm.getFacts()
    const save = $playerSave
    if (!save) return
    const unlearned = facts.filter(f => !save.learnedFacts.includes(f.id))
    for (const fact of unlearned.slice(0, 10)) {
      addLearnedFact(fact.id)
    }
  }

  function resetSave(): void {
    if (confirm('Delete all save data and start fresh?')) {
      deleteSave()
      initPlayer('teen')
      playerSave.update(s => {
        if (!s) return s
        return { ...s, oxygen: BALANCE.STARTING_OXYGEN_TANKS }
      })
      persistPlayer()
      currentScreen.set('base')
    }
  }

  function quickDive(): void {
    // Give 3 tanks and start dive immediately
    playerSave.update(s => {
      if (!s) return s
      return { ...s, oxygen: Math.max(s.oxygen, 3) }
    })
    persistPlayer()
    gm.startDive(3)
  }

  function goToScreen(screen: string): void {
    currentScreen.set(screen as 'mainMenu' | 'base' | 'divePrepScreen' | 'mining')
  }
</script>

{#if !open}
  <button class="dev-toggle" type="button" onclick={toggle} title="Dev Panel">
    DEV
  </button>
{:else}
  <div class="dev-panel">
    <div class="dev-header">
      <span>Dev Panel</span>
      <button class="close-btn" type="button" onclick={toggle}>X</button>
    </div>

    <div class="dev-section">
      <span class="section-label">Resources</span>
      <button type="button" onclick={giveOxygen}>+3 O2 Tanks</button>
      <button type="button" onclick={giveDust}>+100 Dust</button>
      <button type="button" onclick={giveShards}>+50 Shards</button>
      <button type="button" onclick={giveCrystals}>+20 Crystals</button>
    </div>

    <div class="dev-section">
      <span class="section-label">Knowledge</span>
      <button type="button" onclick={learn10Facts}>Learn 10 Facts</button>
      <button type="button" onclick={learnAllFacts}>Learn ALL Facts</button>
    </div>

    <div class="dev-section">
      <span class="section-label">Navigation</span>
      <button type="button" onclick={quickDive}>Quick Dive (3 tanks)</button>
      <button type="button" onclick={() => goToScreen('base')}>Go to Base</button>
      <button type="button" onclick={() => goToScreen('mainMenu')}>Main Menu</button>
    </div>

    <div class="dev-section">
      <span class="section-label">Save</span>
      <span class="dev-info">O2: {$playerSave?.oxygen ?? 0} | Dust: {$playerSave?.minerals.dust ?? 0} | Facts: {$playerSave?.learnedFacts.length ?? 0}</span>
      <button type="button" class="danger" onclick={resetSave}>Reset Save</button>
    </div>
  </div>
{/if}

<style>
  .dev-toggle {
    position: fixed;
    top: 4px;
    right: 4px;
    z-index: 9999;
    pointer-events: auto;
    padding: 4px 8px;
    border: 1px solid #f0f;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.7);
    color: #f0f;
    font-family: 'Courier New', monospace;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    opacity: 0.6;
  }

  .dev-toggle:hover {
    opacity: 1;
  }

  .dev-panel {
    position: fixed;
    top: 4px;
    right: 4px;
    z-index: 9999;
    pointer-events: auto;
    width: min(280px, 90vw);
    max-height: 80vh;
    overflow-y: auto;
    border: 1px solid #f0f;
    border-radius: 8px;
    background: rgba(10, 10, 20, 0.95);
    color: #ddd;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    padding: 8px;
  }

  .dev-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 6px;
    margin-bottom: 6px;
    border-bottom: 1px solid #333;
    color: #f0f;
    font-weight: 700;
  }

  .close-btn {
    background: none;
    border: 1px solid #666;
    border-radius: 4px;
    color: #ddd;
    cursor: pointer;
    padding: 2px 6px;
    font-family: inherit;
  }

  .dev-section {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px 0;
    border-bottom: 1px solid #222;
  }

  .section-label {
    width: 100%;
    color: #f0f;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 2px;
  }

  .dev-info {
    width: 100%;
    color: #888;
    font-size: 11px;
    margin-bottom: 4px;
  }

  .dev-panel button {
    padding: 4px 8px;
    border: 1px solid #444;
    border-radius: 4px;
    background: #1a1a2e;
    color: #ddd;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
  }

  .dev-panel button:hover {
    background: #2a2a3e;
    border-color: #666;
  }

  .dev-panel button:active {
    background: #333;
  }

  .dev-panel button.danger {
    border-color: #e94560;
    color: #e94560;
  }

  .dev-panel button.danger:hover {
    background: rgba(233, 69, 96, 0.2);
  }
</style>

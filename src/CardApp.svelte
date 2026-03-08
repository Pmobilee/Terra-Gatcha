<script lang="ts">
  import { onDestroy } from 'svelte'
  import { currentScreen } from './ui/stores/gameState'
  import {
    gameFlowState,
    activeRunState,
    activeRoomOptions,
    activeMysteryEvent,
    activeRunEndData,
    startNewRun,
    onDomainsSelected,
    onEncounterComplete,
    onRoomSelected,
    onMysteryResolved,
    onRestResolved,
    returnToMenu,
    playAgain,
  } from './services/gameFlowController'
  import {
    activeTurnState,
    handlePlayCard,
    handleSkipCard,
    handleEndTurn,
    startEncounterForRoom,
  } from './services/encounterBridge'
  import type { FactDomain } from './data/card-types'
  import type { RoomOption, MysteryEffect } from './services/floorManager'
  import type { RunEndData } from './services/runManager'
  import { get } from 'svelte/store'
  import { healPlayer } from './services/runManager'

  // Lazy imports for code-splitting
  import DomainSelection from './ui/components/DomainSelection.svelte'
  import CardCombatOverlay from './ui/components/CardCombatOverlay.svelte'
  import RoomSelection from './ui/components/RoomSelection.svelte'
  import MysteryEventOverlay from './ui/components/MysteryEventOverlay.svelte'
  import RestRoomOverlay from './ui/components/RestRoomOverlay.svelte'
  import RunEndScreen from './ui/components/RunEndScreen.svelte'

  // ── Handlers ──────────────────────────────────────

  function handleStartRun(): void {
    startNewRun()
  }

  function handleDomainsSelected(primary: FactDomain, secondary: FactDomain): void {
    onDomainsSelected(primary, secondary)
    // Start first combat encounter
    startEncounterForRoom()
  }

  function handleRoomSelected(index: number): void {
    const rooms = get(activeRoomOptions)
    const room = rooms[index]
    if (!room) return
    onRoomSelected(room)
    // If the room type is combat, start the encounter
    if (room.type === 'combat') {
      startEncounterForRoom(room.enemyId)
    }
  }

  function handleMysteryResolve(effect: MysteryEffect): void {
    // Apply effect to run state
    const run = get(activeRunState)
    if (run) {
      if (effect.type === 'heal') {
        healPlayer(run, effect.amount)
      } else if (effect.type === 'damage') {
        run.playerHp = Math.max(0, run.playerHp - effect.amount)
      }
      activeRunState.set(run)
    }
    onMysteryResolved()
  }

  function handleRestHeal(): void {
    const run = get(activeRunState)
    if (run) {
      const amount = Math.round(run.playerMaxHp * 0.3)
      healPlayer(run, amount)
      activeRunState.set(run)
    }
    onRestResolved()
  }

  function handleRestUpgrade(): void {
    // Placeholder — just resolve like heal for now
    onRestResolved()
  }

  function handleOnEncounterComplete(result: 'victory' | 'defeat'): void {
    onEncounterComplete(result)
  }

  function handleGoBack(): void {
    returnToMenu()
  }
</script>

<div class="card-app" data-screen={$currentScreen}>
  <!-- Phaser canvas container (always present, hidden when not in combat) -->
  <div
    id="phaser-container"
    class="phaser-container"
    class:visible={$currentScreen === 'combat'}
  ></div>

  {#if $currentScreen === 'mainMenu' || $currentScreen === 'base'}
    <div class="main-menu">
      <h1 class="menu-title">TERRA MINER</h1>
      <p class="menu-subtitle">Card Roguelite</p>
      <button class="start-btn" data-testid="btn-start-run" onclick={handleStartRun}>
        Start Run
      </button>
    </div>
  {/if}

  {#if $currentScreen === 'domainSelection'}
    <DomainSelection
      onstart={handleDomainsSelected}
      onback={handleGoBack}
    />
  {/if}

  {#if $currentScreen === 'combat'}
    <CardCombatOverlay
      turnState={$activeTurnState}
      onplaycard={handlePlayCard}
      onskipcard={handleSkipCard}
      onendturn={handleEndTurn}
    />
  {/if}

  {#if $currentScreen === 'roomSelection'}
    {@const run = $activeRunState}
    {#if run}
      <RoomSelection
        options={$activeRoomOptions}
        playerHp={run.playerHp}
        playerMaxHp={run.playerMaxHp}
        currentFloor={run.floor.currentFloor}
        encounterNumber={run.floor.currentEncounter}
        onselect={handleRoomSelected}
      />
    {/if}
  {/if}

  {#if $currentScreen === 'mysteryEvent'}
    {@const run = $activeRunState}
    <MysteryEventOverlay
      event={$activeMysteryEvent}
      playerHp={run?.playerHp ?? 0}
      playerMaxHp={run?.playerMaxHp ?? 0}
      onresolve={handleMysteryResolve}
    />
  {/if}

  {#if $currentScreen === 'restRoom'}
    {@const run = $activeRunState}
    <RestRoomOverlay
      playerHp={run?.playerHp ?? 0}
      playerMaxHp={run?.playerMaxHp ?? 0}
      onheal={handleRestHeal}
      onupgrade={handleRestUpgrade}
    />
  {/if}

  {#if $currentScreen === 'runEnd'}
    {@const end = $activeRunEndData}
    {#if end}
      <RunEndScreen
        result={end.result}
        floorReached={end.floorReached}
        factsAnswered={end.factsAnswered}
        accuracy={end.accuracy}
        bestCombo={end.bestCombo}
        cardsEarned={end.cardsEarned}
        onplayagain={playAgain}
        onhome={returnToMenu}
      />
    {/if}
  {/if}
</div>

<style>
  .card-app {
    position: fixed;
    inset: 0;
    background: #0D1117;
    overflow: hidden;
  }

  .phaser-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 55vh;
    display: none;
  }

  .phaser-container.visible {
    display: block;
  }

  .main-menu {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    z-index: 10;
  }

  .menu-title {
    font-size: 32px;
    font-weight: 800;
    color: #F1C40F;
    letter-spacing: 3px;
    margin: 0;
    text-align: center;
    text-shadow: 0 2px 8px rgba(241, 196, 15, 0.3);
  }

  .menu-subtitle {
    font-size: 14px;
    color: #8B949E;
    margin: 0 0 24px;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .start-btn {
    width: 220px;
    height: 64px;
    background: linear-gradient(135deg, #27AE60, #2ECC71);
    border: none;
    border-radius: 16px;
    color: #fff;
    font-size: 20px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.1s, box-shadow 0.2s;
    box-shadow: 0 4px 15px rgba(39, 174, 96, 0.3);
    letter-spacing: 1px;
  }

  .start-btn:hover {
    transform: scale(1.03);
    box-shadow: 0 6px 20px rgba(39, 174, 96, 0.4);
  }

  .start-btn:active {
    transform: scale(0.97);
  }
</style>

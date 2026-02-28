<script lang="ts">
  import { get } from 'svelte/store'
  import { GameManager } from './game/GameManager'
  import {
    currentScreen,
    activeQuiz,
    activeFact,
    inventory,
  } from './ui/stores/gameState'
  import { playerSave } from './ui/stores/playerData'

  // Components
  import HUD from './ui/components/HUD.svelte'
  import QuizOverlay from './ui/components/QuizOverlay.svelte'
  import BackpackOverlay from './ui/components/BackpackOverlay.svelte'
  import FactReveal from './ui/components/FactReveal.svelte'
  import DivePrepScreen from './ui/components/DivePrepScreen.svelte'
  import BaseView from './ui/components/BaseView.svelte'
  import DevPanel from './ui/components/DevPanel.svelte'

  const gm = GameManager.getInstance()

  // Quiz mode tracking
  let quizMode = $state<'gate' | 'study'>('gate')

  // Main menu start handler
  function handleStart(): void {
    currentScreen.set('base')
  }

  // Base actions
  function handleDive(): void {
    gm.goToDivePrep()
  }

  function handleStudy(): void {
    quizMode = 'study'
    gm.startStudySession()
  }

  function handleReviewArtifact(): void {
    gm.reviewNextArtifact()
  }

  // Dive prep actions
  function handleStartDive(tanks: number): void {
    gm.startDive(tanks)
  }

  function handleBackFromDivePrep(): void {
    gm.goToBase()
  }

  // Mining HUD actions
  function handleSurface(): void {
    gm.endDive(false)
  }

  function handleOpenBackpack(): void {
    // Triggered by Phaser event, screen already set by GameManager
    // But also support direct call from HUD
    currentScreen.set('backpack')
  }

  // Quiz actions
  function handleQuizAnswer(correct: boolean): void {
    if (quizMode === 'gate') {
      gm.handleQuizAnswer(correct)
    } else {
      gm.handleStudyAnswer(correct)
    }
  }

  function handleQuizClose(): void {
    if (quizMode === 'gate') {
      gm.resumeQuiz(false)
    } else {
      currentScreen.set('base')
    }
  }

  // Backpack actions
  function handleCloseBackpack(): void {
    gm.closeBackpack()
  }

  function handleDropItem(index: number): void {
    gm.dropItem(index)
  }

  // Fact reveal actions
  function handleLearnFact(): void {
    gm.learnArtifact()
  }

  function handleSellFact(): void {
    gm.sellArtifact()
  }

  // Track quiz mode when screen changes to quiz from mining (gate mode)
  $effect(() => {
    if ($currentScreen === 'quiz' && $activeQuiz) {
      // If we came from mining, it's gate mode (set by quiz-gate event)
      // If we came from study button, quizMode was already set to 'study'
    }
  })
</script>

<div id="game-container"></div>
<div id="ui-overlay">
  {#if $currentScreen === 'mainMenu'}
    <div class="main-menu">
      <h1 class="game-title">Terra Gacha</h1>
      <p class="tagline">Mine. Discover. Learn.</p>
      <button class="start-btn" type="button" onclick={handleStart}>Start</button>
    </div>

  {:else if $currentScreen === 'base'}
    <BaseView
      onDive={handleDive}
      onStudy={handleStudy}
      onReviewArtifact={handleReviewArtifact}
    />

  {:else if $currentScreen === 'divePrepScreen'}
    <DivePrepScreen
      availableTanks={$playerSave?.oxygen ?? 0}
      onStartDive={handleStartDive}
      onBack={handleBackFromDivePrep}
    />

  {:else if $currentScreen === 'mining'}
    <HUD
      onSurface={handleSurface}
      onOpenBackpack={handleOpenBackpack}
    />

  {:else if $currentScreen === 'quiz' && $activeQuiz}
    {#if quizMode === 'gate'}
      <HUD
        onSurface={handleSurface}
        onOpenBackpack={handleOpenBackpack}
      />
    {/if}
    <QuizOverlay
      fact={$activeQuiz.fact}
      choices={$activeQuiz.choices}
      mode={quizMode}
      onAnswer={handleQuizAnswer}
      onClose={handleQuizClose}
    />

  {:else if $currentScreen === 'backpack'}
    <HUD
      onSurface={handleSurface}
      onOpenBackpack={handleOpenBackpack}
    />
    <BackpackOverlay
      slots={$inventory}
      onClose={handleCloseBackpack}
      onDropItem={handleDropItem}
    />

  {:else if $currentScreen === 'factReveal' && $activeFact}
    <FactReveal
      fact={$activeFact}
      onLearn={handleLearnFact}
      onSell={handleSellFact}
    />

  {:else if $currentScreen === 'sacrifice'}
    <!-- MVP: sacrifice screen is just a redirect back to base -->
    <div class="sacrifice-screen">
      <h2>Oxygen Depleted!</h2>
      <p>You lost 30% of your inventory...</p>
      <button type="button" onclick={() => currentScreen.set('base')}>Return to Base</button>
    </div>
  {/if}

  <DevPanel />
</div>

<style>
  .main-menu {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    background: var(--color-bg);
    z-index: 30;
    font-family: 'Courier New', monospace;
  }

  .game-title {
    font-size: clamp(2.5rem, 8vw, 4rem);
    color: var(--color-warning);
    text-transform: uppercase;
    letter-spacing: 4px;
    text-shadow: 0 0 20px rgba(255, 211, 105, 0.3);
  }

  .tagline {
    color: var(--color-text-dim);
    font-size: 1.1rem;
    letter-spacing: 2px;
  }

  .start-btn {
    margin-top: 1rem;
    min-width: 200px;
    min-height: 56px;
    border: 2px solid var(--color-success);
    border-radius: 14px;
    background: color-mix(in srgb, var(--color-success) 25%, var(--color-surface) 75%);
    color: var(--color-text);
    font-family: inherit;
    font-size: 1.2rem;
    font-weight: 700;
    letter-spacing: 2px;
    cursor: pointer;
    transition: transform 120ms ease, background-color 120ms ease;
  }

  .start-btn:active {
    transform: scale(0.97);
    background: color-mix(in srgb, var(--color-success) 40%, var(--color-surface) 60%);
  }

  .sacrifice-screen {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    background: rgba(0, 0, 0, 0.9);
    z-index: 50;
    font-family: 'Courier New', monospace;
    color: var(--color-accent);
  }

  .sacrifice-screen p {
    color: var(--color-text-dim);
  }

  .sacrifice-screen button {
    margin-top: 1rem;
    min-height: 48px;
    padding: 0.8rem 2rem;
    border: 1px solid var(--color-text-dim);
    border-radius: 12px;
    background: var(--color-surface);
    color: var(--color-text);
    font-family: inherit;
    font-size: 1rem;
    cursor: pointer;
  }
</style>

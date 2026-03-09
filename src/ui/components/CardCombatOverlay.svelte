<script lang="ts">
  import { get } from 'svelte/store'
  import type { Card } from '../../data/card-types'
  import type { TurnState } from '../../services/turnManager'
  import { FLOOR_TIMER } from '../../data/balance'
  import { getQuestionPresentation } from '../../services/questionFormatter'
  import {
    difficultyMode,
    isSlowReader,
    onboardingState,
    markOnboardingTooltipSeen,
    type DifficultyMode,
  } from '../../services/cardPreferences'
  import CardHand from './CardHand.svelte'
  import CardExpanded from './CardExpanded.svelte'
  import DamageNumber from './DamageNumber.svelte'
  import ComboCounter from './ComboCounter.svelte'
  import RelicTray from './RelicTray.svelte'
  import { juiceManager } from '../../services/juiceManager'
  import { factsDB } from '../../services/factsDB'
  import { getReviewStateByFactId } from '../stores/playerData'
  import type { ActiveBounty } from '../../services/bountyManager'
  import { playCardAudio } from '../../services/cardAudioManager'

  interface Props {
    turnState: TurnState | null
    activeBounties?: ActiveBounty[]
    onplaycard: (
      cardId: string,
      correct: boolean,
      speedBonus: boolean,
      responseTimeMs?: number,
      variantIndex?: number,
    ) => void
    onskipcard: (cardId: string) => void
    onendturn: () => void
    onusehint: () => void
  }

  type CardPlayStage = 'hand' | 'selected' | 'committed'

  interface QuizData {
    question: string
    answers: string[]
    correctAnswer: string
    variantIndex: number
  }

  let { turnState, activeBounties = [], onplaycard, onskipcard, onendturn, onusehint }: Props = $props()

  let cardPlayStage = $state<CardPlayStage>('hand')
  let selectedIndex = $state<number | null>(null)
  let committedCardIndex = $state<number | null>(null)
  let committedQuizData = $state<QuizData | null>(null)
  let committedAtMs = $state(0)

  let answeredThisTurn = $state(0)
  let damageNumbers = $state<Array<{ id: number; value: string; isCritical: boolean }>>([])
  let cardAnimations = $state<Record<string, 'launch' | 'fizzle' | null>>({})
  let damageIdCounter = $state(0)
  let slowReaderEnabled = $state(false)
  let currentDifficulty = $state<DifficultyMode>('standard')

  let handCards = $derived<Card[]>(turnState?.deck.hand ?? [])
  let comboCount = $derived(turnState?.comboCount ?? 0)
  let isPerfectTurn = $derived(turnState?.isPerfectTurn ?? false)
  let activeRelics = $derived(turnState?.activeRelics ?? [])
  let apCurrent = $derived(turnState?.apCurrent ?? 0)
  let apMax = $derived(turnState?.apMax ?? 0)

  let selectedCard = $derived<Card | null>(
    selectedIndex !== null && handCards[selectedIndex] ? handCards[selectedIndex] : null,
  )

  let committedCard = $derived<Card | null>(
    committedCardIndex !== null && handCards[committedCardIndex] ? handCards[committedCardIndex] : null,
  )

  let selectedPresentation = $derived(
    selectedCard
      ? getQuestionPresentation(selectedCard.tier, selectedCard.isMasteryTrial === true)
      : null,
  )

  let committedPresentation = $derived(
    committedCard
      ? getQuestionPresentation(committedCard.tier, committedCard.isMasteryTrial === true)
      : null,
  )

  let speedBonusThreshold = $derived(
    turnState?.activeRelicIds.has('scholars_focus') ? 0.30 : 0.25,
  )

  let showEndTurn = $derived(
    turnState !== null && turnState.phase === 'player_action',
  )

  let endTurnDisabled = $derived(
    !turnState ||
      turnState.phase !== 'player_action' ||
      cardPlayStage === 'committed',
  )

  let timerEnabled = $derived(currentDifficulty !== 'explorer')
  let canaryQuestionBias = $derived(turnState?.canaryQuestionBias ?? 0)

  let effectiveTimerSeconds = $derived.by(() => {
    if (!turnState || !committedPresentation || !committedQuizData) return 4

    const floorBase = committedPresentation.timerOverride
      ?? (FLOOR_TIMER.find((entry) => turnState.deck.currentFloor <= entry.maxFloor)?.seconds ?? 4)

    const questionWords = committedQuizData.question
      .trim()
      .split(/\s+/)
      .filter(Boolean).length

    const extraWords = Math.max(0, questionWords - 10)
    const wordBonus = Math.floor(extraWords / 15)
    const slowReaderBonus = slowReaderEnabled && !committedPresentation.disableSlowReader ? 3 : 0

    let timer = floorBase + wordBonus + slowReaderBonus

    if (currentDifficulty === 'scholar' && committedCard) {
      const tierRank = committedCard.tier === '1' ? 0 : committedCard.tier === '2a' ? 1 : committedCard.tier === '2b' ? 2 : 3
      timer = Math.max(2, timer - tierRank * 2)
    }

    return timer
  })

  let timerColorVariant = $derived<'default' | 'gold' | 'slowReader'>(
    committedCard?.isMasteryTrial
      ? 'gold'
      : slowReaderEnabled
        ? 'slowReader'
        : 'default',
  )

  let castDisabled = $derived(
    !selectedCard || !turnState || Math.max(1, selectedCard.apCost ?? 1) > turnState.apCurrent,
  )

  let onboardingTip = $derived.by(() => {
    const state = get(onboardingState)
    if (state.hasCompletedOnboarding) return null

    if (cardPlayStage === 'hand' && !state.hasSeenCardTapTooltip) {
      return 'Tap a card to examine it'
    }

    if (cardPlayStage === 'selected' && !state.hasSeenCastTooltip) {
      return 'Tap Cast to commit — you cannot cancel'
    }

    if (cardPlayStage === 'committed' && !state.hasSeenAnswerTooltip) {
      return 'Answer to activate your card'
    }

    if (answeredThisTurn > 0 && !state.hasSeenEndTurnTooltip) {
      return 'Tap End Turn when done'
    }

    if ((turnState?.turnNumber ?? 0) >= 2 && !state.hasSeenAPTooltip) {
      return 'You have AP — each cast uses AP'
    }

    return null
  })

  let onboardingTipClass = $derived.by(() => {
    if (!onboardingTip) return ''
    if (cardPlayStage === 'selected') return 'tip-cast'
    if (cardPlayStage === 'committed') return 'tip-answer'
    if (answeredThisTurn > 0) return 'tip-endturn'
    if ((turnState?.turnNumber ?? 0) >= 2) return 'tip-ap'
    return 'tip-hand'
  })

  function removeDamageNumber(id: number): void {
    damageNumbers = damageNumbers.filter((entry) => entry.id !== id)
  }

  function spawnDamageNumber(value: string, isCritical: boolean): void {
    const id = damageIdCounter++
    damageNumbers = [...damageNumbers, { id, value, isCritical }]
  }

  $effect(() => {
    const unsubDifficulty = difficultyMode.subscribe((value) => {
      currentDifficulty = value
    })
    const unsubSlowReader = isSlowReader.subscribe((value) => {
      slowReaderEnabled = value
    })

    return () => {
      unsubDifficulty()
      unsubSlowReader()
    }
  })

  $effect(() => {
    juiceManager.setCallbacks({
      onDamageNumber: (value, isCritical) => spawnDamageNumber(value, isCritical),
    })
    return () => juiceManager.clearCallbacks()
  })

  function getQuizForCard(card: Card, optionCount: number): QuizData {
    const variantCount = 3
    const lastVariant = getReviewStateByFactId(card.factId)?.lastVariantIndex ?? -1
    let variantIndex = 0
    if (variantCount > 1) {
      if (canaryQuestionBias < 0) {
        variantIndex = 0
      } else if (canaryQuestionBias > 0) {
        const challengeVariants = [1, 2].filter((value) => value !== lastVariant)
        variantIndex = challengeVariants[Math.floor(Math.random() * challengeVariants.length)] ?? 1
      } else {
        variantIndex = Math.floor(Math.random() * variantCount)
        while (variantCount > 1 && variantIndex === lastVariant) {
          variantIndex = Math.floor(Math.random() * variantCount)
        }
      }
    }

    const fact = factsDB.isReady() ? factsDB.getById(card.factId) : null
    if (!fact) {
      return {
        question: `Question for ${card.factId}`,
        answers: ['Answer', 'Wrong A', 'Wrong B'],
        correctAnswer: 'Answer',
        variantIndex,
      }
    }

    const distractorCount = Math.max(2, optionCount - 1)
    const shuffledDistractors = [...fact.distractors].sort(() => Math.random() - 0.5)
    const picked = shuffledDistractors.slice(0, Math.min(distractorCount, shuffledDistractors.length))

    const allAnswers = [...picked]
    const insertIdx = Math.floor(Math.random() * (allAnswers.length + 1))
    allAnswers.splice(insertIdx, 0, fact.correctAnswer)

    const question = variantIndex === 1
      ? `Which prompt maps to "${fact.correctAnswer}"?`
      : variantIndex === 2
        ? `Fill in the blank: ${fact.statement.replace(fact.correctAnswer, '_____')}`
        : fact.quizQuestion

    return {
      question,
      answers: allAnswers,
      correctAnswer: fact.correctAnswer,
      variantIndex,
    }
  }

  function resetCardFlow(): void {
    cardPlayStage = 'hand'
    selectedIndex = null
    committedCardIndex = null
    committedQuizData = null
    committedAtMs = 0
  }

  let _lastTurnNumber = 0
  $effect(() => {
    const nextTurn = turnState?.turnNumber ?? 0
    if (nextTurn !== _lastTurnNumber) {
      _lastTurnNumber = nextTurn
      resetCardFlow()
      answeredThisTurn = 0

      if (nextTurn >= 2) {
        const state = get(onboardingState)
        if (!state.hasCompletedOnboarding && !state.hasSeenAPTooltip) {
          markOnboardingTooltipSeen('hasSeenAPTooltip')
        }
      }
    }
  })

  $effect(() => {
    if (cardPlayStage === 'committed' && (!committedCard || !committedQuizData)) {
      resetCardFlow()
    }
  })

  let autoEndTimeout: ReturnType<typeof setTimeout> | undefined
  $effect(() => {
    if (
      turnState &&
      turnState.phase === 'player_action' &&
      turnState.apCurrent <= 0 &&
      cardPlayStage !== 'committed'
    ) {
      autoEndTimeout = setTimeout(() => onendturn(), 500)
      return () => {
        if (autoEndTimeout !== undefined) clearTimeout(autoEndTimeout)
      }
    }
  })

  function handleSelect(index: number): void {
    if (!turnState || turnState.phase !== 'player_action') return
    if (cardPlayStage === 'committed') return

    const card = handCards[index]
    if (!card) return

    if (selectedIndex === index && cardPlayStage === 'selected') {
      handleDeselect()
      return
    }

    selectedIndex = index
    cardPlayStage = 'selected'

    const state = get(onboardingState)
    if (!state.hasCompletedOnboarding && !state.hasSeenCardTapTooltip) {
      markOnboardingTooltipSeen('hasSeenCardTapTooltip')
    }
  }

  function handleDeselect(): void {
    if (cardPlayStage !== 'selected') return
    resetCardFlow()
  }

  function handleCast(): void {
    if (!selectedCard || !selectedPresentation || castDisabled) return

    playCardAudio('card-cast')
    cardPlayStage = 'committed'
    committedCardIndex = selectedIndex
    committedQuizData = getQuizForCard(selectedCard, selectedPresentation.optionCount)
    committedAtMs = Date.now()

    const state = get(onboardingState)
    if (!state.hasCompletedOnboarding && !state.hasSeenCastTooltip) {
      markOnboardingTooltipSeen('hasSeenCastTooltip')
    }
  }

  function handleAnswer(answerIndex: number, isCorrect: boolean, speedBonus: boolean): void {
    if (!committedCard) return

    const cardId = committedCard.id
    const responseTimeMs = committedAtMs > 0 ? Math.max(50, Date.now() - committedAtMs) : undefined
    const effectVal = Math.round(committedCard.baseEffectValue * committedCard.effectMultiplier)
    const effectLabel = `${committedCard.cardType.toUpperCase()} ${effectVal}`

    cardAnimations = { ...cardAnimations, [cardId]: isCorrect ? 'launch' : 'fizzle' }
    setTimeout(() => {
      cardAnimations = { ...cardAnimations, [cardId]: null }
    }, isCorrect ? 300 : 400)

    const nextCombo = isCorrect ? (turnState?.comboCount ?? 0) + 1 : 0
    const willBePerfect = isCorrect && (turnState?.cardsCorrectThisTurn === turnState?.cardsPlayedThisTurn)
    juiceManager.fire({
      type: isCorrect ? 'correct' : 'wrong',
      damage: isCorrect ? effectVal : 0,
      isCritical: speedBonus,
      comboCount: nextCombo,
      effectLabel: isCorrect ? effectLabel : undefined,
      isPerfectTurn: willBePerfect,
    })

    onplaycard(cardId, isCorrect, speedBonus, responseTimeMs, committedQuizData?.variantIndex)
    answeredThisTurn += 1
    resetCardFlow()

    const state = get(onboardingState)
    if (!state.hasCompletedOnboarding && !state.hasSeenAnswerTooltip) {
      markOnboardingTooltipSeen('hasSeenAnswerTooltip')
    }
  }

  function handleSkip(): void {
    if (cardPlayStage === 'selected' && selectedCard) {
      onskipcard(selectedCard.id)
      resetCardFlow()
      return
    }

    if (cardPlayStage === 'committed' && committedCard) {
      handleAnswer(-1, false, false)
    }
  }

  function handleEndTurn(): void {
    const state = get(onboardingState)
    if (!state.hasCompletedOnboarding && !state.hasSeenEndTurnTooltip) {
      markOnboardingTooltipSeen('hasSeenEndTurnTooltip')
    }
    onendturn()
  }

  function getCardStars(card: Card): string {
    if (card.tier === '3') return '★★★'
    if (card.tier === '2b') return '★★'
    if (card.tier === '2a') return '★★'
    return '★'
  }

  function getCardEffectText(card: Card): string {
    const amount = Math.round(card.baseEffectValue * card.effectMultiplier)
    switch (card.cardType) {
      case 'attack': return `Deal ${amount} damage`
      case 'shield': return `Gain ${amount} shield`
      case 'heal': return `Recover ${amount} HP`
      case 'buff': return `Boost next cast (${amount})`
      case 'debuff': return `Apply debuff (${amount})`
      case 'regen': return `Regen ${amount}`
      case 'utility': return `Utility effect (${amount})`
      case 'wild': return `Adaptive effect (${amount})`
      default: return `Effect ${amount}`
    }
  }

  function bountyLabel(bounty: ActiveBounty): string {
    const progress = Math.min(bounty.progress, bounty.target)
    return `${bounty.name}: ${progress}/${bounty.target}`
  }
</script>

<div class="card-combat-overlay">
  {#if turnState === null}
    <div class="empty-state">Waiting for encounter...</div>
  {:else}
    <RelicTray relics={activeRelics} triggeredRelicId={turnState.triggeredRelicId} />

    <div class="ap-strip" aria-label="Action points">
      <span>AP</span>
      <strong>{apCurrent}/{apMax}</strong>
    </div>

    {#if activeBounties.length > 0}
      <div class="bounty-strip" aria-label="Bounty progress">
        {#each activeBounties.slice(0, 2) as bounty (bounty.id)}
          <div class="bounty-line" class:done={bounty.completed}>{bountyLabel(bounty)}</div>
        {/each}
      </div>
    {/if}

    {#if cardPlayStage === 'selected' && selectedCard}
      <button
        class="card-backdrop"
        onclick={handleDeselect}
        aria-label="Cancel card selection"
      ></button>

      <section class="selected-panel" aria-label="Selected card">
        <div class="selected-header">
          <span class="selected-type">{selectedCard.cardType.toUpperCase()}</span>
          <span class="selected-stars">{getCardStars(selectedCard)}</span>
        </div>
        <h3>{selectedCard.mechanicName ?? selectedCard.cardType}</h3>
        <p>{getCardEffectText(selectedCard)}</p>
        <p class="selected-tier">Tier {selectedCard.tier.toUpperCase()}</p>

        <button
          class="cast-btn"
          data-testid="btn-cast-card"
          onclick={handleCast}
          disabled={castDisabled}
        >
          CAST
        </button>
        <button class="selected-skip" onclick={handleSkip}>Skip</button>
      </section>
    {/if}

    {#if cardPlayStage === 'committed' && committedCard && committedQuizData && committedPresentation}
      <CardExpanded
        card={committedCard}
        question={committedQuizData.question}
        answers={committedQuizData.answers}
        correctAnswer={committedQuizData.correctAnswer}
        timerDuration={effectiveTimerSeconds}
        timerEnabled={timerEnabled}
        comboCount={turnState.comboCount}
        hintsRemaining={turnState.deck.hintsRemaining}
        speedBonusThreshold={speedBonusThreshold}
        showMasteryTrialHeader={committedCard.isMasteryTrial === true}
        timerColorVariant={timerColorVariant}
        highlightHint={turnState.canaryQuestionBias < 0}
        allowCancel={false}
        skipLabel="Forfeit"
        onanswer={handleAnswer}
        onskip={handleSkip}
        oncancel={() => {}}
        onusehint={onusehint}
      />
    {/if}

    {#if onboardingTip}
      <div class={`onboarding-tip ${onboardingTipClass}`}>{onboardingTip}</div>
    {/if}

    {#each damageNumbers as dn (dn.id)}
      <DamageNumber value={dn.value} isCritical={dn.isCritical} onComplete={() => removeDamageNumber(dn.id)} />
    {/each}

    {#if comboCount >= 4}
      <div class="screen-edge-pulse" style="pointer-events: none;"></div>
    {/if}

    <ComboCounter count={comboCount} {isPerfectTurn} />

    <CardHand
      cards={handCards}
      {selectedIndex}
      {cardAnimations}
      apCurrent={apCurrent}
      disabled={turnState.phase !== 'player_action' || cardPlayStage === 'committed'}
      onselectcard={handleSelect}
      ondeselectcard={handleDeselect}
    />

    {#if showEndTurn}
      <button
        class="end-turn-btn"
        class:disabled={endTurnDisabled}
        data-testid="btn-end-turn"
        onclick={handleEndTurn}
        disabled={endTurnDisabled}
      >
        END TURN • {apCurrent} AP LEFT
      </button>
    {/if}
  {/if}
</div>

<style>
  .card-combat-overlay {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 45vh;
    z-index: 10;
    background: rgba(0, 0, 0, 0.85);
    overflow: visible;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #7f8c8d;
    font-size: 14px;
  }

  .ap-strip {
    position: absolute;
    left: 12px;
    top: 10px;
    z-index: 8;
    background: rgba(15, 23, 35, 0.92);
    border: 1px solid #3a4b63;
    border-radius: 10px;
    color: #dce7f6;
    padding: 6px 10px;
    display: inline-flex;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    letter-spacing: 0.4px;
  }

  .bounty-strip {
    position: absolute;
    right: 12px;
    top: 10px;
    z-index: 8;
    min-width: 146px;
    max-width: 220px;
    background: rgba(15, 23, 35, 0.92);
    border: 1px solid #475569;
    border-radius: 10px;
    padding: 6px 8px;
    display: grid;
    gap: 4px;
    color: #dce7f6;
    font-size: 11px;
  }

  .bounty-line {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bounty-line.done {
    color: #facc15;
  }

  .ap-strip strong {
    font-size: 15px;
    color: #7dd3fc;
  }

  .card-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 15;
    border: none;
    cursor: pointer;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
  }

  .selected-panel {
    position: absolute;
    bottom: 128px;
    left: 50%;
    transform: translateX(-50%);
    width: 240px;
    max-width: calc(100vw - 28px);
    background: #162231;
    border: 2px solid #f1c40f;
    border-radius: 14px;
    padding: 14px;
    z-index: 20;
    text-align: center;
  }

  .selected-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #a8d6ff;
    font-size: 12px;
    margin-bottom: 6px;
  }

  .selected-panel h3 {
    margin: 4px 0;
    color: #f5f7fb;
    font-size: 16px;
  }

  .selected-panel p {
    margin: 3px 0;
    color: #c7d5e8;
    font-size: 12px;
  }

  .selected-tier {
    color: #f4d35e;
  }

  .cast-btn {
    width: 120px;
    height: 48px;
    border: none;
    border-radius: 10px;
    margin-top: 8px;
    background: linear-gradient(135deg, #f5b83d, #c97d16);
    color: #151006;
    font-weight: 800;
    letter-spacing: 1.2px;
  }

  .cast-btn:disabled {
    opacity: 0.45;
  }

  .selected-skip {
    margin-top: 8px;
    border: none;
    background: transparent;
    color: #9aa8ba;
    font-size: 12px;
    text-decoration: underline;
  }

  .onboarding-tip {
    position: absolute;
    z-index: 25;
    max-width: 220px;
    background: rgba(6, 8, 16, 0.92);
    color: #f4f7fb;
    border: 1px solid rgba(241, 196, 15, 0.5);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.3;
  }

  .tip-hand {
    bottom: 118px;
    left: 50%;
    transform: translateX(-50%);
  }

  .tip-cast {
    bottom: 320px;
    left: 50%;
    transform: translateX(-50%);
  }

  .tip-answer {
    bottom: 360px;
    left: 50%;
    transform: translateX(-50%);
  }

  .tip-endturn {
    bottom: 180px;
    left: 50%;
    transform: translateX(-50%);
  }

  .tip-ap {
    top: 44px;
    left: 12px;
  }

  .end-turn-btn {
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: 68px;
    height: 48px;
    background: #1f2937;
    color: #f8fafc;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    z-index: 5;
    -webkit-tap-highlight-color: transparent;
    font-family: inherit;
    letter-spacing: 0.8px;
  }

  .end-turn-btn.disabled,
  .end-turn-btn:disabled {
    background: #334155;
    color: #94a3b8;
  }

  .screen-edge-pulse {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    box-shadow: inset 0 0 60px 20px rgba(255, 215, 0, 0.15);
    animation: edgePulse 400ms ease-in-out;
    z-index: 5;
  }

  @keyframes edgePulse {
    0% { opacity: 0; }
    50% { opacity: 1; }
    100% { opacity: 0.7; }
  }
</style>

<script lang="ts">
  import { onDestroy } from 'svelte'
  import type { Card, FactDomain, CardType } from '../../data/card-types'

  interface Props {
    card: Card
    question: string
    answers: string[]
    correctAnswer: string
    timerDuration: number
    comboCount: number
    hintsRemaining: number
    onanswer: (answerIndex: number, isCorrect: boolean, speedBonus: boolean) => void
    onskip: () => void
    oncancel: () => void
  }

  let { card, question, answers, correctAnswer, timerDuration, comboCount, hintsRemaining, onanswer, onskip, oncancel }: Props = $props()

  /** Domain color mapping */
  const DOMAIN_COLORS: Record<FactDomain, string> = {
    science: '#E74C3C',
    history: '#3498DB',
    geography: '#F1C40F',
    language: '#2ECC71',
    math: '#9B59B6',
    arts: '#E67E22',
    medicine: '#1ABC9C',
    technology: '#95A5A6',
  }

  /** Domain display names */
  const DOMAIN_NAMES: Record<FactDomain, string> = {
    science: 'Science',
    history: 'History',
    geography: 'Geography',
    language: 'Language',
    math: 'Math',
    arts: 'Arts',
    medicine: 'Medicine',
    technology: 'Technology',
  }

  /** Card type emoji icons */
  const TYPE_ICONS: Record<CardType, string> = {
    attack: '⚔',
    shield: '🛡',
    heal: '💚',
    utility: '⭐',
    buff: '⬆',
    debuff: '⬇',
    regen: '➕',
    wild: '💎',
  }

  /** Effect description templates */
  const EFFECT_DESCRIPTIONS: Record<CardType, string> = {
    attack: 'Deal N Damage',
    shield: 'Block N Damage',
    heal: 'Heal N HP',
    buff: 'Buff +N%',
    debuff: 'Weaken Enemy',
    regen: 'Regen N/turn',
    utility: 'Draw +1 Card',
    wild: 'Copy Last',
  }

  // Computed card values
  let effectValue = $derived(Math.round(card.baseEffectValue * card.effectMultiplier))
  let effectDescription = $derived(
    EFFECT_DESCRIPTIONS[card.cardType].replace('N', String(effectValue))
  )
  let domainColor = $derived(DOMAIN_COLORS[card.domain])
  let domainName = $derived(DOMAIN_NAMES[card.domain])
  let typeIcon = $derived(TYPE_ICONS[card.cardType])

  // Timer state
  let startTime = $state(Date.now())
  let elapsed = $state(0)
  let timerFraction = $derived(Math.max(0, 1 - elapsed / (timerDuration * 1000)))
  let timerColor = $derived(
    timerFraction > 0.5 ? '#27AE60' : timerFraction > 0.25 ? '#F1C40F' : '#E74C3C'
  )

  // Answer state
  let selectedAnswerIndex = $state<number | null>(null)
  let answerRevealed = $state(false)
  let answersDisabled = $state(false)
  let showSpeedBonus = $state(false)
  let timerExpired = $state(false)

  // Swipe tracking
  let touchStartY = $state<number | null>(null)

  // Timer animation loop
  let rafId: number | undefined
  let feedbackTimeoutId: ReturnType<typeof setTimeout> | undefined
  let correctRevealTimeoutId: ReturnType<typeof setTimeout> | undefined
  let speedBonusTimeoutId: ReturnType<typeof setTimeout> | undefined

  function timerTick(): void {
    if (answersDisabled || timerExpired) return
    elapsed = Date.now() - startTime
    if (elapsed >= timerDuration * 1000) {
      timerExpired = true
      answersDisabled = true
      onskip()
      return
    }
    rafId = requestAnimationFrame(timerTick)
  }

  $effect(() => {
    // Start timer on mount
    startTime = Date.now()
    elapsed = 0
    timerExpired = false
    rafId = requestAnimationFrame(timerTick)

    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId)
      if (feedbackTimeoutId !== undefined) clearTimeout(feedbackTimeoutId)
      if (correctRevealTimeoutId !== undefined) clearTimeout(correctRevealTimeoutId)
      if (speedBonusTimeoutId !== undefined) clearTimeout(speedBonusTimeoutId)
    }
  })

  /**
   * Handle an answer button tap.
   */
  function handleAnswer(index: number): void {
    if (answersDisabled) return
    answersDisabled = true
    selectedAnswerIndex = index

    const isCorrect = answers[index] === correctAnswer
    const speedBonus = elapsed < (timerDuration * 1000 * 0.25)

    if (isCorrect && speedBonus) {
      showSpeedBonus = true
      speedBonusTimeoutId = setTimeout(() => { showSpeedBonus = false }, 500)
    }

    if (!isCorrect) {
      // Reveal correct answer after 400ms
      correctRevealTimeoutId = setTimeout(() => {
        answerRevealed = true
      }, 400)
    } else {
      answerRevealed = true
    }

    // Call onanswer after 800ms feedback
    feedbackTimeoutId = setTimeout(() => {
      onanswer(index, isCorrect, speedBonus)
    }, 800)
  }

  /**
   * Get the CSS class for an answer button based on state.
   */
  function getAnswerClass(index: number): string {
    if (selectedAnswerIndex === null) return ''
    const isCorrect = answers[index] === correctAnswer
    if (index === selectedAnswerIndex) {
      return isCorrect ? 'answer-correct' : 'answer-wrong'
    }
    if (answerRevealed && isCorrect) {
      return 'answer-reveal-correct'
    }
    return ''
  }

  function handleTouchStart(e: TouchEvent): void {
    touchStartY = e.touches[0].clientY
  }

  function handleTouchMove(e: TouchEvent): void {
    if (touchStartY === null) return
    const deltaY = e.touches[0].clientY - touchStartY
    if (deltaY > 40) {
      touchStartY = null
      oncancel()
    }
  }

  function handleTouchEnd(): void {
    touchStartY = null
  }

  onDestroy(() => {
    if (rafId !== undefined) cancelAnimationFrame(rafId)
    if (feedbackTimeoutId !== undefined) clearTimeout(feedbackTimeoutId)
    if (correctRevealTimeoutId !== undefined) clearTimeout(correctRevealTimeoutId)
    if (speedBonusTimeoutId !== undefined) clearTimeout(speedBonusTimeoutId)
  })
</script>

<div
  class="card-expanded"
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  role="dialog"
  aria-label="Card question"
  tabindex="-1"
>
  <!-- Card header -->
  <div class="card-header" style="background: {domainColor};">
    <span class="header-domain">{domainName}</span>
    <span class="header-icon">{typeIcon}</span>
  </div>

  <!-- Effect description -->
  <div class="card-effect-desc">{effectDescription}</div>

  <!-- Question text -->
  <div class="card-question">{question}</div>

  <!-- Answer buttons -->
  <div class="card-answers">
    {#each answers as answer, i}
      <button
        class="answer-btn {getAnswerClass(i)}"
        data-testid="quiz-answer-{i}"
        disabled={answersDisabled}
        onclick={() => handleAnswer(i)}
      >
        {answer}
      </button>
    {/each}
  </div>

  <!-- Speed bonus badge -->
  {#if showSpeedBonus}
    <div class="speed-bonus-badge">SPEED BONUS</div>
  {/if}

  <!-- Timer bar -->
  <div class="timer-bar-container">
    <div
      class="timer-bar-fill"
      style="width: {timerFraction * 100}%; background: {timerColor};"
    ></div>
  </div>

  <!-- Action row -->
  <div class="action-row">
    <button class="action-btn skip-btn" onclick={onskip} disabled={answersDisabled}>
      Skip
    </button>
    <button class="action-btn hint-btn" disabled={answersDisabled || hintsRemaining <= 0}>
      Hint ({hintsRemaining})
    </button>
  </div>

  <!-- Combo indicator -->
  {#if comboCount > 0}
    <div class="combo-indicator">Combo x{comboCount}</div>
  {/if}
</div>

<style>
  .card-expanded {
    position: absolute;
    bottom: 120px;
    left: 50%;
    transform: translateX(-50%);
    width: 300px;
    background: #1A2332;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
    z-index: 20;
    animation: slide-up 200ms ease-out;
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(40px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    height: 32px;
    box-sizing: border-box;
  }

  .header-domain {
    font-size: 14px;
    font-weight: 600;
    color: white;
  }

  .header-icon {
    font-size: 16px;
  }

  .card-effect-desc {
    padding: 4px 12px;
    font-size: 13px;
    color: #BDC3C7;
    text-align: center;
    height: 24px;
    line-height: 24px;
  }

  .card-question {
    padding: 8px 12px;
    font-size: 16px;
    color: #ECF0F1;
    line-height: 1.4;
    max-height: 67px; /* ~3 lines */
    overflow: hidden;
    text-align: center;
  }

  .card-answers {
    padding: 4px 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .answer-btn {
    width: 100%;
    height: 56px;
    background: #2C3E50;
    border: 1px solid #34495E;
    border-radius: 8px;
    color: #ECF0F1;
    font-size: 16px;
    text-align: left;
    padding: 0 16px;
    cursor: pointer;
    transition: background 200ms ease, border-color 200ms ease;
    -webkit-tap-highlight-color: transparent;
    font-family: inherit;
  }

  .answer-btn:active:not(:disabled) {
    background: #34495E;
  }

  .answer-btn:disabled {
    cursor: default;
  }

  .answer-correct {
    background: #27AE60 !important;
    border-color: #27AE60 !important;
  }

  .answer-wrong {
    background: #7F8C8D !important;
    border-color: #7F8C8D !important;
  }

  .answer-reveal-correct {
    background: #3498DB !important;
    border-color: #3498DB !important;
  }

  .speed-bonus-badge {
    text-align: center;
    color: #F1C40F;
    font-size: 14px;
    font-weight: 700;
    padding: 4px 0;
    animation: pulse-badge 500ms ease-out;
  }

  @keyframes pulse-badge {
    0% { transform: scale(0.8); opacity: 0; }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); opacity: 1; }
  }

  .timer-bar-container {
    height: 8px;
    background: #2C3E50;
    margin: 0 12px;
    border-radius: 4px;
    overflow: hidden;
  }

  .timer-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 100ms linear;
  }

  .action-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    height: 48px;
    box-sizing: border-box;
  }

  .action-btn {
    background: transparent;
    border: 1px solid #4A6274;
    border-radius: 6px;
    color: #BDC3C7;
    font-size: 13px;
    padding: 4px 16px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    font-family: inherit;
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .action-btn:active:not(:disabled) {
    background: rgba(255, 255, 255, 0.05);
  }

  .combo-indicator {
    position: absolute;
    top: -8px;
    right: 12px;
    background: #F39C12;
    color: #1A2332;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 10px;
  }
</style>

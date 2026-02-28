<script lang="ts">
  import type { Fact } from '../../data/types'
  import { BALANCE } from '../../data/balance'

  interface Props {
    fact: Fact
    choices: string[]
    mode: 'gate' | 'study'
    onAnswer: (correct: boolean) => void
    onClose: () => void
  }

  const totalAttempts = BALANCE.QUIZ_GATE_MAX_FAILURES + 1

  let { fact, choices, mode, onAnswer, onClose }: Props = $props()

  let selectedAnswer = $state<string | null>(null)
  let isCorrect = $state<boolean | null>(null)
  let attemptsRemaining = $state<number>(totalAttempts)
  let showResult = $state<boolean>(false)

  const resultText = $derived(() => {
    if (!showResult || isCorrect === null) return ''
    return isCorrect ? 'Correct!' : 'Wrong!'
  })

  const resultClass = $derived(() => {
    if (!showResult || isCorrect === null) return ''
    return isCorrect ? 'result-correct' : 'result-wrong'
  })

  $effect(() => {
    fact.id
    mode
    selectedAnswer = null
    isCorrect = null
    showResult = false
    attemptsRemaining = totalAttempts
  })

  async function handleAnswer(answer: string): Promise<void> {
    if (showResult) return

    selectedAnswer = answer
    isCorrect = answer === fact.correctAnswer
    showResult = true

    if (!isCorrect && mode === 'gate') {
      attemptsRemaining = Math.max(0, attemptsRemaining - 1)
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 1000)
    })

    if (isCorrect) {
      onAnswer(true)
      return
    }

    if (mode === 'gate' && attemptsRemaining === 0) {
      onAnswer(false)
      return
    }

    selectedAnswer = null
    isCorrect = null
    showResult = false
  }

  function getChoiceClass(choice: string): string {
    if (!showResult || selectedAnswer !== choice || isCorrect === null) {
      return ''
    }

    return isCorrect ? 'choice-correct' : 'choice-wrong'
  }
</script>

<div class="quiz-overlay" role="dialog" aria-modal="true" aria-label="Quiz">
  <div class="quiz-card">
    <button class="close-button" type="button" onclick={onClose} aria-label="Close quiz">
      x
    </button>

    <p class="question">{fact.quizQuestion}</p>

    {#if mode === 'gate'}
      <p class="attempts">Attempts: {attemptsRemaining}/{totalAttempts}</p>
    {/if}

    <div class="choices">
      {#each choices as choice}
        <button
          class={`choice-button ${getChoiceClass(choice)}`}
          type="button"
          disabled={showResult}
          onclick={() => void handleAnswer(choice)}
        >
          {choice}
        </button>
      {/each}
    </div>

    {#if showResult}
      <p class={`result-text ${resultClass}`}>{resultText}</p>
    {/if}
  </div>
</div>

<style>
  .quiz-overlay {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.85);
    font-family: 'Courier New', monospace;
  }

  .quiz-card {
    position: relative;
    width: min(100%, 36rem);
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    border: 2px solid var(--color-primary);
    border-radius: 16px;
    padding: 1.25rem;
    background: var(--color-surface);
    color: var(--color-text);
  }

  .close-button {
    position: absolute;
    top: 0.6rem;
    right: 0.6rem;
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--color-text-dim);
    border-radius: 999px;
    background: transparent;
    color: var(--color-text-dim);
    font: inherit;
    cursor: pointer;
  }

  .question {
    margin-top: 0.5rem;
    color: var(--color-warning);
    font-size: 1.1rem;
    line-height: 1.4;
    text-align: center;
  }

  .attempts {
    color: var(--color-text-dim);
    font-size: 0.95rem;
    text-align: center;
  }

  .choices {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .choice-button {
    min-height: 48px;
    border: 2px solid var(--color-primary);
    border-radius: 999px;
    padding: 0.75rem 1rem;
    background: var(--color-bg);
    color: var(--color-text);
    font: inherit;
    font-size: 1rem;
    text-align: center;
    cursor: pointer;
    transition: transform 120ms ease, border-color 120ms ease, background-color 120ms ease;
  }

  .choice-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .choice-button:disabled {
    opacity: 0.95;
    cursor: default;
  }

  .choice-correct {
    border-color: var(--color-success);
    background: #4ecca3;
    color: #10221b;
  }

  .choice-wrong {
    border-color: var(--color-accent);
    background: #e94560;
    color: #fff;
  }

  .result-text {
    min-height: 1.4rem;
    font-size: 1rem;
    text-align: center;
    font-weight: 700;
  }

  .result-correct {
    color: var(--color-success);
  }

  .result-wrong {
    color: var(--color-accent);
  }
</style>

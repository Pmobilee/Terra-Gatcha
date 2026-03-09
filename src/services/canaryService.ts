export type CanaryMode = 'neutral' | 'assist' | 'challenge'

export interface CanaryState {
  wrongAnswersThisFloor: number
  correctStreak: number
  mode: CanaryMode
  enemyDamageMultiplier: number
  questionBias: -1 | 0 | 1
}

function deriveMode(wrongAnswersThisFloor: number, correctStreak: number): CanaryState {
  if (correctStreak >= 5) {
    return {
      wrongAnswersThisFloor,
      correctStreak,
      mode: 'challenge',
      enemyDamageMultiplier: 1.1,
      questionBias: 1,
    }
  }

  if (wrongAnswersThisFloor >= 3) {
    return {
      wrongAnswersThisFloor,
      correctStreak,
      mode: 'assist',
      enemyDamageMultiplier: 0.85,
      questionBias: -1,
    }
  }

  return {
    wrongAnswersThisFloor,
    correctStreak,
    mode: 'neutral',
    enemyDamageMultiplier: 1,
    questionBias: 0,
  }
}

export function createCanaryState(): CanaryState {
  return deriveMode(0, 0)
}

export function recordCanaryAnswer(state: CanaryState, correct: boolean): CanaryState {
  const nextWrong = correct ? state.wrongAnswersThisFloor : state.wrongAnswersThisFloor + 1
  const nextStreak = correct ? state.correctStreak + 1 : 0
  return deriveMode(nextWrong, nextStreak)
}

export function resetCanaryFloor(state: CanaryState): CanaryState {
  return deriveMode(0, state.correctStreak)
}

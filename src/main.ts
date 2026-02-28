import './app.css'
import App from './App.svelte'
import { mount } from 'svelte'
import { GameManager } from './game/GameManager'
import { addLearnedFact, initPlayer, playerSave } from './ui/stores/playerData'
import { currentScreen } from './ui/stores/gameState'
import { get } from 'svelte/store'
import { BALANCE } from './data/balance'
import type { Fact } from './data/types'

// Import seed vocabulary data (Vite JSON import)
import vocabData from './data/seed/vocab-n3.json'

// Mount Svelte UI overlay
const app = mount(App, {
  target: document.getElementById('app')!,
})

// Initialize player save data
const save = initPlayer('teen')

// Ensure oxygen tanks are available (replenish if 0)
if (save.oxygen <= 0) {
  playerSave.update(s => {
    if (!s) return s
    return { ...s, oxygen: BALANCE.STARTING_OXYGEN_TANKS }
  })
}

// Seed 5 starting facts if player has none learned yet
if (save.learnedFacts.length === 0) {
  const starterFacts = (vocabData as Fact[]).slice(0, 5)
  for (const fact of starterFacts) {
    addLearnedFact(fact.id)
  }
}

// Initialize game manager and load facts
const gameManager = GameManager.getInstance()
gameManager.setFacts(vocabData as Fact[])

// Boot Phaser engine
gameManager.boot()

// When Phaser finishes booting, navigate to base screen
const game = gameManager.getGame()
if (game) {
  game.events.on('boot-complete', () => {
    currentScreen.set('base')
  })
}

export default app

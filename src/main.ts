import './app.css'
import App from './App.svelte'
import { mount } from 'svelte'
import { GameManager } from './game/GameManager'
import { initPlayer } from './ui/stores/playerData'
import { currentScreen } from './ui/stores/gameState'
import type { Fact } from './data/types'

// Import seed vocabulary data (Vite JSON import)
import vocabData from './data/seed/vocab-n3.json'

// Mount Svelte UI overlay
const app = mount(App, {
  target: document.getElementById('app')!,
})

// Initialize player save data
initPlayer('teen')

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

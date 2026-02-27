import './app.css'
import App from './App.svelte'
import { mount } from 'svelte'
import { GameManager } from './game/GameManager'

// Mount Svelte UI overlay
const app = mount(App, {
  target: document.getElementById('app')!,
})

// Initialize Phaser game after DOM is ready
const gameManager = GameManager.getInstance()
gameManager.boot()

export default app

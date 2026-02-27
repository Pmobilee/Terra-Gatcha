import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { MainScene } from './scenes/MainScene'

/**
 * Singleton manager for the Phaser game instance.
 * Handles game creation, configuration, and lifecycle.
 */
export class GameManager {
  private static instance: GameManager
  private game: Phaser.Game | null = null

  private constructor() {}

  static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager()
    }
    return GameManager.instance
  }

  /** Boot the Phaser game engine and attach to DOM */
  boot(): void {
    if (this.game) {
      console.warn('GameManager: game already booted')
      return
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: 'game-container',
      width: window.innerWidth,
      height: window.innerHeight,
      pixelArt: true,
      roundPixels: true,
      antialias: false,
      backgroundColor: '#1a1a2e',
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [BootScene, MainScene],
      input: {
        activePointers: 3, // Support multi-touch
      },
    }

    this.game = new Phaser.Game(config)
  }

  /** Get the Phaser game instance */
  getGame(): Phaser.Game | null {
    return this.game
  }

  /** Destroy the game instance (cleanup) */
  destroy(): void {
    if (this.game) {
      this.game.destroy(true)
      this.game = null
    }
  }
}

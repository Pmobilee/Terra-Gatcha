import Phaser from 'phaser'

/**
 * BootScene: First scene loaded. Handles asset preloading
 * and displays a loading indicator.
 *
 * After loading completes, it sleeps — the GameManager handles
 * screen transitions, and MineScene is started on demand.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload(): void {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    const progressBar = this.add.graphics()
    const progressBox = this.add.graphics()
    progressBox.fillStyle(0x16213e, 0.8)
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50)

    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      fontFamily: 'Courier New',
      fontSize: '18px',
      color: '#e94560',
    })
    loadingText.setOrigin(0.5, 0.5)

    this.load.on('progress', (value: number) => {
      progressBar.clear()
      progressBar.fillStyle(0xe94560, 1)
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30)
    })

    this.load.on('complete', () => {
      progressBar.destroy()
      progressBox.destroy()
      loadingText.destroy()
    })

    // Future: load sprite assets here
    // this.load.image('player', 'assets/sprites/characters/miner_idle.png')
    // this.load.image('tiles', 'assets/tilesets/underground.png')
  }

  create(): void {
    // Emit boot-complete so main.ts can transition to base screen
    this.game.events.emit('boot-complete')

    // Scene sleeps — MineScene will be started on demand by GameManager
    this.scene.sleep()
  }
}

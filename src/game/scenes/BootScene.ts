import Phaser from 'phaser'

/**
 * BootScene: First scene loaded. Handles asset preloading
 * and displays a loading indicator.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload(): void {
    // Create a simple loading bar
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

    // Placeholder: load game assets here as they're created
    // this.load.image('player', 'assets/sprites/player.png')
    // this.load.image('tiles', 'assets/tilesets/underground.png')
  }

  create(): void {
    this.scene.start('MainScene')
  }
}

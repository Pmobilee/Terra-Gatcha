import Phaser from 'phaser'

/**
 * BootScene: First scene loaded. Previously handled asset preloading,
 * now sprite loading is deferred to MineScene for faster initial boot.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  create(): void {
    // Emit boot-complete so main.ts can transition to base screen
    this.game.events.emit('boot-complete')

    // Scene sleeps — MineScene will be started on demand by GameManager
    this.scene.sleep()
  }
}

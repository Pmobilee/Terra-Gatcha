import Phaser from 'phaser'

/**
 * BootScene: First scene loaded. Previously handled asset preloading,
 * now sprite loading is deferred to MineScene for faster initial boot.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload(): void {
    this.load.image('bg-combat', 'assets/backgrounds/combat/bg_combat_dungeon.png')

    this.load.image('player-idle', 'assets/sprites/player/player_idle.png')
    this.load.image('player-attack', 'assets/sprites/player/player_attack.png')
    this.load.image('player-shield', 'assets/sprites/player/player_shield.png')
    this.load.image('player-heal', 'assets/sprites/player/player_heal.png')
    this.load.image('player-hit', 'assets/sprites/player/player_hit.png')
    this.load.image('player-victory', 'assets/sprites/player/player_victory.png')
    this.load.image('player-death', 'assets/sprites/player/player_death.png')

    this.load.image('enemy-cave_bat-idle', 'assets/sprites/enemies/cave_bat_idle.png')
    this.load.image('enemy-cave_bat-hit', 'assets/sprites/enemies/cave_bat_hit.png')
    this.load.image('enemy-cave_bat-death', 'assets/sprites/enemies/cave_bat_death.png')

    this.load.image('enemy-crystal_golem-idle', 'assets/sprites/enemies/crystal_golem_idle.png')
    this.load.image('enemy-crystal_golem-hit', 'assets/sprites/enemies/crystal_golem_hit.png')
    this.load.image('enemy-crystal_golem-death', 'assets/sprites/enemies/crystal_golem_death.png')

    this.load.image('enemy-the_excavator-idle', 'assets/sprites/enemies/the_excavator_idle.png')
    this.load.image('enemy-the_excavator-hit', 'assets/sprites/enemies/the_excavator_hit.png')
    this.load.image('enemy-the_excavator-death', 'assets/sprites/enemies/the_excavator_death.png')
  }

  create(): void {
    // Emit boot-complete so main.ts can transition to base screen
    this.game.events.emit('boot-complete')

    // Scene sleeps — MineScene will be started on demand by GameManager
    this.scene.sleep()
  }
}

import Phaser from 'phaser'
import { BALANCE } from '../../data/balance'
import { BlockType, type InventorySlot, type MineCell } from '../../data/types'
import { Player } from '../entities/Player'
import { canMine, mineBlock } from '../systems/MiningSystem'
import { generateMine, revealAround } from '../systems/MineGenerator'
import {
  addOxygen,
  consumeOxygen,
  createOxygenState,
  getOxygenCostForBlock,
  type OxygenState,
} from '../systems/OxygenSystem'

const TILE_SIZE = BALANCE.TILE_SIZE

const BLOCK_COLORS: Record<BlockType, number> = {
  [BlockType.Empty]: 0x1a1a2e,
  [BlockType.Dirt]: 0x5c4033,
  [BlockType.SoftRock]: 0x7a6652,
  [BlockType.Stone]: 0x6b6b6b,
  [BlockType.HardRock]: 0x4a4a4a,
  [BlockType.MineralNode]: 0x4ecca3,
  [BlockType.ArtifactNode]: 0xe94560,
  [BlockType.OxygenCache]: 0x5dade2,
  [BlockType.QuizGate]: 0xffd369,
  [BlockType.UpgradeCrate]: 0xb8860b,
  [BlockType.Unbreakable]: 0x2c2c2c,
}

export interface MineSceneData {
  seed: number
  oxygenTanks: number
  inventorySlots: number
  facts: string[]
}

export class MineScene extends Phaser.Scene {
  private seed = 0
  private oxygenTanks: number = BALANCE.STARTING_OXYGEN_TANKS
  private grid: MineCell[][] = []
  private player!: Player
  private oxygenState!: OxygenState
  private inventory: InventorySlot[] = []
  private inventorySlots: number = BALANCE.STARTING_INVENTORY_SLOTS
  private tileGraphics!: Phaser.GameObjects.Graphics
  private fogGraphics!: Phaser.GameObjects.Graphics
  private playerGraphics!: Phaser.GameObjects.Graphics
  private cameraTarget!: Phaser.GameObjects.Zone
  private facts: string[] = []
  private blocksMinedThisRun = 0
  private artifactsFound: string[] = []
  private gridWidth = 0
  private gridHeight = 0
  private isPaused = false

  constructor() {
    super({ key: 'MineScene' })
  }

  /**
   * Initializes the run state from scene data.
   */
  init(data: Partial<MineSceneData> = {}): void {
    this.seed = data.seed ?? (Date.now() >>> 0)
    this.oxygenTanks = data.oxygenTanks ?? BALANCE.STARTING_OXYGEN_TANKS
    this.inventorySlots = data.inventorySlots ?? BALANCE.STARTING_INVENTORY_SLOTS
    this.facts = data.facts ?? []
    this.blocksMinedThisRun = 0
    this.artifactsFound = []
    this.isPaused = false
  }

  /**
   * Creates mine state, camera, rendering layers, and input handlers.
   */
  create(): void {
    this.grid = generateMine(this.seed, BALANCE.MINE_WIDTH, BALANCE.MINE_LAYER_HEIGHT, this.facts)
    this.gridHeight = this.grid.length
    this.gridWidth = this.gridHeight > 0 ? this.grid[0].length : 0
    this.oxygenState = createOxygenState(this.oxygenTanks)
    this.inventory = Array.from({ length: this.inventorySlots }, () => ({ type: 'empty' as const }))

    const startX = Math.floor(this.gridWidth / 2)
    this.player = new Player(startX, 1)

    this.tileGraphics = this.add.graphics()
    this.fogGraphics = this.add.graphics()
    this.playerGraphics = this.add.graphics()
    this.cameraTarget = this.add.zone(startX * TILE_SIZE + TILE_SIZE * 0.5, TILE_SIZE + TILE_SIZE * 0.5, 1, 1)

    const worldWidth = this.gridWidth * TILE_SIZE
    const worldHeight = this.gridHeight * TILE_SIZE
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight)
    this.cameras.main.startFollow(this.cameraTarget, true, 0.2, 0.2)

    this.redrawAll()
    revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
    this.redrawAll()

    this.input.on('pointerdown', this.handlePointerDown, this)

    this.game.events.emit('mine-started', {
      seed: this.seed,
      oxygen: this.oxygenState,
      inventorySlots: this.inventorySlots,
    })
  }

  private redrawAll(): void {
    this.updateCameraTarget()
    this.drawTiles()
    this.drawPlayer()
    this.drawFog()
  }

  private updateCameraTarget(): void {
    this.cameraTarget.setPosition(
      this.player.gridX * TILE_SIZE + TILE_SIZE * 0.5,
      this.player.gridY * TILE_SIZE + TILE_SIZE * 0.5,
    )
  }

  private drawTiles(): void {
    this.tileGraphics.clear()

    const camera = this.cameras.main
    const startX = Math.max(0, Math.floor(camera.worldView.x / TILE_SIZE) - 1)
    const endX = Math.min(this.gridWidth - 1, Math.ceil((camera.worldView.x + camera.worldView.width) / TILE_SIZE) + 1)
    const startY = Math.max(0, Math.floor(camera.worldView.y / TILE_SIZE) - 1)
    const endY = Math.min(this.gridHeight - 1, Math.ceil((camera.worldView.y + camera.worldView.height) / TILE_SIZE) + 1)

    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        const cell = this.grid[y][x]
        const px = x * TILE_SIZE
        const py = y * TILE_SIZE

        if (!cell.revealed) {
          this.tileGraphics.fillStyle(0x111111, 1)
          this.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
          continue
        }

        const color = BLOCK_COLORS[cell.type] ?? 0x111111
        this.tileGraphics.fillStyle(color, 1)
        this.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)

        if (cell.type !== BlockType.Empty) {
          this.tileGraphics.lineStyle(1, 0x111111, 0.7)
          this.tileGraphics.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1)
        }

        if (cell.maxHardness > 0 && cell.hardness > 0 && cell.hardness < cell.maxHardness) {
          const crackAlpha = 0.3 + (1 - cell.hardness / cell.maxHardness) * 0.5
          this.tileGraphics.lineStyle(1, 0x000000, crackAlpha)
          this.tileGraphics.lineBetween(px + 4, py + 4, px + TILE_SIZE - 4, py + TILE_SIZE - 4)
          this.tileGraphics.lineBetween(px + TILE_SIZE - 4, py + 4, px + 4, py + TILE_SIZE - 4)
        }
      }
    }
  }

  private drawPlayer(): void {
    this.playerGraphics.clear()

    const px = this.player.gridX * TILE_SIZE
    const py = this.player.gridY * TILE_SIZE

    this.playerGraphics.fillStyle(0x00ff88, 0.25)
    this.playerGraphics.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)

    this.playerGraphics.fillStyle(0x00ff88, 1)
    this.playerGraphics.fillRect(px + 6, py + 6, TILE_SIZE - 12, TILE_SIZE - 12)

    this.playerGraphics.lineStyle(2, 0x7dffca, 0.95)
    this.playerGraphics.strokeRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8)
  }

  private drawFog(): void {
    this.fogGraphics.clear()

    const camera = this.cameras.main
    const startX = Math.max(0, Math.floor(camera.worldView.x / TILE_SIZE) - 1)
    const endX = Math.min(this.gridWidth - 1, Math.ceil((camera.worldView.x + camera.worldView.width) / TILE_SIZE) + 1)
    const startY = Math.max(0, Math.floor(camera.worldView.y / TILE_SIZE) - 1)
    const endY = Math.min(this.gridHeight - 1, Math.ceil((camera.worldView.y + camera.worldView.height) / TILE_SIZE) + 1)

    this.fogGraphics.fillStyle(0x000000, 0.45)
    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        if (!this.grid[y][x].revealed) {
          this.fogGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        }
      }
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.isPaused) {
      return
    }

    const camera = this.cameras.main
    const worldX = pointer.x + camera.scrollX
    const worldY = pointer.y + camera.scrollY
    const targetX = Math.floor(worldX / TILE_SIZE)
    const targetY = Math.floor(worldY / TILE_SIZE)

    if (targetX < 0 || targetY < 0 || targetX >= this.gridWidth || targetY >= this.gridHeight) {
      return
    }

    const playerX = this.player.gridX
    const playerY = this.player.gridY

    if (targetX === playerX && targetY === playerY) {
      this.game.events.emit('open-backpack')
      return
    }

    if (Math.abs(targetX - playerX) + Math.abs(targetY - playerY) !== 1) {
      return
    }

    const targetCell = this.grid[targetY][targetX]

    if (targetCell.type === BlockType.Empty) {
      const moved = this.player.moveToEmpty(targetX, targetY, this.grid)
      if (!moved) {
        return
      }

      const moveCostResult = consumeOxygen(this.oxygenState, BALANCE.OXYGEN_COST_MOVE)
      this.oxygenState = moveCostResult.state
      revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)

      this.game.events.emit('oxygen-changed', this.oxygenState)
      this.game.events.emit('depth-changed', this.player.gridY)
      if (moveCostResult.depleted) {
        this.game.events.emit('oxygen-depleted')
      }

      this.redrawAll()
      return
    }

    if (!canMine(this.grid, targetX, targetY, playerX, playerY)) {
      return
    }

    const blockType = targetCell.type
    const oxygenCost = getOxygenCostForBlock(blockType)
    const oxygenResult = consumeOxygen(this.oxygenState, oxygenCost)
    this.oxygenState = oxygenResult.state

    if (oxygenResult.depleted) {
      this.game.events.emit('oxygen-changed', this.oxygenState)
      this.game.events.emit('oxygen-depleted')
      this.redrawAll()
      return
    }

    const mineResult = mineBlock(this.grid, targetX, targetY)
    if (mineResult.success) {
      this.blocksMinedThisRun += 1
    }

    if (mineResult.destroyed) {
      switch (blockType) {
        case BlockType.MineralNode: {
          const mineralSlot: InventorySlot = {
            type: 'mineral',
            mineralTier: mineResult.content?.mineralType,
            mineralAmount: mineResult.content?.mineralAmount,
          }
          const added = this.addToInventory(mineralSlot)
          this.game.events.emit('mineral-collected', {
            ...mineResult.content,
            addedToInventory: added,
          })
          break
        }
        case BlockType.ArtifactNode: {
          const artifactSlot: InventorySlot = {
            type: 'artifact',
            artifactRarity: mineResult.content?.artifactRarity,
            factId: mineResult.content?.factId,
          }
          const added = this.addToInventory(artifactSlot)
          if (mineResult.content?.factId) {
            this.artifactsFound.push(mineResult.content.factId)
          }
          this.game.events.emit('artifact-found', {
            factId: mineResult.content?.factId,
            rarity: mineResult.content?.artifactRarity,
            addedToInventory: added,
          })
          break
        }
        case BlockType.OxygenCache: {
          const oxygenAmount = mineResult.content?.oxygenAmount ?? BALANCE.OXYGEN_CACHE_RESTORE
          this.oxygenState = addOxygen(this.oxygenState, oxygenAmount)
          this.game.events.emit('oxygen-restored', {
            amount: oxygenAmount,
            state: this.oxygenState,
          })
          break
        }
        case BlockType.QuizGate:
          this.isPaused = true
          this.game.events.emit('quiz-gate', {
            factId: mineResult.content?.factId,
          })
          break
        case BlockType.UpgradeCrate:
          this.game.events.emit('upgrade-found')
          break
        default:
          break
      }
    }

    revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
    this.game.events.emit('oxygen-changed', this.oxygenState)
    this.game.events.emit('depth-changed', this.player.gridY)
    this.redrawAll()
  }

  /**
   * Resumes mining input after a quiz gate result.
   */
  public resumeFromQuiz(passed: boolean): void {
    this.isPaused = false

    if (!passed) {
      const oxygenResult = consumeOxygen(this.oxygenState, BALANCE.QUIZ_GATE_FAILURE_OXYGEN_COST)
      this.oxygenState = oxygenResult.state
      this.game.events.emit('oxygen-changed', this.oxygenState)

      if (oxygenResult.depleted) {
        this.game.events.emit('oxygen-depleted')
      }
    }

    this.redrawAll()
  }

  /**
   * Ends the active run and returns run results for processing.
   */
  public surfaceRun(): { inventory: InventorySlot[]; blocksMinedThisRun: number; artifactsFound: string[] } {
    const runResults = {
      inventory: this.inventory.map((slot) => ({ ...slot })),
      blocksMinedThisRun: this.blocksMinedThisRun,
      artifactsFound: [...this.artifactsFound],
    }

    this.game.events.emit('run-complete', runResults)
    return runResults
  }

  private addToInventory(slot: InventorySlot): boolean {
    const emptyIndex = this.inventory.findIndex((inventorySlot) => inventorySlot.type === 'empty')
    if (emptyIndex === -1) {
      return false
    }

    this.inventory[emptyIndex] = slot
    return true
  }
}

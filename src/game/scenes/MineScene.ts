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
  private breakEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private cameraTarget!: Phaser.GameObjects.Zone
  private flashTiles = new Map<string, number>()
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
    this.flashTiles.clear()
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

    // Start in center area of mine (middle third vertically)
    const minStartY = Math.floor(this.gridHeight * 0.4)
    const maxStartY = Math.floor(this.gridHeight * 0.6)
    const startY = Math.floor(Math.random() * (maxStartY - minStartY + 1)) + minStartY

    // Start in center horizontally with some randomness
    const centerX = Math.floor(this.gridWidth / 2)
    const startX = centerX + Math.floor(Math.random() * 5) - 2

    this.player = new Player(startX, startY)

    // Ensure starting area is empty (3x3 around player)
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const x = startX + dx
        const y = startY + dy
        if (y >= 0 && y < this.gridHeight && x >= 0 && x < this.gridWidth) {
          this.grid[y][x] = {
            type: BlockType.Empty,
            hardness: 0,
            maxHardness: 0,
            revealed: false,
          }
        }
      }
    }

    this.tileGraphics = this.add.graphics()
    this.fogGraphics = this.add.graphics()
    this.playerGraphics = this.add.graphics()

    const particleTextureKey = 'break-particle'
    if (!this.textures.exists(particleTextureKey)) {
      const particleGraphics = this.make.graphics({ x: 0, y: 0 })
      particleGraphics.fillStyle(0xffffff, 1)
      particleGraphics.fillRect(0, 0, 4, 4)
      particleGraphics.generateTexture(particleTextureKey, 4, 4)
      particleGraphics.destroy()
    }

    this.breakEmitter = this.add.particles(0, 0, particleTextureKey, {
      speed: { min: 30, max: 80 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      lifespan: 400,
      quantity: 6,
      emitting: false,
    })

    this.cameraTarget = this.add.zone(
      startX * TILE_SIZE + TILE_SIZE * 0.5,
      startY * TILE_SIZE + TILE_SIZE * 0.5,
      1,
      1,
    )

    const worldWidth = this.gridWidth * TILE_SIZE
    const worldHeight = this.gridHeight * TILE_SIZE
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight)

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

  /**
   * Phaser update loop — redraws the visible mine each frame.
   */
  update(): void {
    this.redrawAll()
  }

  private redrawAll(): void {
    this.updateCameraTarget()
    this.drawTiles()
    this.drawPlayer()
    this.drawFog()
  }

  private updateCameraTarget(): void {
    const targetX = this.player.gridX * TILE_SIZE + TILE_SIZE * 0.5
    const targetY = this.player.gridY * TILE_SIZE + TILE_SIZE * 0.5

    this.cameraTarget.setPosition(targetX, targetY)

    const cam = this.cameras.main
    const desiredX = targetX - cam.width / 2
    const desiredY = targetY - cam.height / 2
    const lerp = 0.15

    cam.scrollX += (desiredX - cam.scrollX) * lerp
    cam.scrollY += (desiredY - cam.scrollY) * lerp
  }

  private shiftColor(color: number, amount: number): number {
    const r = Phaser.Math.Clamp(((color >> 16) & 0xff) + amount, 0, 255)
    const g = Phaser.Math.Clamp(((color >> 8) & 0xff) + amount, 0, 255)
    const b = Phaser.Math.Clamp((color & 0xff) + amount, 0, 255)
    return (r << 16) | (g << 8) | b
  }

  private seededModulo(tileX: number, tileY: number, salt: number, modulo: number): number {
    const rawSeed = tileX * 31 + tileY * 17 + salt * 13
    const positiveSeed = ((rawSeed % 7919) + 7919) % 7919
    return positiveSeed % modulo
  }

  private drawBlockPattern(cell: MineCell, tileX: number, tileY: number, px: number, py: number): void {
    const baseColor = BLOCK_COLORS[cell.type] ?? 0x111111
    const darkerColor = this.shiftColor(baseColor, -26)
    const lighterColor = this.shiftColor(baseColor, 30)
    const centerX = px + TILE_SIZE * 0.5
    const centerY = py + TILE_SIZE * 0.5

    switch (cell.type) {
      case BlockType.Dirt: {
        const dotCount = 3 + this.seededModulo(tileX, tileY, 1, 2)
        this.tileGraphics.fillStyle(darkerColor, 0.85)
        for (let i = 0; i < dotCount; i += 1) {
          const offsetX = 2 + this.seededModulo(tileX, tileY, 10 + i, Math.max(1, TILE_SIZE - 4))
          const offsetY = 2 + this.seededModulo(tileX, tileY, 20 + i, Math.max(1, TILE_SIZE - 4))
          this.tileGraphics.fillRect(px + offsetX, py + offsetY, 2, 2)
        }
        break
      }
      case BlockType.SoftRock: {
        const lineOffset = this.seededModulo(tileX, tileY, 2, 3) - 1
        this.tileGraphics.lineStyle(2, lighterColor, 0.55)
        this.tileGraphics.lineBetween(
          px + 3,
          py + TILE_SIZE * 0.5 + lineOffset,
          px + TILE_SIZE - 3,
          py + TILE_SIZE * 0.5 + lineOffset,
        )
        break
      }
      case BlockType.Stone: {
        this.tileGraphics.lineStyle(1, lighterColor, 0.45)
        this.tileGraphics.lineBetween(px + 3, py + TILE_SIZE - 4, px + TILE_SIZE - 5, py + 4)
        this.tileGraphics.lineBetween(px + 7, py + TILE_SIZE - 3, px + TILE_SIZE - 2, py + 6)
        break
      }
      case BlockType.HardRock: {
        this.tileGraphics.lineStyle(1, lighterColor, 0.35)
        for (let i = -2; i <= TILE_SIZE + 2; i += 5) {
          this.tileGraphics.lineBetween(px + i, py + 1, px + i + 8, py + TILE_SIZE - 1)
          this.tileGraphics.lineBetween(px + i + 8, py + 1, px + i, py + TILE_SIZE - 1)
        }
        break
      }
      case BlockType.MineralNode: {
        const pulse = (Math.sin(this.time.now * 0.003 + this.seededModulo(tileX, tileY, 3, 32)) + 1) * 0.5
        this.tileGraphics.fillStyle(lighterColor, 0.16 + pulse * 0.24)
        this.tileGraphics.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
        this.tileGraphics.lineStyle(2, this.shiftColor(baseColor, 46), 0.35 + pulse * 0.35)
        this.tileGraphics.strokeRect(px + 1.5, py + 1.5, TILE_SIZE - 3, TILE_SIZE - 3)
        break
      }
      case BlockType.ArtifactNode: {
        const rotation = this.time.now * 0.004 + this.seededModulo(tileX, tileY, 4, 360) * (Math.PI / 180)
        const radius = TILE_SIZE * 0.28
        const dx = Math.cos(rotation) * radius
        const dy = Math.sin(rotation) * radius
        this.tileGraphics.lineStyle(2, 0xffffff, 0.32)
        this.tileGraphics.lineBetween(centerX - dx, centerY - dy, centerX + dx, centerY + dy)
        this.tileGraphics.fillStyle(0xffffff, 0.18)
        this.tileGraphics.fillCircle(centerX + dx * 0.25, centerY + dy * 0.25, 2)
        break
      }
      case BlockType.OxygenCache: {
        const bubbleCount = 3 + this.seededModulo(tileX, tileY, 5, 2)
        this.tileGraphics.fillStyle(this.shiftColor(baseColor, 36), 0.5)
        for (let i = 0; i < bubbleCount; i += 1) {
          const bubbleX = 4 + this.seededModulo(tileX, tileY, 30 + i, Math.max(1, TILE_SIZE - 8))
          const bubbleY = 4 + this.seededModulo(tileX, tileY, 40 + i, Math.max(1, TILE_SIZE - 8))
          const radius = 1 + this.seededModulo(tileX, tileY, 50 + i, 2)
          this.tileGraphics.fillCircle(px + bubbleX, py + bubbleY, radius)
        }
        break
      }
      case BlockType.UpgradeCrate: {
        this.tileGraphics.lineStyle(2, this.shiftColor(baseColor, 34), 0.6)
        this.tileGraphics.strokeRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8)
        this.tileGraphics.lineBetween(px + 4, py + TILE_SIZE * 0.5, px + TILE_SIZE - 4, py + TILE_SIZE * 0.5)
        this.tileGraphics.lineBetween(px + TILE_SIZE * 0.5, py + 4, px + TILE_SIZE * 0.5, py + TILE_SIZE - 4)
        break
      }
      case BlockType.QuizGate: {
        this.tileGraphics.lineStyle(2, darkerColor, 0.9)
        this.tileGraphics.lineBetween(px + 6, py + 7, px + TILE_SIZE * 0.5, py + 4)
        this.tileGraphics.lineBetween(px + TILE_SIZE * 0.5, py + 4, px + TILE_SIZE - 6, py + 8)
        this.tileGraphics.lineBetween(px + TILE_SIZE - 6, py + 8, px + TILE_SIZE * 0.5, py + 12)
        this.tileGraphics.lineBetween(px + TILE_SIZE * 0.5, py + 12, px + TILE_SIZE * 0.5, py + 15)
        this.tileGraphics.fillStyle(darkerColor, 0.9)
        this.tileGraphics.fillCircle(centerX, py + TILE_SIZE - 5, 1.8)
        break
      }
      case BlockType.Unbreakable: {
        this.tileGraphics.lineStyle(1, this.shiftColor(baseColor, 36), 0.5)
        for (let i = -4; i <= TILE_SIZE + 4; i += 4) {
          this.tileGraphics.lineBetween(px + i, py + 1, px + i + 10, py + TILE_SIZE - 1)
        }
        break
      }
      default:
        break
    }
  }

  private drawTiles(): void {
    this.tileGraphics.clear()

    const camera = this.cameras.main
    const viewWidth = camera.worldView.width > 0 ? camera.worldView.width : camera.width
    const viewHeight = camera.worldView.height > 0 ? camera.worldView.height : camera.height
    const viewX = camera.worldView.width > 0 ? camera.worldView.x : camera.scrollX
    const viewY = camera.worldView.height > 0 ? camera.worldView.y : camera.scrollY

    const startX = Math.max(0, Math.floor(viewX / TILE_SIZE) - 1)
    const endX = Math.min(this.gridWidth - 1, Math.ceil((viewX + viewWidth) / TILE_SIZE) + 1)
    const startY = Math.max(0, Math.floor(viewY / TILE_SIZE) - 1)
    const endY = Math.min(this.gridHeight - 1, Math.ceil((viewY + viewHeight) / TILE_SIZE) + 1)

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
          this.drawBlockPattern(cell, x, y, px, py)
          this.tileGraphics.lineStyle(1, 0x111111, 0.7)
          this.tileGraphics.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1)
        }

        if (cell.maxHardness > 0 && cell.hardness > 0 && cell.hardness < cell.maxHardness) {
          const damagePercent = 1 - cell.hardness / cell.maxHardness
          const crackPadding = 4

          if (damagePercent <= 0.33) {
            this.tileGraphics.lineStyle(1, 0x000000, 0.3)
            this.tileGraphics.lineBetween(
              px + crackPadding,
              py + crackPadding,
              px + TILE_SIZE - crackPadding,
              py + TILE_SIZE - crackPadding,
            )
          } else if (damagePercent <= 0.66) {
            this.tileGraphics.lineStyle(1.5, 0x000000, 0.5)
            this.tileGraphics.lineBetween(
              px + crackPadding,
              py + crackPadding,
              px + TILE_SIZE - crackPadding,
              py + TILE_SIZE - crackPadding,
            )
            this.tileGraphics.lineBetween(
              px + TILE_SIZE - crackPadding,
              py + crackPadding,
              px + crackPadding,
              py + TILE_SIZE - crackPadding,
            )
          } else {
            this.tileGraphics.lineStyle(2, 0x662222, 0.7)
            this.tileGraphics.lineBetween(
              px + crackPadding,
              py + crackPadding,
              px + TILE_SIZE - crackPadding,
              py + TILE_SIZE - crackPadding,
            )
            this.tileGraphics.lineBetween(
              px + TILE_SIZE - crackPadding,
              py + crackPadding,
              px + crackPadding,
              py + TILE_SIZE - crackPadding,
            )
            this.tileGraphics.lineBetween(
              px + TILE_SIZE * 0.5,
              py + crackPadding,
              px + TILE_SIZE * 0.45,
              py + TILE_SIZE - crackPadding,
            )
            this.tileGraphics.lineBetween(
              px + crackPadding + 1,
              py + TILE_SIZE * 0.7,
              px + TILE_SIZE - crackPadding - 1,
              py + TILE_SIZE * 0.35,
            )
          }
        }

        const flashKey = `${x},${y}`
        const flashStart = this.flashTiles.get(flashKey)
        if (flashStart !== undefined) {
          const elapsed = this.time.now - flashStart
          if (elapsed < 150) {
            const alpha = 0.45 * (1 - elapsed / 150)
            this.tileGraphics.fillStyle(0xffffff, alpha)
            this.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
          } else {
            this.flashTiles.delete(flashKey)
          }
        }
      }
    }
  }

  private drawPlayer(): void {
    this.playerGraphics.clear()

    const px = this.player.gridX * TILE_SIZE
    const py = this.player.gridY * TILE_SIZE

    const bodyWidth = TILE_SIZE * 0.6
    const bodyHeight = TILE_SIZE * 0.5
    const bodyX = px + (TILE_SIZE - bodyWidth) * 0.5
    const bodyY = py + TILE_SIZE * 0.42

    const headWidth = TILE_SIZE * 0.42
    const headHeight = TILE_SIZE * 0.24
    const headX = px + (TILE_SIZE - headWidth) * 0.5
    const headY = py + TILE_SIZE * 0.2

    this.playerGraphics.fillStyle(0x00ff88, 1)
    this.playerGraphics.fillRect(bodyX, bodyY, bodyWidth, bodyHeight)

    this.playerGraphics.fillStyle(0x228b22, 1)
    this.playerGraphics.fillRect(headX, headY, headWidth, headHeight)

    this.playerGraphics.fillStyle(0xffff00, 1)
    this.playerGraphics.fillCircle(headX + headWidth * 0.78, headY + headHeight * 0.42, Math.max(1.5, TILE_SIZE * 0.06))

    const pickaxeBaseX = bodyX + bodyWidth
    const pickaxeBaseY = bodyY + bodyHeight * 0.42
    const pickaxeTipX = pickaxeBaseX + TILE_SIZE * 0.2
    const pickaxeTipY = pickaxeBaseY - TILE_SIZE * 0.26

    this.playerGraphics.lineStyle(2, 0xb0b0b0, 1)
    this.playerGraphics.lineBetween(pickaxeBaseX, pickaxeBaseY, pickaxeTipX, pickaxeTipY)
    this.playerGraphics.lineStyle(2, 0xd9d9d9, 1)
    this.playerGraphics.lineBetween(pickaxeTipX - TILE_SIZE * 0.08, pickaxeTipY + TILE_SIZE * 0.03, pickaxeTipX + TILE_SIZE * 0.08, pickaxeTipY - TILE_SIZE * 0.03)
  }

  private drawFog(): void {
    this.fogGraphics.clear()

    const camera = this.cameras.main
    const viewWidth = camera.worldView.width > 0 ? camera.worldView.width : camera.width
    const viewHeight = camera.worldView.height > 0 ? camera.worldView.height : camera.height
    const viewX = camera.worldView.width > 0 ? camera.worldView.x : camera.scrollX
    const viewY = camera.worldView.height > 0 ? camera.worldView.y : camera.scrollY

    const startX = Math.max(0, Math.floor(viewX / TILE_SIZE) - 1)
    const endX = Math.min(this.gridWidth - 1, Math.ceil((viewX + viewWidth) / TILE_SIZE) + 1)
    const startY = Math.max(0, Math.floor(viewY / TILE_SIZE) - 1)
    const endY = Math.min(this.gridHeight - 1, Math.ceil((viewY + viewHeight) / TILE_SIZE) + 1)

    this.fogGraphics.fillStyle(0x000000, 0.45)
    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        if (!this.grid[y][x].revealed) {
          this.fogGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        }
      }
    }
  }

  private spawnBreakParticles(px: number, py: number, blockType: BlockType): void {
    this.breakEmitter.setParticleTint(BLOCK_COLORS[blockType])
    this.breakEmitter.setPosition(px + TILE_SIZE * 0.5, py + TILE_SIZE * 0.5)
    this.breakEmitter.explode(6)
  }

  /**
   * Find shortest path through empty tiles using BFS.
   * Returns positions from start to end (excluding start, including end).
   */
  private findPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): { x: number; y: number }[] | null {
    if (startX === endX && startY === endY) {
      return []
    }

    const visited = new Set<string>()
    const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = []

    queue.push({ x: startX, y: startY, path: [] })
    visited.add(`${startX},${startY}`)

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) {
        break
      }

      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ]

      for (const next of neighbors) {
        if (next.x < 0 || next.y < 0 || next.x >= this.gridWidth || next.y >= this.gridHeight) {
          continue
        }

        const key = `${next.x},${next.y}`
        if (visited.has(key)) {
          continue
        }

        const cell = this.grid[next.y][next.x]
        if (cell.type !== BlockType.Empty) {
          continue
        }

        const newPath = [...current.path, next]

        if (next.x === endX && next.y === endY) {
          return newPath
        }

        queue.push({ x: next.x, y: next.y, path: newPath })
        visited.add(key)
      }
    }

    return null
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
      return
    }

    // Check if clicked target is empty and reachable via pathfinding.
    const clickedCell = this.grid[targetY][targetX]
    if (clickedCell.type === BlockType.Empty && clickedCell.revealed) {
      const path = this.findPath(playerX, playerY, targetX, targetY)
      if (path && path.length > 0) {
        const nextStep = path[0]
        const moved = this.player.moveToEmpty(nextStep.x, nextStep.y, this.grid)
        if (moved) {
          revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
          this.game.events.emit('oxygen-changed', this.oxygenState)
          this.game.events.emit('depth-changed', this.player.gridY)
          this.redrawAll()
        }
        return
      }
    }

    let finalX = targetX
    let finalY = targetY

    // If not adjacent, move in the direction of the click
    if (Math.abs(targetX - playerX) + Math.abs(targetY - playerY) !== 1) {
      const dx = targetX - playerX
      const dy = targetY - playerY

      // Determine primary direction (prefer vertical over horizontal for ties)
      if (Math.abs(dy) >= Math.abs(dx)) {
        // Move vertically
        finalX = playerX
        finalY = playerY + (dy > 0 ? 1 : -1)
      } else {
        // Move horizontally
        finalX = playerX + (dx > 0 ? 1 : -1)
        finalY = playerY
      }

      // Bounds check
      if (finalX < 0 || finalY < 0 || finalX >= this.gridWidth || finalY >= this.gridHeight) {
        return
      }
    }

    const targetCell = this.grid[finalY][finalX]

    if (targetCell.type === BlockType.Empty) {
      const moved = this.player.moveToEmpty(finalX, finalY, this.grid)
      if (!moved) {
        return
      }

      revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)

      this.game.events.emit('oxygen-changed', this.oxygenState)
      this.game.events.emit('depth-changed', this.player.gridY)

      this.redrawAll()
      return
    }

    if (!canMine(this.grid, finalX, finalY, playerX, playerY)) {
      return
    }

    const blockType = targetCell.type

    if (blockType !== BlockType.QuizGate) {
      const oxygenCost = getOxygenCostForBlock(blockType)
      const oxygenResult = consumeOxygen(this.oxygenState, oxygenCost)
      this.oxygenState = oxygenResult.state

      if (oxygenResult.depleted) {
        this.game.events.emit('oxygen-changed', this.oxygenState)
        this.game.events.emit('oxygen-depleted')
        this.redrawAll()
        return
      }
    }

    const mineResult = mineBlock(this.grid, finalX, finalY)
    if (mineResult.success) {
      this.blocksMinedThisRun += 1
      if (!mineResult.destroyed) {
        this.flashTiles.set(`${finalX},${finalY}`, this.time.now)
      }
    }

    if (mineResult.destroyed) {
      this.spawnBreakParticles(finalX * TILE_SIZE, finalY * TILE_SIZE, blockType)

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

      const moved = this.player.moveToEmpty(finalX, finalY, this.grid)
      if (moved) {
        revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
        this.game.events.emit('depth-changed', this.player.gridY)
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

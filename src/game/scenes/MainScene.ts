import Phaser from 'phaser'

/** Grid cell types for the mining world */
enum CellType {
  Empty = 0,
  Dirt = 1,
  Stone = 2,
  Mineral = 3,
  Relic = 4,
}

/** Color mapping for cell types */
const CELL_COLORS: Record<CellType, number> = {
  [CellType.Empty]: 0x1a1a2e,
  [CellType.Dirt]: 0x5c4033,
  [CellType.Stone]: 0x6b6b6b,
  [CellType.Mineral]: 0x4ecca3,
  [CellType.Relic]: 0xe94560,
}

/**
 * MainScene: The primary game scene where mining takes place.
 * Renders a grid-based underground world that the player can mine.
 */
export class MainScene extends Phaser.Scene {
  private gridWidth = 12
  private gridHeight = 20
  private cellSize = 0
  private grid: CellType[][] = []
  private gridGraphics!: Phaser.GameObjects.Graphics
  private playerDepth = 0
  private offsetX = 0
  private offsetY = 0

  constructor() {
    super({ key: 'MainScene' })
  }

  create(): void {
    // Calculate cell size based on screen width (mobile-first)
    this.cellSize = Math.floor(this.cameras.main.width / this.gridWidth)
    this.offsetX = (this.cameras.main.width - this.cellSize * this.gridWidth) / 2
    this.offsetY = 60 // Leave room for HUD

    // Generate initial grid
    this.generateGrid()

    // Create graphics object for rendering
    this.gridGraphics = this.add.graphics()
    this.drawGrid()

    // Handle touch/click input for mining
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handleMine(pointer.x, pointer.y)
    })

    // Handle window resize
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.cellSize = Math.floor(gameSize.width / this.gridWidth)
      this.offsetX = (gameSize.width - this.cellSize * this.gridWidth) / 2
      this.drawGrid()
    })

    // Welcome text
    const welcomeText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      'Tap blocks to mine!',
      {
        fontFamily: 'Courier New',
        fontSize: '16px',
        color: '#ffd369',
      }
    )
    welcomeText.setOrigin(0.5, 0.5)
    welcomeText.setDepth(100)

    // Fade out welcome text
    this.tweens.add({
      targets: welcomeText,
      alpha: 0,
      duration: 3000,
      delay: 2000,
      onComplete: () => welcomeText.destroy(),
    })
  }

  /** Generate a procedural underground grid */
  private generateGrid(): void {
    this.grid = []
    for (let y = 0; y < this.gridHeight; y++) {
      const row: CellType[] = []
      for (let x = 0; x < this.gridWidth; x++) {
        // First two rows are empty (surface)
        if (y < 2) {
          row.push(CellType.Empty)
        } else {
          const rand = Math.random()
          if (rand < 0.05) {
            row.push(CellType.Relic)
          } else if (rand < 0.15) {
            row.push(CellType.Mineral)
          } else if (rand < 0.4) {
            row.push(CellType.Stone)
          } else {
            row.push(CellType.Dirt)
          }
        }
      }
      this.grid.push(row)
    }
  }

  /** Draw the grid to the screen */
  private drawGrid(): void {
    this.gridGraphics.clear()

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const cellType = this.grid[y][x]
        const px = this.offsetX + x * this.cellSize
        const py = this.offsetY + y * this.cellSize

        // Fill cell
        this.gridGraphics.fillStyle(CELL_COLORS[cellType], 1)
        this.gridGraphics.fillRect(px, py, this.cellSize - 1, this.cellSize - 1)

        // Add subtle border for non-empty cells
        if (cellType !== CellType.Empty) {
          this.gridGraphics.lineStyle(1, 0x000000, 0.3)
          this.gridGraphics.strokeRect(px, py, this.cellSize - 1, this.cellSize - 1)
        }
      }
    }
  }

  /** Handle mining a cell at screen coordinates */
  private handleMine(screenX: number, screenY: number): void {
    const gridX = Math.floor((screenX - this.offsetX) / this.cellSize)
    const gridY = Math.floor((screenY - this.offsetY) / this.cellSize)

    // Bounds check
    if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
      return
    }

    const cellType = this.grid[gridY][gridX]

    if (cellType === CellType.Empty) {
      return // Nothing to mine
    }

    // Mining effect — flash white
    const px = this.offsetX + gridX * this.cellSize
    const py = this.offsetY + gridY * this.cellSize
    const flash = this.add.graphics()
    flash.fillStyle(0xffffff, 0.8)
    flash.fillRect(px, py, this.cellSize - 1, this.cellSize - 1)
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      onComplete: () => flash.destroy(),
    })

    // Handle special cells
    if (cellType === CellType.Mineral || cellType === CellType.Relic) {
      // TODO: Trigger quiz overlay via Svelte event
      console.log(`Discovered a ${cellType === CellType.Mineral ? 'mineral' : 'relic'} at (${gridX}, ${gridY})!`)
    }

    // Mine the cell
    this.grid[gridY][gridX] = CellType.Empty
    this.drawGrid()
  }
}

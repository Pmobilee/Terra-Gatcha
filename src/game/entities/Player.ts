import { BlockType, type MineCell } from '../../data/types'

export class Player {
  public gridX: number
  public gridY: number

  constructor(startX: number, startY: number) {
    this.gridX = startX
    this.gridY = startY
  }

  /**
   * Moves the player to an adjacent empty cell.
   *
   * @param x - Target grid X position.
   * @param y - Target grid Y position.
   * @param grid - Mine grid to validate movement against.
   * @returns True when movement succeeds, otherwise false.
   */
  public moveToEmpty(x: number, y: number, grid: MineCell[][]): boolean {
    if (y < 0 || y >= grid.length) {
      return false
    }

    const row = grid[y]
    if (x < 0 || x >= row.length) {
      return false
    }

    if (row[x].type !== BlockType.Empty) {
      return false
    }

    if (!this.isAdjacentTo(x, y)) {
      return false
    }

    this.gridX = x
    this.gridY = y

    return true
  }

  /**
   * Gets the player's current grid position.
   *
   * @returns Current position as x and y coordinates.
   */
  public getPosition(): { x: number; y: number } {
    return {
      x: this.gridX,
      y: this.gridY,
    }
  }

  /**
   * Checks whether the given position is adjacent to the player.
   *
   * @param x - Grid X position to check.
   * @param y - Grid Y position to check.
   * @returns True when Manhattan distance is exactly 1.
   */
  public isAdjacentTo(x: number, y: number): boolean {
    return Math.abs(x - this.gridX) + Math.abs(y - this.gridY) === 1
  }
}

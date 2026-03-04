import { BALANCE, getLayerGridSize, HAZARD_DENSITY_BY_LAYER } from '../../data/balance'
import { BlockType, type MineCell, type MineCellContent, type Rarity } from '../../data/types'
import { type Biome, DEFAULT_BIOME, ALL_BIOMES } from '../../data/biomes'
import { LANDMARK_LAYERS, LANDMARK_TEMPLATES, getLandmarkIdForLayer, type LandmarkTemplate } from '../../data/landmarks'
import { BIOME_STRUCTURAL_FEATURES, STRUCTURAL_FEATURE_CONFIGS, type StructuralFeatureId } from '../../data/biomeStructures'
import { getFragmentsForLayer } from '../../data/recipeFragments'
import { injectAnomalyZones } from './AnomalyZoneSystem'
import type { EngagementData } from '../../services/engagementScorer'
import type { ArchetypeData } from '../../services/archetypeDetector'

/**
 * Creates a deterministic pseudo-random number generator from a numeric seed.
 * Uses the mulberry32 algorithm and returns values in the range [0, 1).
 */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0

  return (): number => {
    t += 0x6d2b79f5
    let n = Math.imul(t ^ (t >>> 15), t | 1)
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Linear interpolation clamped to [0, 1].
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Returns depth-based block weight overrides for each layer (0-indexed, 0-19).
 * Used to add HardRock, MineralNode, ArtifactNode, and FossilNode into the distribution
 * as the player descends — replacing the fixed density-only approach for base blocks.
 * (DD-V2-054)
 */
function getBlockWeightsForLayer(layer: number): {
  dirt: number; softRock: number; stone: number; hardRock: number;
  mineralNode: number; artifactNode: number; fossilNode: number;
} {
  const depth = layer / 19  // 0.0 at layer 0, 1.0 at layer 19
  return {
    dirt:        lerp(0.35, 0.02, depth),
    softRock:    lerp(0.20, 0.08, depth),
    stone:       lerp(0.25, 0.20, depth),
    hardRock:    lerp(0.00, 0.35, depth),
    mineralNode: layer <= 12 ? lerp(0.05, 0.08, depth) : lerp(0.08, 0.04, (layer - 12) / 7),
    artifactNode: lerp(0.01, 0.06, depth),
    fossilNode:  lerp(0.01, 0.03, depth),
  };
}

/**
 * Stamps a landmark template into the center of the mine grid.
 * Returns the resolved spawn (S) position.
 * All ASCII characters map to BlockType values; 'S' becomes Empty and records spawn coords.
 * (DD-V2-055)
 */
function stampLandmark(
  template: LandmarkTemplate,
  grid: MineCell[][],
  width: number,
  height: number
): { spawnX: number; spawnY: number } {
  const tRows = template.grid
  const tH = tRows.length
  const tW = Math.max(...tRows.map(r => r.length))
  const offsetX = Math.floor((width - tW) / 2)
  const offsetY = Math.floor((height - tH) / 2)

  let spawnX = offsetX + 1
  let spawnY = offsetY + 1

  const ASCII_MAP: Record<string, BlockType> = {
    ' ': BlockType.Empty,
    '#': BlockType.HardRock,
    'L': BlockType.LavaBlock,
    'G': BlockType.GasPocket,
    'C': BlockType.Chest,
    'T': BlockType.Tablet,
    'M': BlockType.MineralNode,
    'E': BlockType.Empty,
    'S': BlockType.Empty,
    'D': BlockType.DescentShaft,
  }

  for (let row = 0; row < tH; row++) {
    for (let col = 0; col < tRows[row].length; col++) {
      const ch = tRows[row][col]
      const gx = offsetX + col
      const gy = offsetY + row
      if (gx < 0 || gx >= width || gy < 0 || gy >= height) continue
      if (ch === 'S') { spawnX = gx; spawnY = gy }
      const blockType = ASCII_MAP[ch] ?? BlockType.Empty
      const hardness = getHardness(blockType)
      grid[gy][gx] = {
        type: blockType,
        hardness,
        maxHardness: hardness,
        revealed: false,
      }
    }
  }

  return { spawnX, spawnY }
}

/**
 * Stamps a single structural feature into the grid using shape-aware logic.
 * Each feature type has its own geometry instead of a uniform rectangle fill.
 * (DD-V2-236, Phase 49.1)
 *
 * @param grid - Mine cell grid to write into.
 * @param featureId - Which structural feature to stamp.
 * @param fx - Top-left X of the bounding box.
 * @param fy - Top-left Y of the bounding box.
 * @param fw - Width of the bounding box (from config).
 * @param fh - Height of the bounding box (from config).
 * @param fillBlock - Primary block type for this feature.
 * @param rng - Seeded RNG.
 * @param gridWidth - Full grid width (for bounds checking).
 * @param gridHeight - Full grid height (for bounds checking).
 */
function stampFeature(
  grid: MineCell[][],
  featureId: StructuralFeatureId,
  fx: number, fy: number, fw: number, fh: number,
  fillBlock: BlockType,
  rng: () => number,
  gridWidth: number,
  gridHeight: number,
): void {
  // Helper: safely write a cell only if not a protected block type.
  function writeCell(x: number, y: number, cell: MineCell): void {
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return
    const existing = grid[y][x]
    if (
      existing.type === BlockType.ExitLadder ||
      existing.type === BlockType.DescentShaft ||
      existing.type === BlockType.QuizGate
    ) return
    grid[y][x] = cell
  }

  function solidCell(type: BlockType): MineCell {
    const h = getHardness(type)
    return { type, hardness: h, maxHardness: h, revealed: false }
  }

  function emptyCell(): MineCell {
    return { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: false }
  }

  switch (featureId) {

    case 'pocket_caves': {
      // Elliptical hollow: fill interior with Empty, leave surrounding rock intact.
      const cx = fx + Math.floor(fw / 2)
      const cy = fy + Math.floor(fh / 2)
      const rx = fw / 2
      const ry = fh / 2
      for (let dy = 0; dy < fh; dy++) {
        for (let dx = 0; dx < fw; dx++) {
          const nx = (dx - rx + 0.5) / rx
          const ny = (dy - ry + 0.5) / ry
          if (nx * nx + ny * ny <= 1.0) {
            writeCell(cx - Math.floor(fw / 2) + dx, cy - Math.floor(fh / 2) + dy, emptyCell())
          }
        }
      }
      break
    }

    case 'crystal_veins':
    case 'living_veins':
    case 'copper_traces': {
      // Diagonal vein: draw a 1-2 wide diagonal stripe of fillBlock through the bounding box.
      const veins = 1 + Math.floor(rng() * 2)  // 1 or 2 veins per feature
      for (let v = 0; v < veins; v++) {
        const startX = fx + Math.floor(rng() * fw)
        let curX = startX
        for (let dy = 0; dy < fh; dy++) {
          writeCell(curX, fy + dy, solidCell(fillBlock))
          if (rng() < 0.4) curX = Math.max(fx, Math.min(fx + fw - 1, curX + (rng() < 0.5 ? 1 : -1)))
        }
      }
      break
    }

    case 'root_corridors': {
      // Winding horizontal corridor: 1 cell tall, width = fw, meanders ±1 in Y.
      let curY = fy + Math.floor(fh / 2)
      for (let dx = 0; dx < fw; dx++) {
        writeCell(fx + dx, curY, emptyCell())
        // Occasional vertical branch
        if (rng() < 0.2) {
          const branch = rng() < 0.5 ? -1 : 1
          writeCell(fx + dx, curY + branch, emptyCell())
        }
        if (rng() < 0.3) curY = Math.max(fy, Math.min(fy + fh - 1, curY + (rng() < 0.5 ? 1 : -1)))
      }
      break
    }

    case 'lava_streams':
    case 'magma_rivers': {
      // Vertical stream with slight horizontal drift, 1-2 wide.
      let curX = fx + Math.floor(fw / 2)
      for (let dy = 0; dy < fh; dy++) {
        writeCell(curX, fy + dy, solidCell(fillBlock))
        if (fw > 1) writeCell(curX + 1, fy + dy, solidCell(fillBlock))
        if (rng() < 0.25) curX = Math.max(fx, Math.min(fx + fw - 1, curX + (rng() < 0.5 ? 1 : -1)))
      }
      break
    }

    case 'ice_columns':
    case 'obsidian_spires':
    case 'void_columns':
    case 'temporal_fractures': {
      // Tapered vertical column: wide at base, narrows toward top.
      const midX = fx + Math.floor(fw / 2)
      for (let dy = 0; dy < fh; dy++) {
        const taper = Math.floor((dy / fh) * (fw / 2))
        const left = midX - (fw / 2 - taper)
        const right = midX + (fw / 2 - taper)
        for (let x = Math.ceil(left); x <= Math.floor(right); x++) {
          writeCell(x, fy + dy, solidCell(fillBlock))
        }
      }
      break
    }

    case 'mushroom_clusters': {
      // 2-3 mushroom silhouettes: thin stem (SoftRock) topped by 3-wide cap (fillBlock).
      const count = 2 + Math.floor(rng() * 2)
      for (let m = 0; m < count; m++) {
        const stemX = fx + 1 + Math.floor(rng() * Math.max(1, fw - 2))
        const stemTopY = fy + 1
        const stemH = 2 + Math.floor(rng() * 2)
        // Cap
        for (let cx = stemX - 1; cx <= stemX + 1; cx++) {
          writeCell(cx, stemTopY, solidCell(fillBlock))
        }
        // Stem
        for (let dy = 1; dy <= stemH; dy++) {
          writeCell(stemX, stemTopY + dy, solidCell(BlockType.SoftRock))
        }
      }
      break
    }

    case 'fossil_beds': {
      // Horizontal band of FossilNodes mixed with SoftRock, 2 rows tall.
      for (let dy = 0; dy < Math.min(fh, 2); dy++) {
        for (let dx = 0; dx < fw; dx++) {
          const isFossil = rng() < 0.35
          writeCell(fx + dx, fy + dy, solidCell(isFossil ? BlockType.FossilNode : fillBlock))
        }
      }
      break
    }

    case 'sand_pockets': {
      // Diamond-shaped pocket of Dirt (sand proxy) with empty centre.
      const cx = fx + Math.floor(fw / 2)
      const cy = fy + Math.floor(fh / 2)
      const r = Math.floor(Math.min(fw, fh) / 2)
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= r) {
            const isEmpty = Math.abs(dx) + Math.abs(dy) < r - 1
            writeCell(cx + dx, cy + dy, isEmpty ? emptyCell() : solidCell(fillBlock))
          }
        }
      }
      break
    }

    case 'amber_inclusions': {
      // Small cluster of ArtifactNodes surrounded by HardRock.
      const cx = fx + Math.floor(fw / 2)
      const cy = fy + Math.floor(fh / 2)
      writeCell(cx, cy, solidCell(fillBlock))  // fillBlock = ArtifactNode
      // Surround with HardRock
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          writeCell(cx + dx, cy + dy, solidCell(BlockType.HardRock))
        }
      }
      break
    }

    case 'ruin_walls': {
      // Partial rectangular ruin: 3 sides present (top, left, right), bottom open.
      for (let dy = 0; dy < fh; dy++) {
        for (let dx = 0; dx < fw; dx++) {
          const isTop = dy === 0
          const isLeft = dx === 0
          const isRight = dx === fw - 1
          if ((isTop || isLeft || isRight) && rng() > 0.3) {
            writeCell(fx + dx, fy + dy, solidCell(fillBlock))
          }
        }
      }
      break
    }

    case 'plasma_nodes':
    case 'glitch_tiles': {
      // Scattered cluster: random fill within bounding box at ~50% density.
      for (let dy = 0; dy < fh; dy++) {
        for (let dx = 0; dx < fw; dx++) {
          if (rng() < 0.5) writeCell(fx + dx, fy + dy, solidCell(fillBlock))
        }
      }
      break
    }

    case 'floating_islands': {
      // Solid rectangular platform with 2 empty cells below (gap) — gravity-defying feel.
      const islandH = Math.max(1, Math.floor(fh / 2))
      for (let dy = 0; dy < islandH; dy++) {
        for (let dx = 0; dx < fw; dx++) {
          writeCell(fx + dx, fy + dy, solidCell(fillBlock))
        }
      }
      // Clear below the island
      for (let dy = islandH; dy < fh; dy++) {
        for (let dx = 0; dx < fw; dx++) {
          writeCell(fx + dx, fy + dy, emptyCell())
        }
      }
      break
    }

    case 'mirror_symmetry': {
      // Left half filled, right half is a mirror. Creates an echo-chamber visual motif.
      const halfW = Math.floor(fw / 2)
      for (let dy = 0; dy < fh; dy++) {
        for (let dx = 0; dx < halfW; dx++) {
          if (rng() < 0.5) {
            writeCell(fx + dx, fy + dy, solidCell(fillBlock))
            writeCell(fx + fw - 1 - dx, fy + dy, solidCell(fillBlock))
          }
        }
      }
      break
    }

    case 'stalactite_field': {
      // Rows of downward-pointing stalactites from the top edge of the bounding box.
      // Each column has a probabilistic stalactite of random length (1 to fh/2).
      for (let dx = 0; dx < fw; dx++) {
        if (rng() < 0.65) {
          const len = 1 + Math.floor(rng() * Math.max(1, Math.floor(fh / 2)))
          for (let dy = 0; dy < len; dy++) {
            writeCell(fx + dx, fy + dy, solidCell(fillBlock))
          }
        }
      }
      break
    }

    case 'crystal_formation': {
      // Upward-growing crystal spires from the bottom edge, tapering toward the top.
      const spireCount = 2 + Math.floor(rng() * 3)
      const step = Math.max(1, Math.floor(fw / spireCount))
      for (let s = 0; s < spireCount; s++) {
        const spireX = fx + s * step + Math.floor(rng() * Math.max(1, step - 1))
        const spireH = Math.ceil(fh * (0.4 + rng() * 0.6))
        const spireW = 1 + (rng() < 0.4 ? 1 : 0)
        for (let dy = 0; dy < spireH; dy++) {
          const taper = dy < 2 ? 0 : (dy === spireH - 1 ? 0 : 1)
          for (let sw = 0; sw < spireW - (dy > spireH / 2 ? taper : 0); sw++) {
            writeCell(spireX + sw, fy + fh - 1 - dy, solidCell(fillBlock))
          }
        }
      }
      break
    }

    case 'hydrothermal_vent': {
      // Vertical plume: GasPocket column rising from the bottom, flanked by LavaBlock.
      const ventX = fx + Math.floor(fw / 2)
      for (let dy = 0; dy < fh; dy++) {
        // Central gas column
        writeCell(ventX, fy + fh - 1 - dy, solidCell(BlockType.GasPocket))
        // Lava flanks on lower half only
        if (dy < Math.floor(fh / 2)) {
          writeCell(ventX - 1, fy + fh - 1 - dy, solidCell(BlockType.LavaBlock))
          if (fw >= 3) writeCell(ventX + 1, fy + fh - 1 - dy, solidCell(BlockType.LavaBlock))
        }
      }
      break
    }

    default: {
      // Fallback: original rectangle fill.
      for (let dy = 0; dy < fh; dy++) {
        for (let dx = 0; dx < fw; dx++) {
          writeCell(fx + dx, fy + dy, solidCell(fillBlock))
        }
      }
    }
  }
}

/**
 * Places biome-specific structural features on the grid after base generation.
 * Features use shape-aware stamp logic (stampFeature) instead of plain rectangle fills.
 * Phase 9.4 / Phase 49.1
 */
function placeStructuralFeatures(
  grid: MineCell[][],
  biomeId: string,
  rng: () => number,
  height: number,
  width: number,
): void {
  const featureIds = BIOME_STRUCTURAL_FEATURES[biomeId]
  if (!featureIds || featureIds.length === 0) return

  // Track placed feature bounding boxes to prevent overlap
  const placed: Array<{ x: number; y: number; w: number; h: number }> = []

  for (const featureId of featureIds) {
    const config = STRUCTURAL_FEATURE_CONFIGS[featureId]
    if (!config) continue

    // Attempt to place the feature a few times
    const maxAttempts = 8
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Skip this placement with probability (1 - frequency)
      if (rng() > config.frequency) continue

      // Randomize size within bounds
      const fw = config.minSize.width + Math.floor(rng() * (config.maxSize.width - config.minSize.width + 1))
      const fh = config.minSize.height + Math.floor(rng() * (config.maxSize.height - config.minSize.height + 1))

      // Random position (leave 2-cell border)
      const margin = 2
      if (width <= fw + margin * 2 || height <= fh + margin * 2) continue
      const fx = margin + Math.floor(rng() * (width - fw - margin * 2))
      const fy = margin + Math.floor(rng() * (height - fh - margin * 2))

      // Check overlap with previously placed features
      const overlaps = placed.some(p =>
        fx < p.x + p.w && fx + fw > p.x &&
        fy < p.y + p.h && fy + fh > p.y
      )
      if (overlaps) continue

      // Phase 49.1: Use shape-aware stampFeature() instead of the plain rectangle fill.
      stampFeature(grid, featureId, fx, fy, fw, fh, config.fillBlock, rng, width, height)

      placed.push({ x: fx, y: fy, w: fw, h: fh })
      break // Successfully placed this feature
    }
  }
}

/**
 * Difficulty modifier profile extracted from player engagement and archetype data.
 * All values are multipliers (1.0 = no change).
 */
export interface DifficultyProfile {
  /** Block hardness multiplier (applied on top of LAYER_HARDNESS_SCALE). */
  hardnessMultiplier: number
  /** HardRock block weight multiplier. */
  hardRockWeightMultiplier: number
  /** Hazard density multiplier. */
  hazardMultiplier: number
  /** OxygenCache density multiplier (inverse of difficulty). */
  oxygenCacheMultiplier: number
  /** Anomaly zone injection probability multiplier. */
  anomalyRateMultiplier: number
  /** Mineral node count multiplier. */
  mineralMultiplier: number
}

/**
 * Builds a DifficultyProfile from the player's engagement score and archetype.
 * Engagement score is clamped to [0, 100]. Score 50 → neutral (all 1.0).
 * Score > 50 → harder; score < 50 → easier.
 *
 * @param engagementData - Player's hidden engagement scoring state.
 * @param archetypeData - Player's detected archetype (explorer/miner/scholar/survivor).
 */
export function buildDifficultyProfile(
  engagementData: EngagementData,
  archetypeData: ArchetypeData,
): DifficultyProfile {
  const score = Math.max(0, Math.min(100, engagementData.currentScore ?? 50))
  const normalized = (score - 50) / 50  // -1.0 to +1.0

  // Base difficulty scaling: ±20% from neutral
  const hardnessMult = 1.0 + normalized * BALANCE.DD_HARDNESS_SCALE
  const hazardMult   = 1.0 + normalized * BALANCE.DD_HAZARD_SCALE
  const oxygenMult   = 1.0 - normalized * BALANCE.DD_OXYGEN_SCALE  // less O2 when harder
  let anomalyMult  = 1.0 + normalized * 0.5

  // Archetype modifiers
  let hardRockMult = 1.0
  let mineralMult = 1.0
  const effectiveArchetype = archetypeData.manualOverride ?? archetypeData.detected
  if (effectiveArchetype === 'collector') {
    hardRockMult *= 1.1   // Collectors (miners) get extra HardRock as a reward
    mineralMult *= 1.2
  } else if (effectiveArchetype === 'explorer') {
    anomalyMult *= 1.15  // Explorers see more anomalies
  }

  return {
    hardnessMultiplier:       Math.max(0.5, hardnessMult),
    hardRockWeightMultiplier: Math.max(0.5, hardnessMult * hardRockMult),
    hazardMultiplier:         Math.max(0.3, hazardMult),
    oxygenCacheMultiplier:    Math.max(0.5, oxygenMult),
    anomalyRateMultiplier:    Math.max(0.5, anomalyMult),
    mineralMultiplier:        Math.max(0.7, mineralMult),
  }
}

/**
 * Returns a blend of two biome blockWeights based on a 0.0–1.0 alpha.
 * alpha=0.0 → fully biomeA, alpha=1.0 → fully biomeB.
 */
function blendBiomeWeights(
  biomeA: Biome,
  biomeB: Biome,
  alpha: number,
): Biome['blockWeights'] {
  const a = Math.max(0, Math.min(1, alpha))
  return {
    dirt:     biomeA.blockWeights.dirt     * (1 - a) + biomeB.blockWeights.dirt     * a,
    softRock: biomeA.blockWeights.softRock * (1 - a) + biomeB.blockWeights.softRock * a,
    stone:    biomeA.blockWeights.stone    * (1 - a) + biomeB.blockWeights.stone    * a,
    hardRock: biomeA.blockWeights.hardRock * (1 - a) + biomeB.blockWeights.hardRock * a,
  }
}

/**
 * Generates a mine grid using deterministic procedural rules.
 * @param seed - Deterministic seed for this layer.
 * @param facts - Fact IDs to assign to quiz/artifact blocks.
 * @param layer - Zero-based layer index (0-19). Grid size is derived from this.
 *                On non-final layers (layer < MAX_LAYERS - 1), places a DescentShaft.
 * @param biome - Optional biome definition that overrides block weights, hazard densities, and visuals.
 *                Defaults to the sedimentary biome if not provided.
 * @param secondaryBiome - Optional second biome for left/right blended layers (DD-V2-235).
 * @param transitionBandWidth - Width in columns of the blended transition zone (default 5).
 * @param difficultyProfile - Optional difficulty profile derived from player engagement data (Phase 49.7).
 */
export function generateMine(
  seed: number,
  facts: string[],
  layer = 0,
  biome: Biome = DEFAULT_BIOME,
  secondaryBiome?: Biome,
  transitionBandWidth = 5,
  difficultyProfile?: DifficultyProfile,
): { grid: MineCell[][], spawnX: number, spawnY: number, biome: Biome, secondaryBiome?: Biome } {
  const oneIndexedLayer = layer + 1  // layer is 0-based internally, convert to 1-based for getLayerGridSize
  const [width, height] = getLayerGridSize(oneIndexedLayer)
  const rng = seededRandom(seed)
  const grid: MineCell[][] = []

  // Per-layer hardness multiplier: each layer is LAYER_HARDNESS_SCALE^layer harder.
  // Apply difficulty profile hardness adjustment on top.
  const hardnessScale = Math.pow(BALANCE.LAYER_HARDNESS_SCALE, layer)
    * (difficultyProfile?.hardnessMultiplier ?? 1.0)

  // Depth-based block weights for this layer (used to inject HardRock into base block distribution).
  const layerWeights = getBlockWeightsForLayer(layer)

  // Dual-biome transition support (49.2): compute split column and transition half-band.
  const splitX = Math.floor(width / 2)
  const halfBand = transitionBandWidth / 2

  for (let y = 0; y < height; y++) {
    const row: MineCell[] = []

    for (let x = 0; x < width; x++) {
      // Determine effective biome for this cell (blend if dual-biome layer)
      let effectiveBiome = biome
      if (secondaryBiome) {
        const distFromSplit = x - splitX  // negative = left side, positive = right side
        const alpha = Math.max(0, Math.min(1, (distFromSplit + halfBand) / transitionBandWidth))
        if (Math.abs(distFromSplit) <= halfBand) {
          // Transition zone: blend weights into a synthetic biome-like object
          const blended = blendBiomeWeights(biome, secondaryBiome, alpha)
          effectiveBiome = { ...biome, blockWeights: blended }
        } else if (distFromSplit > 0) {
          effectiveBiome = secondaryBiome
        }
      }

      const depthWeights = getDepthWeights(y, height, effectiveBiome, layerWeights, difficultyProfile?.hardRockWeightMultiplier)
      const depthWeightTotal = depthWeights.reduce((sum, entry) => sum + entry.weight, 0)

      const type = y < 2 ? BlockType.Empty : pickBaseBlock(rng, depthWeights, depthWeightTotal)
      const baseHardness = getHardness(type)
      // Scale hardness by layer depth (round up, minimum 1 for breakable blocks, preserve 0 and 999).
      const hardness = baseHardness > 0 && baseHardness < 999
        ? Math.max(1, Math.round(baseHardness * hardnessScale))
        : baseHardness

      row.push({
        type,
        hardness,
        maxHardness: hardness,
        revealed: false,
      })
    }

    grid.push(row)
  }

  // Landmark layer check — stamps a pre-designed template instead of procedural generation (DD-V2-055)
  const landmarkId = getLandmarkIdForLayer(oneIndexedLayer)
  if (landmarkId) {
    const template = LANDMARK_TEMPLATES[landmarkId]
    const { spawnX: lSpawnX, spawnY: lSpawnY } = stampLandmark(template, grid, width, height)
    // Reveal spawn area
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = lSpawnX + dx
        const cy = lSpawnY + dy
        if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
          grid[cy][cx].revealed = true
        }
      }
    }
    return { grid, spawnX: lSpawnX, spawnY: lSpawnY, biome, secondaryBiome }
  }

  // Layer 1 spawn (layer === 0): top-center, 3x3 clear area.
  // Layer 2+ (layer >= 1): random position inside the grid (spawn area cleared below).
  let spawnX: number
  let spawnY: number
  if (layer === 0) {
    spawnX = Math.floor(width / 2)
    spawnY = 1
    // Clear 3x3 around spawn
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = spawnX + dx
        const cy = spawnY + dy
        if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
          grid[cy][cx] = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: false }
        }
      }
    }
  } else {
    // For layers 2+: pick a random empty cell far from the descent shaft position.
    // Since shaft is placed later, pick a random position inside the grid avoiding edges.
    spawnX = 2 + Math.floor(rng() * (width - 4))
    spawnY = 2 + Math.floor(rng() * (height - 8))
  }

  // Phase 9.4: Place biome-specific structural features
  placeStructuralFeatures(grid, biome.id, rng, height, width)

  const positions = buildSpecialPositionPool(width, height)
  let factCursor = 0

  const nextFactId = (): string | undefined => {
    if (facts.length === 0) {
      return undefined
    }

    const factId = facts[factCursor % facts.length]
    factCursor += 1
    return factId
  }

  // Apply biome mineral multiplier and optional difficulty profile multiplier.
  const mineralNodeCount = Math.max(1, Math.round(
    BALANCE.DENSITY_MINERAL_NODES * biome.mineralMultiplier * (difficultyProfile?.mineralMultiplier ?? 1.0)
  ))

  placeSpecialBlocks(grid, positions, mineralNodeCount, rng, () => {
    const hardness = BALANCE.HARDNESS_MINERAL_NODE
    const mineralAmount = randomIntInclusive(rng, BALANCE.MINERAL_DROP_MIN, BALANCE.MINERAL_DROP_MAX)
    return {
      type: BlockType.MineralNode,
      hardness,
      maxHardness: hardness,
      revealed: false,
      content: {
        mineralType: 'dust',
        mineralAmount,
      },
    }
  })

  placeSpecialBlocks(grid, positions, BALANCE.DENSITY_ARTIFACT_NODES, rng, () => {
    const hardness = BALANCE.HARDNESS_ARTIFACT_NODE
    return {
      type: BlockType.ArtifactNode,
      hardness,
      maxHardness: hardness,
      revealed: false,
      content: {
        artifactRarity: pickRarity(rng),
        factId: nextFactId(),
      },
    }
  })

  // Apply optional difficulty profile oxygen cache multiplier.
  const oxygenCacheCount = Math.max(0, Math.round(
    BALANCE.DENSITY_OXYGEN_CACHES * (difficultyProfile?.oxygenCacheMultiplier ?? 1.0)
  ))
  placeSpecialBlocks(grid, positions, oxygenCacheCount, rng, () => {
    const hardness = 2
    return {
      type: BlockType.OxygenCache,
      hardness,
      maxHardness: hardness,
      revealed: false,
      content: {
        oxygenAmount: BALANCE.OXYGEN_CACHE_RESTORE,
      },
    }
  })

  placeSpecialBlocks(grid, positions, BALANCE.DENSITY_QUIZ_GATES, rng, () => {
    const hardness = BALANCE.HARDNESS_QUIZ_GATE
    return {
      type: BlockType.QuizGate,
      hardness,
      maxHardness: hardness,
      revealed: false,
      content: {
        factId: nextFactId(),
      },
    }
  })

  placeSpecialBlocks(grid, positions, BALANCE.DENSITY_UPGRADE_CRATES, rng, () => {
    const hardness = 2
    return {
      type: BlockType.UpgradeCrate,
      hardness,
      maxHardness: hardness,
      revealed: false,
    }
  })

  placeRelicShrines(grid, positions, rng, height)

  placeQuoteStones(grid, positions, rng)

  // Depth-adjust mineral amounts: deeper nodes yield more
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x]
      if (cell.type === BlockType.MineralNode && cell.content?.mineralAmount) {
        const depthMultiplier = 1 + (y / height) * 0.8  // 1.0x at top, 1.8x at bottom
        cell.content.mineralAmount = Math.round(cell.content.mineralAmount * depthMultiplier)
      }
    }
  }

  // Depth-based mineral tier assignment: deeper nodes may yield rarer minerals.
  // Priority order (highest wins): essence → geode → crystal → shard → dust
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x]
      if (cell.type === BlockType.MineralNode && cell.content) {
        const depthRatio = y / height
        if (depthRatio >= BALANCE.MINERAL_ESSENCE_DEPTH_THRESHOLD && rng() < BALANCE.MINERAL_ESSENCE_CHANCE) {
          cell.content.mineralType = 'essence'
          cell.content.mineralAmount = randomIntInclusive(rng, BALANCE.MINERAL_ESSENCE_DROP_MIN, BALANCE.MINERAL_ESSENCE_DROP_MAX)
        } else if (depthRatio >= BALANCE.MINERAL_GEODE_DEPTH_THRESHOLD && rng() < BALANCE.MINERAL_GEODE_CHANCE) {
          cell.content.mineralType = 'geode'
          cell.content.mineralAmount = randomIntInclusive(rng, BALANCE.MINERAL_GEODE_DROP_MIN, BALANCE.MINERAL_GEODE_DROP_MAX)
        } else if (depthRatio >= BALANCE.MINERAL_CRYSTAL_DEPTH_THRESHOLD && rng() < BALANCE.MINERAL_CRYSTAL_CHANCE) {
          cell.content.mineralType = 'crystal'
          cell.content.mineralAmount = randomIntInclusive(rng, BALANCE.MINERAL_CRYSTAL_DROP_MIN, BALANCE.MINERAL_CRYSTAL_DROP_MAX)
        } else if (depthRatio >= BALANCE.MINERAL_SHARD_DEPTH_THRESHOLD && rng() < BALANCE.MINERAL_SHARD_CHANCE) {
          cell.content.mineralType = 'shard'
          cell.content.mineralAmount = randomIntInclusive(rng, BALANCE.MINERAL_SHARD_DROP_MIN, BALANCE.MINERAL_SHARD_DROP_MAX)
        }
      }
    }
  }

  placeMicroStructures(grid, rng, spawnX, spawnY, width, height, facts)

  // ---- Phase 49.4: Anomaly zone injection ----
  // Must happen after structural features and micro-structures, before hazards.
  const anomalyFactCursorRef = { cursor: factCursor }
  injectAnomalyZones(grid, biome, rng, width, height, spawnX, spawnY, facts, anomalyFactCursorRef)
  factCursor = anomalyFactCursorRef.cursor

  placeEmptyPockets(grid, rng, BALANCE.DENSITY_EMPTY_POCKETS)

  placeEmptyCaverns(grid, rng, spawnX, spawnY, width, height)

  placeExitRoom(grid, width, height, rng, nextFactId, spawnX, spawnY)

  placeHazards(grid, rng, height, biome, layer, difficultyProfile?.hazardMultiplier ?? 1.0)

  placeOxygenTanks(grid, positions, rng, height)

  placeDataDiscs(grid, positions, rng, height)

  placeFossilNodes(grid, positions, rng, height)

  // Place DescentShaft only on non-final layers (in bottom half of the mine).
  if (layer < BALANCE.MAX_LAYERS - 1) {
    placeDescentShaft(grid, rng, width, height, spawnX, spawnY)
  }

  // Place SendUpStation only on non-final layers (in the middle third of the mine).
  if (layer < BALANCE.MAX_LAYERS - 1) {
    placeSendUpStation(grid, rng, width, height, spawnX, spawnY)
  }

  // ---- Phase 35.1: Quiz gate scatter pass ----
  // Replace solid blocks below 15% depth with quiz gates at ~0.5% density.
  const minGateDepth = Math.floor(height * BALANCE.QUIZ_GATE_MIN_DEPTH_PERCENT)
  for (let y = minGateDepth; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x]
      if (
        cell.type !== BlockType.Stone &&
        cell.type !== BlockType.SoftRock &&
        cell.type !== BlockType.Dirt
      ) continue
      if (rng() < BALANCE.QUIZ_GATE_DENSITY) {
        cell.type = BlockType.QuizGate
        cell.hardness = BALANCE.HARDNESS_QUIZ_GATE
        cell.maxHardness = BALANCE.HARDNESS_QUIZ_GATE
      }
    }
  }

  // ---- Phase 35.3: Offering altar on landmark layers ----
  const isLandmarkLayer = [5, 10, 15, 20].includes(oneIndexedLayer)
  if (isLandmarkLayer) {
    const altarY = Math.floor(height * 0.6) + Math.floor(rng() * Math.floor(height * 0.25))
    const altarX = Math.floor(width * 0.2) + Math.floor(rng() * Math.floor(width * 0.6))
    if (altarY < height && altarX < width) {
      grid[altarY][altarX] = {
        type: BlockType.OfferingAltar,
        hardness: 0,
        maxHardness: 0,
        revealed: false,
        altarUsed: false,
      }
    }
  }

  // ---- Phase 35.5: Recipe fragment nodes ----
  // At most one fragment node per layer; only on layers where eligible recipes exist.
  const eligibleRecipes = getFragmentsForLayer(oneIndexedLayer)
  if (eligibleRecipes.length > 0) {
    const fragMinDepth = Math.floor(height * 0.5)
    let fragPlaced = 0
    for (let y = fragMinDepth; y < height && fragPlaced < 1; y++) {
      for (let x = 0; x < width && fragPlaced < 1; x++) {
        const cell = grid[y][x]
        if (cell.type !== BlockType.Stone && cell.type !== BlockType.HardRock) continue
        if (rng() < BALANCE.FRAGMENT_NODE_DENSITY) {
          const recipe = eligibleRecipes[Math.floor(rng() * eligibleRecipes.length)]
          cell.type = BlockType.RecipeFragmentNode
          cell.hardness = BALANCE.HARDNESS_RECIPE_FRAGMENT
          cell.maxHardness = BALANCE.HARDNESS_RECIPE_FRAGMENT
          cell.fragmentId = recipe.id
          fragPlaced++
        }
      }
    }
  }

  // ---- Phase 35.6: Conditionally breakable locked blocks ----
  // Replace hard rock / stone in the bottom 55% with locked blocks at ~1.2% density.
  const lockedMinDepth = Math.floor(height * BALANCE.LOCKED_BLOCK_MIN_DEPTH_PERCENT)
  const lockedTierWeights = BALANCE.LOCKED_BLOCK_TIER_WEIGHTS as ReadonlyArray<{ tier: number; weight: number }>
  const totalLockedWeight = lockedTierWeights.reduce((s, w) => s + w.weight, 0)
  for (let y = lockedMinDepth; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x]
      if (cell.type !== BlockType.Stone && cell.type !== BlockType.HardRock) continue
      if (rng() < BALANCE.LOCKED_BLOCK_DENSITY) {
        const tierRoll = rng()
        let cumulative = 0
        let requiredTier = 1
        for (const { tier, weight } of lockedTierWeights) {
          cumulative += weight / totalLockedWeight
          if (tierRoll <= cumulative) { requiredTier = tier; break }
        }
        cell.type = BlockType.LockedBlock
        cell.hardness = BALANCE.LOCKED_BLOCK_HARDNESS
        cell.maxHardness = BALANCE.LOCKED_BLOCK_HARDNESS
        cell.requiredTier = requiredTier
      }
    }
  }

  flagTransitionZones(grid, !!secondaryBiome, transitionBandWidth)

  return { grid, spawnX, spawnY, biome, secondaryBiome }
}

/**
 * Marks cells within the transition band as `isTransitionZone = true`.
 * When a dual-biome layer is present, the band is centered on the vertical split (x = width/2).
 * Without a secondary biome, the existing layer-boundary marking logic is applied instead.
 * (DD-V2-235, Phase 49.2.2)
 *
 * @param grid - The mine grid to annotate.
 * @param hasDualBiome - True when a secondary biome was provided to generateMine.
 * @param transitionBandWidth - Width in columns of the dual-biome transition band.
 */
function flagTransitionZones(
  grid: MineCell[][],
  hasDualBiome: boolean,
  transitionBandWidth: number,
): void {
  const height = grid.length
  if (height === 0) return
  const width = grid[0].length

  if (hasDualBiome) {
    // Dual-biome mode: flag cells within halfBand columns of the vertical split.
    const splitX = Math.floor(width / 2)
    const halfBand = Math.ceil(transitionBandWidth / 2)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (Math.abs(x - splitX) <= halfBand) {
          grid[y][x].isTransitionZone = true
        }
      }
    }
  } else {
    // Single-biome mode: flag top/bottom border rows as layer-boundary transition zones.
    const TRANSITION_DEPTH = 3
    for (let x = 0; x < width; x++) {
      for (let borderY = 0; borderY < TRANSITION_DEPTH; borderY++) {
        grid[borderY][x].isTransitionZone = true
        grid[height - 1 - borderY][x].isTransitionZone = true
      }
    }
  }
}

/**
 * Flood-fills from (x, y) through all connected empty/open cells, marking them fully revealed.
 * Immediately adjacent solid blocks at the border are marked as silhouettes (visibilityLevel=1).
 * Cells at distance 2 from revealed space are marked faint (visibilityLevel=2) for scanner upgrades.
 * The radius parameter is ignored (kept for API compatibility).
 */
export function revealAround(grid: MineCell[][], x: number, y: number, _radius: number): void {
  if (grid.length === 0 || grid[0].length === 0) return

  const height = grid.length
  const width = grid[0].length

  // Flood-fill through empty/revealed space from the player's position
  const queue: Array<{ x: number; y: number }> = [{ x, y }]
  const visited = new Set<number>()
  visited.add(y * width + x)

  while (queue.length > 0) {
    const cur = queue.shift()!
    const cell = grid[cur.y][cur.x]
    cell.revealed = true
    cell.visibilityLevel = undefined

    // Spread to orthogonal neighbors that are empty (or already revealed open space)
    const neighbors = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 },
    ]
    for (const n of neighbors) {
      if (n.x < 0 || n.y < 0 || n.x >= width || n.y >= height) continue
      const key = n.y * width + n.x
      if (visited.has(key)) continue
      visited.add(key)
      const nCell = grid[n.y][n.x]
      // Continue flood-fill through empty cells and already-revealed cells
      if (nCell.type === BlockType.Empty || nCell.revealed) {
        queue.push(n)
      }
    }
  }

  // After flood-fill: mark direct border (adjacent solid blocks) as silhouette (visibilityLevel=1)
  for (const key of visited) {
    const cy = Math.floor(key / width)
    const cx = key % width
    const neighbors = [
      { x: cx + 1, y: cy },
      { x: cx - 1, y: cy },
      { x: cx, y: cy + 1 },
      { x: cx, y: cy - 1 },
    ]
    for (const n of neighbors) {
      if (n.x < 0 || n.y < 0 || n.x >= width || n.y >= height) continue
      const nCell = grid[n.y][n.x]
      if (!nCell.revealed) {
        nCell.visibilityLevel = 1
      }
    }
  }

  // Mark second ring (distance-2 from revealed) as faint (visibilityLevel=2) for scanner upgrades
  for (const key of visited) {
    const cy = Math.floor(key / width)
    const cx = key % width
    const neighbors2 = [
      { x: cx + 2, y: cy },
      { x: cx - 2, y: cy },
      { x: cx, y: cy + 2 },
      { x: cx, y: cy - 2 },
      { x: cx + 1, y: cy + 1 },
      { x: cx + 1, y: cy - 1 },
      { x: cx - 1, y: cy + 1 },
      { x: cx - 1, y: cy - 1 },
    ]
    for (const n of neighbors2) {
      if (n.x < 0 || n.y < 0 || n.x >= width || n.y >= height) continue
      const nCell = grid[n.y][n.x]
      if (!nCell.revealed && nCell.visibilityLevel === undefined) {
        nCell.visibilityLevel = 2
      }
    }
  }
}

/**
 * Selects an artifact rarity using weighted probabilities from balance config.
 */
export function pickRarity(rng: () => number): Rarity {
  const entries = Object.entries(BALANCE.ARTIFACT_RARITY_WEIGHTS) as Array<[Rarity, number]>
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0)
  const roll = rng() * totalWeight

  let cumulative = 0
  for (const [rarity, weight] of entries) {
    cumulative += weight
    if (roll < cumulative) {
      return rarity
    }
  }

  return entries[entries.length - 1][0]
}

/**
 * Returns depth-scaled block weights for a given row, modified by the active biome and layer weights.
 * Shallow rows favour dirt; deep rows shift weight toward stone and hard rock.
 * Layer weights (from getBlockWeightsForLayer) scale the base per-row weights to reflect
 * depth progression across the full 20-layer mine, not just within a single layer.
 *
 * @param y - Current row index (0 = top of mine)
 * @param height - Total mine height in rows
 * @param biome - Active biome whose blockWeights multiply the base weights
 * @param layerWeights - Optional layer-level depth weights from getBlockWeightsForLayer
 * @param hardRockWeightMultiplier - Optional difficulty multiplier for HardRock density (Phase 49.7)
 */
function getDepthWeights(
  y: number,
  height: number,
  biome: Biome,
  layerWeights?: ReturnType<typeof getBlockWeightsForLayer>,
  hardRockWeightMultiplier = 1.0,
): Array<{ type: BlockType; weight: number }> {
  const depthRatio = y / height  // 0.0 at top, ~1.0 at bottom

  // Dirt decreases with depth, hard rock increases (within-layer variation)
  const dirtWeight = Math.max(10, 55 - depthRatio * 50)
  const softRockWeight = 20
  const stoneWeight = 10 + depthRatio * 20
  const hardRockWeight = 5 + depthRatio * 25

  // Apply layer-level multipliers when provided (blend within-layer weights with cross-layer weights)
  const dirtFinal = layerWeights ? dirtWeight * (layerWeights.dirt / 0.35) : dirtWeight
  const softRockFinal = layerWeights ? softRockWeight * (layerWeights.softRock / 0.20) : softRockWeight
  const stoneFinal = layerWeights ? stoneWeight * (layerWeights.stone / 0.25) : stoneWeight
  const hardRockFinal = layerWeights
    ? hardRockWeight * Math.max(0.01, layerWeights.hardRock / 0.35) * hardRockWeightMultiplier
    : hardRockWeight * hardRockWeightMultiplier

  return [
    { type: BlockType.Dirt, weight: dirtFinal * biome.blockWeights.dirt },
    { type: BlockType.SoftRock, weight: softRockFinal * biome.blockWeights.softRock },
    { type: BlockType.Stone, weight: stoneFinal * biome.blockWeights.stone },
    { type: BlockType.HardRock, weight: hardRockFinal * biome.blockWeights.hardRock },
  ]
}

function pickBaseBlock(
  rng: () => number,
  weightedBaseBlocks: Array<{ type: BlockType; weight: number }>,
  baseWeightTotal: number
): BlockType {
  if (rng() < BALANCE.DENSITY_UNBREAKABLE_RATIO) {
    return BlockType.Unbreakable
  }

  const roll = rng() * baseWeightTotal
  let cumulative = 0

  for (const entry of weightedBaseBlocks) {
    cumulative += entry.weight
    if (roll < cumulative) {
      return entry.type
    }
  }

  return BlockType.HardRock
}

/** @internal exported for use by AnomalyZoneSystem and other helpers */
export function getHardness(type: BlockType): number {
  switch (type) {
    case BlockType.Dirt:
      return BALANCE.HARDNESS_DIRT
    case BlockType.SoftRock:
      return BALANCE.HARDNESS_SOFT_ROCK
    case BlockType.Stone:
      return BALANCE.HARDNESS_STONE
    case BlockType.HardRock:
      return BALANCE.HARDNESS_HARD_ROCK
    case BlockType.MineralNode:
      return BALANCE.HARDNESS_MINERAL_NODE
    case BlockType.ArtifactNode:
      return BALANCE.HARDNESS_ARTIFACT_NODE
    case BlockType.QuizGate:
      return BALANCE.HARDNESS_QUIZ_GATE
    case BlockType.ExitLadder:
      return 0
    case BlockType.DescentShaft:
      return 1
    case BlockType.Chest:
      return 3
    case BlockType.Tablet:
      return 2
    case BlockType.Unbreakable:
      return 999
    default:
      return 0
  }
}

function buildSpecialPositionPool(width: number, height: number): Array<{ x: number; y: number }> {
  const pool: Array<{ x: number; y: number }> = []

  for (let y = 2; y < height; y++) {
    for (let x = 1; x < width - 1; x++) {
      pool.push({ x, y })
    }
  }

  return pool
}

function placeSpecialBlocks(
  grid: MineCell[][],
  positions: Array<{ x: number; y: number }>,
  count: number,
  rng: () => number,
  createCell: () => MineCell
): void {
  const placements = Math.min(count, positions.length)

  for (let i = 0; i < placements; i++) {
    const randomIndex = Math.floor(rng() * positions.length)
    const [position] = positions.splice(randomIndex, 1)
    grid[position.y][position.x] = createCell()
  }
}

function placeEmptyPockets(grid: MineCell[][], rng: () => number, count: number): void {
  const height = grid.length
  const width = height > 0 ? grid[0].length : 0

  if (width === 0 || height === 0) {
    return
  }

  const minCenterX = 1
  const maxCenterX = width - 2
  const minCenterY = 3
  const maxCenterY = height - 2

  if (maxCenterX < minCenterX || maxCenterY < minCenterY) {
    return
  }

  for (let i = 0; i < count; i++) {
    const centerX = randomIntInclusive(rng, minCenterX, maxCenterX)
    const centerY = randomIntInclusive(rng, minCenterY, maxCenterY)

    for (let y = centerY - 1; y <= centerY + 1; y++) {
      for (let x = centerX - 1; x <= centerX + 1; x++) {
        grid[y][x] = {
          type: BlockType.Empty,
          hardness: 0,
          maxHardness: 0,
          revealed: false,
        }
      }
    }
  }
}

/**
 * Places a single exit room in the mine at a random position.
 * The room is a rectangle of Unbreakable walls with an Empty interior,
 * an ExitLadder at the center, and a 1-wide corridor entrance on a
 * random side blocked by a QuizGate.
 */
function placeExitRoom(
  grid: MineCell[][],
  gridWidth: number,
  gridHeight: number,
  rng: () => number,
  nextFactId: () => string | undefined,
  spawnX: number,
  spawnY: number,
): void {
  const roomW = BALANCE.EXIT_ROOM_WIDTH
  const roomH = BALANCE.EXIT_ROOM_HEIGHT
  const margin = 3

  // Ensure room fits within the grid with margin from edges
  const minX = margin
  const maxX = gridWidth - roomW - margin
  const minY = margin
  const maxY = gridHeight - roomH - margin

  if (maxX < minX || maxY < minY) {
    return // Grid too small for exit room
  }

  // Try up to 10 times to find a room position at least 12 tiles from spawn (Manhattan)
  let roomX = randomIntInclusive(rng, minX, maxX)
  let roomY = randomIntInclusive(rng, minY, maxY)
  const MIN_EXIT_DISTANCE = 12
  for (let attempt = 0; attempt < 10; attempt++) {
    if (Math.abs(roomX - spawnX) + Math.abs(roomY - spawnY) >= MIN_EXIT_DISTANCE) break
    roomX = randomIntInclusive(rng, minX, maxX)
    roomY = randomIntInclusive(rng, minY, maxY)
  }

  // Carve the room: outer ring is Unbreakable, interior is Empty
  for (let dy = 0; dy < roomH; dy++) {
    for (let dx = 0; dx < roomW; dx++) {
      const gx = roomX + dx
      const gy = roomY + dy
      const isWall = dy === 0 || dy === roomH - 1 || dx === 0 || dx === roomW - 1

      grid[gy][gx] = {
        type: isWall ? BlockType.Unbreakable : BlockType.Empty,
        hardness: isWall ? 999 : 0,
        maxHardness: isWall ? 999 : 0,
        revealed: false,
      }
    }
  }

  // Place ExitLadder at center of interior
  const ladderX = roomX + Math.floor(roomW / 2)
  const ladderY = roomY + Math.floor(roomH / 2)
  grid[ladderY][ladderX] = {
    type: BlockType.ExitLadder,
    hardness: 0,
    maxHardness: 0,
    revealed: false,
  }

  // Choose a random side for the corridor entrance: 0=left, 1=right, 2=top, 3=bottom
  const side = Math.floor(rng() * 4)
  let gateX: number
  let gateY: number
  let corridorDx: number
  let corridorDy: number

  switch (side) {
    case 0: // Left
      gateX = roomX
      gateY = roomY + Math.floor(roomH / 2)
      corridorDx = -1
      corridorDy = 0
      break
    case 1: // Right
      gateX = roomX + roomW - 1
      gateY = roomY + Math.floor(roomH / 2)
      corridorDx = 1
      corridorDy = 0
      break
    case 2: // Top
      gateX = roomX + Math.floor(roomW / 2)
      gateY = roomY
      corridorDx = 0
      corridorDy = -1
      break
    default: // Bottom
      gateX = roomX + Math.floor(roomW / 2)
      gateY = roomY + roomH - 1
      corridorDx = 0
      corridorDy = 1
      break
  }

  // Place QuizGate at the wall opening — exit gate requires multiple correct answers
  const factId = nextFactId()
  grid[gateY][gateX] = {
    type: BlockType.QuizGate,
    hardness: BALANCE.EXIT_GATE_QUESTIONS,
    maxHardness: BALANCE.EXIT_GATE_QUESTIONS,
    revealed: false,
    content: {
      factId,
    },
  }

  // Carve a short corridor (1-2 blocks) outward from the gate
  const corridorLength = randomIntInclusive(rng, 1, 2)
  for (let i = 1; i <= corridorLength; i++) {
    const cx = gateX + corridorDx * i
    const cy = gateY + corridorDy * i
    if (cx >= 0 && cx < gridWidth && cy >= 0 && cy < gridHeight) {
      grid[cy][cx] = {
        type: BlockType.Empty,
        hardness: 0,
        maxHardness: 0,
        revealed: false,
      }
    }
  }
}

/**
 * Stamps pre-designed micro-structure rooms into the mine grid.
 *
 * Three room types are available:
 *   - Ancient Library Room (7×5): Unbreakable-walled chamber with an ArtifactNode
 *     at the centre and a QuizGate at the bottom entrance.
 *   - Rest Alcove (5×5): Stone-walled pocket with an OxygenCache at the centre
 *     and an open gap at the bottom entrance.
 *   - Crystal Cavern (6×6): HardRock-walled treasure cave with 4 MineralNodes and
 *     an OxygenCache at the centre. Only appears below CRYSTAL_CAVERN_MIN_DEPTH.
 *     Entrance is a 2-wide gap on a randomly chosen side.
 *
 * Rooms are placed at random positions that respect minimum depth constraints,
 * avoid the spawn area, and do not overlap each other or the grid edges.
 *
 * @param grid - The mine cell grid to stamp into
 * @param rng - Seeded random number generator
 * @param spawnX - Player spawn column (centre of 3×3 clear zone)
 * @param spawnY - Player spawn row (centre of 3×3 clear zone)
 * @param gridWidth - Total grid columns
 * @param gridHeight - Total grid rows
 * @param facts - Array of fact IDs to assign to library ArtifactNodes
 */
function placeMicroStructures(
  grid: MineCell[][],
  rng: () => number,
  spawnX: number,
  spawnY: number,
  gridWidth: number,
  gridHeight: number,
  facts: string[]
): void {
  /** Occupied bounding boxes so rooms do not overlap each other. */
  const placedBoxes: Array<{ x: number; y: number; w: number; h: number }> = []

  /**
   * Returns true when the candidate box overlaps any already-placed bounding box.
   * A 1-cell gap is enforced between rooms.
   */
  function overlapsPlaced(x: number, y: number, w: number, h: number): boolean {
    for (const box of placedBoxes) {
      if (
        x < box.x + box.w + 1 &&
        x + w + 1 > box.x &&
        y < box.y + box.h + 1 &&
        y + h + 1 > box.y
      ) {
        return true
      }
    }
    return false
  }

  /**
   * Returns true when the candidate box overlaps the 3×3 spawn clearance area.
   */
  function overlapsSpawn(x: number, y: number, w: number, h: number): boolean {
    const spawnMinX = spawnX - 1
    const spawnMaxX = spawnX + 1
    const spawnMinY = spawnY - 1
    const spawnMaxY = spawnY + 1
    return (
      x <= spawnMaxX &&
      x + w - 1 >= spawnMinX &&
      y <= spawnMaxY &&
      y + h - 1 >= spawnMinY
    )
  }

  /**
   * Stamps an Ancient Library Room at (roomX, roomY).
   *
   * Layout (7 wide × 5 tall):
   *   UUUUUUU
   *   U.....U    U = Unbreakable wall
   *   U..A..U    . = Empty
   *   U.....U    A = ArtifactNode (guaranteed rare)
   *   UUUQUUU    Q = QuizGate entrance (bottom-centre wall opening)
   */
  function stampLibraryRoom(roomX: number, roomY: number, factId: string | undefined): void {
    const W = 7
    const H = 5

    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const gx = roomX + dx
        const gy = roomY + dy

        // Centre of the room interior (row 2, col 3 in 0-indexed 7×5)
        const isArtifact = dy === 2 && dx === 3
        // Bottom-centre wall opening replaced by QuizGate
        const isQuizGate = dy === H - 1 && dx === 3
        const isWall = dy === 0 || dy === H - 1 || dx === 0 || dx === W - 1

        let cell: MineCell

        if (isArtifact) {
          const hardness = BALANCE.HARDNESS_ARTIFACT_NODE
          cell = {
            type: BlockType.ArtifactNode,
            hardness,
            maxHardness: hardness,
            revealed: false,
            content: {
              artifactRarity: 'rare',
              factId,
            },
          }
        } else if (isQuizGate) {
          const hardness = BALANCE.HARDNESS_QUIZ_GATE
          cell = {
            type: BlockType.QuizGate,
            hardness,
            maxHardness: hardness,
            revealed: false,
            content: { factId },
          }
        } else if (isWall) {
          cell = {
            type: BlockType.Unbreakable,
            hardness: 999,
            maxHardness: 999,
            revealed: false,
          }
        } else {
          cell = {
            type: BlockType.Empty,
            hardness: 0,
            maxHardness: 0,
            revealed: false,
          }
        }

        grid[gy][gx] = cell
      }
    }
  }

  /**
   * Stamps a Crystal Cavern at (roomX, roomY).
   *
   * Layout (6 wide × 6 tall):
   *   HHHHHH
   *   H....H    H = HardRock wall (crystalline)
   *   H.MM.H    . = Empty interior
   *   HMO.MH    M = MineralNode (4 total, scattered)
   *   H....H    O = OxygenCache (centre reward)
   *   HH.HHH    Gap at bottom-centre = 2-wide open entrance
   *
   * The entrance is 2 cells wide on a randomly chosen side.
   */
  function stampCrystalCavern(roomX: number, roomY: number, roomDepthY: number): void {
    const W = 6
    const H = 6

    // Mineral node positions (interior only, not on walls): relative (dx, dy)
    // Using a fixed scatter pattern within the 4×4 interior (dx 1..4, dy 1..4)
    const mineralPositions: Array<{ dx: number; dy: number }> = [
      { dx: 2, dy: 1 },
      { dx: 4, dy: 1 },
      { dx: 1, dy: 3 },
      { dx: 4, dy: 3 },
    ]
    const mineralSet = new Set(mineralPositions.map(p => `${p.dx},${p.dy}`))

    // OxygenCache at centre of interior (dx=2 or 3, dy=2 or 3 — pick col 2, row 2 interior offset)
    const oxygenDx = 2
    const oxygenDy = 3

    // Choose a random side for the 2-wide entrance: 0=left, 1=right, 2=top, 3=bottom
    const entranceSide = Math.floor(rng() * 4)

    // Determine which cells are entrance gaps (2-wide, centred on the chosen wall)
    function isEntranceGap(dx: number, dy: number): boolean {
      switch (entranceSide) {
        case 0: // Left wall — open dx=0, dy=2 and dy=3
          return dx === 0 && (dy === 2 || dy === 3)
        case 1: // Right wall — open dx=W-1, dy=2 and dy=3
          return dx === W - 1 && (dy === 2 || dy === 3)
        case 2: // Top wall — open dy=0, dx=2 and dx=3
          return dy === 0 && (dx === 2 || dx === 3)
        default: // Bottom wall — open dy=H-1, dx=2 and dx=3
          return dy === H - 1 && (dx === 2 || dx === 3)
      }
    }

    // Determine the mineralType based on depth (mirrors the post-pass logic in generateMine).
    // Priority order (highest wins): essence → geode → crystal → shard → dust
    const depthRatio = roomDepthY / gridHeight
    type CavernTier = 'dust' | 'shard' | 'crystal' | 'geode' | 'essence'
    let cavernMineralType: CavernTier = 'dust'
    if (depthRatio >= BALANCE.MINERAL_ESSENCE_DEPTH_THRESHOLD && rng() < BALANCE.MINERAL_ESSENCE_CHANCE) {
      cavernMineralType = 'essence'
    } else if (depthRatio >= BALANCE.MINERAL_GEODE_DEPTH_THRESHOLD && rng() < BALANCE.MINERAL_GEODE_CHANCE) {
      cavernMineralType = 'geode'
    } else if (depthRatio >= BALANCE.MINERAL_CRYSTAL_DEPTH_THRESHOLD && rng() < BALANCE.MINERAL_CRYSTAL_CHANCE) {
      cavernMineralType = 'crystal'
    } else if (depthRatio >= BALANCE.MINERAL_SHARD_DEPTH_THRESHOLD && rng() < BALANCE.MINERAL_SHARD_CHANCE) {
      cavernMineralType = 'shard'
    }

    const mineralDropMin = cavernMineralType === 'essence'
      ? BALANCE.MINERAL_ESSENCE_DROP_MIN
      : cavernMineralType === 'geode'
        ? BALANCE.MINERAL_GEODE_DROP_MIN
        : cavernMineralType === 'crystal'
          ? BALANCE.MINERAL_CRYSTAL_DROP_MIN
          : cavernMineralType === 'shard'
            ? BALANCE.MINERAL_SHARD_DROP_MIN
            : BALANCE.MINERAL_DROP_MIN
    const mineralDropMax = cavernMineralType === 'essence'
      ? BALANCE.MINERAL_ESSENCE_DROP_MAX
      : cavernMineralType === 'geode'
        ? BALANCE.MINERAL_GEODE_DROP_MAX
        : cavernMineralType === 'crystal'
          ? BALANCE.MINERAL_CRYSTAL_DROP_MAX
          : cavernMineralType === 'shard'
            ? BALANCE.MINERAL_SHARD_DROP_MAX
            : BALANCE.MINERAL_DROP_MAX

    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const gx = roomX + dx
        const gy = roomY + dy

        const isMineral = mineralSet.has(`${dx},${dy}`)
        const isOxygen = dx === oxygenDx && dy === oxygenDy
        const isEntrance = isEntranceGap(dx, dy)
        const isWall = !isMineral && !isOxygen && !isEntrance &&
          (dy === 0 || dy === H - 1 || dx === 0 || dx === W - 1)

        let cell: MineCell

        if (isMineral) {
          const hardness = BALANCE.HARDNESS_MINERAL_NODE
          const mineralAmount = randomIntInclusive(rng, mineralDropMin, mineralDropMax)
          cell = {
            type: BlockType.MineralNode,
            hardness,
            maxHardness: hardness,
            revealed: false,
            content: {
              mineralType: cavernMineralType,
              mineralAmount,
            },
          }
        } else if (isOxygen) {
          cell = {
            type: BlockType.OxygenCache,
            hardness: 2,
            maxHardness: 2,
            revealed: false,
            content: { oxygenAmount: BALANCE.OXYGEN_CACHE_RESTORE },
          }
        } else if (isWall) {
          const hardness = BALANCE.HARDNESS_HARD_ROCK
          cell = {
            type: BlockType.HardRock,
            hardness,
            maxHardness: hardness,
            revealed: false,
          }
        } else {
          // Interior empty cells and entrance gap
          cell = {
            type: BlockType.Empty,
            hardness: 0,
            maxHardness: 0,
            revealed: false,
          }
        }

        grid[gy][gx] = cell
      }
    }
  }

  /**
   * Stamps a Rest Alcove at (roomX, roomY).
   *
   * Layout (5 wide × 5 tall):
   *   SSSSS
   *   S...S    S = Stone wall (minable — can tunnel around)
   *   S.O.S    . = Empty interior
   *   S...S    O = OxygenCache
   *   SS.SS    Gap at bottom-centre = open entrance
   */
  function stampRestAlcove(roomX: number, roomY: number): void {
    const W = 5
    const H = 5

    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const gx = roomX + dx
        const gy = roomY + dy

        const isOxygen = dy === 2 && dx === 2
        // Bottom-centre cell is the open entrance gap (Empty, not Stone)
        const isEntrance = dy === H - 1 && dx === 2
        const isWall =
          !isOxygen &&
          !isEntrance &&
          (dy === 0 || dy === H - 1 || dx === 0 || dx === W - 1)

        let cell: MineCell

        if (isOxygen) {
          cell = {
            type: BlockType.OxygenCache,
            hardness: 2,
            maxHardness: 2,
            revealed: false,
            content: { oxygenAmount: BALANCE.OXYGEN_CACHE_RESTORE },
          }
        } else if (isWall) {
          const hardness = BALANCE.HARDNESS_STONE
          cell = {
            type: BlockType.Stone,
            hardness,
            maxHardness: hardness,
            revealed: false,
          }
        } else {
          // Interior empty cells and the entrance gap
          cell = {
            type: BlockType.Empty,
            hardness: 0,
            maxHardness: 0,
            revealed: false,
          }
        }

        grid[gy][gx] = cell
      }
    }
  }

  /**
   * Stamps a Collapsed Tunnel at (roomX, roomY).
   *
   * Layout (COLLAPSED_TUNNEL_LENGTH wide × 3 tall), left-to-right example:
   *   UUUUUUU    U = Unbreakable wall/ceiling
   *   .DSDSDА    . = Open entrance, D = Dirt rubble, S = SoftRock rubble, A = ArtifactNode reward
   *   UUUUUUU
   *
   * `goRight` determines which end has the open entrance (left) vs. the ArtifactNode (right).
   * When false the layout is mirrored: entrance on the right, reward on the left.
   */
  function stampCollapsedTunnel(
    roomX: number,
    roomY: number,
    goRight: boolean,
    factId: string | undefined,
  ): void {
    const W = BALANCE.COLLAPSED_TUNNEL_LENGTH
    const H = 3

    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const gx = roomX + dx
        const gy = roomY + dy

        let cell: MineCell

        if (dy === 0 || dy === H - 1) {
          // Top and bottom rows are Unbreakable (tunnel ceiling/floor walls)
          cell = {
            type: BlockType.Unbreakable,
            hardness: 999,
            maxHardness: 999,
            revealed: false,
          }
        } else {
          // Middle row (dy === 1): entrance, rubble, and reward
          const entranceCol = goRight ? 0 : W - 1
          const artifactCol = goRight ? W - 1 : 0

          if (dx === entranceCol) {
            // Open entrance cell — connects tunnel to surrounding mine space
            cell = {
              type: BlockType.Empty,
              hardness: 0,
              maxHardness: 0,
              revealed: false,
            }
          } else if (dx === artifactCol) {
            // Reward ArtifactNode at the far end of the tunnel
            const hardness = BALANCE.HARDNESS_ARTIFACT_NODE
            cell = {
              type: BlockType.ArtifactNode,
              hardness,
              maxHardness: hardness,
              revealed: false,
              content: {
                artifactRarity: pickRarity(rng),
                factId,
              },
            }
          } else {
            // Rubble: ~60% Dirt, ~40% SoftRock
            const isDirt = rng() < 0.6
            const rubbleType = isDirt ? BlockType.Dirt : BlockType.SoftRock
            const rubbleHardness = isDirt ? BALANCE.HARDNESS_DIRT : BALANCE.HARDNESS_SOFT_ROCK
            cell = {
              type: rubbleType,
              hardness: rubbleHardness,
              maxHardness: rubbleHardness,
              revealed: false,
            }
          }
        }

        grid[gy][gx] = cell
      }
    }
  }

  /**
   * Stamps a Ruins with Lore site at (roomX, roomY).
   *
   * Layout (9 wide × 7 tall) — an ancient ruined chamber:
   *   Walls: mix of Unbreakable (U) and Stone (S); ~30% of non-anchor wall blocks crumble to Empty.
   *   Interior contains: 3 QuoteStones in a row (inscription wall), 1 ArtifactNode in a corner,
   *                      2 MineralNodes scattered, 1 OxygenCache hidden inside, Dirt rubble debris.
   *   Entrance: 2-wide gap on the bottom wall (collapsed entrance).
   *
   *   Schematic (U=Unbreakable, S=Stone, .=Empty, Q=QuoteStone, A=ArtifactNode,
   *              M=MineralNode, O=OxygenCache, D=Dirt rubble):
   *   U S U U U U U S U   row 0
   *   U . . . . . . . U   row 1
   *   S . D . Q Q Q . U   row 2
   *   U . . . . . . . S   row 3
   *   U . M . . . M . U   row 4
   *   U . . . O . . . U   row 5
   *   U U A U . . U U U   row 6  ← 2-wide entrance at dx=4,5
   */
  function stampRuins(roomX: number, roomY: number, factId: string | undefined): void {
    const W = 9
    const H = 7

    // QuoteStone inscription wall: 3 stones in interior row dy=2 at dx=4,5,6
    const quotePositions = new Set(['4,2', '5,2', '6,2'])

    // ArtifactNode at bottom-left interior position (bottom wall row, dx=2)
    const artifactDx = 2
    const artifactDy = H - 1

    // MineralNode positions (interior)
    const mineralPositions = new Set(['2,4', '6,4'])

    // OxygenCache — tucked into the interior near bottom-centre
    const oxygenDx = 4
    const oxygenDy = 5

    // Dirt rubble scattered inside (avoids all special block positions)
    const dirtRubblePositions = new Set(['2,2', '6,3', '4,4'])

    // Entrance: 2-wide gap on the bottom wall at dx=4 and dx=5
    function isEntranceGap(dx: number, dy: number): boolean {
      return dy === H - 1 && (dx === 4 || dx === 5)
    }

    // Pre-roll crumble decisions for border (wall) cells — 30% chance each, excluding anchors
    const crumbleMap = new Set<string>()
    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const onBorder = dy === 0 || dy === H - 1 || dx === 0 || dx === W - 1
        if (!onBorder) continue
        if (isEntranceGap(dx, dy)) continue
        // Corner cells are structural anchors — always solid
        const isCorner = (dx === 0 || dx === W - 1) && (dy === 0 || dy === H - 1)
        if (isCorner) continue
        // Artifact wall cell must remain solid
        if (dx === artifactDx && dy === artifactDy) continue
        if (rng() < 0.3) {
          crumbleMap.add(`${dx},${dy}`)
        }
      }
    }

    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const gx = roomX + dx
        const gy = roomY + dy

        const key = `${dx},${dy}`
        const onBorder = dy === 0 || dy === H - 1 || dx === 0 || dx === W - 1
        const isEntrance = isEntranceGap(dx, dy)
        const isQuote = quotePositions.has(key)
        const isArtifact = dx === artifactDx && dy === artifactDy
        const isMineral = mineralPositions.has(key)
        const isOxygen = dx === oxygenDx && dy === oxygenDy
        const isDirt = dirtRubblePositions.has(key)
        const isCrumbled = crumbleMap.has(key)

        let cell: MineCell

        if (isEntrance) {
          cell = {
            type: BlockType.Empty,
            hardness: 0,
            maxHardness: 0,
            revealed: false,
          }
        } else if (isArtifact) {
          const hardness = BALANCE.HARDNESS_ARTIFACT_NODE
          cell = {
            type: BlockType.ArtifactNode,
            hardness,
            maxHardness: hardness,
            revealed: false,
            content: {
              artifactRarity: 'rare',
              factId,
            },
          }
        } else if (isQuote) {
          cell = {
            type: BlockType.QuoteStone,
            hardness: 2,
            maxHardness: 2,
            revealed: false,
          }
        } else if (isMineral) {
          const hardness = BALANCE.HARDNESS_MINERAL_NODE
          const mineralAmount = randomIntInclusive(rng, BALANCE.MINERAL_DROP_MIN, BALANCE.MINERAL_DROP_MAX)
          cell = {
            type: BlockType.MineralNode,
            hardness,
            maxHardness: hardness,
            revealed: false,
            content: {
              mineralType: 'dust',
              mineralAmount,
            },
          }
        } else if (isOxygen) {
          cell = {
            type: BlockType.OxygenCache,
            hardness: 2,
            maxHardness: 2,
            revealed: false,
            content: { oxygenAmount: BALANCE.OXYGEN_CACHE_RESTORE },
          }
        } else if (isDirt && !onBorder) {
          const hardness = BALANCE.HARDNESS_DIRT
          cell = {
            type: BlockType.Dirt,
            hardness,
            maxHardness: hardness,
            revealed: false,
          }
        } else if (onBorder && isCrumbled) {
          // Crumbled wall section — open gap suggesting ruin
          cell = {
            type: BlockType.Empty,
            hardness: 0,
            maxHardness: 0,
            revealed: false,
          }
        } else if (onBorder) {
          // Wall: corners always Unbreakable; other cells alternate Stone/Unbreakable by position
          const isCorner = (dx === 0 || dx === W - 1) && (dy === 0 || dy === H - 1)
          const useUnbreakable = isCorner || (dx + dy) % 3 !== 1
          if (useUnbreakable) {
            cell = {
              type: BlockType.Unbreakable,
              hardness: 999,
              maxHardness: 999,
              revealed: false,
            }
          } else {
            const hardness = BALANCE.HARDNESS_STONE
            cell = {
              type: BlockType.Stone,
              hardness,
              maxHardness: hardness,
              revealed: false,
            }
          }
        } else {
          // Interior empty space
          cell = {
            type: BlockType.Empty,
            hardness: 0,
            maxHardness: 0,
            revealed: false,
          }
        }

        grid[gy][gx] = cell
      }
    }
  }

  // Dimensions of each room type
  const LIBRARY_W = 7
  const LIBRARY_H = 5
  const ALCOVE_W = 5
  const ALCOVE_H = 5
  const CAVERN_W = 6
  const CAVERN_H = 6
  const TUNNEL_W = BALANCE.COLLAPSED_TUNNEL_LENGTH
  const TUNNEL_H = 3
  const RUINS_W = 9
  const RUINS_H = 7
  const EDGE_MARGIN = 1

  // Independent fact cursor for micro-structure ArtifactNodes
  let factCursor = 0
  const nextMicroFactId = (): string | undefined => {
    if (facts.length === 0) return undefined
    const id = facts[factCursor % facts.length]
    factCursor++
    return id
  }

  // Guarantee one Ruins per mine (if depth allows) as a bonus slot beyond MICRO_STRUCTURE_COUNT.
  // Ruins is the rarest structure — placed first, before the standard pool roll.
  const ruinsGuaranteeMinY = BALANCE.RUINS_MIN_DEPTH
  const ruinsGuaranteeMaxY = gridHeight - RUINS_H - EDGE_MARGIN
  if (ruinsGuaranteeMinY <= ruinsGuaranteeMaxY) {
    let ruinsPlaced = false
    for (let attempt = 0; attempt < 20; attempt++) {
      const rx = randomIntInclusive(rng, EDGE_MARGIN, gridWidth - RUINS_W - EDGE_MARGIN)
      const ry = randomIntInclusive(rng, ruinsGuaranteeMinY, ruinsGuaranteeMaxY)

      if (overlapsSpawn(rx, ry, RUINS_W, RUINS_H)) continue
      if (overlapsPlaced(rx, ry, RUINS_W, RUINS_H)) continue

      stampRuins(rx, ry, nextMicroFactId())
      placedBoxes.push({ x: rx, y: ry, w: RUINS_W, h: RUINS_H })
      ruinsPlaced = true
      break
    }

    if (!ruinsPlaced) {
      // Burn an rng call to keep the sequence predictable
      rng()
    }
  }

  for (let i = 0; i < BALANCE.MICRO_STRUCTURE_COUNT; i++) {
    // Roll a room type using weighted probability:
    //   0.00–0.15  → Ruins (15% — rare, depth-gated, second possible occurrence)
    //   0.15–1.00  → existing four types split ~evenly (~21.25% each)
    // Crystal Cavern and Ruins fall back to Rest Alcove when the grid is too shallow.
    const roomRoll = rng()

    // Determine room dimensions, minimum depth, and type
    let roomW: number
    let roomH: number
    let minDepth: number
    let roomType: 'library' | 'alcove' | 'cavern' | 'tunnel' | 'ruins'

    if (roomRoll < 0.15) {
      // Ruins — rare pool occurrence
      const ruinsPoolMaxY = gridHeight - RUINS_H - EDGE_MARGIN
      if (BALANCE.RUINS_MIN_DEPTH > ruinsPoolMaxY) {
        // Fall back to Rest Alcove if too shallow
        roomW = ALCOVE_W
        roomH = ALCOVE_H
        minDepth = BALANCE.REST_ALCOVE_MIN_DEPTH
        roomType = 'alcove'
      } else {
        roomW = RUINS_W
        roomH = RUINS_H
        minDepth = BALANCE.RUINS_MIN_DEPTH
        roomType = 'ruins'
      }
    } else {
      // Distribute remaining 85% evenly across 4 existing types (~21.25% each)
      const subRoll = Math.floor((roomRoll - 0.15) / 0.2125)

      if (subRoll === 0) {
        roomW = LIBRARY_W
        roomH = LIBRARY_H
        minDepth = BALANCE.LIBRARY_ROOM_MIN_DEPTH
        roomType = 'library'
      } else if (subRoll === 1) {
        roomW = ALCOVE_W
        roomH = ALCOVE_H
        minDepth = BALANCE.REST_ALCOVE_MIN_DEPTH
        roomType = 'alcove'
      } else if (subRoll === 2) {
        // Crystal Cavern — fall back to Rest Alcove if the grid is too shallow
        const cavernMinY = BALANCE.CRYSTAL_CAVERN_MIN_DEPTH
        const cavernMaxY = gridHeight - CAVERN_H - EDGE_MARGIN
        if (cavernMinY > cavernMaxY) {
          roomW = ALCOVE_W
          roomH = ALCOVE_H
          minDepth = BALANCE.REST_ALCOVE_MIN_DEPTH
          roomType = 'alcove'
        } else {
          roomW = CAVERN_W
          roomH = CAVERN_H
          minDepth = cavernMinY
          roomType = 'cavern'
        }
      } else {
        // Collapsed Tunnel — fall back to Rest Alcove if the grid is too shallow
        const tunnelMinY = BALANCE.COLLAPSED_TUNNEL_MIN_DEPTH
        const tunnelMaxY = gridHeight - TUNNEL_H - EDGE_MARGIN
        if (tunnelMinY > tunnelMaxY) {
          roomW = ALCOVE_W
          roomH = ALCOVE_H
          minDepth = BALANCE.REST_ALCOVE_MIN_DEPTH
          roomType = 'alcove'
        } else {
          roomW = TUNNEL_W
          roomH = TUNNEL_H
          minDepth = tunnelMinY
          roomType = 'tunnel'
        }
      }
    }

    const minX = EDGE_MARGIN
    const maxX = gridWidth - roomW - EDGE_MARGIN
    const minY = minDepth
    const maxY = gridHeight - roomH - EDGE_MARGIN

    if (maxX < minX || maxY < minY) {
      continue // Grid too small to fit this room type — skip silently
    }

    let placed = false
    for (let attempt = 0; attempt < 20; attempt++) {
      const rx = randomIntInclusive(rng, minX, maxX)
      const ry = randomIntInclusive(rng, minY, maxY)

      if (overlapsSpawn(rx, ry, roomW, roomH)) continue
      if (overlapsPlaced(rx, ry, roomW, roomH)) continue

      if (roomType === 'library') {
        stampLibraryRoom(rx, ry, nextMicroFactId())
      } else if (roomType === 'cavern') {
        stampCrystalCavern(rx, ry, ry)
      } else if (roomType === 'tunnel') {
        const goRight = rng() < 0.5
        stampCollapsedTunnel(rx, ry, goRight, nextMicroFactId())
      } else if (roomType === 'ruins') {
        stampRuins(rx, ry, nextMicroFactId())
      } else {
        stampRestAlcove(rx, ry)
      }

      placedBoxes.push({ x: rx, y: ry, w: roomW, h: roomH })
      placed = true
      break
    }

    if (!placed) {
      // Burn a single rng call so the sequence stays predictable regardless of placement success
      rng()
    }
  }

  // ── Phase 49.1.2: Three new micro-structure room types ───────────────────

  /**
   * Stamps an Underground River channel at (roomX, roomY).
   *
   * Layout (10 wide × 4 tall):
   *   UUUUUUUUUU   U = Unbreakable ceiling
   *   .LLLLLLLL.   L = LavaBlock river (lava proxy for molten underground river)
   *   SSSSSSSSSS   S = Stone riverbed
   *   UUUUUUUUUU   U = Unbreakable floor
   *
   * Entrance: 2-wide gap on the left wall (dx=0, dy=1 and dy=2 replaced with Empty).
   * Exit: 2-wide gap on the right wall (dx=9, dy=1 and dy=2 replaced with Empty).
   * Only placed at layer depth >= RIVER_MIN_DEPTH_RATIO (0.3) of grid height.
   */
  function stampUndergroundRiver(roomX: number, roomY: number): void {
    const W = 10
    const H = 4
    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const gx = roomX + dx
        const gy = roomY + dy
        if (gx < 0 || gx >= gridWidth || gy < 0 || gy >= gridHeight) continue
        const isEntrance = dx === 0 && (dy === 1 || dy === 2)
        const isExit = dx === W - 1 && (dy === 1 || dy === 2)
        let cell: MineCell
        if (isEntrance || isExit) {
          cell = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: false }
        } else if (dy === 0 || dy === H - 1) {
          cell = { type: BlockType.Unbreakable, hardness: 999, maxHardness: 999, revealed: false }
        } else if (dy === 1) {
          cell = { type: BlockType.LavaBlock, hardness: 0, maxHardness: 0, revealed: false }
        } else {
          const h = BALANCE.HARDNESS_STONE
          cell = { type: BlockType.Stone, hardness: h, maxHardness: h, revealed: false }
        }
        grid[gy][gx] = cell
      }
    }
  }

  /**
   * Stamps a Stalactite Gallery at (roomX, roomY).
   *
   * Layout (8 wide × 7 tall):
   *   UUUUUUUU   ceiling (Unbreakable)
   *   UH.H.H.U   H = HardRock stalactite tip, . = open air
   *   U.HHH..U
   *   U......U   open interior
   *   U.M..M.U   M = MineralNode rewards on floor
   *   U......U
   *   UUQQUUUU   Q = QuizGate entrance pair (bottom-centre)
   *
   * Stalactite pattern is generated probabilistically per column for natural variation.
   */
  function stampStalactiteGallery(roomX: number, roomY: number, factId: string | undefined): void {
    const W = 8
    const H = 7
    const stalactiteColumns = new Set<number>()
    // Randomly pick columns for stalactites (avoid col 0 and W-1 wall cols)
    for (let col = 1; col < W - 1; col++) {
      if (rng() < 0.5) stalactiteColumns.add(col)
    }
    const mineralCols = new Set([2, 5])  // fixed mineral positions on floor

    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const gx = roomX + dx
        const gy = roomY + dy
        if (gx < 0 || gx >= gridWidth || gy < 0 || gy >= gridHeight) continue
        const isWall = dy === 0 || dy === H - 1 || dx === 0 || dx === W - 1
        const isQuizGate = dy === H - 1 && (dx === 3 || dx === 4)
        const isStalactite = !isWall && dy <= 2 && stalactiteColumns.has(dx) && dy >= 1
        const isMineral = dy === H - 2 && mineralCols.has(dx)

        let cell: MineCell
        if (isQuizGate) {
          const hardness = BALANCE.HARDNESS_QUIZ_GATE
          cell = { type: BlockType.QuizGate, hardness, maxHardness: hardness, revealed: false, content: { factId } }
        } else if (isWall) {
          cell = { type: BlockType.Unbreakable, hardness: 999, maxHardness: 999, revealed: false }
        } else if (isStalactite) {
          const h = BALANCE.HARDNESS_HARD_ROCK
          cell = { type: BlockType.HardRock, hardness: h, maxHardness: h, revealed: false }
        } else if (isMineral) {
          const h = BALANCE.HARDNESS_MINERAL_NODE
          const amt = randomIntInclusive(rng, BALANCE.MINERAL_DROP_MIN, BALANCE.MINERAL_DROP_MAX)
          cell = { type: BlockType.MineralNode, hardness: h, maxHardness: h, revealed: false, content: { mineralType: 'crystal', mineralAmount: amt } }
        } else {
          cell = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: false }
        }
        grid[gy][gx] = cell
      }
    }
  }

  /**
   * Stamps a large Geode Chamber at (roomX, roomY).
   *
   * A circular hollow (radius ~3) of Empty interior, surrounded by HardRock walls,
   * with MineralNodes embedded in the inner wall ring,
   * and a single ArtifactNode at the centre. Entrance: 3-wide gap at bottom.
   * Only placed at depth >= 0.5 of the grid height.
   */
  function stampGeodeChamber(roomX: number, roomY: number, factId: string | undefined): void {
    const W = 9
    const H = 9
    const cx = roomX + 4
    const cy = roomY + 4
    const outerR = 4.2
    const innerR = 3.0
    const mineralR = 3.5

    // Pre-compute mineral positions on inner-wall ring (6-directional)
    const mineralAngles = [0, 45, 90, 135, 180, 225].map(a => a * Math.PI / 180)
    const mineralPositions = new Set(mineralAngles.map(a =>
      `${cx + Math.round(Math.cos(a) * mineralR)},${cy + Math.round(Math.sin(a) * mineralR)}`
    ))

    const depthRatio = roomY / gridHeight
    type MineralTierLocal = 'dust' | 'shard' | 'crystal' | 'geode' | 'essence'
    let gemTier: MineralTierLocal = 'crystal'
    if (depthRatio >= 0.8) gemTier = 'geode'
    if (depthRatio >= 0.95) gemTier = 'essence'

    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const gx = roomX + dx
        const gy = roomY + dy
        if (gx < 0 || gx >= gridWidth || gy < 0 || gy >= gridHeight) continue
        const dist = Math.sqrt((gx - cx) ** 2 + (gy - cy) ** 2)
        const key = `${gx},${gy}`
        const isEntrance = dy === H - 1 && (dx === 3 || dx === 4 || dx === 5)
        let cell: MineCell

        if (isEntrance) {
          cell = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: false }
        } else if (gx === cx && gy === cy) {
          // Central artifact
          const h = BALANCE.HARDNESS_ARTIFACT_NODE
          cell = { type: BlockType.ArtifactNode, hardness: h, maxHardness: h, revealed: false, content: { artifactRarity: 'epic', factId } }
        } else if (mineralPositions.has(key) && dist <= outerR) {
          const h = BALANCE.HARDNESS_MINERAL_NODE
          const amt = randomIntInclusive(rng, 1, 3)
          cell = { type: BlockType.MineralNode, hardness: h, maxHardness: h, revealed: false, content: { mineralType: gemTier, mineralAmount: amt } }
        } else if (dist <= innerR) {
          cell = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: false }
        } else if (dist <= outerR) {
          const h = BALANCE.HARDNESS_HARD_ROCK
          cell = { type: BlockType.HardRock, hardness: h, maxHardness: h, revealed: false }
        } else {
          continue  // outside the circle — skip (leave existing block)
        }
        grid[gy][gx] = cell
      }
    }
  }

  // Underground River — placed once per layer, only in the lower 70% of the grid
  if (rng() < 0.20 && gridHeight >= 10) {
    const W = 10; const H = 4
    const rx = 2 + Math.floor(rng() * Math.max(1, gridWidth - W - 4))
    const ry = Math.floor(gridHeight * 0.3) + Math.floor(rng() * Math.max(1, Math.floor(gridHeight * 0.5)))
    if (!overlapsPlaced(rx, ry, W, H) && !overlapsSpawn(rx, ry, W, H)) {
      stampUndergroundRiver(rx, ry)
      placedBoxes.push({ x: rx, y: ry, w: W, h: H })
    }
  }

  // Stalactite Gallery — once per layer, mid-depth
  if (rng() < 0.25 && gridHeight >= 8) {
    const W = 8; const H = 7
    const rx = 2 + Math.floor(rng() * Math.max(1, gridWidth - W - 4))
    const ry = Math.floor(gridHeight * 0.2) + Math.floor(rng() * Math.max(1, Math.floor(gridHeight * 0.5)))
    if (!overlapsPlaced(rx, ry, W, H) && !overlapsSpawn(rx, ry, W, H)) {
      const factId = facts[factCursor % Math.max(1, facts.length)]
      factCursor++
      stampStalactiteGallery(rx, ry, factId)
      placedBoxes.push({ x: rx, y: ry, w: W, h: H })
    }
  }

  // Geode Chamber — once per layer, lower half only
  if (rng() < 0.15 && gridHeight >= 10) {
    const W = 9; const H = 9
    const rx = 2 + Math.floor(rng() * Math.max(1, gridWidth - W - 4))
    const ry = Math.floor(gridHeight * 0.5) + Math.floor(rng() * Math.max(1, Math.floor(gridHeight * 0.4)))
    if (!overlapsPlaced(rx, ry, W, H) && !overlapsSpawn(rx, ry, W, H)) {
      const factId = facts[factCursor % Math.max(1, facts.length)]
      factCursor++
      stampGeodeChamber(rx, ry, factId)
      placedBoxes.push({ x: rx, y: ry, w: W, h: H })
    }
  }
}

/**
 * Places natural-looking open cavern spaces throughout the mine.
 *
 * Each cavern is a rectangular area of BlockType.Empty cells with randomised
 * dimensions between EMPTY_CAVERN_MIN_SIZE and EMPTY_CAVERN_MAX_SIZE.  To
 * give the caverns an organic feel, each corner cell has a ~40% chance of
 * being skipped (left as its original block type).
 *
 * Placement rules:
 *   - Must stay within the grid with a 1-cell margin on every edge
 *   - Must not overlap the 3×3 spawn clearance zone
 *   - Must maintain a 1-cell gap from every previously placed cavern
 *   - Up to 15 placement attempts are made per cavern before giving up
 *
 * @param grid       - The mine cell grid to carve into
 * @param rng        - Seeded random number generator
 * @param spawnX     - Player spawn column (centre of 3×3 clear zone)
 * @param spawnY     - Player spawn row (centre of 3×3 clear zone)
 * @param gridWidth  - Total grid columns
 * @param gridHeight - Total grid rows
 */
function placeEmptyCaverns(
  grid: MineCell[][],
  rng: () => number,
  spawnX: number,
  spawnY: number,
  gridWidth: number,
  gridHeight: number,
): void {
  /** Bounding boxes of already-placed caverns (1-cell gap enforced). */
  const placedBoxes: Array<{ x: number; y: number; w: number; h: number }> = []

  /** Returns true when the candidate box overlaps the spawn 3×3 zone. */
  function overlapsSpawn(x: number, y: number, w: number, h: number): boolean {
    const spawnMinX = spawnX - 1
    const spawnMaxX = spawnX + 1
    const spawnMinY = spawnY - 1
    const spawnMaxY = spawnY + 1
    return (
      x <= spawnMaxX &&
      x + w - 1 >= spawnMinX &&
      y <= spawnMaxY &&
      y + h - 1 >= spawnMinY
    )
  }

  /** Returns true when the candidate box overlaps any already-placed cavern (1-cell gap). */
  function overlapsPlaced(x: number, y: number, w: number, h: number): boolean {
    for (const box of placedBoxes) {
      if (
        x < box.x + box.w + 1 &&
        x + w + 1 > box.x &&
        y < box.y + box.h + 1 &&
        y + h + 1 > box.y
      ) {
        return true
      }
    }
    return false
  }

  const EDGE_MARGIN = 1
  const CORNER_SKIP_CHANCE = 0.4
  const MAX_ATTEMPTS = 15

  for (let i = 0; i < BALANCE.EMPTY_CAVERN_COUNT; i++) {
    const cavW = randomIntInclusive(rng, BALANCE.EMPTY_CAVERN_MIN_SIZE, BALANCE.EMPTY_CAVERN_MAX_SIZE)
    const cavH = randomIntInclusive(rng, BALANCE.EMPTY_CAVERN_MIN_SIZE, BALANCE.EMPTY_CAVERN_MAX_SIZE)

    const minX = EDGE_MARGIN
    const maxX = gridWidth - cavW - EDGE_MARGIN
    const minY = EDGE_MARGIN + 2  // Stay below the guaranteed top-2 empty rows
    const maxY = gridHeight - cavH - EDGE_MARGIN

    if (maxX < minX || maxY < minY) {
      // Grid too small — burn two RNG calls (for width + height) to keep sequence stable
      rng()
      rng()
      continue
    }

    let placed = false
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const cx = randomIntInclusive(rng, minX, maxX)
      const cy = randomIntInclusive(rng, minY, maxY)

      if (overlapsSpawn(cx, cy, cavW, cavH)) continue
      if (overlapsPlaced(cx, cy, cavW, cavH)) continue

      // Carve the cavern, optionally skipping corners for organic shape
      for (let dy = 0; dy < cavH; dy++) {
        for (let dx = 0; dx < cavW; dx++) {
          const isCorner =
            (dx === 0 || dx === cavW - 1) &&
            (dy === 0 || dy === cavH - 1)

          if (isCorner && rng() < CORNER_SKIP_CHANCE) {
            // Leave the existing block in place — organic edge
            continue
          }

          grid[cy + dy][cx + dx] = {
            type: BlockType.Empty,
            hardness: 0,
            maxHardness: 0,
            revealed: false,
          }
        }
      }

      placedBoxes.push({ x: cx, y: cy, w: cavW, h: cavH })
      placed = true
      break
    }

    if (!placed) {
      // Burn one RNG call to keep the sequence stable regardless of placement success
      rng()
    }
  }
}

/**
 * Places RELIC_SHRINE_COUNT RelicShrine blocks in the mine at minimum depth RELIC_SHRINE_MIN_DEPTH.
 * Uses the shared position pool so shrines don't overlap other special blocks.
 * Falls back gracefully if the pool has no positions at the required depth.
 */
/**
 * Places QuoteStone blocks scattered through the mine.
 * These are ancient inscribed stones that display lore text when broken.
 * Placement respects the minimum depth constraint and avoids overwriting other special blocks.
 */
function placeQuoteStones(
  grid: MineCell[][],
  positions: Array<{ x: number; y: number }>,
  rng: () => number,
): void {
  const minDepth = BALANCE.QUOTE_STONE_MIN_DEPTH
  // Build a sub-pool of positions at or below the minimum depth
  const eligiblePositions = positions.filter(p => p.y >= minDepth)

  const count = Math.min(BALANCE.QUOTE_STONE_COUNT, eligiblePositions.length)
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(rng() * eligiblePositions.length)
    const [position] = eligiblePositions.splice(randomIndex, 1)
    // Also remove from the main positions array to avoid overlap with other special blocks
    const mainIdx = positions.findIndex(p => p.x === position.x && p.y === position.y)
    if (mainIdx !== -1) positions.splice(mainIdx, 1)

    const hardness = 2
    grid[position.y][position.x] = {
      type: BlockType.QuoteStone,
      hardness,
      maxHardness: hardness,
      revealed: false,
    }
  }
}

function placeRelicShrines(
  grid: MineCell[][],
  positions: Array<{ x: number; y: number }>,
  rng: () => number,
  height: number,
): void {
  const minDepth = BALANCE.RELIC_SHRINE_MIN_DEPTH
  // Build a sub-pool of positions deep enough for shrine placement
  const deepPositions = positions.filter(p => p.y >= minDepth)

  const count = Math.min(BALANCE.RELIC_SHRINE_COUNT, deepPositions.length)
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(rng() * deepPositions.length)
    const [position] = deepPositions.splice(randomIndex, 1)
    // Also remove from the main positions array to keep it consistent
    const mainIdx = positions.findIndex(p => p.x === position.x && p.y === position.y)
    if (mainIdx !== -1) positions.splice(mainIdx, 1)

    const hardness = 2
    grid[position.y][position.x] = {
      type: BlockType.RelicShrine,
      hardness,
      maxHardness: hardness,
      revealed: false,
    }
  }
}

/**
 * Places rare OxygenTank permanent-upgrade blocks in the lower portion of the mine.
 * Only spawns OXYGEN_TANK_COUNT (1) per mine, always below OXYGEN_TANK_MIN_DEPTH_PERCENT depth.
 * Hardness 3 — encased in hard rock, requires effort to reach.
 * Uses the shared position pool to prevent overlap with other special blocks.
 */
function placeOxygenTanks(
  grid: MineCell[][],
  positions: Array<{ x: number; y: number }>,
  rng: () => number,
  height: number,
): void {
  const minDepth = Math.floor(height * BALANCE.OXYGEN_TANK_MIN_DEPTH_PERCENT)

  // Filter the shared position pool to only deep cells.
  const deepPositions = positions.filter(p => p.y >= minDepth)

  if (deepPositions.length === 0) return

  const count = Math.min(BALANCE.OXYGEN_TANK_COUNT, deepPositions.length)

  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(rng() * deepPositions.length)
    const [pos] = deepPositions.splice(randomIndex, 1)

    // Also remove from the master positions pool to prevent future overlap.
    const masterIndex = positions.findIndex(p => p.x === pos.x && p.y === pos.y)
    if (masterIndex !== -1) {
      positions.splice(masterIndex, 1)
    }

    const hardness = 3
    grid[pos.y][pos.x] = {
      type: BlockType.OxygenTank,
      hardness,
      maxHardness: hardness,
      revealed: false,
    }
  }
}

/**
 * Places Data Disc collectible blocks in the lower portion of the mine.
 * Only spawns DATA_DISC_COUNT (1) per mine, always below DATA_DISC_MIN_DEPTH_PERCENT depth.
 * Hardness 2 — accessible but not trivial to reach.
 * Uses the shared position pool to prevent overlap with other special blocks.
 */
function placeDataDiscs(
  grid: MineCell[][],
  positions: Array<{ x: number; y: number }>,
  rng: () => number,
  height: number,
): void {
  const minDepth = Math.floor(height * BALANCE.DATA_DISC_MIN_DEPTH_PERCENT)

  // Filter the shared position pool to only deep cells.
  const deepPositions = positions.filter(p => p.y >= minDepth)

  if (deepPositions.length === 0) return

  const count = Math.min(BALANCE.DATA_DISC_COUNT, deepPositions.length)

  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(rng() * deepPositions.length)
    const [pos] = deepPositions.splice(randomIndex, 1)

    // Also remove from the master positions pool to prevent future overlap.
    const masterIndex = positions.findIndex(p => p.x === pos.x && p.y === pos.y)
    if (masterIndex !== -1) {
      positions.splice(masterIndex, 1)
    }

    const hardness = 2
    grid[pos.y][pos.x] = {
      type: BlockType.DataDisc,
      hardness,
      maxHardness: hardness,
      revealed: false,
    }
  }
}

/**
 * Places FossilNode blocks in the lower portion of the mine.
 * Only spawns FOSSIL_NODE_COUNT (2) per mine, always below FOSSIL_NODE_MIN_DEPTH_PERCENT depth.
 * Hardness FOSSIL_HARDNESS — requires effort to unearth.
 * Uses the shared position pool to prevent overlap with other special blocks.
 */
function placeFossilNodes(
  grid: MineCell[][],
  positions: Array<{ x: number; y: number }>,
  rng: () => number,
  height: number,
): void {
  const minDepth = Math.floor(height * BALANCE.FOSSIL_NODE_MIN_DEPTH_PERCENT)

  // Filter the shared position pool to only deep cells.
  const deepPositions = positions.filter(p => p.y >= minDepth)

  if (deepPositions.length === 0) return

  const count = Math.min(BALANCE.FOSSIL_NODE_COUNT, deepPositions.length)

  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(rng() * deepPositions.length)
    const [pos] = deepPositions.splice(randomIndex, 1)

    // Also remove from the master positions pool to prevent future overlap.
    const masterIndex = positions.findIndex(p => p.x === pos.x && p.y === pos.y)
    if (masterIndex !== -1) {
      positions.splice(masterIndex, 1)
    }

    const hardness = BALANCE.FOSSIL_HARDNESS
    grid[pos.y][pos.x] = {
      type: BlockType.FossilNode,
      hardness,
      maxHardness: hardness,
      revealed: false,
    }
  }
}

/**
 * Replaces eligible base blocks at sufficient depth with hazard blocks.
 * LavaBlock appears below LAVA_MIN_DEPTH_PERCENT; GasPocket below GAS_POCKET_MIN_DEPTH_PERCENT.
 * UnstableGround appears below UNSTABLE_GROUND_MIN_DEPTH_PERCENT — crumbles easily (hardness 1)
 * and triggers a cave-in when broken, collapsing nearby blocks.
 * Only Dirt, SoftRock, Stone, and HardRock cells are eligible for replacement.
 * Called after all special block and room placement so hazards don't overwrite exits or items.
 * Biome hazardMultipliers scale each hazard's density independently.
 */
function placeHazards(grid: MineCell[][], rng: () => number, height: number, biome: Biome, layer = 0, hazardScalar = 1.0): void {
  const eligibleBaseTypes = new Set<BlockType>([
    BlockType.Dirt,
    BlockType.SoftRock,
    BlockType.Stone,
    BlockType.HardRock,
  ])

  // Apply biome multipliers, per-layer density scaling, and optional auto-balance scalar.
  const layerHazardMultiplier = HAZARD_DENSITY_BY_LAYER[(layer + 1)] ?? 1.0  // layer is 0-based, map is 1-based
  const lavaDensity = BALANCE.LAVA_DENSITY * biome.hazardMultipliers.lava * layerHazardMultiplier * hazardScalar
  const gasDensity = BALANCE.GAS_POCKET_DENSITY * biome.hazardMultipliers.gas * layerHazardMultiplier * hazardScalar
  const unstableDensity = BALANCE.UNSTABLE_GROUND_DENSITY * biome.hazardMultipliers.unstable * layerHazardMultiplier * hazardScalar

  for (let y = 0; y < height; y++) {
    const depthRatio = y / height
    const lavaEligible = depthRatio >= BALANCE.LAVA_MIN_DEPTH_PERCENT
    const gasEligible = depthRatio >= BALANCE.GAS_POCKET_MIN_DEPTH_PERCENT
    const unstableEligible = depthRatio >= BALANCE.UNSTABLE_GROUND_MIN_DEPTH_PERCENT

    if (!lavaEligible && !gasEligible && !unstableEligible) continue

    const row = grid[y]
    for (let x = 0; x < row.length; x++) {
      const cell = row[x]
      if (!eligibleBaseTypes.has(cell.type)) continue

      if (lavaEligible && rng() < lavaDensity) {
        row[x] = {
          type: BlockType.LavaBlock,
          hardness: 2,
          maxHardness: 2,
          revealed: false,
        }
      } else if (gasEligible && rng() < gasDensity) {
        row[x] = {
          type: BlockType.GasPocket,
          hardness: 1,
          maxHardness: 1,
          revealed: false,
        }
      } else if (unstableEligible && rng() < unstableDensity) {
        row[x] = {
          type: BlockType.UnstableGround,
          hardness: 1,
          maxHardness: 1,
          revealed: false,
        }
      }
    }
  }
}

/**
 * Places a single DescentShaft block anywhere in the mine grid (not restricted to bottom half).
 * The shaft is placed at a random position that does not overlap special blocks or the spawn area.
 * Falls back gracefully if no valid position can be found after multiple attempts.
 */
function placeDescentShaft(
  grid: MineCell[][],
  rng: () => number,
  width: number,
  height: number,
  spawnX: number,
  spawnY: number,
): void {
  const minY = 3  // Avoid the very top rows (spawn area)
  const maxY = Math.floor(height * 0.95)
  const minX = 1
  const maxX = width - 2

  if (maxY < minY || maxX < minX) return

  const specialTypes = new Set<BlockType>([
    BlockType.ExitLadder,
    BlockType.OxygenCache,
    BlockType.UpgradeCrate,
    BlockType.QuizGate,
    BlockType.ArtifactNode,
    BlockType.MineralNode,
    BlockType.Unbreakable,
    BlockType.LavaBlock,
    BlockType.GasPocket,
  ])

  for (let attempt = 0; attempt < 30; attempt++) {
    const sx = randomIntInclusive(rng, minX, maxX)
    const sy = randomIntInclusive(rng, minY, maxY)

    // Avoid spawn area
    if (Math.abs(sx - spawnX) <= 1 && Math.abs(sy - spawnY) <= 1) continue
    // Avoid special blocks
    if (specialTypes.has(grid[sy][sx].type)) continue

    grid[sy][sx] = {
      type: BlockType.DescentShaft,
      hardness: 1,
      maxHardness: 1,
      revealed: false,
    }
    return
  }
  // If no valid position found after all attempts, silently skip placement.
}

/**
 * Places a single SendUpStation block in the middle third of the mine grid (rows 33%-66%).
 * The station is placed at a random position that does not overlap special blocks or the spawn area.
 * Falls back gracefully if no valid position can be found after multiple attempts.
 */
function placeSendUpStation(
  grid: MineCell[][],
  rng: () => number,
  width: number,
  height: number,
  spawnX: number,
  spawnY: number,
): void {
  const minY = Math.floor(height * 0.33)
  const maxY = Math.floor(height * 0.66)
  const minX = 1
  const maxX = width - 2

  if (maxY < minY || maxX < minX) return

  const specialTypes = new Set<BlockType>([
    BlockType.ExitLadder,
    BlockType.OxygenCache,
    BlockType.UpgradeCrate,
    BlockType.QuizGate,
    BlockType.ArtifactNode,
    BlockType.MineralNode,
    BlockType.Unbreakable,
    BlockType.LavaBlock,
    BlockType.GasPocket,
    BlockType.DescentShaft,
  ])

  for (let attempt = 0; attempt < 30; attempt++) {
    const sx = randomIntInclusive(rng, minX, maxX)
    const sy = randomIntInclusive(rng, minY, maxY)

    // Avoid spawn area
    if (Math.abs(sx - spawnX) <= 1 && Math.abs(sy - spawnY) <= 1) continue
    // Avoid special blocks
    if (specialTypes.has(grid[sy][sx].type)) continue

    grid[sy][sx] = {
      type: BlockType.SendUpStation,
      hardness: 1,
      maxHardness: 1,
      revealed: false,
    }
    return
  }
  // If no valid position found after all attempts, silently skip placement.
}

/** @internal exported for use by AnomalyZoneSystem and other helpers */
export function randomIntInclusive(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

/**
 * Returns a fully hand-authored tutorial mine grid.
 * The layout is deterministic — no seeded RNG is used.
 * All special block positions are exact and documented in PHASE-14-ONBOARDING-TUTORIAL.md.
 */
export function generateTutorialMine(): { grid: MineCell[][], spawnX: number, spawnY: number, biome: Biome } {
  const WIDTH = 20
  const HEIGHT = 20
  // Build a 20×20 grid of Dirt by default
  const grid: MineCell[][] = Array.from({ length: HEIGHT }, () =>
    Array.from({ length: WIDTH }, () => ({
      type: BlockType.Dirt,
      hardness: BALANCE.HARDNESS_DIRT,
      maxHardness: BALANCE.HARDNESS_DIRT,
      revealed: false,
    }))
  )

  // Helper: set a specific cell
  function set(x: number, y: number, type: BlockType, hardness: number, content?: MineCellContent) {
    grid[y][x] = { type, hardness, maxHardness: hardness, revealed: false, content } as MineCell
  }

  // Border: Unbreakable
  for (let x = 0; x < WIDTH; x++) {
    set(x, 0, BlockType.Unbreakable, 999)
    set(x, HEIGHT - 1, BlockType.Unbreakable, 999)
  }
  for (let y = 0; y < HEIGHT; y++) {
    set(0, y, BlockType.Unbreakable, 999)
    set(WIDTH - 1, y, BlockType.Unbreakable, 999)
  }

  // Spawn area (y=1–2): Empty
  for (let x = 1; x < WIDTH - 1; x++) {
    set(x, 1, BlockType.Empty, 0)
    set(x, 2, BlockType.Empty, 0)
  }

  // Rows y=10–16: SoftRock base
  for (let y = 10; y <= 16; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      set(x, y, BlockType.SoftRock, BALANCE.HARDNESS_SOFT_ROCK)
    }
  }

  // Rows y=17–18: Stone
  for (let y = 17; y <= 18; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      set(x, y, BlockType.Stone, BALANCE.HARDNESS_STONE)
    }
  }

  // Special blocks (dirt zone)
  set(3, 5, BlockType.MineralNode, BALANCE.HARDNESS_MINERAL_NODE)
  set(17, 5, BlockType.MineralNode, BALANCE.HARDNESS_MINERAL_NODE)
  set(9, 6, BlockType.ArtifactNode, 2) // Tutorial artifact — low hardness for quick access
  set(6, 8, BlockType.OxygenCache, 2)

  // Special blocks (soft rock zone)
  set(3, 12, BlockType.MineralNode, BALANCE.HARDNESS_MINERAL_NODE)
  set(12, 13, BlockType.QuizGate, BALANCE.HARDNESS_QUIZ_GATE)

  // Earthquake tutorial zone: 3×3 UnstableGround at (3–5, 14–16)
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      set(3 + dx, 14 + dy, BlockType.UnstableGround, 1)
    }
  }
  // Pre-cleared cell inside (draws player in)
  set(4, 15, BlockType.Empty, 0)

  // Fossil node (accessible without touching UnstableGround)
  set(7, 15, BlockType.FossilNode, 2)

  // Upgrade crate
  set(16, 15, BlockType.UpgradeCrate, 2)

  return { grid, spawnX: 10, spawnY: 1, biome: DEFAULT_BIOME }
}

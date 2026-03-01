<script lang="ts">
  import { getMasteryLevel, isDue } from '../../services/sm2'
  import { playerSave } from '../stores/playerData'
  import { CATEGORIES } from '../../data/types'
  import type { Fact } from '../../data/types'

  interface Props {
    facts: Fact[]
    focusCategory?: string | null
  }

  let { facts, focusCategory = null }: Props = $props()

  // ─── SVG layout constants ───────────────────────────────────────────────────
  const VW = 800
  const VH = 600
  const TRUNK_X = VW / 2
  const TRUNK_BASE_Y = VH - 20
  const TRUNK_TOP_Y = VH - 120

  // Branch configs: angle in degrees from vertical (negative = left, positive = right)
  // and vertical start position along trunk (0 = base, 1 = top)
  type BranchConfig = {
    category: string
    angle: number       // degrees from vertical
    trunkT: number      // 0 (trunk top) to 1 (trunk base) — fraction up trunk
    length: number      // branch length in px
    side: 'left' | 'right'
  }

  const BRANCH_CONFIGS: BranchConfig[] = [
    { category: 'Language',        angle: -30, trunkT: 0.05, length: 160, side: 'left'  },
    { category: 'Life Sciences',   angle: -55, trunkT: 0.22, length: 155, side: 'left'  },
    { category: 'History',         angle: -75, trunkT: 0.42, length: 145, side: 'left'  },
    { category: 'Culture',         angle: -88, trunkT: 0.62, length: 130, side: 'left'  },
    { category: 'Natural Sciences',angle:  30, trunkT: 0.10, length: 160, side: 'right' },
    { category: 'Geography',       angle:  55, trunkT: 0.28, length: 155, side: 'right' },
    { category: 'Technology',      angle:  80, trunkT: 0.50, length: 140, side: 'right' },
  ]

  // ─── Mastery colors ─────────────────────────────────────────────────────────
  type MasteryLevel = 'new' | 'learning' | 'familiar' | 'known' | 'mastered'

  const MASTERY_COLOR: Record<MasteryLevel, string> = {
    new:      '#555566',
    learning: '#8a7b5a',
    familiar: '#b8a040',
    known:    '#4ecca3',
    mastered: '#ffd369',
  }

  const MASTERY_GLOW: Record<MasteryLevel, string> = {
    new:      'none',
    learning: 'none',
    familiar: 'none',
    known:    'none',
    mastered: 'drop-shadow(0 0 5px #ffd369aa)',
  }

  // ─── Derived tree data ───────────────────────────────────────────────────────
  interface LeafData {
    x: number
    y: number
    mastery: MasteryLevel
    due: boolean
    factId: string
  }

  interface BranchData {
    category: string
    config: BranchConfig
    // SVG path points
    startX: number
    startY: number
    endX: number
    endY: number
    cp1X: number
    cp1Y: number
    cp2X: number
    cp2Y: number
    labelX: number
    labelY: number
    labelAnchor: string
    leaves: LeafData[]
    hasLeaves: boolean
    leafCount: number
    totalCount: number
    completionRatio: number
  }

  /**
   * Convert degrees (measured clockwise from upward vertical) to radians,
   * with SVG coordinate system (y increases downward).
   */
  function branchVector(angleDeg: number, length: number): { dx: number; dy: number } {
    const rad = (angleDeg * Math.PI) / 180
    return {
      dx: Math.sin(rad) * length,
      dy: -Math.cos(rad) * length, // negative because SVG y goes down
    }
  }

  /** Deterministic pseudo-random from a seed string */
  function seededRand(seed: string, index: number): number {
    let h = 0
    for (let i = 0; i < seed.length; i++) {
      h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
    }
    h = (Math.imul(h, index + 1337)) | 0
    return Math.abs(h % 1000) / 1000
  }

  const treeData = $derived.by((): BranchData[] => {
    const save = $playerSave

    // Build lookup: factId -> { mastery, due }
    const factStateMap = new Map<string, { mastery: MasteryLevel; due: boolean }>()
    if (save) {
      for (const factId of save.learnedFacts) {
        const rs = save.reviewStates.find((s) => s.factId === factId)
        factStateMap.set(factId, {
          mastery: rs ? getMasteryLevel(rs) : 'new',
          due: rs ? isDue(rs) : true,
        })
      }
    }

    return BRANCH_CONFIGS.map((config): BranchData => {
      // Trunk start point: interpolate between trunk top and trunk base
      const startX = TRUNK_X
      const startY = TRUNK_TOP_Y + (TRUNK_BASE_Y - TRUNK_TOP_Y) * (1 - config.trunkT)

      // Branch end point
      const { dx, dy } = branchVector(config.angle, config.length)
      const endX = startX + dx
      const endY = startY + dy

      // Bezier control points: first cp starts near the trunk going up,
      // second cp pulls toward the end to create a natural arc
      const cp1X = startX + dx * 0.25
      const cp1Y = startY + dy * 0.1
      const cp2X = startX + dx * 0.65
      const cp2Y = startY + dy * 0.6

      // Label position: beyond branch tip, offset slightly
      const labelOffsetX = config.side === 'left' ? -10 : 10
      const labelX = endX + labelOffsetX
      const labelY = endY - 10
      const labelAnchor = config.side === 'left' ? 'end' : 'start'

      // Collect leaves for this category
      const categoryFacts = facts.filter((f) => f.category[0] === config.category)
      const learnedInCategory = categoryFacts.filter((f) => factStateMap.has(f.id))

      const leaves: LeafData[] = learnedInCategory.map((f, i): LeafData => {
        const state = factStateMap.get(f.id)!
        // Distribute leaves along the branch at t ∈ [0.25, 0.95]
        const total = learnedInCategory.length
        const spread = total === 1 ? 0.6 : 0.25 + (i / (total - 1)) * 0.7
        // Add a small perpendicular jitter so leaves don't all sit on the branch line
        const jitterSeed = seededRand(f.id, i)
        const perpJitter = (jitterSeed - 0.5) * 22
        // Perpendicular direction: rotate branch vector 90 deg
        const perpX = -dy / config.length
        const perpY = dx / config.length

        // Point on cubic bezier at parameter t (de Casteljau)
        const t = spread
        const mt = 1 - t
        const bx = mt * mt * mt * startX + 3 * mt * mt * t * cp1X + 3 * mt * t * t * cp2X + t * t * t * endX
        const by = mt * mt * mt * startY + 3 * mt * mt * t * cp1Y + 3 * mt * t * t * cp2Y + t * t * t * endY

        return {
          x: bx + perpX * perpJitter,
          y: by + perpY * perpJitter,
          mastery: state.mastery,
          due: state.due,
          factId: f.id,
        }
      })

      const completionRatio = categoryFacts.length > 0 ? learnedInCategory.length / categoryFacts.length : 0

      return {
        category: config.category,
        config,
        startX, startY, endX, endY,
        cp1X, cp1Y, cp2X, cp2Y,
        labelX, labelY, labelAnchor,
        leaves,
        hasLeaves: leaves.length > 0,
        leafCount: leaves.length,
        totalCount: categoryFacts.length,
        completionRatio,
      }
    })
  })

  // ─── Summary counts ──────────────────────────────────────────────────────────
  const totalLeaves = $derived(treeData.reduce((s, b) => s + b.leafCount, 0))

  // ─── Trunk path ─────────────────────────────────────────────────────────────
  const trunkPath = $derived(
    `M ${TRUNK_X} ${TRUNK_BASE_Y} L ${TRUNK_X} ${TRUNK_TOP_Y}`
  )

  // ─── Focus / viewBox computation ────────────────────────────────────────────

  /**
   * Compute the bounding box of a focused branch — encompassing the start
   * point, end point, label position, and all leaves — with padding.
   */
  function computeFocusViewBox(branch: BranchData): string {
    const PADDING = 60

    // Collect all relevant x/y coordinates
    const xs: number[] = [branch.startX, branch.endX, branch.labelX]
    const ys: number[] = [branch.startY, branch.endY, branch.labelY]

    // Include leaf positions
    for (const leaf of branch.leaves) {
      xs.push(leaf.x)
      ys.push(leaf.y)
    }

    const minX = Math.min(...xs) - PADDING
    const maxX = Math.max(...xs) + PADDING
    const minY = Math.min(...ys) - PADDING
    const maxY = Math.max(...ys) + PADDING

    const rawW = maxX - minX
    const rawH = maxY - minY

    // Maintain 4:3 aspect ratio (matching VW:VH = 800:600) so the SVG
    // doesn't distort when letterboxed inside the container.
    const targetAspect = VW / VH // 4/3
    let w = rawW
    let h = rawH

    if (w / h > targetAspect) {
      // Too wide — expand height
      h = w / targetAspect
    } else {
      // Too tall — expand width
      w = h * targetAspect
    }

    // Re-center after aspect correction
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const x = centerX - w / 2
    const y = centerY - h / 2

    return `${x} ${y} ${w} ${h}`
  }

  /** Derive the active viewBox string based on focusCategory */
  const currentViewBox = $derived.by((): string => {
    if (!focusCategory) return `0 0 ${VW} ${VH}`
    const branch = treeData.find((b) => b.category === focusCategory)
    if (!branch) return `0 0 ${VW} ${VH}`
    return computeFocusViewBox(branch)
  })

  /** The focused branch, for rendering the glow highlight */
  const focusedBranch = $derived(
    focusCategory ? treeData.find((b) => b.category === focusCategory) ?? null : null
  )

  /**
   * Compute the center point of a branch's interesting area (midpoint
   * between branch tip and the centroid of its leaves, or just the tip
   * when no leaves exist). Used to position the glow circle.
   */
  function branchGlowCenter(branch: BranchData): { cx: number; cy: number; r: number } {
    if (branch.leaves.length === 0) {
      return { cx: branch.endX, cy: branch.endY, r: 30 }
    }
    const avgX = branch.leaves.reduce((s, l) => s + l.x, 0) / branch.leaves.length
    const avgY = branch.leaves.reduce((s, l) => s + l.y, 0) / branch.leaves.length
    const cx = (branch.endX + avgX) / 2
    const cy = (branch.endY + avgY) / 2

    // Radius covers the spread of leaves
    const maxDist = branch.leaves.reduce((m, l) => {
      const d = Math.hypot(l.x - cx, l.y - cy)
      return Math.max(m, d)
    }, 30)

    return { cx, cy, r: maxDist + 20 }
  }
</script>

<svg
  class="knowledge-tree-svg"
  viewBox={currentViewBox}
  preserveAspectRatio="xMidYMid meet"
  aria-label="Knowledge tree showing learned facts by category"
  role="img"
>
  <defs>
    <!-- Trunk gradient: brown earth at bottom, lighter at top -->
    <linearGradient id="trunk-grad" x1="0" y1="1" x2="0" y2="0" gradientUnits="objectBoundingBox">
      <stop offset="0%"  stop-color="#5c3a1e" />
      <stop offset="100%" stop-color="#8b5e3c" />
    </linearGradient>

    <!-- Subtle ground glow -->
    <radialGradient id="ground-glow" cx="50%" cy="100%" r="40%">
      <stop offset="0%"  stop-color="#3a2a14" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#1a1a2e" stop-opacity="0" />
    </radialGradient>

    <!-- Mastered leaf pulse animation filter -->
    <filter id="mastered-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <!-- Known leaf subtle glow -->
    <filter id="known-glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <!-- Focus branch glow filter -->
    <filter id="focus-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Ground fill beneath trunk -->
  <ellipse
    cx={TRUNK_X}
    cy={TRUNK_BASE_Y}
    rx="80"
    ry="14"
    fill="url(#ground-glow)"
  />

  <!-- Trunk -->
  <path
    d={trunkPath}
    stroke="url(#trunk-grad)"
    stroke-width="14"
    stroke-linecap="round"
    fill="none"
  />

  <!-- Branches and leaves -->
  {#each treeData as branch (branch.category)}
    {@const isEmpty = !branch.hasLeaves}
    {@const isFocused = focusCategory === branch.category}
    {@const isOther = focusCategory !== null && focusCategory !== branch.category}
    {@const branchStrokeWidth = isEmpty ? 2 : 2 + branch.completionRatio * 6}
    {@const branchColor = isEmpty
      ? '#3a3060'
      : branch.completionRatio >= 0.75
        ? '#4ecca3'
        : branch.completionRatio >= 0.5
          ? '#5ab080'
          : branch.completionRatio >= 0.25
            ? '#8a7a40'
            : '#7a5a30'}

    <!-- Focus glow halo: rendered behind everything for this branch -->
    {#if isFocused && focusedBranch}
      {@const glow = branchGlowCenter(focusedBranch)}
      <circle
        cx={glow.cx}
        cy={glow.cy}
        r={glow.r}
        fill="none"
        stroke="#4ecca366"
        stroke-width="3"
        filter="url(#focus-glow)"
        class="focus-halo"
      />
      <circle
        cx={glow.cx}
        cy={glow.cy}
        r={glow.r}
        fill="#4ecca308"
        stroke="none"
      />
    {/if}

    <!-- Branch path -->
    <path
      d="M {branch.startX} {branch.startY} C {branch.cp1X} {branch.cp1Y}, {branch.cp2X} {branch.cp2Y}, {branch.endX} {branch.endY}"
      stroke={isFocused ? '#6ee8c0' : branchColor}
      stroke-width={isFocused ? branchStrokeWidth + 1.5 : branchStrokeWidth}
      stroke-linecap="round"
      stroke-dasharray={isEmpty ? '5 6' : 'none'}
      stroke-opacity={isOther ? 0.25 : isEmpty ? 0.5 : 1}
      fill="none"
    />

    <!-- Twigs near tip for non-empty branches -->
    {#if branch.hasLeaves}
      <line
        x1={branch.endX}
        y1={branch.endY}
        x2={branch.endX + (branch.config.side === 'left' ? -18 : 18)}
        y2={branch.endY - 14}
        stroke="#8b5e3c"
        stroke-width="2"
        stroke-linecap="round"
        opacity={isOther ? 0.18 : 0.7}
      />
      <line
        x1={branch.endX}
        y1={branch.endY}
        x2={branch.endX + (branch.config.side === 'left' ? 10 : -10)}
        y2={branch.endY - 18}
        stroke="#8b5e3c"
        stroke-width="2"
        stroke-linecap="round"
        opacity={isOther ? 0.12 : 0.5}
      />
    {/if}

    <!-- Category label -->
    <text
      x={branch.labelX}
      y={branch.labelY}
      text-anchor={branch.labelAnchor}
      font-family="'Courier New', monospace"
      font-size="11"
      font-weight="600"
      fill={isFocused ? '#e8e8ff' : branch.hasLeaves ? '#c8c8d8' : '#555570'}
      letter-spacing="0.5"
      opacity={isOther ? 0.3 : 1}
    >
      {branch.category}
    </text>
    {#if branch.leafCount > 0}
      <text
        x={branch.labelX}
        y={branch.labelY + 13}
        text-anchor={branch.labelAnchor}
        font-family="'Courier New', monospace"
        font-size="9"
        fill={isOther ? '#444455' : '#888899'}
      >
        {branch.leafCount}/{branch.totalCount}
      </text>
    {:else}
      <text
        x={branch.labelX}
        y={branch.labelY + 13}
        text-anchor={branch.labelAnchor}
        font-family="'Courier New', monospace"
        font-size="9"
        fill="#444455"
        font-style="italic"
        opacity={isOther ? 0.2 : 1}
      >
        unexplored
      </text>
    {/if}

    <!-- Leaves -->
    {#each branch.leaves as leaf (leaf.factId)}
      {@const isMastered = leaf.mastery === 'mastered'}
      {@const isKnown = leaf.mastery === 'known'}
      {@const color = MASTERY_COLOR[leaf.mastery]}
      <circle
        cx={leaf.x}
        cy={leaf.y}
        r={isMastered ? 6 : 5}
        fill={color}
        opacity={isOther ? 0.15 : leaf.due && leaf.mastery !== 'new' ? 0.45 : 0.92}
        filter={isMastered ? 'url(#mastered-glow)' : isKnown ? 'url(#known-glow)' : 'none'}
        class={isMastered ? 'leaf-mastered' : ''}
        aria-label="{leaf.mastery} fact"
        role="img"
      />
      {#if leaf.due && leaf.mastery !== 'new' && !isOther}
        <!-- Small droop indicator for due facts -->
        <line
          x1={leaf.x}
          y1={leaf.y + (isMastered ? 6 : 5)}
          x2={leaf.x + 1}
          y2={leaf.y + (isMastered ? 6 : 5) + 4}
          stroke={color}
          stroke-width="1"
          stroke-linecap="round"
          opacity="0.35"
        />
      {/if}
    {/each}
  {/each}

  <!-- Empty state text if no facts at all -->
  {#if totalLeaves === 0}
    <text
      x={TRUNK_X}
      y={TRUNK_TOP_Y - 30}
      text-anchor="middle"
      font-family="'Courier New', monospace"
      font-size="13"
      fill="#555570"
      font-style="italic"
    >
      Dive to discover your first fact
    </text>
  {/if}
</svg>

<style>
  .knowledge-tree-svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
    /* Smooth viewBox pan/zoom transitions */
    transition: viewBox 0.6s ease-in-out;
  }

  /* Mastered leaf pulse animation */
  :global(.leaf-mastered) {
    animation: leaf-pulse 2.4s ease-in-out infinite;
    transform-box: fill-box;
    transform-origin: center;
  }

  @keyframes leaf-pulse {
    0%, 100% { opacity: 0.92; r: 6; }
    50%       { opacity: 1.0;  r: 7; }
  }

  /* Focus halo pulse */
  :global(.focus-halo) {
    animation: halo-pulse 2s ease-in-out infinite;
  }

  @keyframes halo-pulse {
    0%, 100% { opacity: 0.6; }
    50%       { opacity: 1.0; }
  }
</style>

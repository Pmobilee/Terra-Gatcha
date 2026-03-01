<script lang="ts">
  import KnowledgeTree from './KnowledgeTree.svelte'
  import { playerSave } from '../stores/playerData'
  import { isDue } from '../../services/sm2'
  import { CATEGORIES } from '../../data/types'
  import type { Fact } from '../../data/types'

  interface Props {
    facts: Fact[]
    onBack: () => void
  }

  let { facts, onBack }: Props = $props()

  // ─── Focus state ─────────────────────────────────────────────────────────────
  /** Currently focused category, or null for the full-tree overview. */
  let focusedCategory: string | null = $state(null)

  /** Toggle focus on a category; tapping the active one clears focus. */
  function toggleFocus(category: string) {
    focusedCategory = focusedCategory === category ? null : category
  }

  /** Clear focus and return to full tree view. */
  function resetView() {
    focusedCategory = null
  }

  // ─── Category pill colors (fixed palette, one per branch) ───────────────────
  const CATEGORY_COLORS: Record<string, string> = {
    'Language':        '#7b68ee',
    'Life Sciences':   '#4ecca3',
    'History':         '#c8a060',
    'Culture':         '#e06080',
    'Natural Sciences':'#60b8e0',
    'Geography':       '#80cc60',
    'Technology':      '#e0a840',
  }

  /** Short display names for pills to save horizontal space */
  const PILL_LABELS: Record<string, string> = {
    'Language':        'Lang',
    'Life Sciences':   'Life Sci',
    'History':         'History',
    'Culture':         'Culture',
    'Natural Sciences':'Nat Sci',
    'Geography':       'Geo',
    'Technology':      'Tech',
  }

  // ─── Derived stats ───────────────────────────────────────────────────────────

  /** Total facts the player has learned */
  const totalLearned = $derived($playerSave?.learnedFacts.length ?? 0)

  /** Count of review states that are currently due */
  const dueCount = $derived.by(() => {
    const save = $playerSave
    if (!save) return 0
    return save.reviewStates.filter((rs) => isDue(rs)).length
  })

  /**
   * Number of top-level CATEGORIES in which the player has at least one
   * learned fact.
   */
  const categoriesUnlocked = $derived.by(() => {
    const save = $playerSave
    if (!save || save.learnedFacts.length === 0) return 0

    const learnedSet = new Set(save.learnedFacts)
    const unlockedCats = new Set<string>()

    for (const fact of facts) {
      if (learnedSet.has(fact.id) && fact.category[0]) {
        unlockedCats.add(fact.category[0])
      }
    }

    return unlockedCats.size
  })

  // ─── Pill row: BRANCH_CONFIGS order (same order as KnowledgeTree branches) ──
  // Use the same order as BRANCH_CONFIGS to keep left/right pairing intuitive
  const PILL_ORDER = [
    'Language',
    'Life Sciences',
    'History',
    'Culture',
    'Natural Sciences',
    'Geography',
    'Technology',
  ] as const
</script>

<div class="tree-view" aria-label="Knowledge Tree">
  <!-- Header -->
  <header class="tree-header">
    <button class="back-button" type="button" onclick={onBack} aria-label="Back">
      &larr; Back
    </button>
    <h1 class="tree-title">Knowledge Tree</h1>
    <!-- Spacer keeps title centred -->
    <div class="header-spacer" aria-hidden="true"></div>
  </header>

  <!-- Category filter pills -->
  <div class="pill-row" role="toolbar" aria-label="Filter by category">
    {#each PILL_ORDER as cat (cat)}
      {@const color = CATEGORY_COLORS[cat] ?? '#888888'}
      {@const isActive = focusedCategory === cat}
      <button
        class="cat-pill"
        class:cat-pill--active={isActive}
        type="button"
        style="--pill-color: {color}"
        onclick={() => toggleFocus(cat)}
        aria-pressed={isActive}
        aria-label="Focus {cat} branch"
      >
        {PILL_LABELS[cat] ?? cat}
      </button>
    {/each}

    {#if focusedCategory !== null}
      <button
        class="reset-btn"
        type="button"
        onclick={resetView}
        aria-label="Reset to full tree view"
      >
        Reset
      </button>
    {/if}
  </div>

  <!-- Tree visualization -->
  <div class="tree-area">
    <KnowledgeTree {facts} focusCategory={focusedCategory} />
  </div>

  <!-- Bottom stats bar -->
  <footer class="stats-bar">
    <div class="stat-item">
      <span class="stat-value">{totalLearned}</span>
      <span class="stat-label">Total Facts</span>
    </div>
    <div class="stat-divider" aria-hidden="true"></div>
    <div class="stat-item" class:stat-due={dueCount > 0}>
      <span class="stat-value">{dueCount}</span>
      <span class="stat-label">Due for Review</span>
    </div>
    <div class="stat-divider" aria-hidden="true"></div>
    <div class="stat-item">
      <span class="stat-value">{categoriesUnlocked}<span class="stat-denom">/{CATEGORIES.length}</span></span>
      <span class="stat-label">Categories</span>
    </div>
  </footer>
</div>

<style>
  .tree-view {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    z-index: 30;
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
    font-family: 'Courier New', monospace;
    overflow: hidden;
  }

  /* ─── Header ─────────────────────────────────────────────────────────────── */
  .tree-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--color-surface);
    border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 60%, transparent 40%);
    flex-shrink: 0;
  }

  .back-button {
    min-height: 40px;
    min-width: 80px;
    border: 1px solid color-mix(in srgb, var(--color-text-dim) 40%, transparent 60%);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-primary) 40%, var(--color-surface) 60%);
    color: var(--color-text);
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0 14px;
    transition: transform 100ms ease, background-color 100ms ease;
  }

  .back-button:active {
    transform: scale(0.96);
    background: color-mix(in srgb, var(--color-primary) 65%, var(--color-surface) 35%);
  }

  .tree-title {
    color: var(--color-warning);
    font-size: clamp(1rem, 4vw, 1.4rem);
    font-weight: 700;
    text-align: center;
    letter-spacing: 1px;
    margin: 0;
  }

  /* Mirrors back-button width so title stays centred */
  .header-spacer {
    min-width: 80px;
  }

  /* ─── Category pill row ──────────────────────────────────────────────────── */
  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 6px;
    padding: 6px 10px;
    background: color-mix(in srgb, var(--color-surface) 85%, transparent 15%);
    border-bottom: 1px solid color-mix(in srgb, var(--color-text-dim) 15%, transparent 85%);
    flex-shrink: 0;
    align-items: center;
    /* Allow horizontal scroll on very small screens */
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }

  .pill-row::-webkit-scrollbar {
    display: none;
  }

  .cat-pill {
    /* Base pill style */
    display: inline-flex;
    align-items: center;
    height: 26px;
    padding: 0 10px;
    border-radius: 13px;
    border: 1.5px solid color-mix(in srgb, var(--pill-color) 40%, transparent 60%);
    background: color-mix(in srgb, var(--pill-color) 14%, var(--color-surface) 86%);
    color: color-mix(in srgb, var(--pill-color) 80%, var(--color-text) 20%);
    font-family: 'Courier New', monospace;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    cursor: pointer;
    white-space: nowrap;
    transition: background 150ms ease, border-color 150ms ease, transform 100ms ease, box-shadow 150ms ease;
    flex-shrink: 0;
  }

  .cat-pill:hover {
    background: color-mix(in srgb, var(--pill-color) 25%, var(--color-surface) 75%);
    border-color: color-mix(in srgb, var(--pill-color) 70%, transparent 30%);
  }

  .cat-pill:active {
    transform: scale(0.94);
  }

  /* Active (focused) pill */
  .cat-pill--active {
    background: color-mix(in srgb, var(--pill-color) 30%, var(--color-surface) 70%);
    border-color: var(--pill-color);
    color: var(--pill-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--pill-color) 35%, transparent 65%),
                0 0 8px color-mix(in srgb, var(--pill-color) 40%, transparent 60%);
  }

  /* Reset button */
  .reset-btn {
    display: inline-flex;
    align-items: center;
    height: 26px;
    padding: 0 10px;
    border-radius: 13px;
    border: 1.5px solid color-mix(in srgb, var(--color-text-dim) 40%, transparent 60%);
    background: transparent;
    color: var(--color-text-dim);
    font-family: 'Courier New', monospace;
    font-size: 0.68rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 150ms ease, border-color 150ms ease, transform 100ms ease;
    flex-shrink: 0;
    margin-left: 2px;
  }

  .reset-btn:hover {
    background: color-mix(in srgb, var(--color-text-dim) 12%, transparent 88%);
    border-color: var(--color-text-dim);
    color: var(--color-text);
  }

  .reset-btn:active {
    transform: scale(0.94);
  }

  /* ─── Tree area ──────────────────────────────────────────────────────────── */
  .tree-area {
    flex: 1 1 0;
    min-height: 0;
    padding: 8px 4px 4px;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    overflow: hidden;
  }

  /* ─── Stats bar ──────────────────────────────────────────────────────────── */
  .stats-bar {
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 10px 16px;
    background: var(--color-surface);
    border-top: 1px solid color-mix(in srgb, var(--color-primary) 60%, transparent 40%);
    flex-shrink: 0;
    gap: 0;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    flex: 1;
  }

  .stat-value {
    font-size: clamp(1.1rem, 4vw, 1.5rem);
    font-weight: 800;
    color: var(--color-success);
    line-height: 1.1;
  }

  .stat-due .stat-value {
    color: var(--color-warning);
  }

  .stat-denom {
    font-size: 0.7em;
    font-weight: 600;
    color: var(--color-text-dim);
  }

  .stat-label {
    font-size: clamp(0.65rem, 2.5vw, 0.78rem);
    color: var(--color-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    text-align: center;
  }

  .stat-divider {
    width: 1px;
    height: 36px;
    background: color-mix(in srgb, var(--color-text-dim) 25%, transparent 75%);
    flex-shrink: 0;
    margin: 0 4px;
  }

  /* ─── Small screen tweaks ────────────────────────────────────────────────── */
  @media (max-width: 400px) {
    .tree-header {
      padding: 8px 10px;
    }

    .back-button {
      min-width: 64px;
      font-size: 0.82rem;
    }

    .header-spacer {
      min-width: 64px;
    }

    .pill-row {
      padding: 5px 8px;
      gap: 4px 5px;
      flex-wrap: nowrap;
    }

    .cat-pill {
      height: 24px;
      font-size: 0.68rem;
      padding: 0 8px;
    }
  }
</style>

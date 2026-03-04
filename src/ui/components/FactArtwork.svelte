<script lang="ts">
  /**
   * FactArtwork — displays a fact's pixel-art sprite with mastery-state visual treatment.
   * Handles lazy loading, fallback placeholder, and the Stage 4 shimmer animation.
   *
   * Props:
   *   factId    — database fact ID used to resolve sprite URL
   *   size      — render size in px (default 64; use 128 for detail view)
   *   showLabel — show mastery stage label beneath image (default false)
   */

  import { onMount } from 'svelte'
  import { getMasteryStage, masteryFilter, masteryLabel } from '../stores/factSprites'
  import { getFactSpriteManifest } from '../../services/factSpriteManifest'
  import type { MasteryStage } from '../stores/factSprites'

  export let factId: string
  export let size: number = 64
  export let showLabel: boolean = false

  let stage: MasteryStage = 0
  let available = false
  let loaded    = false

  $: spriteUrl = `/assets/sprites/facts/${factId}.png`
  $: filter    = masteryFilter(stage)
  $: label     = masteryLabel(stage)
  $: isGolden  = stage === 4

  onMount(async () => {
    stage      = getMasteryStage(factId)
    const mf   = await getFactSpriteManifest()
    available  = mf.has(factId)
  })

  function onLoad()  { loaded = true }
</script>

<div
  class="fact-artwork"
  style="width:{size}px; height:{size}px;"
  aria-label="Fact illustration — {label}"
  role="img"
>
  {#if available}
    <img
      src={spriteUrl}
      alt=""
      width={size}
      height={size}
      style="filter: {filter}; image-rendering: pixelated;"
      on:load={onLoad}
      class:hidden={!loaded}
    />
    {#if isGolden && loaded}
      <div class="shimmer-overlay" style="width:{size}px; height:{size}px;" aria-hidden="true"></div>
    {/if}
  {/if}

  {#if !loaded && available}
    <div class="placeholder skeleton" style="width:{size}px; height:{size}px;"></div>
  {/if}

  {#if !available}
    <div class="placeholder fallback" style="width:{size}px; height:{size}px;" aria-label="No illustration yet">
      <svg viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
        <rect width="8" height="8" fill="#1a2035"/>
        <rect x="2" y="1" width="4" height="3" fill="#2d3d6b"/>
        <rect x="1" y="5" width="6" height="2" fill="#2d3d6b"/>
        <rect x="3" y="2" width="2" height="1" fill="#4a7ec7"/>
      </svg>
    </div>
  {/if}

  {#if showLabel}
    <p class="mastery-label stage-{stage}">{label}</p>
  {/if}
</div>

<style>
  .fact-artwork {
    position: relative;
    display: inline-block;
    flex-shrink: 0;
  }

  img {
    display: block;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .hidden { display: none; }

  .placeholder {
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .skeleton {
    background: linear-gradient(90deg, #1a2035 25%, #2d3a5a 50%, #1a2035 75%);
    background-size: 200% 100%;
    animation: shimmer-skeleton 1.5s infinite;
  }

  .fallback { background: #1a2035; }

  .shimmer-overlay {
    position: absolute;
    top: 0; left: 0;
    pointer-events: none;
    background: linear-gradient(
      135deg,
      transparent 20%,
      rgba(255, 215, 0, 0.35) 50%,
      transparent 80%
    );
    background-size: 200% 200%;
    animation: golden-shimmer 3s ease-in-out infinite;
    mix-blend-mode: screen;
    border-radius: 2px;
  }

  .mastery-label {
    text-align: center;
    font-size: 9px;
    color: #8899aa;
    margin: 2px 0 0;
    font-family: monospace;
    letter-spacing: 0.5px;
  }
  .mastery-label.stage-4 { color: #ffd700; }

  @keyframes shimmer-skeleton {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  @keyframes golden-shimmer {
    0%, 100% { background-position: 0% 0%; opacity: 0.4; }
    50%       { background-position: 100% 100%; opacity: 0.8; }
  }
</style>

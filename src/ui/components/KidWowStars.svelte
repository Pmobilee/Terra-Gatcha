<script lang="ts">
  import type { WowScore } from '../../services/wowScore'
  import { wowLevelAriaLabel } from '../../services/wowScore'

  interface Props {
    score: WowScore
    /** Size variant — 'sm' for inline tree tooltips, 'lg' for quiz result. */
    size?: 'sm' | 'lg'
    /** Whether to show the text label beneath the stars. */
    showLabel?: boolean
  }

  let { score, size = 'lg', showLabel = true }: Props = $props()
</script>

<div
  class="wow-stars wow-stars--{size}"
  role="img"
  aria-label={wowLevelAriaLabel(score.level)}
>
  {#each [1, 2, 3, 4, 5] as i (i)}
    <span
      class="star {i <= score.level ? `filled ${score.colorClass}` : 'empty'}"
      aria-hidden="true"
    >★</span>
  {/each}
  {#if showLabel}
    <span class="wow-label">{score.label}</span>
  {/if}
</div>

<style>
  .wow-stars {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    flex-wrap: wrap;
  }
  .wow-stars--lg { gap: 0.3rem; }

  .star { font-size: 1rem; color: #555; transition: color 200ms; }
  .wow-stars--lg .star { font-size: 1.6rem; }

  .filled.wow-1 { color: #a0a0a0; }
  .filled.wow-2 { color: #4ECDC4; }
  .filled.wow-3 { color: #FFD700; }
  .filled.wow-4 { color: #FF9F43; }
  .filled.wow-5 { color: #FF6B9D; text-shadow: 0 0 8px rgba(255,107,157,0.7); }

  .wow-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: #eee;
    margin-left: 0.4rem;
    white-space: nowrap;
  }
  .wow-stars--lg .wow-label { font-size: 1rem; margin-left: 0.6rem; }
</style>

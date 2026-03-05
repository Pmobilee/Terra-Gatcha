<script lang="ts">
  import { BIOME_COMPLETION_MAP } from '../../data/biomeCompletionConfig'
  import type { BiomeId } from '../../data/biomes'

  interface Props {
    biomeId: string
    onClose: () => void
  }

  const { biomeId, onClose }: Props = $props()

  const config = $derived(BIOME_COMPLETION_MAP.get(biomeId as BiomeId) ?? null)
</script>

{#if config}
  <div class="biome-overlay" role="dialog" aria-modal="true" aria-label="Biome Mastered">
    <div class="biome-panel">
      <div class="star-row" aria-hidden="true">* * * * *</div>
      <h2 class="title">BIOME MASTERED</h2>
      <p class="biome-name">{biomeId.replace(/_/g, ' ').toUpperCase()}</p>

      <div class="title-award">
        <span class="title-label">New Title:</span>
        <span class="title-value">{config.titleDisplay}</span>
      </div>

      <div class="bonus-section">
        {#if config.passiveBonus.mineralYieldMultiplier > 1.0}
          <div class="bonus-item">
            +{Math.round((config.passiveBonus.mineralYieldMultiplier - 1) * 100)}% mineral yield in this biome
          </div>
        {/if}
        {#if config.passiveBonus.hazardO2Reduction > 0}
          <div class="bonus-item">
            -{config.passiveBonus.hazardO2Reduction} O2 hazard damage in this biome
          </div>
        {/if}
      </div>

      <div class="gaia-line">
        <span class="gaia-tag">GAIA:</span>
        <span class="gaia-text">"{config.gaiaLine}"</span>
      </div>

      <button type="button" class="close-btn" onclick={onClose}>Continue</button>
    </div>
  </div>
{/if}

<style>
  .biome-overlay {
    position: fixed;
    inset: 0;
    z-index: 8800;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.85);
    pointer-events: all;
  }

  .biome-panel {
    background: #0e0e2a;
    border: 2px solid #4ecca3;
    border-radius: 8px;
    padding: 24px 20px;
    max-width: 380px;
    width: 90%;
    font-family: 'Press Start 2P', monospace;
    color: #e0e0e0;
    text-align: center;
  }

  .star-row {
    color: #4ecca3;
    font-size: 12px;
    margin-bottom: 10px;
    letter-spacing: 4px;
  }

  .title {
    color: #4ecca3;
    font-size: 13px;
    margin-bottom: 8px;
    text-shadow: 0 0 10px #4ecca3;
  }

  .biome-name {
    color: #ffd700;
    font-size: 9px;
    margin-bottom: 16px;
    letter-spacing: 0.1em;
  }

  .title-award {
    margin-bottom: 12px;
    font-size: 9px;
  }

  .title-label {
    color: #888;
    margin-right: 6px;
  }

  .title-value {
    color: #ffd700;
    font-size: 10px;
  }

  .bonus-section {
    margin-bottom: 14px;
  }

  .bonus-item {
    font-size: 8px;
    color: #aaffa0;
    margin-bottom: 4px;
    line-height: 1.5;
  }

  .gaia-line {
    background: rgba(78, 204, 163, 0.08);
    border-left: 2px solid #4ecca3;
    padding: 8px 10px;
    margin-bottom: 16px;
    text-align: left;
  }

  .gaia-tag {
    color: #4ecca3;
    font-size: 8px;
    margin-right: 6px;
  }

  .gaia-text {
    font-size: 8px;
    color: #ccc;
    line-height: 1.7;
    font-family: sans-serif;
  }

  .close-btn {
    background: #4ecca3;
    border: none;
    border-radius: 4px;
    color: #0a0a1a;
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    padding: 10px 24px;
    cursor: pointer;
    min-height: 36px;
  }
</style>

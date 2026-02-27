<script lang="ts">
  // Root component: houses the game canvas and UI overlay
  // Game canvas is managed by Phaser, UI overlay by Svelte
</script>

<div id="game-container"></div>
<div id="ui-overlay">
  <div class="hud-top">
    <span class="game-title">Terra Miner</span>
  </div>
</div>

<style>
  .hud-top {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 20;
  }

  .game-title {
    font-size: 14px;
    color: var(--color-text-dim);
    letter-spacing: 2px;
    text-transform: uppercase;
  }
</style>

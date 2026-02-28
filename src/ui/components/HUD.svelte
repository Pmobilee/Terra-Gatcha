<script lang="ts">
  import { currentDepth, inventory, oxygenCurrent, oxygenMax } from '../stores/gameState'

  interface Props {
    onSurface?: () => void
    onOpenBackpack?: () => void
  }

  let { onSurface, onOpenBackpack }: Props = $props()

  const oxygenRatio = $derived(($oxygenMax > 0 ? $oxygenCurrent / $oxygenMax : 0))
  const oxygenPercent = $derived(Math.max(0, Math.min(100, Math.round(oxygenRatio * 100))))
  const oxygenTone = $derived(oxygenRatio > 0.6 ? 'safe' : oxygenRatio >= 0.3 ? 'warn' : 'danger')
  const oxygenText = $derived(`O2: ${Math.max(0, Math.floor($oxygenCurrent))}/${Math.max(0, Math.floor($oxygenMax))}`)
  const filledSlots = $derived($inventory.filter((slot) => slot.type !== 'empty').length)
  const totalSlots = $derived($inventory.length)

  function handleSurface(): void {
    onSurface?.()
  }

  function handleOpenBackpack(): void {
    onOpenBackpack?.()
  }
</script>

<div class="hud">
  <div class="top-row">
    <div class="oxygen-panel">
      <div class="oxygen-label">{oxygenText}</div>
      <div class="oxygen-track" aria-hidden="true">
        <div class="oxygen-fill {oxygenTone}" style={`width: ${oxygenPercent}%`}></div>
      </div>
    </div>
    <div class="depth-indicator">Depth: {$currentDepth}</div>
  </div>

  <button class="surface-btn" type="button" onclick={handleSurface}>
    ↑ Surface
  </button>

  <button
    class="backpack-btn"
    type="button"
    onclick={handleOpenBackpack}
    aria-label="Open backpack"
  >
    {filledSlots}/{totalSlots}
  </button>
</div>

<style>
  .hud {
    position: fixed;
    inset: 0;
    z-index: 20;
    pointer-events: none;
    font-family: 'Courier New', monospace;
  }

  .top-row {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    right: 0.75rem;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .oxygen-panel {
    flex: 1;
    min-width: 10rem;
    max-width: min(26rem, 70vw);
    padding: 0.5rem 0.625rem;
    background: color-mix(in srgb, var(--color-bg) 75%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-surface) 70%, var(--color-text) 30%);
    border-radius: 0.5rem;
  }

  .oxygen-label,
  .depth-indicator {
    color: var(--color-text);
    font-size: 0.85rem;
    line-height: 1.2;
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
  }

  .oxygen-track {
    margin-top: 0.4rem;
    width: 100%;
    height: 0.7rem;
    background: color-mix(in srgb, var(--color-surface) 85%, var(--color-bg) 15%);
    border-radius: 999px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--color-bg) 60%, var(--color-text) 40%);
  }

  .oxygen-fill {
    height: 100%;
    width: 0%;
    transition: width 160ms linear, background-color 160ms linear;
  }

  .oxygen-fill.safe {
    background: var(--color-success);
  }

  .oxygen-fill.warn {
    background: var(--color-warning);
  }

  .oxygen-fill.danger {
    background: var(--color-accent);
  }

  .depth-indicator {
    padding: 0.6rem 0.7rem;
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--color-bg) 75%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-surface) 70%, var(--color-text) 30%);
    white-space: nowrap;
  }

  .surface-btn,
  .backpack-btn {
    position: absolute;
    pointer-events: auto;
    border: 1px solid color-mix(in srgb, var(--color-text) 25%, var(--color-surface) 75%);
    background: var(--color-surface);
    color: var(--color-text);
    min-height: 44px;
    min-width: 44px;
    font-family: inherit;
    font-size: 0.95rem;
    line-height: 1;
    touch-action: manipulation;
    cursor: pointer;
  }

  .surface-btn {
    left: 0.75rem;
    bottom: 0.75rem;
    border-radius: 999px;
    padding: 0.8rem 1rem;
    background: color-mix(in srgb, var(--color-success) 35%, var(--color-surface) 65%);
  }

  .backpack-btn {
    right: 0.75rem;
    bottom: 0.75rem;
    border-radius: 50%;
    width: 60px;
    height: 60px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--color-accent) 30%, var(--color-surface) 70%);
    font-weight: 700;
  }

  .surface-btn:active,
  .backpack-btn:active {
    transform: translateY(1px);
  }

  @media (max-width: 480px) {
    .top-row {
      top: 0.55rem;
      left: 0.55rem;
      right: 0.55rem;
    }

    .oxygen-panel {
      max-width: 65vw;
      padding: 0.45rem 0.5rem;
    }

    .oxygen-label,
    .depth-indicator {
      font-size: 0.78rem;
    }

    .surface-btn {
      left: 0.55rem;
      bottom: 0.55rem;
      padding: 0.72rem 0.9rem;
    }

    .backpack-btn {
      right: 0.55rem;
      bottom: 0.55rem;
      width: 56px;
      height: 56px;
      font-size: 0.88rem;
    }
  }
</style>

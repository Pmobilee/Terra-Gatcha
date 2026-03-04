<script lang="ts">
  interface Props {
    minutesRemaining: number
    onDismiss: () => void
  }
  let { minutesRemaining, onDismiss }: Props = $props()
</script>

<div class="session-warning" role="status" aria-live="polite">
  <span class="warning-icon" aria-hidden="true">⌛</span>
  <span class="warning-text">
    {minutesRemaining} minute{minutesRemaining === 1 ? '' : 's'} left for today!
  </span>
  <button class="dismiss-btn" type="button" onclick={onDismiss} aria-label="Dismiss warning">✕</button>
</div>

<style>
  .session-warning {
    pointer-events: auto;
    position: fixed;
    top: 0.75rem; left: 50%; transform: translateX(-50%);
    z-index: 8000;
    display: flex; align-items: center; gap: 0.5rem;
    background: #FF9F43; color: #1a1a2e;
    border-radius: 20px; padding: 0.5rem 1rem;
    font-weight: 700; font-size: 0.9rem; white-space: nowrap;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  }
  .warning-icon { font-size: 1.1rem; }
  .dismiss-btn {
    background: none; border: none; cursor: pointer;
    color: inherit; font-size: 0.9rem; margin-left: 0.25rem;
  }
</style>

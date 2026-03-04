<script lang="ts">
  import { sessionTimer } from '../../services/sessionTimer'
  import { parentalStore } from '../stores/parentalStore'

  interface Props {
    secondsPlayed: number
  }

  let { secondsPlayed }: Props = $props()

  let pinEntry = $state('')
  let pinError = $state(false)

  function formatMinutes(s: number): string {
    return Math.round(s / 60).toString()
  }

  function handlePinSubmit(): void {
    const pin = $parentalStore.pin
    if (pin && pinEntry === pin) {
      sessionTimer.parentOverride()
      pinEntry = ''
      pinError = false
    } else {
      pinError = true
      pinEntry = ''
    }
  }
</script>

<div class="time-up-overlay" role="alertdialog" aria-modal="true" aria-labelledby="time-up-title">
  <div class="time-up-card">
    <div class="time-up-icon" aria-hidden="true">⏰</div>
    <h1 id="time-up-title" class="time-up-heading">Great job today!</h1>
    <p class="time-up-body">
      You played for <strong>{formatMinutes(secondsPlayed)} minutes</strong>.<br>
      Come back tomorrow for more discoveries!
    </p>

    <div class="pin-section">
      <p class="pin-hint">Parent? Enter your PIN to keep playing.</p>
      <input
        class="pin-input {pinError ? 'pin-input--error' : ''}"
        type="password"
        inputmode="numeric"
        maxlength="6"
        placeholder="••••"
        bind:value={pinEntry}
        onkeydown={(e) => e.key === 'Enter' && handlePinSubmit()}
        aria-label="Parent PIN"
      />
      {#if pinError}
        <p class="pin-error" role="alert">Incorrect PIN. Try again.</p>
      {/if}
      <button class="pin-btn" type="button" onclick={handlePinSubmit}>
        Unlock
      </button>
    </div>
  </div>
</div>

<style>
  .time-up-overlay {
    pointer-events: auto;
    position: fixed;
    inset: 0;
    z-index: 9000;
    background: rgba(10, 15, 40, 0.97);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .time-up-card {
    background: #16213e;
    border: 2px solid rgba(78, 205, 196, 0.4);
    border-radius: 24px;
    padding: 2.5rem 2rem;
    max-width: 360px;
    width: 100%;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
  }
  .time-up-icon { font-size: 4rem; }
  .time-up-heading { font-size: 1.8rem; color: #FFD700; margin: 0; font-weight: 900; }
  .time-up-body { color: rgba(238,238,238,0.85); font-size: 1rem; line-height: 1.6; margin: 0; }
  .pin-section { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; width: 100%; }
  .pin-hint { font-size: 0.75rem; color: rgba(238,238,238,0.4); margin: 0; }
  .pin-input {
    width: 120px; padding: 0.6rem; font-size: 1.2rem; text-align: center;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2);
    border-radius: 8px; color: #eee; font-family: inherit;
  }
  .pin-input--error { border-color: #e94560; }
  .pin-error { font-size: 0.75rem; color: #e94560; margin: 0; }
  .pin-btn {
    padding: 0.5rem 1.5rem; background: rgba(78,205,196,0.15);
    border: 1px solid rgba(78,205,196,0.5); border-radius: 8px;
    color: #4ECDC4; font-size: 0.875rem; cursor: pointer;
  }
</style>

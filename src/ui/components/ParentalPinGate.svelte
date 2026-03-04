<script lang="ts">
  import { verifyPin } from '../stores/parentalStore'

  interface Props {
    /** Purpose string shown in the modal heading. */
    purpose: string
    onSuccess: () => void
    onCancel: () => void
  }

  let { purpose, onSuccess, onCancel }: Props = $props()

  let pinEntry = $state('')
  let pinError = $state(false)
  let checking = $state(false)

  async function handleSubmit(): Promise<void> {
    if (checking || pinEntry.length < 4) return
    checking = true
    const ok = await verifyPin(pinEntry)
    checking = false
    if (ok) {
      pinError = false
      onSuccess()
    } else {
      pinError = true
      pinEntry = ''
    }
  }
</script>

<div class="pin-gate-backdrop" role="dialog" aria-modal="true" aria-labelledby="pin-gate-title">
  <div class="pin-gate-card">
    <h2 id="pin-gate-title" class="pin-gate-heading">Parent PIN Required</h2>
    <p class="pin-gate-purpose">{purpose}</p>

    <input
      class="pin-input {pinError ? 'pin-input--error' : ''}"
      type="password"
      inputmode="numeric"
      maxlength="6"
      placeholder="Enter PIN"
      bind:value={pinEntry}
      onkeydown={(e) => e.key === 'Enter' && handleSubmit()}
      aria-label="Parent PIN"
      aria-invalid={pinError}
    />
    {#if pinError}
      <p class="pin-error" role="alert">Incorrect PIN. Please try again.</p>
    {/if}

    <div class="pin-gate-actions">
      <button class="btn-cancel" type="button" onclick={onCancel} disabled={checking}>Cancel</button>
      <button class="btn-confirm" type="button" onclick={handleSubmit} disabled={checking || pinEntry.length < 4}>
        {checking ? '…' : 'Confirm'}
      </button>
    </div>
  </div>
</div>

<style>
  .pin-gate-backdrop {
    pointer-events: auto; position: fixed; inset: 0;
    z-index: 9100; background: rgba(0,0,0,0.75);
    display: flex; align-items: center; justify-content: center; padding: 1rem;
  }
  .pin-gate-card {
    background: #16213e; border: 1px solid rgba(233,69,96,0.4);
    border-radius: 20px; padding: 2rem 1.5rem;
    max-width: 320px; width: 100%;
    display: flex; flex-direction: column; align-items: center; gap: 1rem;
  }
  .pin-gate-heading { font-size: 1.2rem; color: #eee; margin: 0; }
  .pin-gate-purpose { font-size: 0.875rem; color: rgba(238,238,238,0.6); margin: 0; text-align: center; }
  .pin-input {
    width: 140px; padding: 0.75rem; font-size: 1.4rem; text-align: center; letter-spacing: 0.4rem;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2);
    border-radius: 10px; color: #eee; font-family: inherit;
  }
  .pin-input--error { border-color: #e94560; }
  .pin-error { font-size: 0.75rem; color: #e94560; margin: 0; }
  .pin-gate-actions { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
  .btn-cancel {
    padding: 0.6rem 1.25rem; background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;
    color: rgba(238,238,238,0.7); cursor: pointer;
  }
  .btn-confirm {
    padding: 0.6rem 1.25rem; background: rgba(78,205,196,0.15);
    border: 1px solid rgba(78,205,196,0.5); border-radius: 8px;
    color: #4ECDC4; cursor: pointer; font-weight: 700;
  }
  .btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
</style>

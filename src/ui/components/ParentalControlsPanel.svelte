<script lang="ts">
  import {
    parentalStore,
    updateParentalSettings,
    setPin,
    verifyPin,
    removePin,
  } from '../stores/parentalStore'
  import { sessionTimer } from '../../services/sessionTimer'
  import { deleteSave } from '../../services/saveService'
  import WeeklyReportPreview from './WeeklyReportPreview.svelte'

  interface Props {
    onClose: () => void
  }
  let { onClose }: Props = $props()

  // ── Time limit options ──────────────────────────────────────────────────────
  const TIME_OPTIONS: Array<{ label: string; seconds: number }> = [
    { label: 'Unlimited', seconds: 0 },
    { label: '15 min', seconds: 900 },
    { label: '30 min', seconds: 1800 },
    { label: '45 min', seconds: 2700 },
    { label: '60 min', seconds: 3600 },
    { label: '90 min', seconds: 5400 },
    { label: '120 min', seconds: 7200 },
  ]

  // ── Local UI state ──────────────────────────────────────────────────────────
  let emailInput = $state($parentalStore.parentEmail ?? '')
  let emailError = $state('')

  // Change PIN flow: 'idle' | 'current' | 'new' | 'confirm'
  let changePinStep = $state<'idle' | 'current' | 'new' | 'confirm'>('idle')
  let changePinCurrent = $state('')
  let changePinNew = $state('')
  let changePinConfirm = $state('')
  let changePinError = $state('')
  let changePinChecking = $state(false)

  // Remove PIN flow
  let removePinStep = $state<'idle' | 'confirm'>('idle')
  let removePinEntry = $state('')
  let removePinError = $state('')
  let removePinChecking = $state(false)

  // Delete data flow
  let deleteStep = $state<'idle' | 'confirm1' | 'pin'>('idle')
  let deletePinEntry = $state('')
  let deletePinError = $state('')

  // ── Derived ─────────────────────────────────────────────────────────────────
  const hasPin = $derived($parentalStore.pinHash !== null)
  const currentLimitSeconds = $derived($parentalStore.limitSeconds)

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleTimeLimitChange(e: Event): void {
    const val = parseInt((e.target as HTMLSelectElement).value, 10)
    updateParentalSettings({ limitSeconds: val })
    sessionTimer.start(val) // apply immediately
  }

  function handleEmailSave(): void {
    emailError = ''
    const trimmed = emailInput.trim()
    if (trimmed !== '' && (!trimmed.includes('@') || !trimmed.includes('.'))) {
      emailError = 'Please enter a valid email address.'
      return
    }
    updateParentalSettings({ parentEmail: trimmed === '' ? null : trimmed })
  }

  function handleSocialToggle(): void {
    updateParentalSettings({ socialEnabled: !$parentalStore.socialEnabled })
  }

  function handleWeeklyReportToggle(): void {
    updateParentalSettings({ weeklyReportEnabled: !$parentalStore.weeklyReportEnabled })
  }

  function handleKidThemeToggle(): void {
    updateParentalSettings({ kidThemeEnabled: !$parentalStore.kidThemeEnabled })
  }

  // ── Change PIN ───────────────────────────────────────────────────────────────

  async function handleChangePinCurrentSubmit(): Promise<void> {
    if (changePinChecking) return
    changePinError = ''
    if (!hasPin) {
      // No PIN set yet — go straight to setting a new one
      changePinStep = 'new'
      return
    }
    changePinChecking = true
    const ok = await verifyPin(changePinCurrent)
    changePinChecking = false
    if (!ok) {
      changePinError = 'Incorrect current PIN.'
      changePinCurrent = ''
      return
    }
    changePinStep = 'new'
    changePinCurrent = ''
  }

  function handleChangePinNewSubmit(): void {
    changePinError = ''
    if (changePinNew.length < 4) {
      changePinError = 'PIN must be at least 4 digits.'
      return
    }
    changePinStep = 'confirm'
  }

  async function handleChangePinConfirmSubmit(): Promise<void> {
    changePinError = ''
    if (changePinNew !== changePinConfirm) {
      changePinError = 'PINs do not match.'
      changePinConfirm = ''
      return
    }
    await setPin(changePinNew)
    changePinStep = 'idle'
    changePinNew = ''
    changePinConfirm = ''
    changePinError = ''
  }

  function cancelChangePin(): void {
    changePinStep = 'idle'
    changePinCurrent = ''
    changePinNew = ''
    changePinConfirm = ''
    changePinError = ''
  }

  // ── Remove PIN ───────────────────────────────────────────────────────────────

  function startRemovePin(): void {
    removePinStep = 'confirm'
    removePinEntry = ''
    removePinError = ''
  }

  async function handleRemovePinSubmit(): Promise<void> {
    if (removePinChecking) return
    removePinError = ''
    removePinChecking = true
    const ok = await verifyPin(removePinEntry)
    removePinChecking = false
    if (!ok) {
      removePinError = 'Incorrect PIN.'
      removePinEntry = ''
      return
    }
    removePin()
    removePinStep = 'idle'
    removePinEntry = ''
  }

  function cancelRemovePin(): void {
    removePinStep = 'idle'
    removePinEntry = ''
    removePinError = ''
  }

  // ── Delete child data ────────────────────────────────────────────────────────

  function startDeleteData(): void {
    deleteStep = 'confirm1'
  }

  async function handleDeletePinSubmit(): Promise<void> {
    deletePinError = ''
    const ok = await verifyPin(deletePinEntry)
    if (!ok) {
      deletePinError = 'Incorrect PIN.'
      deletePinEntry = ''
      return
    }
    // Proceed with deletion
    deleteSave()
    window.location.reload()
  }

  function cancelDelete(): void {
    deleteStep = 'idle'
    deletePinEntry = ''
    deletePinError = ''
  }
</script>

<div class="parental-panel">
  <div class="panel-header">
    <h2 class="panel-title">Parental Controls</h2>
    <button class="close-btn" type="button" onclick={onClose} aria-label="Close parental controls">✕</button>
  </div>

  <div class="panel-scroll">

    <!-- Time Limit -->
    <section class="control-section">
      <h3 class="section-label">Daily Time Limit</h3>
      <select
        class="time-select"
        value={currentLimitSeconds}
        onchange={handleTimeLimitChange}
        aria-label="Daily time limit"
      >
        {#each TIME_OPTIONS as opt}
          <option value={opt.seconds}>{opt.label}</option>
        {/each}
      </select>
      <p class="section-hint">Hard stop when the limit is reached. Parent PIN unlocks more time.</p>
    </section>

    <!-- Parent Email + Weekly Report -->
    <section class="control-section">
      <h3 class="section-label">Weekly Learning Report</h3>
      <div class="email-row">
        <input
          class="email-input {emailError ? 'email-input--error' : ''}"
          type="email"
          placeholder="parent@example.com"
          bind:value={emailInput}
          aria-label="Parent email for weekly reports"
        />
        <button class="save-btn" type="button" onclick={handleEmailSave}>Save</button>
      </div>
      {#if emailError}
        <p class="field-error" role="alert">{emailError}</p>
      {/if}
      <label class="toggle-row">
        <span class="toggle-label">Send weekly email</span>
        <input
          type="checkbox"
          checked={$parentalStore.weeklyReportEnabled}
          onchange={handleWeeklyReportToggle}
          aria-label="Enable weekly learning report email"
        />
      </label>
      <WeeklyReportPreview />
    </section>

    <!-- Social Features -->
    <section class="control-section">
      <h3 class="section-label">Social Features</h3>
      <label class="toggle-row">
        <span class="toggle-label">Allow leaderboards, guilds &amp; duels</span>
        <input
          type="checkbox"
          checked={$parentalStore.socialEnabled}
          onchange={handleSocialToggle}
          aria-label="Enable social features"
        />
      </label>
      <p class="section-hint">Off by default for under-13 accounts.</p>
    </section>

    <!-- Kid Theme -->
    <section class="control-section">
      <h3 class="section-label">Kid-Friendly Theme</h3>
      <label class="toggle-row">
        <span class="toggle-label">Larger buttons, simpler labels</span>
        <input
          type="checkbox"
          checked={$parentalStore.kidThemeEnabled}
          onchange={handleKidThemeToggle}
          aria-label="Enable kid-friendly theme"
        />
      </label>
    </section>

    <!-- Change PIN -->
    <section class="control-section">
      <h3 class="section-label">Parent PIN</h3>

      {#if changePinStep === 'idle'}
        <button class="action-btn" type="button" onclick={() => { changePinStep = hasPin ? 'current' : 'new' }}>
          {hasPin ? 'Change PIN' : 'Set PIN'}
        </button>
        {#if hasPin}
          <button class="action-btn action-btn--danger" type="button" onclick={startRemovePin}>
            Remove PIN
          </button>
        {/if}

      {:else if changePinStep === 'current'}
        <p class="flow-label">Enter your current PIN:</p>
        <input class="pin-field" type="password" inputmode="numeric" maxlength="6"
          placeholder="Current PIN" bind:value={changePinCurrent}
          onkeydown={(e) => e.key === 'Enter' && handleChangePinCurrentSubmit()}
          aria-label="Current PIN"
        />
        {#if changePinError}<p class="field-error" role="alert">{changePinError}</p>{/if}
        <div class="flow-actions">
          <button class="btn-sm" type="button" onclick={cancelChangePin}>Cancel</button>
          <button class="btn-sm btn-sm--primary" type="button" onclick={handleChangePinCurrentSubmit} disabled={changePinChecking || changePinCurrent.length < 4}>
            {changePinChecking ? '…' : 'Next'}
          </button>
        </div>

      {:else if changePinStep === 'new'}
        <p class="flow-label">Enter new PIN (4–6 digits):</p>
        <input class="pin-field" type="password" inputmode="numeric" maxlength="6"
          placeholder="New PIN" bind:value={changePinNew}
          onkeydown={(e) => e.key === 'Enter' && handleChangePinNewSubmit()}
          aria-label="New PIN"
        />
        {#if changePinError}<p class="field-error" role="alert">{changePinError}</p>{/if}
        <div class="flow-actions">
          <button class="btn-sm" type="button" onclick={cancelChangePin}>Cancel</button>
          <button class="btn-sm btn-sm--primary" type="button" onclick={handleChangePinNewSubmit} disabled={changePinNew.length < 4}>
            Next
          </button>
        </div>

      {:else if changePinStep === 'confirm'}
        <p class="flow-label">Confirm new PIN:</p>
        <input class="pin-field" type="password" inputmode="numeric" maxlength="6"
          placeholder="Confirm PIN" bind:value={changePinConfirm}
          onkeydown={(e) => e.key === 'Enter' && handleChangePinConfirmSubmit()}
          aria-label="Confirm new PIN"
        />
        {#if changePinError}<p class="field-error" role="alert">{changePinError}</p>{/if}
        <div class="flow-actions">
          <button class="btn-sm" type="button" onclick={cancelChangePin}>Cancel</button>
          <button class="btn-sm btn-sm--primary" type="button" onclick={handleChangePinConfirmSubmit} disabled={changePinConfirm.length < 4}>
            Save PIN
          </button>
        </div>
      {/if}

      <!-- Remove PIN confirmation -->
      {#if removePinStep === 'confirm'}
        <div class="remove-pin-section">
          <p class="flow-label">Enter current PIN to remove it:</p>
          <input class="pin-field" type="password" inputmode="numeric" maxlength="6"
            placeholder="Current PIN" bind:value={removePinEntry}
            onkeydown={(e) => e.key === 'Enter' && handleRemovePinSubmit()}
            aria-label="Current PIN to remove"
          />
          {#if removePinError}<p class="field-error" role="alert">{removePinError}</p>{/if}
          <div class="flow-actions">
            <button class="btn-sm" type="button" onclick={cancelRemovePin}>Cancel</button>
            <button class="btn-sm btn-sm--danger" type="button" onclick={handleRemovePinSubmit} disabled={removePinChecking || removePinEntry.length < 4}>
              {removePinChecking ? '…' : 'Remove PIN'}
            </button>
          </div>
        </div>
      {/if}
    </section>

    <!-- Delete Child's Data -->
    <section class="control-section control-section--danger">
      <h3 class="section-label section-label--danger">Data Management</h3>

      {#if deleteStep === 'idle'}
        <button class="action-btn action-btn--danger" type="button" onclick={startDeleteData}>
          Delete Child's Data
        </button>
      {:else if deleteStep === 'confirm1'}
        <p class="delete-warning">
          This will permanently erase all game progress, facts learned, and account data. This cannot be undone.
        </p>
        <div class="flow-actions">
          <button class="btn-sm" type="button" onclick={cancelDelete}>Cancel</button>
          <button class="btn-sm btn-sm--danger" type="button" onclick={() => { deleteStep = hasPin ? 'pin' : 'idle'; if (!hasPin) { deleteSave(); window.location.reload() } }}>
            I understand, continue
          </button>
        </div>
      {:else if deleteStep === 'pin'}
        <p class="flow-label">Enter parent PIN to confirm deletion:</p>
        <input class="pin-field" type="password" inputmode="numeric" maxlength="6"
          placeholder="Parent PIN" bind:value={deletePinEntry}
          onkeydown={(e) => e.key === 'Enter' && handleDeletePinSubmit()}
          aria-label="Parent PIN to confirm deletion"
        />
        {#if deletePinError}<p class="field-error" role="alert">{deletePinError}</p>{/if}
        <div class="flow-actions">
          <button class="btn-sm" type="button" onclick={cancelDelete}>Cancel</button>
          <button class="btn-sm btn-sm--danger" type="button" onclick={handleDeletePinSubmit} disabled={deletePinEntry.length < 4}>
            Delete All Data
          </button>
        </div>
      {/if}
    </section>

  </div>
</div>

<style>
  .parental-panel {
    background: #0f172a;
    border: 1px solid rgba(78,205,196,0.3);
    border-radius: 16px;
    max-width: 400px;
    width: 100%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
  }
  .panel-title { font-size: 1.1rem; color: #4ECDC4; margin: 0; }
  .close-btn { background: none; border: none; color: rgba(238,238,238,0.5); font-size: 1.2rem; cursor: pointer; }
  .panel-scroll { overflow-y: auto; padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 1.25rem; }

  .control-section { display: flex; flex-direction: column; gap: 0.6rem; }
  .control-section--danger { border-top: 1px solid rgba(233,69,96,0.2); padding-top: 1rem; }
  .section-label { font-size: 0.7rem; font-weight: 700; color: rgba(238,238,238,0.5); text-transform: uppercase; letter-spacing: 0.08em; margin: 0; }
  .section-label--danger { color: rgba(233,69,96,0.7); }
  .section-hint { font-size: 0.7rem; color: rgba(238,238,238,0.4); margin: 0; }

  .time-select {
    padding: 0.5rem 0.75rem; background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.15); border-radius: 8px;
    color: #eee; font-size: 0.875rem; width: 100%;
  }

  .email-row { display: flex; gap: 0.5rem; }
  .email-input {
    flex: 1; padding: 0.5rem 0.75rem; background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #eee; font-size: 0.85rem;
  }
  .email-input--error { border-color: #e94560; }
  .save-btn {
    padding: 0.5rem 0.75rem; background: rgba(78,205,196,0.1);
    border: 1px solid rgba(78,205,196,0.4); border-radius: 8px;
    color: #4ECDC4; font-size: 0.8rem; cursor: pointer; white-space: nowrap;
  }

  .toggle-row {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 0.85rem; color: rgba(238,238,238,0.85); cursor: pointer;
    gap: 0.5rem;
  }
  .toggle-label { flex: 1; }

  .action-btn {
    padding: 0.55rem 1rem; background: rgba(78,205,196,0.08);
    border: 1px solid rgba(78,205,196,0.35); border-radius: 8px;
    color: #4ECDC4; font-size: 0.8rem; cursor: pointer; text-align: left;
  }
  .action-btn--danger {
    background: rgba(233,69,96,0.08); border-color: rgba(233,69,96,0.35); color: #e94560;
  }

  .flow-label { font-size: 0.8rem; color: rgba(238,238,238,0.7); margin: 0; }
  .pin-field {
    width: 130px; padding: 0.55rem 0.75rem; font-size: 1.2rem;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2);
    border-radius: 8px; color: #eee; text-align: center; letter-spacing: 0.3rem;
  }
  .field-error { font-size: 0.75rem; color: #e94560; margin: 0; }

  .flow-actions { display: flex; gap: 0.5rem; }
  .btn-sm {
    padding: 0.45rem 0.9rem; background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.15); border-radius: 7px;
    color: rgba(238,238,238,0.7); font-size: 0.78rem; cursor: pointer;
  }
  .btn-sm--primary {
    background: rgba(78,205,196,0.12); border-color: rgba(78,205,196,0.45); color: #4ECDC4; font-weight: 700;
  }
  .btn-sm--danger {
    background: rgba(233,69,96,0.1); border-color: rgba(233,69,96,0.4); color: #e94560;
  }
  .btn-sm:disabled { opacity: 0.35; cursor: not-allowed; }

  .delete-warning { font-size: 0.8rem; color: #e94560; margin: 0; line-height: 1.5; }
  .remove-pin-section { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed rgba(233,69,96,0.2); }
</style>

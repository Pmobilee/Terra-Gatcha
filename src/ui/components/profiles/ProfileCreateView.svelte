<script lang="ts">
  import { profileService, ProfileService } from '../../../services/profileService'
  import type { PlayerProfile } from '../../../data/profileTypes'

  interface Props {
    onCreated: (profile: PlayerProfile) => void
    onBack: () => void
  }

  const { onCreated, onBack }: Props = $props()

  const avatarOptions = ProfileService.getAvatarOptions()

  let name = $state('')
  let selectedAvatar = $state(avatarOptions[0] ?? '⛏')
  let ageBracket = $state<'under_13' | 'teen' | 'adult'>('teen')
  let errorMsg = $state<string | null>(null)

  const nameIsValid = $derived(name.trim().length > 0 && name.trim().length <= 20)
  const canSubmit = $derived(nameIsValid && selectedAvatar.length > 0)

  function handleSubmit(): void {
    if (!canSubmit) return
    errorMsg = null
    try {
      const profile = profileService.createProfile({
        name: name.trim(),
        ageBracket,
        avatarKey: selectedAvatar,
        interests: [],
      })
      onCreated(profile)
    } catch (err: unknown) {
      errorMsg = err instanceof Error ? err.message : 'Failed to create profile.'
    }
  }

  const AGE_BRACKETS: { value: 'under_13' | 'teen' | 'adult'; label: string }[] = [
    { value: 'under_13', label: 'Under 13' },
    { value: 'teen', label: '13–17' },
    { value: 'adult', label: '18+' },
  ]
</script>

<div class="profile-create-view">
  <button class="back-btn" type="button" onclick={onBack} aria-label="Go back">
    ← Back
  </button>

  <div class="form-card">
    <h2 class="form-title">New Explorer</h2>

    <!-- Avatar picker -->
    <div class="field">
      <p class="field-label" id="avatar-label">Choose your avatar</p>
      <div class="avatar-grid" role="group" aria-labelledby="avatar-label">
        {#each avatarOptions as emoji}
          <button
            class="avatar-btn"
            class:selected={selectedAvatar === emoji}
            type="button"
            onclick={() => { selectedAvatar = emoji }}
            aria-label="Select avatar {emoji}"
            aria-pressed={selectedAvatar === emoji}
          >
            {emoji}
          </button>
        {/each}
      </div>
    </div>

    <!-- Name input -->
    <div class="field">
      <label class="field-label" for="profile-name">Explorer name</label>
      <input
        id="profile-name"
        class="name-input"
        type="text"
        placeholder="Enter name..."
        maxlength={20}
        bind:value={name}
        autocomplete="off"
      />
      <span class="char-count" class:warn={name.length > 16}>
        {name.length}/20
      </span>
    </div>

    <!-- Age bracket -->
    <div class="field">
      <p class="field-label" id="age-label">Your age group</p>
      <div class="age-group" role="group" aria-labelledby="age-label">
        {#each AGE_BRACKETS as bracket}
          <button
            class="age-btn"
            class:selected={ageBracket === bracket.value}
            type="button"
            onclick={() => { ageBracket = bracket.value }}
            aria-pressed={ageBracket === bracket.value}
          >
            {bracket.label}
          </button>
        {/each}
      </div>
    </div>

    {#if errorMsg}
      <p class="error-msg" role="alert">{errorMsg}</p>
    {/if}

    <button
      class="submit-btn"
      type="button"
      onclick={handleSubmit}
      disabled={!canSubmit}
    >
      Start Exploring
    </button>
  </div>
</div>

<style>
  .profile-create-view {
    pointer-events: auto;
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #1a1a2e;
    z-index: 100;
    font-family: 'Courier New', monospace;
    padding: 1.5rem;
    overflow-y: auto;
  }

  .back-btn {
    position: absolute;
    top: 1.25rem;
    left: 1.25rem;
    background: none;
    border: none;
    color: #888;
    font-family: inherit;
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0.4rem 0.8rem;
    transition: color 120ms ease;
  }

  .back-btn:hover {
    color: #eee;
  }

  .form-card {
    width: min(100%, 22rem);
    display: flex;
    flex-direction: column;
    gap: 1.4rem;
  }

  .form-title {
    text-align: center;
    color: #ffd369;
    font-size: 1.4rem;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field-label {
    font-size: 0.78rem;
    color: #888;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin: 0;
    padding: 0;
  }

  /* Avatar grid */
  .avatar-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
  }

  .avatar-btn {
    font-size: 1.8rem;
    padding: 0.4rem;
    border-radius: 10px;
    border: 2px solid transparent;
    background: rgba(255, 255, 255, 0.05);
    cursor: pointer;
    transition: border-color 120ms ease, background 120ms ease, transform 120ms ease;
    line-height: 1;
  }

  .avatar-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: scale(1.08);
  }

  .avatar-btn.selected {
    border-color: #e94560;
    background: rgba(233, 69, 96, 0.2);
  }

  /* Name input */
  .name-input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.75rem 1rem;
    border-radius: 10px;
    border: 2px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.06);
    color: #eee;
    font-family: inherit;
    font-size: 1rem;
    outline: none;
    transition: border-color 120ms ease;
  }

  .name-input:focus {
    border-color: #e94560;
  }

  .name-input::placeholder {
    color: #555;
  }

  .char-count {
    font-size: 0.72rem;
    color: #666;
    text-align: right;
    align-self: flex-end;
    margin-top: -0.25rem;
  }

  .char-count.warn {
    color: #ffd369;
  }

  /* Age bracket */
  .age-group {
    display: flex;
    gap: 0.5rem;
  }

  .age-btn {
    flex: 1;
    padding: 0.65rem 0.5rem;
    border-radius: 10px;
    border: 2px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.04);
    color: #aaa;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.5px;
    transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
  }

  .age-btn:hover {
    border-color: rgba(255, 255, 255, 0.3);
    color: #eee;
  }

  .age-btn.selected {
    border-color: #e94560;
    background: rgba(233, 69, 96, 0.2);
    color: #eee;
  }

  /* Error */
  .error-msg {
    color: #ff6b6b;
    font-size: 0.85rem;
    text-align: center;
    margin: 0;
  }

  /* Submit */
  .submit-btn {
    width: 100%;
    padding: 0.9rem;
    border-radius: 14px;
    border: 2px solid #e94560;
    background: rgba(233, 69, 96, 0.25);
    color: #eee;
    font-family: inherit;
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 2px;
    cursor: pointer;
    transition: background 120ms ease, transform 120ms ease;
  }

  .submit-btn:hover:not(:disabled) {
    background: rgba(233, 69, 96, 0.4);
  }

  .submit-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .submit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>

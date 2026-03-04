<script lang="ts">
  import { profileService } from '../../../services/profileService'
  import { profileStore } from '../../stores/profileStore'
  import type { PlayerProfile } from '../../../data/profileTypes'

  interface Props {
    onBack: () => void
    onProfileDeleted: () => void
  }

  const { onBack, onProfileDeleted }: Props = $props()

  /** ID of the profile pending deletion confirmation. */
  let confirmDeleteId = $state<string | null>(null)

  /** Look up the profile pending deletion (for displaying its name in confirm dialog). */
  const confirmProfile = $derived.by(() => {
    if (!confirmDeleteId) return null
    return profileService.getProfiles().find(p => p.id === confirmDeleteId) ?? null
  })

  function requestDelete(id: string): void {
    confirmDeleteId = id
  }

  function cancelDelete(): void {
    confirmDeleteId = null
  }

  function confirmDelete(): void {
    if (!confirmDeleteId) return
    profileService.deleteProfile(confirmDeleteId)
    profileStore.refresh()
    confirmDeleteId = null
    onProfileDeleted()
  }

  // Use the store for reactivity
  let profiles: PlayerProfile[] = $state(profileService.getProfiles())

  $effect(() => {
    const unsub = profileStore.subscribe(updated => {
      profiles = updated
    })
    return unsub
  })
</script>

<div class="profile-manage-view">
  <button class="back-btn" type="button" onclick={onBack} aria-label="Go back">
    ← Back
  </button>

  <div class="content">
    <h2 class="title">Manage Profiles</h2>

    {#if profiles.length === 0}
      <p class="empty-msg">No profiles yet.</p>
    {:else}
      <ul class="profile-list">
        {#each profiles as profile (profile.id)}
          <li class="profile-row">
            <span class="row-avatar">{profile.avatarKey}</span>
            <div class="row-info">
              <span class="row-name">{profile.name}</span>
              <span class="row-level">Lv. {profile.level}</span>
            </div>
            <button
              class="delete-btn"
              type="button"
              onclick={() => requestDelete(profile.id)}
              aria-label="Delete profile {profile.name}"
            >
              Delete
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <!-- Confirmation dialog -->
  {#if confirmProfile}
    <div class="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div class="confirm-card">
        <p id="confirm-title" class="confirm-msg">
          Delete <strong>{confirmProfile.name}</strong>?
          This cannot be undone.
        </p>
        <div class="confirm-btns">
          <button class="confirm-cancel" type="button" onclick={cancelDelete}>Cancel</button>
          <button class="confirm-delete" type="button" onclick={confirmDelete}>Delete</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .profile-manage-view {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: #1a1a2e;
    z-index: 100;
    font-family: 'Courier New', monospace;
    padding: 1.5rem;
    overflow-y: auto;
  }

  .back-btn {
    align-self: flex-start;
    background: none;
    border: none;
    color: #888;
    font-family: inherit;
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0.4rem 0.8rem 0.4rem 0;
    transition: color 120ms ease;
  }

  .back-btn:hover {
    color: #eee;
  }

  .content {
    width: min(100%, 24rem);
    margin-top: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  .title {
    color: #ffd369;
    font-size: 1.2rem;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin: 0;
    text-align: center;
  }

  .empty-msg {
    color: #666;
    text-align: center;
    font-size: 0.9rem;
    margin: 2rem 0;
  }

  .profile-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .profile-row {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.85rem 1rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
  }

  .row-avatar {
    font-size: 1.8rem;
    flex-shrink: 0;
  }

  .row-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .row-name {
    color: #eee;
    font-size: 0.95rem;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-level {
    color: #ffd369;
    font-size: 0.75rem;
  }

  .delete-btn {
    flex-shrink: 0;
    background: none;
    border: 1px solid rgba(255, 107, 107, 0.4);
    border-radius: 8px;
    color: #ff6b6b;
    font-family: inherit;
    font-size: 0.8rem;
    padding: 0.35rem 0.75rem;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }

  .delete-btn:hover {
    background: rgba(255, 107, 107, 0.15);
    border-color: #ff6b6b;
  }

  /* Confirm overlay */
  .confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 1.5rem;
  }

  .confirm-card {
    width: min(100%, 20rem);
    background: #1a1a2e;
    border: 1px solid rgba(255, 107, 107, 0.4);
    border-radius: 16px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .confirm-msg {
    color: #eee;
    font-size: 0.95rem;
    text-align: center;
    margin: 0;
    line-height: 1.5;
  }

  .confirm-msg strong {
    color: #ffd369;
  }

  .confirm-btns {
    display: flex;
    gap: 0.75rem;
  }

  .confirm-cancel {
    flex: 1;
    padding: 0.7rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.06);
    color: #aaa;
    font-family: inherit;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }

  .confirm-cancel:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #eee;
  }

  .confirm-delete {
    flex: 1;
    padding: 0.7rem;
    border-radius: 10px;
    border: 1px solid #ff6b6b;
    background: rgba(255, 107, 107, 0.2);
    color: #ff6b6b;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 120ms ease;
  }

  .confirm-delete:hover {
    background: rgba(255, 107, 107, 0.35);
  }
</style>

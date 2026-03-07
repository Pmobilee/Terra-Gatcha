<script lang="ts">
  import { shortcutService } from '../../services/shortcutService'
  import { onMount, onDestroy } from 'svelte'

  let visible = $state(false)
  let bindings = $state(shortcutService.getBindings())

  function show() { visible = true; bindings = shortcutService.getBindings() }
  function hide() { visible = false }

  onMount(() => shortcutService.on('shortcut_help', show))
  onDestroy(() => shortcutService.off('shortcut_help', show))
</script>

{#if visible}
  <div
    class="overlay-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="Keyboard shortcuts"
    tabindex="-1"
    onclick={(e) => { if (e.target === e.currentTarget) hide() }}
    onkeydown={(e) => { if (e.key === 'Escape') hide() }}
  >
    <div class="overlay-card" role="document">
      <h2 class="overlay-title">Keyboard Shortcuts</h2>
      <dl class="bindings-grid">
        {#each bindings as b (b.id)}
          <div class="binding-row">
            <dt class="binding-key">{b.key}</dt>
            <dd class="binding-label">{b.label}</dd>
          </div>
        {/each}
      </dl>
      <button class="close-btn" onclick={hide} type="button">Close</button>
    </div>
  </div>
{/if}

<style>
  .overlay-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 500;
    pointer-events: auto;
  }

  .overlay-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 14px;
    padding: 1.5rem;
    max-width: 440px;
    width: calc(100% - 2rem);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .overlay-title {
    font-size: 1.1rem;
    color: var(--color-text);
    font-family: var(--font-body);
  }

  .bindings-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .binding-row {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    font-family: var(--font-body);
    font-size: 0.9rem;
  }

  .binding-key {
    font-family: monospace;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 5px;
    padding: 0.2rem 0.5rem;
    min-width: 3rem;
    text-align: center;
    color: var(--color-accent);
    font-weight: 700;
  }

  .binding-label { color: var(--color-text-dim); }

  .close-btn {
    align-self: flex-end;
    padding: 0.5rem 1.25rem;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: var(--color-text);
    font-family: var(--font-body);
    cursor: pointer;
  }
</style>

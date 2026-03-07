<script lang="ts">
  interface ContextMenuItem {
    label: string
    action: () => void
    danger?: boolean
  }

  let {
    items = $bindable<ContextMenuItem[]>([]),
    x = $bindable(0),
    y = $bindable(0),
    visible = $bindable(false),
  } = $props<{
    items: ContextMenuItem[]
    x: number
    y: number
    visible: boolean
  }>()

  function close() { visible = false }

  $effect(() => {
    if (!visible) return
    const handler = () => close()
    window.addEventListener('click', handler, { once: true })
    window.addEventListener('contextmenu', handler, { once: true })
    return () => {
      window.removeEventListener('click', handler)
      window.removeEventListener('contextmenu', handler)
    }
  })
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <menu
    class="context-menu"
    style="left: {x}px; top: {y}px"
    onkeydown={(e) => e.key === 'Escape' && close()}
    role="menu"
  >
    {#each items as item (item.label)}
      <li role="menuitem">
        <button
          class="context-item"
          class:danger={item.danger}
          onclick={() => { item.action(); close() }}
          type="button"
        >
          {item.label}
        </button>
      </li>
    {/each}
  </menu>
{/if}

<style>
  .context-menu {
    position: fixed;
    z-index: 9999;
    list-style: none;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 0.375rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
    min-width: 160px;
    pointer-events: auto;
  }

  .context-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.5rem 0.75rem;
    background: none;
    border: none;
    border-radius: 5px;
    color: var(--color-text);
    font-family: var(--font-body);
    font-size: 0.875rem;
    cursor: pointer;
    white-space: nowrap;
  }

  .context-item:hover { background: rgba(255, 255, 255, 0.08); }
  .context-item.danger { color: #f87171; }
  .context-item.danger:hover { background: rgba(248, 113, 113, 0.12); }
</style>

<script lang="ts">
  import type { InventorySlot, MineralTier } from '../../data/types'

  interface Props {
    slots: InventorySlot[]
    onClose: () => void
    onDropItem: (index: number) => void
  }

  let { slots, onClose, onDropItem }: Props = $props()

  let selectedIndex = $state<number | null>(null)

  const filledCount = $derived(slots.filter((slot) => slot.type !== 'empty').length)
  const totalCount = $derived(slots.length)

  function formatMineralTier(tier: MineralTier | undefined): string {
    switch (tier) {
      case 'dust':
        return 'Dust'
      case 'shard':
        return 'Shard'
      case 'crystal':
        return 'Crystal'
      case 'coreFragment':
        return 'Core Fragment'
      case 'primordialEssence':
        return 'Primordial Essence'
      default:
        return 'Mineral'
    }
  }

  function formatRarity(rarity: string | undefined): string {
    if (!rarity) return 'Unknown'
    return rarity.charAt(0).toUpperCase() + rarity.slice(1)
  }

  function handleSlotTap(index: number): void {
    if (selectedIndex === index) {
      const slot = slots[index]

      if (slot && slot.type !== 'empty' && window.confirm('Drop?')) {
        onDropItem(index)
      }

      selectedIndex = null
      return
    }

    selectedIndex = index
  }

  $effect(() => {
    if (selectedIndex !== null && selectedIndex >= slots.length) {
      selectedIndex = null
    }
  })
</script>

<section class="backpack-overlay" aria-label="Backpack inventory">
  <header class="title-bar">
    <h2>Backpack ({filledCount}/{totalCount})</h2>
    <button class="close-button" type="button" aria-label="Close backpack" onclick={onClose}>X</button>
  </header>

  <div class="slot-grid">
    {#each slots as slot, index}
      <button
        class="slot"
        class:empty={slot.type === 'empty'}
        class:mineral={slot.type === 'mineral'}
        class:artifact={slot.type === 'artifact'}
        class:fossil={slot.type === 'fossil'}
        class:selected={selectedIndex === index}
        type="button"
        onclick={() => handleSlotTap(index)}
        aria-label={`Inventory slot ${index + 1}`}
        aria-pressed={selectedIndex === index}
      >
        {#if slot.type === 'mineral'}
          <span class="label">{formatMineralTier(slot.mineralTier)}</span>
          <span class="value">x{slot.mineralAmount ?? 0}</span>
        {:else if slot.type === 'artifact'}
          <span class="label">{formatRarity(slot.artifactRarity)}</span>
          <span class="value">Artifact</span>
        {:else if slot.type === 'fossil'}
          <span class="label">Fossil</span>
        {/if}
      </button>
    {/each}
  </div>
</section>

<style>
  .backpack-overlay {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: auto;
    z-index: 40;
    height: 60dvh;
    background: var(--color-surface);
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    animation: slide-up 220ms ease-out;
    display: flex;
    flex-direction: column;
  }

  .title-bar {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  }

  .title-bar h2 {
    font-size: 1rem;
    color: var(--color-text);
  }

  .close-button {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text);
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
  }

  .slot-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    padding: 16px;
    overflow-y: auto;
  }

  .slot {
    min-height: 80px;
    aspect-ratio: 1 / 1;
    border: 2px solid transparent;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    text-align: center;
    padding: 8px;
    cursor: pointer;
  }

  .slot.empty {
    background: transparent;
    border-style: dashed;
    border-color: rgba(255, 255, 255, 0.1);
  }

  .slot.mineral {
    background: rgba(78, 204, 163, 0.2);
    color: var(--color-success);
  }

  .slot.artifact {
    background: rgba(233, 69, 96, 0.2);
    color: var(--color-accent);
  }

  .slot.fossil {
    background: rgba(255, 255, 255, 0.14);
    color: var(--color-text);
  }

  .slot.selected {
    border-color: var(--color-warning);
  }

  .label {
    font-size: 0.78rem;
    line-height: 1.1;
  }

  .value {
    font-size: 0.85rem;
    font-weight: bold;
    line-height: 1.1;
  }

  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }

    to {
      transform: translateY(0);
    }
  }
</style>

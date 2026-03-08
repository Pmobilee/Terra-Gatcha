<script lang="ts">
  interface Props {
    count: number  // 0-5, 0-1 = hidden
  }

  let { count }: Props = $props()

  let displayText = $derived(count >= 5 ? 'PERFECT!' : count >= 2 ? `${count}x` : '')
  let visible = $derived(count >= 2)
  let animKey = $state(0)

  // Trigger bounce animation on count change
  $effect(() => {
    if (count >= 2) {
      animKey++
    }
  })
</script>

{#if visible}
  {#key animKey}
    <div
      class="combo-counter"
      class:combo-3={count >= 3}
      class:combo-4={count >= 4}
      class:combo-5={count >= 5}
      data-testid="combo-counter"
    >
      <span class="combo-text">{displayText}</span>
      {#if count >= 3}
        <div class="particle-ring"></div>
      {/if}
    </div>
  {/key}
{/if}

<style>
  .combo-counter {
    position: absolute;
    top: 8px;
    right: 16px;
    z-index: 50;
    animation: comboBounce 300ms ease-out;
  }
  .combo-text {
    font-size: 20px;
    font-weight: 900;
    color: #FFD700;
    text-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
  }
  .combo-3 .combo-text { font-size: 24px; }
  .combo-4 .combo-text { font-size: 28px; }
  .combo-5 .combo-text {
    font-size: 36px;
    text-shadow: 0 0 16px rgba(255, 215, 0, 0.8);
  }
  .particle-ring {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 60px;
    height: 60px;
    margin-top: -30px;
    margin-left: -30px;
    border: 2px solid rgba(255, 215, 0, 0.4);
    border-radius: 50%;
    animation: ringPulse 2s linear infinite;
  }
  .combo-4 .particle-ring {
    border-color: rgba(255, 215, 0, 0.6);
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
  }
  @keyframes comboBounce {
    0% { transform: scale(1.5); }
    50% { transform: scale(0.9); }
    100% { transform: scale(1.0); }
  }
  @keyframes ringPulse {
    0% { transform: rotate(0deg) scale(1); opacity: 0.6; }
    50% { transform: rotate(180deg) scale(1.1); opacity: 0.3; }
    100% { transform: rotate(360deg) scale(1); opacity: 0.6; }
  }
</style>

<script lang="ts">
  interface Props {
    value: string
    isCritical: boolean
    onComplete?: () => void
  }

  let { value, isCritical, onComplete }: Props = $props()

  // Auto-remove after animation
  $effect(() => {
    const timer = setTimeout(() => onComplete?.(), 600)
    return () => clearTimeout(timer)
  })
</script>

<div
  class="damage-number"
  class:critical={isCritical}
  data-testid="damage-number"
>
  {value}
</div>

<style>
  .damage-number {
    position: absolute;
    top: 40%;
    left: 50%;
    transform: translateX(-50%);
    font-size: 24px;
    font-weight: 900;
    color: #FFD700;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
    pointer-events: none;
    z-index: 100;
    animation: damageArc 600ms ease-out forwards;
  }
  .damage-number.critical {
    font-size: 32px;
    color: #E74C3C;
  }
  @keyframes damageArc {
    0% { transform: translateX(-50%) translateY(0) scale(0.5); opacity: 0; }
    15% { transform: translateX(-50%) translateY(-10px) scale(1.3); opacity: 1; }
    40% { transform: translateX(-50%) translateY(-60px) scale(1.1); opacity: 1; }
    70% { transform: translateX(-50%) translateY(-40px) scale(1.0); opacity: 1; }
    85% { transform: translateX(-50%) translateY(-30px) scale(1.2); opacity: 0.8; }
    100% { transform: translateX(-50%) translateY(-20px) scale(1.0); opacity: 0; }
  }
</style>

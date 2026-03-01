<script lang="ts">
  import { giaiMessage, giaiExpression } from '../stores/gameState'
  import { GIAI_EXPRESSIONS, GIAI_NAME } from '../../data/giaiAvatar'

  /** Auto-dismiss duration in milliseconds */
  const DISMISS_DELAY = 4000

  let visible = $state(false)
  let currentMessage = $state('')
  let currentExpressionId = $state('neutral')
  let dismissTimer: ReturnType<typeof setTimeout> | null = null

  $effect(() => {
    const msg = $giaiMessage
    if (msg) {
      currentMessage = msg
      currentExpressionId = $giaiExpression
      visible = true
      if (dismissTimer) clearTimeout(dismissTimer)
      dismissTimer = setTimeout(() => {
        visible = false
        giaiMessage.set(null)
      }, DISMISS_DELAY)
    }
  })

  const expressionEmoji = $derived(
    (GIAI_EXPRESSIONS[currentExpressionId] ?? GIAI_EXPRESSIONS.neutral).emoji
  )
</script>

{#if visible}
  <div class="giai-toast" class:visible>
    <span class="giai-avatar" aria-hidden="true">{expressionEmoji}</span>
    <div class="giai-body">
      <span class="giai-prefix">{GIAI_NAME}:</span>
      <span class="giai-text">{currentMessage}</span>
    </div>
  </div>
{/if}

<style>
  .giai-toast {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%) translateY(16px);
    max-width: 360px;
    width: calc(100% - 2rem);
    padding: 10px 14px;
    background: color-mix(in srgb, var(--color-bg, #1a1a2e) 88%, transparent);
    border-left: 4px solid var(--color-warning, #f4c430);
    border-radius: 0 6px 6px 0;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    font-family: 'Courier New', monospace;
    font-size: 0.82rem;
    color: var(--color-text, #e8e8f0);
    line-height: 1.4;
    z-index: 25;
    pointer-events: none;
    opacity: 0;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    animation:
      giai-slide-in 0.3s ease-out forwards,
      giai-fade-out 0.35s ease-in forwards var(--dismiss-delay, 3.65s);
  }

  .giai-avatar {
    font-size: 1.25rem;
    line-height: 1;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .giai-body {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 0.4em;
    min-width: 0;
  }

  .giai-prefix {
    font-weight: 700;
    color: var(--color-warning, #f4c430);
    flex-shrink: 0;
  }

  .giai-text {
    color: var(--color-text, #e8e8f0);
  }

  @keyframes giai-slide-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @keyframes giai-fade-out {
    from {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    to {
      opacity: 0;
      transform: translateX(-50%) translateY(-8px);
    }
  }

  @media (max-width: 480px) {
    .giai-toast {
      bottom: 72px;
      font-size: 0.78rem;
    }

    .giai-avatar {
      font-size: 1.1rem;
    }
  }
</style>

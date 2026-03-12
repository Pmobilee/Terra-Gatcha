<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { CampfireEffect } from '../effects/CampfireEffect'

  interface Props {
    streak: number
  }

  let { streak }: Props = $props()

  let canvasEl: HTMLCanvasElement | undefined
  let campfireEffect: CampfireEffect | null = null

  onMount(() => {
    if (canvasEl) {
      campfireEffect = new CampfireEffect(canvasEl, streak)
      campfireEffect.start()
    }
  })

  onDestroy(() => {
    campfireEffect?.destroy()
  })

  // Update streak reactively
  $effect(() => {
    campfireEffect?.updateStreak(streak)
  })
</script>

<canvas
  bind:this={canvasEl}
  class="campfire-canvas"
  width="200"
  height="250"
  aria-hidden="true"
></canvas>

<style>
  .campfire-canvas {
    position: absolute;
    /* Position over the campfire sprite — campfire is at roughly z-index 15 area */
    bottom: 33%;
    left: 50%;
    transform: translateX(-50%);
    width: 200px;
    height: 250px;
    z-index: 16;
    pointer-events: none;
  }
</style>

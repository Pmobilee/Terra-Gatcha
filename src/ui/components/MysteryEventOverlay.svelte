<script lang="ts">
  import type { MysteryEvent, MysteryEffect } from '../../services/floorManager'
  import { getRandomRoomBg } from '../../data/backgroundManifest'
  import { holdScreenTransition, releaseScreenTransition } from '../stores/gameState'
  import { preloadImages } from '../utils/assetPreloader'
  import { getMysteryEventIconPath, getMysteryEventEmoji } from '../utils/iconAssets'

  interface Props {
    event: MysteryEvent | null
    playerHp: number
    playerMaxHp: number
    onresolve: (effect: MysteryEffect) => void
  }

  let { event, playerHp, playerMaxHp, onresolve }: Props = $props()

  const bgUrl = getRandomRoomBg('mystery')
  holdScreenTransition()
  preloadImages([bgUrl]).then(releaseScreenTransition)

  let effectIcon = $derived(getEffectIcon(event?.effect))

  function getEffectIcon(effect: MysteryEffect | undefined): string {
    if (!effect) return 'choice' // fallback
    switch (effect.type) {
      case 'heal': return 'heal'
      case 'damage': return 'damage'
      case 'freeCard': return 'free_card'
      case 'nothing': return 'nothing'
      case 'choice': return 'choice'
      default: return 'choice'
    }
  }

  function handleContinue(): void {
    if (event) {
      onresolve(event.effect)
    }
  }

  function handleChoiceOption(choiceEffect: MysteryEffect): void {
    onresolve(choiceEffect)
  }
</script>

{#if event}
  <div class="mystery-overlay">
    <img class="overlay-bg" src={bgUrl} alt="" aria-hidden="true" />
    <div class="mystery-card">
      <h2 class="event-name">{event.name}</h2>
      <span class="effect-icon">
        <img class="mystery-icon-img" src={getMysteryEventIconPath(effectIcon)} alt=""
          onerror={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; ((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement).style.display = 'inline'; }} />
        <span style="display:none">{getMysteryEventEmoji(effectIcon)}</span>
      </span>
      <p class="event-desc">{event.description}</p>

      <div class="hp-info">
        HP: {playerHp} / {playerMaxHp}
      </div>

      {#if event.effect.type === 'choice'}
        <div class="choice-buttons">
          {#each event.effect.options as option, i (i)}
            <button
              class="choice-btn"
              onclick={() => handleChoiceOption(option.effect)}
            >
              {option.label}
            </button>
          {/each}
        </div>
      {:else}
        <button
          class="continue-btn"
          data-testid="mystery-continue"
          onclick={handleContinue}
        >
          Continue
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .mystery-overlay {
    position: fixed;
    inset: 0;
    background: rgba(13, 17, 23, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 16px;
    position: relative;
  }

  .overlay-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 0;
    pointer-events: none;
  }

  .mystery-card {
    background: #161B22;
    border: 2px solid #9B59B6;
    border-radius: 12px;
    padding: 24px;
    max-width: 340px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    position: relative;
    z-index: 1;
  }

  .event-name {
    font-size: 18px;
    color: #9B59B6;
    margin: 0;
    text-align: center;
  }

  .effect-icon {
    font-size: 48px;
  }

  .event-desc {
    font-size: 14px;
    color: #C9D1D9;
    text-align: center;
    line-height: 1.5;
    margin: 0;
  }

  .hp-info {
    font-size: 12px;
    color: #8B949E;
  }

  .choice-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    margin-top: 8px;
  }

  .choice-btn {
    width: 100%;
    padding: 12px;
    background: #1E2D3D;
    border: 1px solid #484F58;
    border-radius: 8px;
    color: #E6EDF3;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .choice-btn:hover {
    background: #2D333B;
  }

  .continue-btn {
    width: 100%;
    padding: 14px;
    background: #9B59B6;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.1s;
    margin-top: 8px;
  }

  .continue-btn:hover {
    transform: scale(1.03);
  }

  .mystery-icon-img {
    width: 3rem;
    height: 3rem;
    image-rendering: pixelated;
    display: inline-block;
  }
</style>

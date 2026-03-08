<script lang="ts">
  import type { Card, FactDomain, CardType } from '../../data/card-types'

  interface Props {
    cards: Card[]
    selectedIndex: number | null
    disabled: boolean
    cardAnimations?: Record<string, 'launch' | 'fizzle' | null>
    onselectcard: (index: number) => void
    ondeselectcard: () => void
  }

  let { cards, selectedIndex, disabled, cardAnimations, onselectcard, ondeselectcard }: Props = $props()

  /** Domain color mapping */
  const DOMAIN_COLORS: Record<FactDomain, string> = {
    science: '#E74C3C',
    history: '#3498DB',
    geography: '#F1C40F',
    language: '#2ECC71',
    math: '#9B59B6',
    arts: '#E67E22',
    medicine: '#1ABC9C',
    technology: '#95A5A6',
  }

  /** Card type emoji icons */
  const TYPE_ICONS: Record<CardType, string> = {
    attack: '⚔',
    shield: '🛡',
    heal: '💚',
    utility: '⭐',
    buff: '⬆',
    debuff: '⬇',
    regen: '➕',
    wild: '💎',
  }

  /**
   * Compute rotation for each card index given total count.
   * Spread from -8 to +8 degrees for 5 cards.
   */
  function getRotation(index: number, total: number): number {
    if (total <= 1) return 0
    const spread = 16 // total degrees from first to last
    const step = spread / (total - 1)
    return -spread / 2 + step * index
  }

  /**
   * Compute vertical arc offset — edges higher than center.
   * Uses a simple parabolic curve: 0 at edges, 8px at center → invert.
   */
  function getArcOffset(index: number, total: number): number {
    if (total <= 1) return 0
    const mid = (total - 1) / 2
    const normalized = (index - mid) / mid // -1 to 1
    return Math.abs(normalized) * 8 // edges 8px higher (more negative translateY)
  }

  /**
   * Compute horizontal offset for card positioning.
   * Cards overlap showing ~60% of width. Card width = 65px, visible = 39px.
   */
  function getXOffset(index: number, total: number): number {
    const cardVisibleWidth = 39 // 60% of 65px
    const totalWidth = cardVisibleWidth * (total - 1)
    return -totalWidth / 2 + cardVisibleWidth * index
  }

  /**
   * Get effect description for display on card face.
   */
  function getEffectValue(card: Card): number {
    return Math.round(card.baseEffectValue * card.effectMultiplier)
  }

  function handleCardClick(index: number): void {
    if (disabled) return
    if (selectedIndex !== null) return
    onselectcard(index)
  }
</script>

<div
  class="card-hand-container"
  role="group"
  aria-label="Card hand"
>
  {#each cards as card, i (card.id)}
    {@const isSelected = selectedIndex === i}
    {@const isOther = selectedIndex !== null && !isSelected}
    {@const rotation = getRotation(i, cards.length)}
    {@const arcOffset = getArcOffset(i, cards.length)}
    {@const xOffset = getXOffset(i, cards.length)}
    {@const domainColor = DOMAIN_COLORS[card.domain]}
    {@const icon = TYPE_ICONS[card.cardType]}
    {@const effectVal = getEffectValue(card)}
    {@const cardAnim = cardAnimations?.[card.id] ?? null}

    <button
      class="card-in-hand"
      class:card-selected={isSelected}
      class:card-dimmed={isOther}
      class:tier-2={card.tier >= 2}
      class:card-launch={cardAnim === 'launch'}
      class:card-fizzle={cardAnim === 'fizzle'}
      style="
        transform: translateX({xOffset}px) translateY({isOther ? 20 : -arcOffset}px) rotate({isSelected ? 0 : rotation}deg);
        border-color: {domainColor};
        animation-delay: {i * 50}ms;
      "
      data-testid="card-hand-{i}"
      disabled={disabled || isOther}
      onclick={() => handleCardClick(i)}
    >
      <div class="card-domain-stripe" style="background: {domainColor};"></div>
      <div class="card-type-icon">{icon}</div>
      <div class="card-effect-value">{effectVal}</div>
      {#if card.tier >= 2}
        <div class="card-tier-badge">T{card.tier}</div>
      {/if}
    </button>
  {/each}
</div>

<style>
  .card-hand-container {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    height: 95px;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    pointer-events: none;
  }

  .card-in-hand {
    position: absolute;
    width: 65px;
    height: 95px;
    background: #1E2D3D;
    border: 2px solid;
    border-radius: 8px;
    cursor: pointer;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0;
    overflow: hidden;
    transition: transform 250ms ease, opacity 250ms ease;
    animation: card-fan-in 300ms ease-out both;
    -webkit-tap-highlight-color: transparent;
    font-family: inherit;
    color: white;
  }

  .card-in-hand:active:not(:disabled) {
    transform: scale(1.05);
  }

  .card-selected {
    z-index: 5;
    transform: translateY(-20px) scale(1.1) !important;
  }

  .card-dimmed {
    opacity: 0.3;
    pointer-events: none;
  }

  .tier-2 {
    box-shadow: 0 0 8px rgba(192, 192, 192, 0.6);
  }

  .card-domain-stripe {
    width: 100%;
    height: 4px;
    flex-shrink: 0;
  }

  .card-type-icon {
    font-size: 20px;
    margin-top: 6px;
    line-height: 1;
  }

  .card-effect-value {
    font-size: 24px;
    font-weight: 700;
    margin-top: 4px;
    line-height: 1;
  }

  .card-tier-badge {
    font-size: 10px;
    font-weight: 600;
    color: #C0C0C0;
    margin-top: auto;
    margin-bottom: 4px;
  }

  @keyframes card-fan-in {
    from {
      opacity: 0;
      transform: translateX(0) translateY(60px) rotate(0deg);
    }
  }

  .card-launch {
    animation: cardLaunch 300ms ease-in forwards;
    pointer-events: none;
  }
  @keyframes cardLaunch {
    0%   { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
    60%  { opacity: 1; }
    100% { transform: translateY(-600px) rotate(12deg) scale(0.4); opacity: 0; }
  }

  .card-fizzle {
    animation: cardFizzle 400ms ease-out forwards;
    pointer-events: none;
  }
  @keyframes cardFizzle {
    0%   { transform: translateY(0) scale(1); opacity: 0.4; filter: grayscale(0.5); }
    100% { transform: translateY(100px) scale(0.8); opacity: 0; filter: grayscale(1); }
  }
</style>

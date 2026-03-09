<script lang="ts">
  import type { Card, CardType } from '../../data/card-types'
  import { factsDB } from '../../services/factsDB'
  import { getCardFramePath } from '../utils/domainAssets'

  interface Props {
    options: Card[]
    onselect: (card: Card) => void
    onskip: () => void
    onreroll?: (type: CardType) => void
  }

  let { options, onselect, onskip, onreroll }: Props = $props()
  let selectedType = $state<CardType | null>(null)
  let previewQuestion = $state<string>('Select a type to preview a fact.')

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

  const TYPE_DESCRIPTIONS: Record<CardType, string> = {
    attack: 'Deal direct damage to enemies.',
    shield: 'Gain block before enemy attacks.',
    heal: 'Recover HP and stabilize your run.',
    buff: 'Increase output and combo pressure.',
    debuff: 'Reduce enemy tempo and threat.',
    utility: 'Tech effects for flexible turns.',
    regen: 'Scale sustain over time.',
    wild: 'High-impact wildcard effect.',
  }

  function selectedCard(): Card | null {
    if (!selectedType) return null
    return options.find((option) => option.cardType === selectedType) ?? null
  }

  function selectType(cardType: CardType): void {
    selectedType = cardType
    updatePreview()
  }

  function updatePreview(): void {
    const selected = selectedCard()
    if (!selected) {
      previewQuestion = 'Select a type to preview a fact.'
      return
    }
    const fact = factsDB.getById(selected.factId)
    const raw = fact?.quizQuestion ?? fact?.statement ?? 'Unknown fact'
    previewQuestion = raw.length > 120 ? `${raw.slice(0, 117)}...` : raw
  }

  function reroll(): void {
    const selected = selectedCard()
    if (!selected || !onreroll) return
    onreroll(selected.cardType)
  }

  function accept(): void {
    const selected = selectedCard()
    if (!selected) return
    onselect(selected)
  }

  $effect(() => {
    if (selectedType === null && options.length > 0) {
      selectedType = options[0]?.cardType ?? null
    }
    updatePreview()
  })

  function isSelected(option: Card): boolean {
    return selectedType === option.cardType
  }
</script>

<div class="reward-screen">
  <h1>Choose Your Reward</h1>
  <p>Pick a card type, preview its fact, then accept.</p>

  <div class="type-options">
    {#each options as option (option.cardType)}
      <button
        class="type-option"
        class:selected={isSelected(option)}
        style="--frame-image: url('{option.isEcho ? '/assets/sprites/cards/frame_echo.png' : getCardFramePath(option.cardType)}');"
        onclick={() => selectType(option.cardType)}
        data-testid={`reward-type-${option.cardType}`}
      >
        <div class="type-head">
          <span class="icon">{TYPE_ICONS[option.cardType]}</span>
          <span class="type-name">{option.cardType.toUpperCase()}</span>
        </div>
        <div class="type-desc">{TYPE_DESCRIPTIONS[option.cardType]}</div>
        <div class="type-value">Power {Math.round(option.baseEffectValue * option.effectMultiplier)}</div>
      </button>
    {/each}
  </div>

  <section class="preview">
    <div class="preview-label">Fact Preview</div>
    <div class="preview-text">{previewQuestion}</div>
  </section>

  <div class="actions">
    <button
      class="reroll"
      onclick={reroll}
      disabled={!selectedCard() || !onreroll}
      data-testid="reward-reroll"
    >
      Reroll
    </button>
    <button class="accept" onclick={accept} disabled={!selectedCard()} data-testid="reward-accept">Accept</button>
    <button class="skip" onclick={onskip}>Skip</button>
  </div>
</div>

<style>
  .reward-screen {
    position: fixed;
    inset: 0;
    background: #0D1117;
    color: #E6EDF3;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 16px;
    gap: 14px;
    z-index: 220;
    overflow-y: auto;
  }

  h1 {
    margin: 8px 0 0;
    font-size: 24px;
    letter-spacing: 1px;
    color: #F1C40F;
  }

  p {
    margin: 0;
    color: #8B949E;
    text-align: center;
  }

  .type-options {
    width: 100%;
    max-width: 760px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .type-option {
    border: 2px solid #314357;
    border-radius: 12px;
    background:
      linear-gradient(rgba(18, 26, 38, 0.88), rgba(18, 26, 38, 0.92)),
      var(--frame-image) center / cover no-repeat,
      #1a2332;
    color: inherit;
    padding: 10px;
    min-height: 110px;
    text-align: left;
    transition: transform 120ms ease, box-shadow 120ms ease;
    display: grid;
    gap: 4px;
  }

  .type-option.selected {
    transform: scale(1.01);
    box-shadow: 0 0 0 2px #F1C40F;
    border-color: #F1C40F;
  }

  .type-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .icon {
    font-size: 24px;
  }

  .type-name {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.6px;
  }

  .type-desc {
    color: #c7d1db;
    font-size: 13px;
  }

  .type-value {
    color: #8ac9ff;
    font-weight: 700;
    font-size: 13px;
  }

  .preview {
    width: 100%;
    max-width: 760px;
    border-radius: 12px;
    border: 1px solid #314357;
    background: rgba(15, 23, 33, 0.72);
    padding: 12px;
    display: grid;
    gap: 6px;
  }

  .preview-label {
    color: #8B949E;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .preview-text {
    font-weight: 700;
    font-size: 14px;
    color: #E6EDF3;
    line-height: 1.35;
  }

  .actions {
    width: 100%;
    max-width: 760px;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }

  .accept,
  .reroll,
  .skip {
    height: 52px;
    border-radius: 10px;
    border: none;
    font-size: 15px;
    font-weight: 700;
  }

  .accept {
    background: #27AE60;
    color: #fff;
  }

  .reroll {
    background: #2b394b;
    color: #cfd9e3;
  }

  .skip {
    background: #2D333B;
    color: #9BA4AD;
  }

  .accept:disabled,
  .reroll:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 560px) {
    .actions {
      grid-template-columns: 1fr;
    }
  }
</style>

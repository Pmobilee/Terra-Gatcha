# AR-09: Strategic Deck Building (Card Type Selection)
> Phase: Core Gameplay — Deck Strategy
> Priority: HIGH
> Depends on: AR-01 (Combat Integrity), AR-02 (FSRS), AR-03 (Card Types)
> Estimated scope: M

Currently, card rewards show 3 random cards to the player. This phase replaces random selection with strategic type selection: player picks a card TYPE (Attack, Shield, Heal, etc.), then a random fact from that type's pool is assigned. This preserves learning variety while enabling meaningful deck-building decisions. Also reduces starter deck from 20 to 15 cards and adds deck removal at shops.

## Design Reference

From GAME_DESIGN.md Section 11 (Card Types):

> | Type | Effect | Synergy |
> |------|--------|---------|
> | Attack | Deal 8 dmg (Tier 1) to 12 (Tier 3) | Combo |
> | Shield | Block 8-12 dmg | Defensive builds |
> | Heal | Restore 8-12 HP | Sustain |
> | Buff | +1 AP, +1 Tier for next card, or draw card | Combo |
> | Debuff | Enemy -1 AP or -2 dmg next turn | Control |
> | Utility | Discard/redraw hand, peek enemy deck | Tech |

From GAME_DESIGN.md Section 12 (Reward System):

> Card reward now shows 3 TYPE options instead of random cards. Player picks a type. A random fact from that type's pool is assigned. Facts are still distributed by difficulty and domain—selection is purely about type preference.

From GAME_DESIGN.md Section 27 (Shop System):

> Room type: Shop. Sell cards to reduce deck bloat. Price = card rarity (1-3 gold depending on tier and effect power). Add card removal mechanic.

## Implementation

### Sub-task 1: Card Type Selection Screen

#### UI

New component `src/ui/components/CardRewardScreen.svelte`:

Current behavior (random 3 cards):
```
┌─────────────────────┐
│ Choose Your Reward  │
│  ┌───┐  ┌───┐  ┌───┐│
│  │ 🗡 │  │ 🛡 │  │ 💚 ││
│  │STR│  │DEF│  │HEL││
│  └───┘  └───┘  └───┘│
│ [Tap to select]     │
└─────────────────────┘
```

New behavior (3 type options):
```
┌──────────────────────────────┐
│     Choose Your Reward       │
│ ┌────────────────────────┐   │
│ │ ⚔️ ATTACK              │   │
│ │ Deal damage to enemy   │   │
│ │ Fact: "Q: What is..."  │   │
│ └────────────────────────┘   │
│ ┌────────────────────────┐   │
│ │ 🛡️  SHIELD             │   │
│ │ Block incoming damage  │   │
│ │ Fact: "Q: Who..."      │   │
│ └────────────────────────┘   │
│ ┌────────────────────────┐   │
│ │ 💚 HEAL                │   │
│ │ Restore health         │   │
│ │ Fact: "Q: When..."     │   │
│ └────────────────────────┘   │
│                              │
│  Preview fact: [Question]    │
│  [Accept] [Reroll]           │
└──────────────────────────────┘
```

Each type option shows:
- Icon + name (40dp icon, 18dp name)
- Description of effect (14dp, gray text)
- Preview: first 50 chars of a fact from that type's pool
- Tap to select (ripple effect)
- Selected option: border highlight, checkmark

Two buttons below all options:
- "Accept" (green, confirms selection, adds card to deck)
- "Reroll" (gray, rerolls the fact within selected type)

#### Logic

```typescript
// In src/services/encounterRewards.ts

interface CardRewardState {
  selectedType?: CardType;  // 'attack' | 'shield' | 'heal' | 'buff' | 'debuff' | 'utility'
  previewFact?: Fact;
  allTypeOptions: CardType[];  // Random 3 types from available pool
}

export function selectCardRewardType(
  type: CardType,
  runState: CardRunState,
  factDatabase: Fact[]
): { selectedType: CardType; previewFact: Fact } {
  // Get all facts of this type from current domains
  const typeFacts = factDatabase.filter(
    f => f.cardType === type &&
         (f.domain === runState.primaryDomain || f.domain === runState.secondaryDomain)
  );

  // Pick random unlearned fact (or least-learned if all seen)
  const previewFact = pickRandomFact(typeFacts, runState.playerFactStates);

  return { selectedType: type, previewFact };
}

export function rerollFactInType(
  type: CardType,
  runState: CardRunState,
  factDatabase: Fact[],
  previousFact: Fact
): Fact {
  // Same logic but exclude the previous fact
  const typeFacts = factDatabase.filter(
    f => f.cardType === type &&
         (f.domain === runState.primaryDomain || f.domain === runState.secondaryDomain) &&
         f.id !== previousFact.id
  );

  return pickRandomFact(typeFacts, runState.playerFactStates);
}

export function confirmCardReward(
  fact: Fact,
  type: CardType,
  runState: CardRunState
): CardRunState {
  // Create card, add to deck
  const card = createCardFromFact(fact, type);
  return {
    ...runState,
    currentHand: [...runState.currentHand, card],
    cardsCollected: [...runState.cardsCollected, card],
  };
}
```

#### 3 Type Options

For each reward, randomly select 3 types from the pool (weighted to vary):

```typescript
export function generateTypeOptions(
  previousTypes: CardType[],  // Types already selected this run
  recentFailures: CardType[]  // Types that didn't help much
): CardType[] {
  const allTypes: CardType[] = ['attack', 'shield', 'heal', 'buff', 'debuff', 'utility'];

  // Bias away from recently-used types (encourage variety)
  const weighted = allTypes
    .map(type => ({
      type,
      weight: previousTypes.filter(t => t === type).length === 0 ? 1 : 0.3,
    }))
    .sort(() => Math.random() - 0.5);

  return weighted.slice(0, 3).map(w => w.type);
}
```

### Sub-task 2: Reduce Starter Deck

#### Current State

Starter deck: 20 cards (all Attack type)

#### New State

Starter deck: 15 cards

Composition: Weighted toward Attack/Shield/Heal (defensive start):
- 6 Attack
- 5 Shield
- 4 Heal

```typescript
// In src/data/gameStart.ts or src/services/gameInitialization.ts

export function createStarterDeck(facts: Fact[]): Card[] {
  const starterFacts = facts
    .filter(f => f.difficulty === '1' && f.domain === 'general')  // Tier 1, general domain
    .sort(() => Math.random() - 0.5);

  const deck: Card[] = [];

  // Attack: 6 cards
  for (let i = 0; i < 6; i++) {
    deck.push(createCardFromFact(starterFacts[i], 'attack'));
  }

  // Shield: 5 cards
  for (let i = 6; i < 11; i++) {
    deck.push(createCardFromFact(starterFacts[i], 'shield'));
  }

  // Heal: 4 cards
  for (let i = 11; i < 15; i++) {
    deck.push(createCardFromFact(starterFacts[i], 'heal'));
  }

  return deck;
}
```

### Sub-task 3: Card Removal at Shops

#### Logic

Shop room now offers card selling:

```typescript
// In src/services/roomSystem.ts or encounterRewards.ts

interface ShopOption {
  type: 'card-sell';
  card: Card;
  goldValue: number;
}

export function calculateCardSellPrice(card: Card): number {
  // Price based on tier and rarity
  const tierValue: Record<CardTier, number> = {
    '1': 1,
    '2a': 2,
    '2b': 2,
    '3': 3,
  };

  return tierValue[card.tier];
}

export function generateShopOptions(deck: Card[]): ShopOption[] {
  // Show 3 random cards from deck
  const toSell = shuffleArray(deck).slice(0, 3);

  return toSell.map(card => ({
    type: 'card-sell',
    card,
    goldValue: calculateCardSellPrice(card),
  }));
}

export function sellCard(cardId: string, runState: CardRunState): CardRunState {
  const card = runState.currentHand.find(c => c.id === cardId) ||
               runState.deckCards.find(c => c.id === cardId);

  if (!card) return runState;

  const price = calculateCardSellPrice(card);

  // Remove from deck
  const newDeck = runState.deckCards.filter(c => c.id !== cardId);
  const newHand = runState.currentHand.filter(c => c.id !== cardId);

  return {
    ...runState,
    deckCards: newDeck,
    currentHand: newHand,
    currencyGained: runState.currencyGained + price,
    cardsCollected: runState.cardsCollected.filter(c => c.id !== cardId),
  };
}
```

#### UI

Shop screen shows card carousel:

```
┌────────────────────────────┐
│         Shop Room          │
│  ┌──────────────────────┐  │
│  │     💚 HEAL CARD     │  │
│  │  Q: What is H₂O?     │  │
│  │                      │  │
│  │  💰 2 Gold / Sell    │  │
│  └──────────────────────┘  │
│  ◀ [CARD 1 of 3] ▶         │
│                            │
│  [< BACK]  [SELL]  [SKIP]  │
└────────────────────────────┘
```

- Card carousel: swipe left/right or arrow buttons to browse 3 options
- Show card type, tier, question preview
- Sell value in gold
- "SELL" button confirmed sale and removes card from deck
- "SKIP" button leaves all cards in deck
- Can sell multiple cards in one visit

### Sub-task 4: Archetype Selection at Run Start (Optional)

#### Design

After domain selection, optionally show archetype picker:

```
┌───────────────────────────┐
│  What's Your Playstyle?   │
│                           │
│ 🎯 BALANCED               │
│ Neutral weights           │
│ [Select] [Skip]           │
│                           │
│ ⚔️ AGGRESSIVE              │
│ Favor Attack              │
│ [Select] [Skip]           │
│                           │
│ 🛡️  DEFENSIVE              │
│ Favor Shield              │
│ [Select] [Skip]           │
│                           │
│ 🧠 CONTROL                │
│ Favor Debuff/Utility      │
│ [Select] [Skip]           │
└───────────────────────────┘
```

If selected, biases the 3 type options toward that archetype:

```typescript
type Archetype = 'balanced' | 'aggressive' | 'defensive' | 'control';

export function generateTypeOptionsForArchetype(
  archetype: Archetype
): CardType[] {
  const weights: Record<Archetype, Record<CardType, number>> = {
    balanced: {
      attack: 1,
      shield: 1,
      heal: 1,
      buff: 0.5,
      debuff: 0.5,
      utility: 0.5,
    },
    aggressive: {
      attack: 2,
      shield: 0.3,
      heal: 0.5,
      buff: 1.5,
      debuff: 0.2,
      utility: 0.2,
    },
    defensive: {
      attack: 0.3,
      shield: 2,
      heal: 1.5,
      buff: 0.5,
      debuff: 1,
      utility: 1,
    },
    control: {
      attack: 0.3,
      shield: 0.5,
      heal: 0.5,
      buff: 0.5,
      debuff: 2,
      utility: 2,
    },
  };

  // Pick top 3 by weight
  const allTypes = Object.keys(weights[archetype]) as CardType[];
  return allTypes
    .map(type => ({ type, weight: weights[archetype][type] }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(w => w.type);
}
```

This is OPTIONAL in AR-09. If time is tight, ship without it and revisit in a later phase.

### Sub-task 5: Update Card Reward UI Component

Modify or replace `src/ui/components/CardRewardOverlay.svelte` (or wherever card rewards are shown):

```svelte
<!-- src/ui/components/CardRewardOverlay.svelte (updated) -->
<script>
  import { onMount } from 'svelte';

  export let onRewardAccepted: (card: Card) => void;
  export let runState: CardRunState;
  export let factDatabase: Fact[];

  let selectedType: CardType | null = null;
  let previewFact: Fact | null = null;
  let typeOptions: CardType[] = [];

  onMount(() => {
    typeOptions = generateTypeOptions(
      runState.cardsCollected.map(c => c.cardType),
      []
    );
  });

  function handleTypeSelect(type: CardType) {
    const { selectedType: sType, previewFact: pFact } = selectCardRewardType(
      type,
      runState,
      factDatabase
    );
    selectedType = sType;
    previewFact = pFact;
  }

  function handleReroll() {
    if (!selectedType || !previewFact) return;
    const newFact = rerollFactInType(selectedType, runState, factDatabase, previewFact);
    previewFact = newFact;
  }

  function handleAccept() {
    if (!selectedType || !previewFact) return;
    const newRunState = confirmCardReward(previewFact, selectedType, runState);
    onRewardAccepted(newRunState);
  }
</script>

<div class="card-reward-overlay">
  <h2>Choose Your Reward</h2>

  <div class="type-options">
    {#each typeOptions as type}
      <button
        class="type-button"
        class:selected={selectedType === type}
        on:click={() => handleTypeSelect(type)}
      >
        <div class="icon">{getCardTypeIcon(type)}</div>
        <div class="name">{type.toUpperCase()}</div>
        <div class="description">{getCardTypeDescription(type)}</div>
        {#if previewFact && selectedType === type}
          <div class="preview">{previewFact.question.substring(0, 50)}...</div>
        {/if}
      </button>
    {/each}
  </div>

  {#if previewFact && selectedType}
    <div class="preview-section">
      <div class="label">Preview Fact:</div>
      <div class="question">{previewFact.question}</div>
      <button on:click={handleReroll} class="btn-reroll">↻ Reroll</button>
    </div>

    <div class="actions">
      <button on:click={handleAccept} class="btn-accept">✓ Accept</button>
    </div>
  {/if}
</div>

<style>
  .card-reward-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16dp;
    z-index: 1000;
  }

  h2 {
    font-size: 20dp;
    margin-bottom: 24dp;
  }

  .type-options {
    display: flex;
    flex-direction: column;
    gap: 12dp;
    width: 100%;
    margin-bottom: 24dp;
  }

  .type-button {
    padding: 12dp;
    background: rgba(100, 100, 100, 0.3);
    border: 2px solid transparent;
    border-radius: 4dp;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .type-button:hover,
  .type-button.selected {
    border-color: gold;
  }

  .icon {
    font-size: 24dp;
    margin-bottom: 8dp;
  }

  .name {
    font-size: 16dp;
    font-weight: bold;
  }

  .description {
    font-size: 12dp;
    color: #aaa;
    margin-top: 4dp;
  }

  .preview {
    font-size: 11dp;
    color: #888;
    margin-top: 8dp;
    font-style: italic;
  }

  .preview-section {
    background: rgba(0, 0, 0, 0.5);
    padding: 12dp;
    border-radius: 4dp;
    margin-bottom: 16dp;
    max-width: 300dp;
  }

  .label {
    font-size: 12dp;
    color: #999;
    margin-bottom: 4dp;
  }

  .question {
    font-size: 14dp;
    line-height: 1.4;
    margin-bottom: 12dp;
  }

  .btn-reroll {
    background: rgba(100, 100, 100, 0.5);
    border: 1px solid #666;
    padding: 6dp 12dp;
    font-size: 12dp;
  }

  .actions {
    display: flex;
    gap: 12dp;
  }

  .btn-accept {
    background: green;
    padding: 12dp 32dp;
    font-size: 14dp;
    border: none;
  }
</style>
```

### Sub-task 6: Update Card Factory

Modify `src/services/cardFactory.ts` to ensure facts are distributed properly:

```typescript
export function createCardFromFact(fact: Fact, type: CardType): Card {
  const baseEffect = getCardTypeEffect(type);
  const tierMultiplier = getTierMultiplier(fact.tier || '1');

  return {
    id: generateId(),
    factId: fact.id,
    cardType: type,
    question: fact.question,
    answers: fact.answers,
    correctIndex: fact.correctIndex,
    effect: {
      ...baseEffect,
      value: Math.round(baseEffect.value * tierMultiplier),
    },
    tier: fact.tier || '1',
    domain: fact.domain,
    createdAt: new Date().toISOString(),
  };
}
```

### Sub-task 7: Update Card Type Icons & Descriptions

Ensure all card types have clear visual and textual representations:

```typescript
// In src/data/cardTypes.ts or equivalent

export const CARD_TYPE_INFO: Record<CardType, CardTypeInfo> = {
  attack: {
    icon: '⚔️',
    name: 'Attack',
    description: 'Deal damage to the enemy',
    effect: 'damage',
  },
  shield: {
    icon: '🛡️',
    name: 'Shield',
    description: 'Block incoming damage',
    effect: 'block',
  },
  heal: {
    icon: '💚',
    name: 'Heal',
    description: 'Restore your health',
    effect: 'heal',
  },
  buff: {
    icon: '📈',
    name: 'Buff',
    description: 'Enhance next card or gain AP',
    effect: 'buff',
  },
  debuff: {
    icon: '📉',
    name: 'Debuff',
    description: 'Weaken enemy next turn',
    effect: 'debuff',
  },
  utility: {
    icon: '⚙️',
    name: 'Utility',
    description: 'Tech plays: redraw, peek, etc.',
    effect: 'utility',
  },
};

export function getCardTypeIcon(type: CardType): string {
  return CARD_TYPE_INFO[type]?.icon ?? '?';
}

export function getCardTypeDescription(type: CardType): string {
  return CARD_TYPE_INFO[type]?.description ?? 'Unknown effect';
}
```

## System Interactions

- **Card Types (AR-03):** Facts already tagged with cardType. Type selection uses existing tags.
- **Domains (AR-03):** Type pool filtered by primary + secondary domain.
- **Combos (AR-03):** No change. Combos still build on consecutive correct regardless of type.
- **Relics (AR-06):** No change. Relics interact with cards; type doesn't affect relic synergy.
- **Difficulty Modes (AR-04):** Type selection independent of difficulty. All modes see same type options.
- **FSRS (AR-02):** Fact selection is random within type; learning is unaffected.
- **Shop (Room System):** Shop room now includes card removal option.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Player selects Attack, all Attack facts in domains are learned | Reroll shows least-recently-seen Attack fact instead of picking new one. |
| Player defeats enemy with only Heal cards in deck | Heal cards activate normally. If no damage cards, enemy damage is applied. Valid. |
| Starter deck with 15 cards, player doesn't gain any cards in run | Deck size can drop below 15 (valid). |
| Player sells all Shield cards, then must face Shield-heavy enemy | Player must adapt with remaining cards. Valid challenge. |
| Card type has 0 facts in current domains | Type option not offered in that reward (generate 3 from non-empty types only). |
| Archetype selection skipped | Balanced weights applied. |
| Reroll button spammed rapidly | Last reroll honored; bouncing prevented by disable-during-transition. |
| Shop with 0 cards in deck | Sell option not offered. Show message: "Your deck is full of memories." |
| Player defeats boss with fewer cards than starter deck (after removal) | Valid. Smaller deck is harder but achievable. |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Create | `src/ui/components/CardTypeSelector.svelte` | Card type selection UI with preview |
| Modify | `src/ui/components/CardRewardOverlay.svelte` | Replace random card selection with type selection |
| Create | `src/ui/components/ShopRoom.svelte` | Shop room with card selling carousel |
| Create | `src/services/cardTypeWeighting.ts` | Archetype weights, type option generation |
| Modify | `src/services/cardFactory.ts` | createCardFromFact with type parameter |
| Modify | `src/services/encounterRewards.ts` | selectCardRewardType, rerollFactInType, confirmCardReward |
| Modify | `src/services/roomSystem.ts` | Shop room generation, generateShopOptions, sellCard |
| Modify | `src/data/gameStart.ts` | Starter deck reduced to 15 cards (6 attack, 5 shield, 4 heal) |
| Modify | `src/data/cardTypes.ts` | Add CARD_TYPE_INFO, icon/description mappings |
| Modify | `src/data/types.ts` | CardTypeInfo interface if needed |
| Create | `src/ui/screens/ArchetypeSelector.svelte` | Optional archetype picker at run start |

## Done When

- [ ] Card reward screen shows 3 type options (icon, name, description, preview fact)
- [ ] Selecting a type shows preview of a random fact from that type's pool
- [ ] Reroll button generates new fact within selected type (excludes previous)
- [ ] Accept button adds card to deck with selected type and preview fact
- [ ] Starter deck is 15 cards (6 attack, 5 shield, 4 heal)
- [ ] Shop room appears at random encounters
- [ ] Shop room shows 3 random cards from current deck with sell prices
- [ ] Selling a card removes it from deck and adds gold to run currency
- [ ] All card types have clear icons (⚔️ 🛡️ 💚 📈 📉 ⚙️) and descriptions
- [ ] Archetype selector (optional) shows on run start, biases type options if selected
- [ ] Type options weighted to provide variety (avoid repeating same type)
- [ ] Facts still distributed randomly despite type selection (preserves learning variety)
- [ ] Card creation from fact works with explicit type parameter
- [ ] 3-type options never include types with 0 facts in current domains
- [ ] Edge cases handled: all facts learned, no facts in type, reroll spam, sparse deck
- [ ] `npx vitest run` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

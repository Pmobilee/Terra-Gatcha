<script lang="ts">
  import { getDefaultHubStack } from '../../data/hubFloors'
  import type { FloorUpgradeTier } from '../../data/hubLayout'
  import { FLOOR_CANVAS_H } from '../../data/hubLayout'
  import { playerSave } from '../stores/playerData'
  import { currentFloorIndex } from '../stores/gameState'
  import FloorCanvas from './FloorCanvas.svelte'
  import FloorIndicator from './FloorIndicator.svelte'
  import type { Fact } from '../../data/types'

  interface Props {
    onDive: () => void
    onStudy?: () => void
    onReviewArtifact?: () => void
    onViewTree?: () => void
    onMaterializer?: () => void
    onPremiumMaterializer?: () => void
    onCosmetics?: () => void
    onKnowledgeStore?: () => void
    onFossils?: () => void
    onZoo?: () => void
    onStreakPanel?: () => void
    onFarm?: () => void
    onSettings?: () => void
    facts?: Fact[]
  }

  const {
    onDive, onStudy, onReviewArtifact, onViewTree,
    onMaterializer, onPremiumMaterializer, onCosmetics,
    onKnowledgeStore, onFossils, onZoo, onStreakPanel,
    onFarm, onSettings, facts,
  }: Props = $props()

  const hubStack = getDefaultHubStack()

  // Derive unlocked floors from player save
  const unlockedIds = $derived($playerSave?.hubState?.unlockedFloorIds ?? ['starter'])
  const floorTiers = $derived(($playerSave?.hubState?.floorTiers ?? { starter: 0 }) as Record<string, number>)

  // Filter to unlocked floors only
  const unlockedFloors = $derived(
    hubStack.floors.filter(f => unlockedIds.includes(f.id))
  )

  let floorIndex = $state(0)

  // Sync with store
  $effect(() => {
    currentFloorIndex.set(floorIndex)
  })

  // Clamp floor index when unlocked floors change
  $effect(() => {
    if (floorIndex >= unlockedFloors.length) {
      floorIndex = Math.max(0, unlockedFloors.length - 1)
    }
  })

  // Touch navigation
  let touchStartY = $state(0)

  function handleTouchStart(e: TouchEvent): void {
    touchStartY = e.touches[0].clientY
  }

  function handleTouchEnd(e: TouchEvent): void {
    const deltaY = touchStartY - e.changedTouches[0].clientY
    if (Math.abs(deltaY) > 40) {
      if (deltaY > 0 && floorIndex < unlockedFloors.length - 1) {
        floorIndex++
      } else if (deltaY < 0 && floorIndex > 0) {
        floorIndex--
      }
    }
  }

  function handleWheel(e: WheelEvent): void {
    e.preventDefault()
    if (e.deltaY > 0 && floorIndex < unlockedFloors.length - 1) {
      floorIndex++
    } else if (e.deltaY < 0 && floorIndex > 0) {
      floorIndex--
    }
  }

  function handleFloorSelect(index: number): void {
    if (index >= 0 && index < unlockedFloors.length) {
      floorIndex = index
    }
  }

  function handleObjectTap(objectId: string, action: string): void {
    if (action === 'dive') { onDive(); return }
    if (action === 'none') return
    switch (action) {
      case 'knowledgeTree':       onViewTree?.(); break
      case 'workshop':
      case 'materializer':        onMaterializer?.(); break
      case 'premiumMaterializer': onPremiumMaterializer?.(); break
      case 'cosmeticsShop':       onCosmetics?.(); break
      case 'knowledgeStore':      onKnowledgeStore?.(); break
      case 'fossilGallery':       onFossils?.(); break
      case 'zoo':                 onZoo?.(); break
      case 'streakPanel':         onStreakPanel?.(); break
      case 'farm':                onFarm?.(); break
      case 'studySession':        onStudy?.(); break
      case 'settings':            onSettings?.(); break
      case 'command':             onStudy?.(); break // GAIA terminal -> study for now
      default: break
    }
  }

  // Calculate translateY for slide animation
  const slideOffset = $derived(-floorIndex * 100)
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="hub-view"
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
  onwheel={handleWheel}
>
  <!-- Resource bar at top -->
  <div class="hub-resource-bar">
    {#if $playerSave}
      <span class="res">💎 {$playerSave.minerals.dust}</span>
      <span class="res">🔷 {$playerSave.minerals.shard}</span>
      <span class="res">💠 {$playerSave.minerals.crystal}</span>
      <span class="res">🫧 {$playerSave.oxygen} O₂</span>
    {/if}
  </div>

  <!-- Floor viewport -->
  <div class="floor-viewport">
    <div
      class="floor-slide-container"
      style="transform: translateY({slideOffset}%)"
    >
      {#each unlockedFloors as floor, i (floor.id)}
        <div class="floor-slot">
          <FloorCanvas
            {floor}
            upgradeTier={(floorTiers[floor.id] ?? 0) as FloorUpgradeTier}
            onObjectTap={handleObjectTap}
          />
        </div>
      {/each}
    </div>
  </div>

  <FloorIndicator
    floors={hubStack.floors}
    {unlockedIds}
    currentIndex={floorIndex}
    onFloorSelect={handleFloorSelect}
  />
</div>

<style>
  .hub-view {
    width: 100%;
    height: 100vh;
    overflow: hidden;
    background: #0a0a1e;
    position: relative;
    touch-action: none;
  }

  .hub-resource-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 16px;
    padding: 8px 12px;
    background: rgba(10,10,30,0.85);
    z-index: 40;
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    color: #ccc;
  }

  .res {
    white-space: nowrap;
  }

  .floor-viewport {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
  }

  .floor-slide-container {
    transition: transform 400ms cubic-bezier(0.4, 0.0, 0.2, 1);
    will-change: transform;
  }

  .floor-slot {
    width: 100%;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-top: 40px;
  }
</style>

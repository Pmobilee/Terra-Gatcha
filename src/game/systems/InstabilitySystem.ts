import { BALANCE } from '../../data/balance'

/** Trigger types that contribute to layer instability. (Phase 35.4) */
export type InstabilityTrigger =
  | 'lava_adjacent'       // mined a block next to lava
  | 'unstable_broke'      // broke UnstableGround
  | 'cave_in'             // cave-in event fired
  | 'hard_rock_deep'      // broke HardRock in extreme tier (layer 16+)
  | 'altar_tier4'         // tier-4 altar sacrifice (earth-shaking)

/**
 * Manages the per-layer instability meter.
 * Registered with TickSystem to count down collapse ticks. (DD-V2-023, Phase 35.4)
 */
export class InstabilitySystem {
  private level = 0       // 0–100
  private collapseFired = false
  private collapseCountdown = 0  // ticks remaining to reach descent shaft

  private readonly onThresholdWarning: () => void
  private readonly onCollapse: () => void
  private readonly onCollapseCountdownTick: (remaining: number) => void

  constructor(
    onThresholdWarning: () => void,
    onCollapse: () => void,
    onCollapseCountdownTick: (remaining: number) => void,
  ) {
    this.onThresholdWarning = onThresholdWarning
    this.onCollapse = onCollapse
    this.onCollapseCountdownTick = onCollapseCountdownTick
  }

  /**
   * Add instability points for a trigger event.
   * @param trigger - What caused the instability increase.
   */
  addInstability(trigger: InstabilityTrigger): void {
    const deltas = BALANCE.INSTABILITY_DELTAS as Record<string, number>
    const delta = deltas[trigger] ?? 0
    const wasBelow75 = this.level < BALANCE.INSTABILITY_WARNING_THRESHOLD
    this.level = Math.min(100, this.level + delta)

    // Fire warning callback on crossing the 75% threshold
    if (wasBelow75 && this.level >= BALANCE.INSTABILITY_WARNING_THRESHOLD && !this.collapseFired) {
      this.onThresholdWarning()
    }

    // Fire collapse when reaching 100%
    if (this.level >= 100 && !this.collapseFired) {
      this.collapseFired = true
      this.collapseCountdown = BALANCE.INSTABILITY_COLLAPSE_TICKS
      this.onCollapse()
    }
  }

  /**
   * Called by TickSystem each tick during a collapse countdown.
   * @param _tick - Global tick counter (unused).
   * @param _layerTick - Layer-scoped tick counter (unused).
   */
  onTick(_tick: number, _layerTick: number): void {
    if (!this.collapseFired || this.collapseCountdown <= 0) return
    this.collapseCountdown--
    this.onCollapseCountdownTick(this.collapseCountdown)
  }

  /** Returns the current instability level (0–100). */
  getLevel(): number { return this.level }

  /** Returns true if a collapse is active and the countdown is running. */
  isCollapsing(): boolean { return this.collapseFired && this.collapseCountdown > 0 }

  /** Returns the remaining collapse countdown ticks. */
  getCountdown(): number { return this.collapseCountdown }

  /** Reset all instability state. Call on layer change or new dive. */
  reset(): void {
    this.level = 0
    this.collapseFired = false
    this.collapseCountdown = 0
  }
}

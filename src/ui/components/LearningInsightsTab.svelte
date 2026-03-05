<script lang="ts">
  /**
   * LearningInsightsTab — personal learning effectiveness panel for the GAIA Report.
   * Renders mastery rate, velocity, category strengths, and retention predictions.
   * All data is computed client-side from the player's ReviewStates.
   */
  import { playerSave } from '../stores/playerData'
  import { computeLearningInsights, type LearningInsights } from '../../services/learningInsights'

  interface Props {
    /** Map from factId → category name, for category breakdown. */
    factCategories?: Map<string, string>
  }

  const { factCategories = new Map() }: Props = $props()

  let insights: LearningInsights | null = $state(null)

  $effect(() => {
    const save = $playerSave
    if (save) {
      insights = computeLearningInsights(
        save.reviewStates,
        save.engagementData,
        factCategories,
      )
    }
  })

  /**
   * Format a 0-1 fraction as a percentage string.
   * @param value - Fraction between 0 and 1.
   * @returns Formatted percentage string (e.g. "74%").
   */
  function pct(value: number): string {
    return `${Math.round(value * 100)}%`
  }

  /**
   * Compute bar fill width percentage clamped to [0, 100].
   * @param value - The value to scale.
   * @param max   - The maximum expected value (default 1).
   * @returns Integer percentage in [0, 100].
   */
  function bar(value: number, max = 1): number {
    return Math.min(Math.max((value / max) * 100, 0), 100)
  }
</script>

<div class="insights-tab" aria-label="My Learning Insights">
  {#if !insights || insights.totalReviewed === 0}
    <p class="empty-state">
      Complete some dives and reviews to unlock your learning insights.
    </p>
  {:else}
    <!-- Overview strip -->
    <div class="overview-grid">
      <div class="stat-card">
        <span class="stat-value">{insights.masteredCount}</span>
        <span class="stat-label">Facts Mastered</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{pct(insights.masteryRate)}</span>
        <span class="stat-label">Mastery Rate</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{insights.masteryVelocityPerWeek.toFixed(1)}/wk</span>
        <span class="stat-label">Mastery Speed</span>
      </div>
      <div class="stat-card" class:warn={insights.overdueCount > 0}>
        <span class="stat-value">{insights.overdueCount}</span>
        <span class="stat-label">Overdue Reviews</span>
      </div>
    </div>

    <!-- Category strengths -->
    {#if insights.topCategories.length > 0}
      <section class="section">
        <h3 class="section-title">Your Strongest Categories</h3>
        {#each insights.topCategories as cat}
          <div class="category-row" aria-label="{cat.category}: {pct(cat.masteryRate)} mastery">
            <span class="category-name">{cat.category}</span>
            <div
              class="bar-track"
              role="progressbar"
              aria-valuenow={Math.round(cat.masteryRate * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div class="bar-fill" style="width: {bar(cat.masteryRate)}%"></div>
            </div>
            <span class="category-pct">{pct(cat.masteryRate)}</span>
          </div>
        {/each}
      </section>
    {/if}

    <!-- Retention predictions -->
    <section class="section">
      <h3 class="section-title">Predicted Retention</h3>
      <p class="section-desc">
        Based on your average memory strength (ease factor {insights.avgEaseFactor.toFixed(2)}),
        here's how well you're likely to remember mastered facts over time:
      </p>
      <div class="prediction-grid">
        {#each insights.retentionPredictions as pred}
          <div class="pred-card">
            <span class="pred-pct">{pct(pred.predictedRetention)}</span>
            <span class="pred-label">in {pred.daysOut} days</span>
          </div>
        {/each}
      </div>
    </section>

    <!-- SM-2 stats -->
    <section class="section">
      <h3 class="section-title">Memory Health</h3>
      <div class="health-row">
        <span>Average ease factor</span>
        <span class="health-value">{insights.avgEaseFactor.toFixed(2)}</span>
      </div>
      <div class="health-row">
        <span>Average review interval</span>
        <span class="health-value">{insights.avgIntervalDays.toFixed(0)} days</span>
      </div>
      <div class="health-row">
        <span>Lapse rate</span>
        <span class="health-value" class:warn={insights.lapseRate > 0.15}>
          {pct(insights.lapseRate)}
        </span>
      </div>
    </section>
  {/if}
</div>

<style>
  .insights-tab {
    padding: 12px;
    color: #d4e8d0;
    font-size: 13px;
    overflow-y: auto;
    max-height: 400px;
  }
  .empty-state {
    text-align: center;
    color: #7a9e88;
    padding: 32px 16px;
  }
  .overview-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }
  .stat-card {
    background: rgba(0,0,0,0.3);
    border: 1px solid #2a4a38;
    border-radius: 6px;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .stat-card.warn { border-color: #c8831a; }
  .stat-value { font-size: 22px; font-weight: bold; color: #a8e6b0; }
  .stat-label { font-size: 11px; color: #7a9e88; }
  .section { margin-bottom: 16px; }
  .section-title {
    font-size: 12px;
    font-weight: bold;
    color: #6fcf97;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 8px;
  }
  .section-desc { color: #7a9e88; margin-bottom: 8px; }
  .category-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .category-name { width: 110px; flex-shrink: 0; }
  .bar-track {
    flex: 1;
    height: 8px;
    background: rgba(255,255,255,0.1);
    border-radius: 4px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    background: #6fcf97;
    border-radius: 4px;
    transition: width 0.3s ease;
  }
  .category-pct { width: 36px; text-align: right; color: #a8e6b0; }
  .prediction-grid { display: flex; gap: 12px; }
  .pred-card {
    flex: 1;
    background: rgba(0,0,0,0.25);
    border: 1px solid #2a4a38;
    border-radius: 6px;
    padding: 8px;
    text-align: center;
  }
  .pred-pct { display: block; font-size: 20px; font-weight: bold; color: #a8e6b0; }
  .pred-label { font-size: 11px; color: #7a9e88; }
  .health-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .health-value { color: #a8e6b0; }
  .health-value.warn { color: #f2c94c; }
</style>

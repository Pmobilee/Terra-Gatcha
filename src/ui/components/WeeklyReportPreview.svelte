<script lang="ts">
  import { playerSave } from '../stores/playerData'

  let loading = $state(false)
  let error = $state(false)
  let expanded = $state(false)

  interface ReportSummary {
    totalPlayMinutes: number
    factsLearned: number
    factsMastered: number
    streakDays: number
    topCategories: Array<{ name: string; count: number }>
  }

  let report = $state<ReportSummary | null>(null)

  async function fetchReport(): Promise<void> {
    const playerId = $playerSave?.playerId
    if (!playerId) return
    loading = true
    error = false
    try {
      const apiBase = (import.meta as unknown as Record<string, Record<string, string>>).env?.VITE_API_BASE_URL ?? 'http://localhost:3001'
      const res = await fetch(`${apiBase}/parental/${playerId}/weekly-summary`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json() as ReportSummary
      report = data
    } catch {
      error = true
    } finally {
      loading = false
    }
  }

  function toggleExpanded(): void {
    if (!expanded && !report && !loading) {
      void fetchReport()
    }
    expanded = !expanded
  }
</script>

<div class="weekly-preview">
  <button class="preview-toggle" type="button" onclick={toggleExpanded}>
    Preview this week's report {expanded ? '▲' : '▼'}
  </button>

  {#if expanded}
    <div class="preview-content">
      {#if loading}
        <p class="preview-loading">Loading…</p>
      {:else if error || !report}
        <p class="preview-unavailable">Summary unavailable. Try again later.</p>
      {:else}
        <div class="preview-stat">
          <span class="stat-label">Play time</span>
          <span class="stat-value">{report.totalPlayMinutes} min</span>
        </div>
        <div class="preview-stat">
          <span class="stat-label">Facts discovered</span>
          <span class="stat-value">{report.factsLearned}</span>
        </div>
        <div class="preview-stat">
          <span class="stat-label">Facts mastered</span>
          <span class="stat-value">{report.factsMastered}</span>
        </div>
        <div class="preview-stat">
          <span class="stat-label">Streak</span>
          <span class="stat-value">{report.streakDays} days</span>
        </div>
        {#if report.topCategories.length > 0}
          <div class="preview-categories">
            <span class="stat-label">Top topics</span>
            <ul class="category-list">
              {#each report.topCategories.slice(0, 3) as cat}
                <li>{cat.name}: {cat.count}</li>
              {/each}
            </ul>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .weekly-preview {
    width: 100%;
    border: 1px solid rgba(78,205,196,0.2);
    border-radius: 10px;
    overflow: hidden;
  }
  .preview-toggle {
    width: 100%; padding: 0.75rem 1rem;
    background: rgba(78,205,196,0.06);
    border: none; color: #4ECDC4; cursor: pointer;
    font-size: 0.8rem; text-align: left; font-weight: 600;
  }
  .preview-content {
    padding: 0.75rem 1rem;
    display: flex; flex-direction: column; gap: 0.4rem;
  }
  .preview-loading, .preview-unavailable {
    font-size: 0.75rem; color: rgba(238,238,238,0.5); margin: 0;
  }
  .preview-stat {
    display: flex; justify-content: space-between;
    font-size: 0.8rem; color: rgba(238,238,238,0.8);
  }
  .stat-label { color: rgba(238,238,238,0.5); }
  .stat-value { font-weight: 700; color: #eee; }
  .preview-categories { display: flex; flex-direction: column; gap: 0.2rem; }
  .category-list {
    margin: 0.2rem 0 0 0; padding-left: 1rem;
    font-size: 0.75rem; color: rgba(238,238,238,0.7);
  }
  .category-list li { margin-bottom: 0.1rem; }
</style>

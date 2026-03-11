<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import {
    createDefaultCalibrationState,
    setGlobalKnowledgeLevel,
    setDomainManualLevel,
    setAutoCalibrate,
    resolveDistributionForDomain,
    KNOWLEDGE_LEVEL_DISTRIBUTIONS,
  } from '../../services/difficultyCalibration'
  import type { KnowledgeLevel, CalibrationState } from '../../services/difficultyCalibration'
  import { getAllDomainMetadata } from '../../data/domainMetadata'

  interface Props {
    onBack: () => void
  }

  let { onBack }: Props = $props()

  let showAutoCalibExplanation = $state(false)

  let calibration = $derived<CalibrationState>(
    $playerSave?.calibrationState ?? createDefaultCalibrationState()
  )

  let domains = $derived(getAllDomainMetadata().filter(d => !d.comingSoon))

  const LEVEL_OPTIONS: Array<{ id: KnowledgeLevel | 'global'; label: string }> = [
    { id: 'global', label: 'Use Global' },
    { id: 'casual', label: 'Casual' },
    { id: 'normal', label: 'Normal' },
    { id: 'scholar', label: 'Scholar' },
  ]

  const GLOBAL_LEVEL_OPTIONS: Array<{ id: KnowledgeLevel; label: string }> = [
    { id: 'casual', label: 'Casual' },
    { id: 'normal', label: 'Normal' },
    { id: 'scholar', label: 'Scholar' },
  ]

  function updateCalibration(updated: CalibrationState): void {
    playerSave.update(s => s ? { ...s, calibrationState: updated } : s)
  }

  function handleGlobalLevelChange(level: KnowledgeLevel): void {
    updateCalibration(setGlobalKnowledgeLevel(level, calibration))
  }

  function handleDomainLevelChange(domain: string, value: KnowledgeLevel | 'global'): void {
    const level = value === 'global' ? null : value
    updateCalibration(setDomainManualLevel(domain, level, calibration))
  }

  function handleAutoCalibToggle(): void {
    const next = !calibration.autoCalibrate
    if (next && !calibration.hasSeenAutoCalibExplanation) {
      showAutoCalibExplanation = true
      updateCalibration({ ...setAutoCalibrate(true, calibration), hasSeenAutoCalibExplanation: true })
    } else {
      updateCalibration(setAutoCalibrate(next, calibration))
    }
  }

  function dismissExplanation(): void {
    showAutoCalibExplanation = false
  }

  function getOffsetLabel(domain: string): string {
    const dc = calibration.domains[domain]
    if (!dc || dc.autoOffset === 0) return ''
    const pct = Math.round(Math.abs(dc.autoOffset) * 100)
    return dc.autoOffset > 0 ? `+${pct}% harder` : `-${pct}% easier`
  }

  function getActiveLevelForDomain(domain: string): KnowledgeLevel | 'global' {
    return calibration.domains[domain]?.manualLevel ?? 'global'
  }
</script>

<section class="topic-interests" aria-label="Topic interests and difficulty settings">
  <header class="ti-header">
    <button class="ti-back-btn" onclick={onBack} aria-label="Back to hub">&larr;</button>
    <h1 class="ti-title">Topics & Difficulty</h1>
  </header>

  <!-- Global difficulty -->
  <div class="ti-section">
    <h2 class="ti-section-title">Global Difficulty</h2>
    <div class="ti-chip-row">
      {#each GLOBAL_LEVEL_OPTIONS as opt}
        <button
          class="ti-chip"
          class:active={calibration.globalLevel === opt.id}
          onclick={() => handleGlobalLevelChange(opt.id)}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Auto-calibrate toggle -->
  <div class="ti-section">
    <div class="ti-toggle-row">
      <div class="ti-toggle-info">
        <span class="ti-toggle-label">Auto-adjust difficulty</span>
        <span class="ti-toggle-hint">Adapts to your performance after each run</span>
      </div>
      <button
        class="ti-toggle"
        class:on={calibration.autoCalibrate}
        onclick={handleAutoCalibToggle}
        role="switch"
        aria-checked={calibration.autoCalibrate}
      >
        <span class="ti-toggle-knob"></span>
      </button>
    </div>
  </div>

  <!-- Domain list -->
  <div class="ti-section">
    <h2 class="ti-section-title">Per-Topic Difficulty</h2>
    <div class="ti-domain-list">
      {#each domains as domain}
        {@const activeLvl = getActiveLevelForDomain(domain.id)}
        {@const offset = getOffsetLabel(domain.id)}
        <div class="ti-domain-card">
          <div class="ti-domain-header">
            <span class="ti-domain-icon">{domain.icon}</span>
            <span class="ti-domain-name">{domain.displayName}</span>
            {#if offset}
              <span class="ti-offset-badge">{offset}</span>
            {/if}
          </div>
          <div class="ti-chip-row compact">
            {#each LEVEL_OPTIONS as opt}
              <button
                class="ti-chip small"
                class:active={activeLvl === opt.id}
                onclick={() => handleDomainLevelChange(domain.id, opt.id)}
              >
                {opt.label}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- Auto-calibrate explanation popup -->
{#if showAutoCalibExplanation}
  <div class="explanation-overlay" role="dialog" aria-modal="true">
    <div class="explanation-modal">
      <h3>Auto-Adjust Difficulty</h3>
      <p>
        After each run, Recall Rogue will gently adjust question difficulty in each topic based on how well you perform.
      </p>
      <p>
        If you're acing a topic, it'll gradually add harder questions. If you're struggling, it'll ease up. Changes are small and gradual.
      </p>
      <button class="explanation-dismiss" onclick={dismissExplanation}>Got it!</button>
    </div>
  </div>
{/if}

<style>
  .topic-interests {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: #0a0e18;
    color: #e2e8f0;
    overflow-y: auto;
    padding: 0 16px 32px;
    -webkit-overflow-scrolling: touch;
  }

  .ti-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 0 12px;
    position: sticky;
    top: 0;
    background: #0a0e18;
    z-index: 10;
  }

  .ti-back-btn {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 4px 8px;
    font-family: inherit;
  }

  .ti-title {
    font-size: 1.2rem;
    font-weight: 700;
    margin: 0;
  }

  .ti-section {
    margin-bottom: 20px;
  }

  .ti-section-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 10px;
  }

  .ti-chip-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .ti-chip-row.compact {
    gap: 6px;
  }

  .ti-chip {
    padding: 8px 16px;
    border: 2px solid #2a3450;
    border-radius: 8px;
    background: #0f1420;
    color: #94a3b8;
    font-size: 0.85rem;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    font-family: inherit;
  }

  .ti-chip.small {
    padding: 5px 10px;
    font-size: 0.78rem;
    border-radius: 6px;
  }

  .ti-chip.active {
    border-color: #FCD34D;
    color: #FCD34D;
    background: #1a2040;
  }

  .ti-chip:hover:not(.active) {
    border-color: #475569;
  }

  /* Toggle */
  .ti-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
  }

  .ti-toggle-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .ti-toggle-label {
    font-size: 0.95rem;
    font-weight: 600;
  }

  .ti-toggle-hint {
    font-size: 0.78rem;
    color: #64748b;
  }

  .ti-toggle {
    position: relative;
    width: 48px;
    height: 26px;
    border-radius: 13px;
    border: 2px solid #2a3450;
    background: #1a1f2e;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
    padding: 0;
    font-family: inherit;
  }

  .ti-toggle.on {
    background: #2563eb;
    border-color: #3b82f6;
  }

  .ti-toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #e2e8f0;
    transition: transform 0.2s;
  }

  .ti-toggle.on .ti-toggle-knob {
    transform: translateX(22px);
  }

  /* Domain cards */
  .ti-domain-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ti-domain-card {
    background: #111827;
    border: 1px solid #1e293b;
    border-radius: 10px;
    padding: 12px;
  }

  .ti-domain-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .ti-domain-icon {
    font-size: 1.2rem;
  }

  .ti-domain-name {
    font-weight: 600;
    font-size: 0.95rem;
    flex: 1;
  }

  .ti-offset-badge {
    font-size: 0.72rem;
    color: #FCD34D;
    background: rgba(252, 211, 77, 0.1);
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 600;
  }

  /* Explanation popup */
  .explanation-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    padding: 16px;
  }

  .explanation-modal {
    background: #1a1f2e;
    border: 2px solid #3b4a6b;
    border-radius: 14px;
    padding: 24px 20px;
    max-width: 360px;
    text-align: center;
  }

  .explanation-modal h3 {
    color: #FCD34D;
    font-size: 1.1rem;
    margin: 0 0 12px;
  }

  .explanation-modal p {
    color: #94a3b8;
    font-size: 0.85rem;
    line-height: 1.5;
    margin: 0 0 12px;
  }

  .explanation-dismiss {
    padding: 10px 28px;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    margin-top: 4px;
    font-family: inherit;
  }

  .explanation-dismiss:active {
    background: #1d4ed8;
  }
</style>

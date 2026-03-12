<script lang="ts">
  import type { KnowledgeLevel } from '../../services/difficultyCalibration'
  import { getKnowledgeLevelIconPath, getKnowledgeLevelEmoji } from '../utils/iconAssets'

  interface Props {
    onselect: (level: KnowledgeLevel) => void
  }

  let { onselect }: Props = $props()

  const levels: Array<{ id: KnowledgeLevel; title: string; description: string; iconKey: string }> = [
    {
      id: 'casual',
      title: 'Casual Learner',
      description: "I'm just getting started. Start me with easier questions.",
      iconKey: 'casual',
    },
    {
      id: 'normal',
      title: 'Normal',
      description: 'Give me a balanced mix of easy and hard questions.',
      iconKey: 'normal',
    },
    {
      id: 'scholar',
      title: 'Master Scholar',
      description: 'Challenge me! I love difficult questions.',
      iconKey: 'scholar',
    },
  ]
</script>

<div class="popup-overlay" role="dialog" aria-modal="true" aria-label="Choose your knowledge level">
  <div class="popup-content">
    <h2 class="popup-title">How much do you already know?</h2>
    <p class="popup-subtitle">This affects the difficulty of questions you'll see. You can change this anytime in Topics.</p>

    <div class="level-cards">
      {#each levels as level}
        <button
          class="level-card"
          data-testid="knowledge-level-{level.id}"
          onclick={() => onselect(level.id)}
        >
          <span class="level-icon">
            <img class="knowledge-level-icon-img" src={getKnowledgeLevelIconPath(level.iconKey)} alt=""
              onerror={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; ((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement).style.display = 'inline'; }} />
            <span style="display:none">{getKnowledgeLevelEmoji(level.iconKey)}</span>
          </span>
          <span class="level-title">{level.title}</span>
          <span class="level-desc">{level.description}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .popup-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.85);
    padding: 16px;
  }

  .popup-content {
    background: #1a1f2e;
    border: 2px solid #3b4a6b;
    border-radius: 16px;
    padding: 24px 20px;
    max-width: 400px;
    width: 100%;
    text-align: center;
  }

  .popup-title {
    font-size: 1.3rem;
    color: #e2e8f0;
    margin: 0 0 8px;
    font-weight: 700;
  }

  .popup-subtitle {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0 0 20px;
    line-height: 1.4;
  }

  .level-cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .level-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 16px 12px;
    background: #0f1420;
    border: 2px solid #2a3450;
    border-radius: 12px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    color: #e2e8f0;
    font-family: inherit;
  }

  .level-card:hover,
  .level-card:focus-visible {
    border-color: #FCD34D;
    background: #1a2040;
  }

  .level-card:active {
    background: #222850;
  }

  .level-icon {
    font-size: 2rem;
    line-height: 1;
  }

  .level-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: #FCD34D;
  }

  .level-desc {
    font-size: 0.82rem;
    color: #94a3b8;
    line-height: 1.3;
  }

  .knowledge-level-icon-img {
    width: 2rem;
    height: 2rem;
    image-rendering: pixelated;
    display: inline-block;
  }
</style>

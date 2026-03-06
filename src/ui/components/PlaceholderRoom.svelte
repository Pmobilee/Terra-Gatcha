<script lang="ts">
  interface Props {
    title: string
    description?: string
    onBack: () => void
  }

  let { title, description = 'This feature is coming soon.', onBack }: Props = $props()
</script>

<div class="placeholder-room">
  <header class="placeholder-header">
    <button class="back-btn" type="button" onclick={onBack}>← Back</button>
    <h2>{title}</h2>
  </header>
  <div class="placeholder-body">
    <div class="placeholder-icon">🚧</div>
    <p class="placeholder-text">{description}</p>
  </div>
</div>

<style>
  .placeholder-room {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary, #1a1a2e);
    color: var(--text-primary, #e0e0e0);
    padding: 1rem;
  }
  .placeholder-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  .placeholder-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  .back-btn {
    background: none;
    border: 1px solid var(--border-color, #444);
    color: var(--text-primary, #e0e0e0);
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .placeholder-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 1rem;
  }
  .placeholder-icon {
    font-size: 3rem;
  }
  .placeholder-text {
    font-size: 1rem;
    opacity: 0.7;
    text-align: center;
    max-width: 300px;
  }
</style>

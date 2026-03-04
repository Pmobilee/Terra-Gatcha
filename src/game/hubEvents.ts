/**
 * hubEvents.ts
 *
 * Typed event bridge for Phaser DomeScene → Svelte component communication.
 * Uses a simple pub/sub pattern since Phaser events can't directly update Svelte stores.
 */

type HubEventMap = {
  'objectTap': [objectId: string, action: string]
  'floorChanged': [index: number]
  'gaia-bubble-tap': [text: string]
  // Phase 47: Achievement Gallery
  'gallery-painting-tap': [paintingId: string]
  'gallery-overview-tap': []
  'painting-reveal-complete': [paintingId: string]
}

type Listener<K extends keyof HubEventMap> = (...args: HubEventMap[K]) => void

class HubEventBus {
  private listeners = new Map<string, Set<Function>>()

  on<K extends keyof HubEventMap>(event: K, fn: Listener<K>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(fn)
  }

  off<K extends keyof HubEventMap>(event: K, fn: Listener<K>): void {
    this.listeners.get(event)?.delete(fn)
  }

  emit<K extends keyof HubEventMap>(event: K, ...args: HubEventMap[K]): void {
    this.listeners.get(event)?.forEach(fn => (fn as Function)(...args))
  }
}

export const hubEvents = new HubEventBus()

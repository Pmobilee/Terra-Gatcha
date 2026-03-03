/**
 * TickSystem — central registry for tick-driven game logic.
 * All hazard timers, instability meters, and active entities
 * register callbacks here. Never use setInterval or setTimeout
 * for game logic — always use ticks. (DD-V2-051)
 */
export type TickCallback = (tick: number, layerTick: number) => void;

export class TickSystem {
  private static instance: TickSystem;
  private callbacks: Map<string, TickCallback> = new Map();
  private tickCount = 0;
  private layerTickCount = 0;

  static getInstance(): TickSystem {
    if (!TickSystem.instance) TickSystem.instance = new TickSystem();
    return TickSystem.instance;
  }

  /** Register a named tick listener. Overwrites existing if same key. */
  register(key: string, cb: TickCallback): void {
    this.callbacks.set(key, cb);
  }

  /** Remove a tick listener by key. */
  unregister(key: string): void {
    this.callbacks.delete(key);
  }

  /** Called by MineScene after every player move or block hit. */
  advance(): void {
    this.tickCount++;
    this.layerTickCount++;
    this.callbacks.forEach(cb => cb(this.tickCount, this.layerTickCount));
  }

  /** Reset layer tick counter on layer change. */
  resetLayerTick(): void {
    this.layerTickCount = 0;
  }

  /** Full reset on new dive. */
  resetAll(): void {
    this.tickCount = 0;
    this.layerTickCount = 0;
    this.callbacks.clear();
  }

  getTick(): number { return this.tickCount; }
  getLayerTick(): number { return this.layerTickCount; }
}

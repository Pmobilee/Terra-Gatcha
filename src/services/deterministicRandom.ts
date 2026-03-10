/**
 * Deterministic RNG override for fixed-seed modes (e.g. Daily Expedition).
 * Uses a local mulberry32 generator and swaps Math.random at runtime.
 */

let originalDescriptor: PropertyDescriptor | null = null
let active = false
let activeSeed: number | null = null

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let n = Math.imul(t ^ (t >>> 15), 1 | t)
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
}

export function activateDeterministicRandom(seed: number): void {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) return

  if (!originalDescriptor) {
    originalDescriptor = Object.getOwnPropertyDescriptor(Math, 'random') ?? null
  }

  const generator = mulberry32(seed)
  Object.defineProperty(Math, 'random', {
    value: () => generator(),
    writable: true,
    configurable: true,
    enumerable: false,
  })

  active = true
  activeSeed = seed >>> 0
}

export function deactivateDeterministicRandom(): void {
  if (!active) return

  if (originalDescriptor) {
    Object.defineProperty(Math, 'random', originalDescriptor)
  }

  active = false
  activeSeed = null
}

export function isDeterministicRandomActive(): boolean {
  return active
}

export function getDeterministicRandomSeed(): number | null {
  return activeSeed
}


/**
 * Web performance timing collector.
 *
 * Captures LCP, FID/INP, CLS, and FCP via PerformanceObserver and reports
 * them to the analytics service once per session.
 *
 * Call perfService.observe() once at app boot.
 */

import { analyticsService } from './analyticsService'

interface PerfSnapshot {
  lcp?: number
  fcp?: number
  cls?: number
  inp?: number
  ttfb?: number
}

class PerfService {
  private snapshot: PerfSnapshot = {}
  private reported = false

  observe(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return

    // FCP
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.snapshot.fcp = Math.round(entry.startTime)
          }
        }
      }).observe({ type: 'paint', buffered: true })
    } catch { /* unsupported */ }

    // LCP
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const last = entries[entries.length - 1]
        if (last) this.snapshot.lcp = Math.round(last.startTime)
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    } catch { /* unsupported */ }

    // CLS
    try {
      let clsValue = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number }
          if (!e.hadRecentInput) clsValue += e.value ?? 0
        }
        this.snapshot.cls = parseFloat(clsValue.toFixed(4))
      }).observe({ type: 'layout-shift', buffered: true })
    } catch { /* unsupported */ }

    // INP (Interaction to Next Paint — available in Chrome 96+)
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const duration = entry.duration
          if (!this.snapshot.inp || duration > this.snapshot.inp) {
            this.snapshot.inp = Math.round(duration)
          }
        }
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit)
    } catch { /* unsupported */ }

    // TTFB via navigation timing
    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      if (nav) {
        this.snapshot.ttfb = Math.round(nav.responseStart - nav.requestStart)
      }
    } catch { /* unsupported */ }

    // Report 10 seconds after boot to capture LCP
    setTimeout(() => this.report(), 10_000)
  }

  private report(): void {
    if (this.reported) return
    this.reported = true

    analyticsService.track({
      name: 'web_vitals',
      properties: {
        lcp: this.snapshot.lcp ?? -1,
        fcp: this.snapshot.fcp ?? -1,
        cls: this.snapshot.cls ?? -1,
        inp: this.snapshot.inp ?? -1,
        ttfb: this.snapshot.ttfb ?? -1,
      },
    })
  }
}

export const perfService = new PerfService()

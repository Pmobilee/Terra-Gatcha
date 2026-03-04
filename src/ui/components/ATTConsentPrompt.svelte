<script lang="ts">
  import { registerPlugin } from '@capacitor/core'
  import { onMount } from 'svelte'
  import { analyticsEnabled } from '../../ui/stores/settings'

  interface ATTPlugin {
    requestPermission(): Promise<{ status: 'authorized' | 'denied' | 'not_determined' | 'restricted' }>
    getStatus(): Promise<{ status: 'authorized' | 'denied' | 'not_determined' | 'restricted' }>
  }

  const ATT = registerPlugin<ATTPlugin>('AppTrackingTransparency')

  let shown = false

  onMount(async () => {
    // Only on iOS; Android and web skip silently
    if (!('Capacitor' in window)) return
    try {
      const { status } = await ATT.getStatus()
      if (status === 'not_determined') {
        shown = true
        const result = await ATT.requestPermission()
        analyticsEnabled.set(result.status === 'authorized')
        shown = false
      }
    } catch {
      // Plugin not available (Android / web) — analytics defaults to enabled
      analyticsEnabled.set(true)
    }
  })
</script>

<!-- No visible UI: the native OS dialog is shown by requestPermission() -->

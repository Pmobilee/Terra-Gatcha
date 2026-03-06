# Phase 67: Onboarding Polish

## Tech Stack
- Frontend: Svelte 5 + TypeScript (strict), Vite 7, Phaser 3
- Onboarding cutscene: `src/ui/components/OnboardingCutscene.svelte` (delegates to `CutscenePanel.svelte`)
- Streak panel: `src/ui/components/StreakPanel.svelte`
- Milestone data: `BALANCE.STREAK_MILESTONES` in `src/data/balance.ts` (19 milestones, days 3-365)
- Typecheck: `npm run typecheck` -- 0 errors

## Overview

**Goal:** Fix two low-priority UX polish issues discovered during playtesting: a placeholder backstory scene and a missing scroll indicator on the streak milestone list.

**Priority:** LOW

**Findings:** M3 (backstory placeholder), L2 (streak list no scroll indicator)

**Dependencies:** None (purely visual polish on existing components).

**Estimated Complexity:** Low -- two independent CSS/markup changes, no logic or data changes.

**Design Decision Refs:** None (cosmetic fixes).

---

## Sub-steps

### 67.1 -- Replace backstory placeholder scene

**Problem:** The `CutscenePanel.svelte` component renders panel images (`/cutscene/panel_01.png` through `panel_05.png`) that may be missing or placeholder quality. Panel 2 specifically references atmospheric re-entry and shows a brown rectangle with `[ placeholder ]` text when the image is missing.

**Current state:**
- `src/ui/components/OnboardingCutscene.svelte` defines 5 panels with `{ src, caption }` objects
- `src/ui/components/CutscenePanel.svelte` renders each panel as a full-screen overlay with an `<img>` tag and caption text
- When images are missing/broken, the user sees a broken image icon or placeholder

**Fix:** Replace the image-based approach in `CutscenePanel.svelte` with a CSS-driven atmospheric background that works without external image files. This ensures the cutscene always looks good even when images are absent.

**Implementation:**

1. **Modify `CutscenePanel.svelte`** to add a CSS gradient background behind the image:
   - Add a `data-panel` attribute to the `.panel` div, passing the panel index (0-4)
   - Add a `fallback-bg` div that renders a CSS gradient specific to each panel's mood:
     - Panel 0 (Year 2847): Dark navy (#0a0a2e) to deep purple (#1a0a3e) -- deep space
     - Panel 1 (Re-entry): Dark space blue (#0a0a2e) at top, orange atmospheric glow (#ff6b35) in middle, brown ground (#3d2817) at bottom
     - Panel 2 (Survived): Warm amber (#4a2800) to dark brown (#1a0a00) -- crash aftermath
     - Panel 3 (GAIA systems): Dark teal (#0a1a2e) to green (#0a2e1a) -- AI boot sequence
     - Panel 4 (Underground): Dark earth (#1a1008) to stone gray (#2a2a2a) -- underground mystery
   - Add subtle CSS animation: floating particle dots using `@keyframes` (small white/orange circles drifting upward, 6-8 particles via `::before`/`::after` pseudo-elements or a dedicated particle container)
   - The `<img>` tag remains but gets `object-fit: contain` and sits on top of the gradient. If the image loads, it shows over the gradient. If not, the gradient provides the atmosphere.

2. **Modify `OnboardingCutscene.svelte`** to pass panel index to `CutscenePanel`:
   - Add `panelIndex` prop to the `CutscenePanel` component call
   - This allows panel-specific gradient selection

3. **Update `CutscenePanel.svelte` Props interface:**
   ```typescript
   interface Props {
     imageSrc: string
     caption: string
     panelIndex?: number  // NEW: 0-4, used for panel-specific gradient
     onAdvance: () => void
     onSkip: () => void
   }
   ```

4. **CSS particle animation spec:**
   - Create a `.particles` container div with `position: absolute; inset: 0; overflow: hidden; pointer-events: none`
   - Use 6 `<span>` elements with class `.particle`, each with inline `style` for random horizontal position and animation delay
   - Keyframes: `@keyframes float-up { 0% { transform: translateY(100vh); opacity: 0; } 10% { opacity: 0.6; } 90% { opacity: 0.6; } 100% { transform: translateY(-20px); opacity: 0; } }`
   - Each particle: `width: 3px; height: 3px; border-radius: 50%; background: rgba(255, 180, 80, 0.5); position: absolute; animation: float-up 6s linear infinite`
   - Vary animation-duration (4s-8s) and animation-delay (0s-5s) per particle

5. **Do NOT create a Phaser scene** -- this is pure CSS/HTML in Svelte components.

**Acceptance Criteria:**
- [ ] First boot flow shows atmospheric gradient backgrounds on all 5 cutscene panels
- [ ] Panel 1 (re-entry) has a visible space-to-atmosphere gradient (dark blue -> orange -> brown)
- [ ] Subtle floating particle animation is visible during cutscene
- [ ] If cutscene images exist and load, they display on top of the gradient
- [ ] If cutscene images are missing, the gradient provides a complete visual experience
- [ ] Skip button still works, auto-advance still works (4s timer)
- [ ] No console errors during cutscene playback

**Files Modified:**
- `src/ui/components/CutscenePanel.svelte` -- gradient backgrounds, particle animation, panelIndex prop
- `src/ui/components/OnboardingCutscene.svelte` -- pass panelIndex to CutscenePanel

---

### 67.2 -- Add scroll indicator to streak milestone list

**Problem:** `StreakPanel.svelte` renders 19 streak milestones (days 3 through 365) in a `.milestone-list` inside a `.milestones-card`. On mobile screens, this list extends well beyond the viewport with no visual indication that more content exists below.

**Current state:**
- `src/ui/components/StreakPanel.svelte` line 157-187: `.milestones-card` contains a `<ul class="milestone-list">` with an `{#each}` over `BALANCE.STREAK_MILESTONES`
- The entire `.streak-panel` has `overflow-y: auto` (line 271), so the whole page scrolls
- The milestone list itself has no constrained height or independent scroll
- No scroll affordance indicator exists

**Fix:** Constrain the milestone list to a max height with its own scroll, and add a bottom fade gradient that disappears when the user scrolls to the bottom.

**Implementation:**

1. **Add a scroll wrapper** around the milestone list in the template:
   ```svelte
   <div class="milestone-scroll-wrapper" bind:this={milestoneScrollEl}>
     <ul class="milestone-list" aria-label="Streak milestones">
       {#each BALANCE.STREAK_MILESTONES as milestone}
         <!-- existing milestone rows unchanged -->
       {/each}
     </ul>
     {#if showScrollFade}
       <div class="scroll-fade" aria-hidden="true"></div>
     {/if}
   </div>
   ```

2. **Add reactive state** in the `<script>` block:
   ```typescript
   let milestoneScrollEl: HTMLDivElement | undefined = $state(undefined)
   let showScrollFade = $state(true)

   function handleMilestoneScroll(): void {
     if (!milestoneScrollEl) return
     const { scrollTop, scrollHeight, clientHeight } = milestoneScrollEl
     // Hide fade when within 8px of bottom
     showScrollFade = scrollHeight - scrollTop - clientHeight > 8
   }

   $effect(() => {
     if (!milestoneScrollEl) return
     milestoneScrollEl.addEventListener('scroll', handleMilestoneScroll, { passive: true })
     // Initial check (may already fit without scroll)
     handleMilestoneScroll()
     return () => milestoneScrollEl?.removeEventListener('scroll', handleMilestoneScroll)
   })
   ```

3. **Add CSS styles:**
   ```css
   .milestone-scroll-wrapper {
     position: relative;
     max-height: 360px;           /* ~5.5 visible milestones */
     overflow-y: auto;
     -webkit-overflow-scrolling: touch;
   }

   .scroll-fade {
     position: sticky;
     bottom: 0;
     left: 0;
     right: 0;
     height: 48px;
     background: linear-gradient(
       to bottom,
       transparent,
       var(--color-surface)
     );
     pointer-events: none;
     border-radius: 0 0 12px 12px;
   }
   ```

4. **Also check if content fits** without scrolling (e.g., on very large screens). If `scrollHeight <= clientHeight`, set `showScrollFade = false` from the start.

**Acceptance Criteria:**
- [ ] Milestone list is constrained to ~360px max height with internal scrolling
- [ ] A fade gradient is visible at the bottom when more milestones exist below the visible area
- [ ] The fade gradient disappears when the user scrolls to the bottom of the list
- [ ] On large screens where all milestones fit, no fade gradient is shown
- [ ] Touch scrolling works smoothly on mobile (`-webkit-overflow-scrolling: touch`)
- [ ] No layout shifts or visual glitches when scrolling
- [ ] Accessibility: `aria-label` on milestone list is preserved, fade div has `aria-hidden="true"`

**Files Modified:**
- `src/ui/components/StreakPanel.svelte` -- scroll wrapper, fade gradient, scroll event handler

---

## Verification Gate

All of the following MUST pass before this phase is marked complete:

1. `npm run typecheck` -- 0 errors
2. `npm run build` -- succeeds without errors
3. `npx vitest run` -- all existing tests pass
4. **Cutscene visual test:**
   - Navigate to app without `skipOnboarding` query param (or use `?devpreset=first_boot`)
   - Complete age gate
   - Verify cutscene panels show gradient backgrounds (not broken images or placeholder text)
   - Verify floating particle animation is visible
   - Verify Skip button works
   - Screenshot each panel for visual confirmation
5. **Streak scroll test:**
   - Navigate with `?skipOnboarding=true&devpreset=post_tutorial`
   - Open Streak Panel
   - Verify fade gradient appears at bottom of milestone list
   - Scroll to bottom of milestone list
   - Verify fade gradient disappears
   - Screenshot before and after scroll

## Files Affected

| File | Change |
|------|--------|
| `src/ui/components/CutscenePanel.svelte` | Add gradient backgrounds, particle animation, `panelIndex` prop |
| `src/ui/components/OnboardingCutscene.svelte` | Pass `panelIndex` to CutscenePanel |
| `src/ui/components/StreakPanel.svelte` | Add scroll wrapper, fade gradient, scroll event handler |

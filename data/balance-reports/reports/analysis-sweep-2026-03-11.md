# Balance Analysis Report — Full Sweep (Post-Fix v2)

**Generated:** 2026-03-11
**Source:** `data/balance-reports/runs/full-sweep-post-fix-v2.json`
**Runs:** 36,650 | **Seeds:** 50/config | **Floors:** 24 | **Elapsed:** 43.9s

---

## 1. Executive Summary

| Metric | Value | Status |
|--------|-------|--------|
| Total relics analyzed | 37 (solo) | |
| S-tier (>50) | 0 | GREEN |
| A-tier (>25) | 0 | YELLOW (want 2-4) |
| B-tier (>10) | 7 | Healthy |
| C-tier (0-10) | 19 | Healthy |
| D-tier (-10 to 0) | 10 | HIGH — too many |
| F-tier (<-10) | 1 | YELLOW |
| Broken synergies (>2.0) | 17 | RED |
| Overpowered flags | 0 | GREEN |
| Immortality flags | 0 | GREEN |

### Overall Health Verdict: YELLOW

**Positive:** Zero S-tier or overpowered relics. No immortality exploits. The B-tier cluster (7 relics) is well-distributed across offensive, cursed, and utility categories.

**Concerns:**
1. **10 D-tier relics** — nearly a third of the roster feels underwhelming. Several of these (iron_buckler, scholars_hat, last_breath) should be impactful defensive/sustain relics but score negative due to defensive metrics being penalized.
2. **1 F-tier** (phoenix_feather at -13.5) — actively harmful solo. Needs a rework.
3. **17 broken synergies** — the 2.0 threshold is being tripped by many low-solo-impact relics that combine for modest real-world gains. Most are measurement artifacts, but 3-4 warrant investigation.
4. **0 A-tier relics** — per design philosophy, we WANT 2-4 aspirational A-tier relics that reward specific combos. The current ceiling (glass_cannon at 19.6) is too flat.

---

## 2. Control Baselines

| Profile | Avg Floor | Survival | Accuracy | Max Combo | DPS | Dmg Taken/Enc |
|---------|-----------|----------|----------|-----------|-----|---------------|
| Struggling | 1.7 | 0% | 38.5% | 4.2 | 3.4 | 65.5 |
| Beginner | 2.6 | 0% | 49.2% | 5.7 | 4.7 | 51.0 |
| Average | 5.6 | 0% | 72.0% | 10.6 | 9.5 | 31.5 |
| Expert | 15.8 | 2% | 90.1% | 23.2 | 20.1 | 19.6 |
| Speed-runner | 19.1 | 22% | 90.2% | 25.1 | 22.9 | 18.7 |

**Assessment:** Baselines are reasonable. Struggling/beginner die early (floors 1-3) as expected. Average players reach mid-game (floor 5-6). Expert players push deep but only 2% complete all 24 floors without relics — this is a good difficulty floor. Speed-runners' 22% survival with no relics is slightly high, suggesting speed bonuses alone provide strong combat advantage.

**Note:** No profile has non-zero survival at average or below without relics. This confirms relics are meaningful progression tools, not just bonuses.

---

## 3. Problem Relics

### F-Tier: phoenix_feather (-13.5 overall)

| Metric | Value |
|--------|-------|
| DPS Impact | +10.9 |
| Defense Impact | -56.0 |
| Survival Impact | 0.0 |

**Why it's F-tier:** The phoenix_feather's lethal-save mechanic triggers on death, reviving the player with some HP. However, the simulation shows it creates a *net negative* because:
- The revival HP is low (likely ~20%), meaning the player dies again shortly after
- The defense score (-56) indicates the relic is correlated with taking far more damage — likely because runs where the relic triggers are already failing runs
- The +10.9 DPS suggests the extra turns from revival do produce some damage, but not enough to recover

**Recommendation:** Phoenix_feather needs a buff. Options:
1. **Increase revival HP to 40-50%** instead of current low value — gives a real second chance
2. **Add temporary invulnerability (1-2 turns)** after revival — prevents immediate re-death
3. **Add a damage buff after revival** (+50% damage for 3 turns) — the "phoenix rising" fantasy

**File:** `src/services/relicEffectResolver.ts` → `resolveLethalSave()` function

### D-Tier Cluster (10 relics)

Most D-tier relics fall into two patterns:

**Pattern A: Defense-heavy relics penalized by measurement** (iron_buckler -2.8, scholars_hat -3.4, last_breath -2.7)
These relics provide shields/healing/death-prevention that extends encounters but doesn't directly kill faster. The defense impact formula penalizes higher damage-taken-per-encounter, even when the player survives longer.

**Pattern B: Truly weak effects** (iron_resolve -0.1, medic_kit -1.1, vitality_ring -1.1, swift_boots -1.2, blood_pact -1.6)
These have small or conditional effects that don't meaningfully change run outcomes when solo.

**Pattern C: Timer/system-dependent** (sharp_eye 0.0, speed_charm 0.0, venom_fang 0.0)
Cannot be modeled — require timer/poison systems absent from headless simulator. Score is inherently 0.

**Recommendation for Pattern A:** Consider adjusting the impact formula. Defense-heavy relics should be measured by *floor progression* and *survival probability* rather than damage-taken-per-encounter. Their value is in extending runs, not reducing per-encounter damage.

**Recommendation for Pattern B:** Buff numerical values by 30-50%. These relics are balanced around being "nice to have" but should feel more impactful:
- `iron_resolve`: Increase from +15% to +25% damage bonus below 50% HP
- `medic_kit`: Increase heal % from 20% to 25% or lower HP threshold
- `swift_boots`: Consider adding a DPS component alongside speed bonus
- `blood_pact`: Already strong in combos (synergy with berserker_band, momentum_gem) — keep as-is

---

## 4. Complete Tier List

### B-Tier (10-25) — 7 relics
| Relic | Overall | DPS | Defense | Key Effect |
|-------|---------|-----|---------|------------|
| glass_cannon | 19.6 | 41.3 | 24.0 | +50% damage, +50% damage taken (cursed) |
| blood_price | 16.3 | 25.9 | 28.4 | Damage costs HP, massive DPS boost (cursed) |
| thorned_vest | 11.5 | 14.9 | 23.5 | Reflects damage back to attacker |
| afterimage | 11.3 | 26.8 | 11.0 | Dodge chance after combo streak |
| barbed_edge | 11.1 | 21.1 | 15.8 | Strike cards deal bonus damage |
| war_drum | 10.9 | 19.0 | 17.3 | +damage per consecutive attack |
| whetstone | 10.9 | 20.5 | 15.8 | Flat +damage to all attacks |

**Observation:** Two cursed relics (glass_cannon, blood_price) lead B-tier. This is healthy design — high-risk relics should be high-reward. Thorned_vest is strong for a non-cursed defensive relic.

### C-Tier (0-10) — 19 relics
| Relic | Overall | DPS | Defense |
|-------|---------|-----|---------|
| combo_ring | 9.3 | 19.4 | 11.8 |
| executioners_axe | 8.3 | 9.1 | 18.6 |
| mirror_shield | 8.2 | 18.0 | 9.2 |
| curiosity_gem | 7.7 | 10.3 | 15.2 |
| memory_palace | 7.5 | 12.6 | 12.3 |
| chain_lightning_rod | 6.3 | 10.0 | 10.8 |
| quicksilver | 4.2 | 6.7 | 7.1 |
| flame_brand | 4.1 | 7.5 | 6.2 |
| double_vision | 3.8 | 7.1 | 5.4 |
| fortress_wall | 3.2 | 10.7 | -0.1 |
| crescendo_blade | 2.8 | 5.2 | 4.0 |
| momentum_gem | 1.5 | 3.5 | 1.6 |
| berserker_band | 1.5 | 2.4 | 2.6 |
| phase_cloak | 0.5 | 2.7 | -1.1 |
| stone_wall | 0.2 | 0.6 | -0.1 |
| steel_skin | 0.1 | 0.5 | 0.0 |
| renewal_spring | 0.1 | 0.3 | -0.1 |
| herbal_pouch | 0.0 | 0.5 | -0.4 |

**Observation:** The bottom of C-tier (stone_wall through herbal_pouch, all <1.0) is functionally D-tier. These relics have near-zero solo impact and are only useful in combinations. Consider whether this is by design (combo enablers) or whether they need buffs.

### D-Tier (-10 to 0) — 10 relics
| Relic | Overall | DPS | Defense |
|-------|---------|-----|---------|
| sharp_eye | 0.0 | 0.0 | 0.0 |
| speed_charm | 0.0 | 0.0 | 0.0 |
| venom_fang | 0.0 | 0.0 | 0.0 |
| iron_resolve | -0.1 | 0.0 | -0.4 |
| medic_kit | -1.1 | 0.1 | -3.6 |
| vitality_ring | -1.1 | 0.7 | -4.2 |
| swift_boots | -1.2 | 1.1 | -5.2 |
| blood_pact | -1.6 | 0.1 | -5.6 |
| last_breath | -2.7 | 1.9 | -10.8 |
| iron_buckler | -2.8 | 3.9 | -13.2 |
| scholars_hat | -3.4 | 2.8 | -14.1 |

### F-Tier (<-10) — 1 relic
| Relic | Overall | DPS | Defense |
|-------|---------|-----|---------|
| phoenix_feather | -13.5 | 10.9 | -56.0 |

---

## 5. Synergy Report

### Top 20 Combos by Synergy Factor

| Rank | Combo | Synergy | Verdict | Analysis |
|------|-------|---------|---------|----------|
| 1 | iron_buckler + fortress_wall | 31.38 | broken | **Measurement artifact.** Both have near-zero solo impact (iron_buckler -2.8, fortress_wall 3.2). Any combined benefit creates a huge synergy *ratio*. Real combined impact is likely modest shield stacking. |
| 2 | steel_skin + iron_resolve | 10.20 | broken | Same pattern: 0.1 + -0.1 solo → any combo benefit inflates the ratio. Both provide conditional defense bonuses that stack. |
| 3 | berserker_band + blood_pact | 9.03 | broken | Solo: 1.5 + -1.6 = ~0. Combined: blood_pact's HP cost + berserker_band's low-HP bonus creates a loop. **Potentially intentional design** — risk/reward synergy. |
| 4 | medic_kit + phase_cloak | 5.34 | broken | Solo: -1.1 + 0.5. Phase_cloak's evasion + medic_kit's healing extend runs. |
| 5 | swift_boots + phase_cloak | 3.98 | broken | Solo: -1.2 + 0.5. Speed + evasion = fewer hits taken. |
| 6 | last_breath + crescendo_blade | 3.46 | broken | Death-save + ramping damage. Last_breath keeps you alive while crescendo builds up. |
| 7 | vitality_ring + phase_cloak | 3.39 | broken | HP + evasion = survivability. |
| 8 | phase_cloak + blood_pact | 3.25 | broken | Evasion offsets blood_pact's self-damage. |
| 9 | momentum_gem + blood_pact | 3.10 | broken | Perfect turn bonus + HP cost creates risk/reward loop. |
| 10 | iron_resolve + phase_cloak | 2.87 | broken | Low-HP bonus + evasion. |
| 11 | last_breath + fortress_wall | 2.37 | broken | Death-save + massive shielding. |
| 12 | swift_boots + fortress_wall | 2.37 | broken | Speed + shields. |
| 13 | stone_wall + medic_kit | 2.33 | broken | Shields + healing. |
| 14 | executioners_axe + phoenix_feather | 2.12 | broken | Execute threshold + revival — interesting synergy where axe finishes enemies before phoenix needs to trigger, and if it does trigger, more time for executes. |
| 15 | stone_wall + blood_pact | 2.09 | broken | Shields offset blood_pact self-damage. |
| 16 | iron_buckler + momentum_gem | 2.06 | broken | Turn-start shield + perfect turn bonus. |
| 17 | momentum_gem + scholars_hat | 2.04 | broken | Both reward perfect play — stacking bonuses for good answers. |
| 18 | curiosity_gem + phoenix_feather | 1.99 | strong | Just below broken threshold. |
| 19 | stone_wall + swift_boots | 1.98 | strong | |
| 20 | iron_buckler + phase_cloak | 1.92 | strong | |

### Synergy Assessment

**The "broken synergy" problem is largely a measurement artifact.** The synergy factor formula (`combo_impact / sum(solo_impacts)`) produces extreme ratios when solo impacts are near zero. A relic with 0.1 solo impact and 0.1 solo impact combining for 3.0 combo impact gives a 15x synergy factor — but 3.0 combined impact is still a weak C-tier combo.

**Actually concerning combos:**
- **berserker_band + blood_pact (9.03x):** This creates a self-reinforcing loop (pay HP → low HP → bonus damage → more HP cost). Worth monitoring but probably intentional risk/reward design.
- **phase_cloak + X:** Phase_cloak appears in 6 of the top 17 broken synergies. Its evasion mechanic multiplies the value of any relic that extends runs. Consider whether phase_cloak's effect is too universally synergistic.

**Recommendation:** Adjust the synergy factor threshold. With so many low-solo-impact relics, the 2.0 cutoff flags too many false positives. Either:
1. Raise threshold to 3.0, or
2. Add a minimum `abs(combo_impact) > 5.0` filter before flagging, or
3. Use `combo_impact - sum(solo_impacts)` (additive) rather than ratio for flagging

---

## 6. Fairness Analysis

### Floor Progression by Profile × Loadout

| Loadout | Beginner | Average | Expert | Expert:Beginner Ratio |
|---------|----------|---------|--------|----------------------|
| Offense | 3.6 | 8.8 | 19.4 | 5.4x |
| Defense | 6.9 | 15.7 | 23.2 | 3.4x |
| Knowledge | 3.3 | 12.5 | 22.5 | 6.9x |
| Cursed | 2.9 | 8.4 | 21.8 | 7.6x |

### Survival by Profile × Loadout

| Loadout | Beginner | Average | Expert |
|---------|----------|---------|--------|
| Offense | 0% | 0% | 18% |
| Defense | 0% | 8% | 72% |
| Knowledge | 0% | 0% | 58% |
| Cursed | 0% | 0% | 50% |

**Assessment:**

1. **Defense loadout is the most fair** (3.4x ratio, average players can survive at 8%). This is correct — defensive relics should help weaker players more than experts.

2. **Cursed loadout is the most unfair** (7.6x ratio). Beginners get floor 2.9 (worse than baseline 2.6!), while experts get 21.8. Cursed relics punish bad play and reward good play, which is by design — but the gap is extreme. Beginners are actively **harmed** by cursed relics.

3. **Knowledge loadout is skill-gated** (6.9x ratio). Knowledge relics (curiosity_gem, memory_palace, scholars_hat) amplify accuracy advantages, so experts benefit disproportionately. This matches the game's educational thesis — players who learn more, do better.

4. **No beginner survival in any loadout except none.** This may be too harsh. A beginner with defense relics reaches floor 6.9 but still has 0% survival. Consider whether even 24 floors is too many for beginners to ever complete, or whether the intent is that progression and relic accumulation eventually make completion accessible.

**Fairness Flags:**
- Cursed loadout: 7.6x ratio exceeds the 5.0 critical threshold
- Knowledge loadout: 6.9x ratio exceeds the 5.0 critical threshold
- Offense loadout: 5.4x is borderline

**Recommendation:** The cursed/knowledge ratios are high but arguably intentional. Monitor but don't rebalance unless casual player feedback indicates frustration. The defense loadout's 3.4x is excellent and could be a model for tuning other loadouts.

---

## 7. Build Performance

| Build | Profile | Survival | Avg Floor | DPS | Dmg Taken/Enc |
|-------|---------|----------|-----------|-----|---------------|
| Iron Fortress | Expert | **98%** | 24.0 | 24.9 | 16.2 |
| Sustain God | Expert | **96%** | 23.8 | 20.4 | 32.7 |
| Speed Demon | Speed-runner | 82% | 23.6 | 30.9 | 12.4 |
| Cursed Gambler | Expert | 80% | 23.2 | 31.2 | 14.7 |
| Full Aggro | Expert | 60% | 23.0 | **34.2** | 12.4 |
| Balanced Best | Expert | 54% | 22.4 | 23.2 | 21.9 |

**Analysis:**

1. **Iron Fortress (98% survival)** is the strongest build by far. 8 defensive relics create near-immortality. This is expected for a full-defense build on an expert player but worth monitoring. The 24.0 avg floor (max possible) means this build virtually never loses.

2. **Sustain God (96%)** is nearly as strong but achieves it differently — takes MORE damage (32.7 vs 16.2) but heals through it. Interesting that sustain rivals pure defense.

3. **Build diversity is healthy.** All 6 builds are viable (54-98% survival on expert). No build is strictly dominated. The DPS vs. survival tradeoff works: Full Aggro has the highest DPS (34.2) but lowest survival (60%).

4. **Balanced Best underperforms** (54%). A mix of offense, defense, and utility relics is worse than committing to an archetype. This is good design — it rewards build coherence.

**Concern:** Iron Fortress at 98% on an expert may mean that defense stacking is too strong in the late game. However, this requires acquiring 8 specific relics, which is a significant investment. Per the design philosophy, this is acceptable as a "build-around" reward.

### Progression Curve

| Stage | Relics | Avg Floor | Survival | DPS |
|-------|--------|-----------|----------|-----|
| New Player (3 starter relics) | 3 | 8.1 | 2% | 11.5 |
| Mid Unlock (6 mixed relics) | 6 | 22.3 | 68% | 19.2 |
| Full Collection (top 8) | 8 | 15.5 | 6% | 16.9 |

**Anomaly:** Full collection (8 top relics) performs WORSE than mid unlock (6 relics). This is because the "top 8" selection is the 8 highest-solo-impact relics, which are mostly offensive and don't synergize defensively. The mid unlock set includes fortress_wall and blood_pact which provide critical survival. **This validates that balanced builds need defensive anchors — raw DPS alone doesn't win.**

---

## 8. Recommendations

### Priority 1 — Critical

| # | Action | File | Expected Impact |
|---|--------|------|-----------------|
| 1 | **Buff phoenix_feather** — increase revival HP from ~20% to 40%, add 2-turn damage immunity post-revival | `relicEffectResolver.ts` → `resolveLethalSave()` | F→C tier, stops being actively harmful |
| 2 | **Fix synergy factor formula** — add minimum `abs(combo_impact) > 5` filter before flagging as broken | `scripts/mass-simulate.ts` | Reduces false-positive broken synergies from 17 to ~3-5 |

### Priority 2 — Important

| # | Action | File | Expected Impact |
|---|--------|------|-----------------|
| 3 | **Create A-tier aspirational relics** — buff 2-3 relics that reward specific 2-relic combos into A-tier (25-40 overall) | `relicEffectResolver.ts`, relic definitions | Creates build-defining moments. Candidates: combo_ring (currently 9.3, pairs with momentum_gem), executioners_axe (8.3, pairs with glass_cannon) |
| 4 | **Buff iron_buckler** (+3 block/turn → +5) — it's a starter relic that should feel good | `relicEffectResolver.ts` → `resolveTurnStartEffects()` | D→C tier |
| 5 | **Buff scholars_hat** — increase knowledge bonus from current value by 40% | `relicEffectResolver.ts` | D→C tier |
| 6 | **Buff iron_resolve** — increase damage bonus from +15% to +25% below 50% HP | `relicEffectResolver.ts` | D→C tier |

### Priority 3 — Polish

| # | Action | File | Expected Impact |
|---|--------|------|-----------------|
| 7 | **Adjust defense impact formula** — measure floor progression instead of damage-taken-per-encounter for defensive relics | `scripts/mass-simulate.ts` | D-tier defensive relics get fairer scores |
| 8 | **Investigate phase_cloak** — appears in 6/17 broken synergies. Its evasion may be too universally multiplicative | `relicEffectResolver.ts` | May need evasion cap or diminishing returns |
| 9 | **Add timer/poison modeling** to headless simulator for sharp_eye, speed_charm, venom_fang | `headless-combat.ts` | Removes 3 unscored relics from D-tier |
| 10 | **Monitor Iron Fortress build** — 98% survival at expert. If ascension modes don't bring this down, consider defense diminishing returns | No immediate action | Watch in future sweeps |

---

## Appendix: Key Thresholds Reference

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Solo impact overall | -10 to +25 (C/B) | S (>50) or F (<-10) | >100 |
| Combo synergy factor | 0.8-1.5 | 1.5-2.0 (strong) | >2.0 (broken) |
| Skill fairness ratio | 1.0-3.0 | 3.0-5.0 | >5.0 |
| Expert survival | 10%-60% | >80% | >99% |
| Average survival | 0%-15% | >30% | >50% |

---

*Report generated from 36,650 simulated runs across 50 seeds, 5 player profiles, 24 floors. All metrics computed on the `average` profile baseline unless otherwise noted.*

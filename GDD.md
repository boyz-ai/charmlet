# Charm Unlock — One-Page GDD (v1.0)

Working title: **Charm Unlock** (TR: Charm Çözücü). Final store name to be checked for trademark/ASO before launch.

## Pitch
A vertical, one-thumb hybrid-casual puzzle: rotate interlocked charm-bracelet rings so their gaps line up, free them one by one, and drop each ring's charm into a 5-slot tray where 3 of the same color clear. Built on the proven "Rotate Rings" mechanic, with a tray/queue economy (Cube Land-style) that the reference game lacks.

## Reference games & twist (USP)
- Reference: Rotate Rings (Nebula Studio, 2026: top download charts, nearly zero IAP revenue), Cube Land / Pixel Flow (queue + tray pressure).
- Twist 1: every freed ring drops a colored charm into a 5-slot tray; 3 same-color charms merge. Release ORDER becomes the core decision.
- Twist 2: limited rotations (moves) per level + mechanic blockers (pins etc.) → natural fail moments.
- Must differ from competitors in at least 2 concrete mechanics/UX points (Apple 4.3 safety): tray economy, pins/blockers, jewelry theme with color-blind symbols.

## Audience & session
Global casual puzzle players, Tier-1 + global. Portrait, one thumb. Sessions 3–8 min (2–4 levels).

## Core loop
Read board → drag a ring to rotate (1 move) → links open when a gap covers a ring intersection → glowing ring = free → tap to release (free, 0 moves) → charm flies to tray → 3 same color merge → board clear = win.

## Win / lose (deterministic: YES)
- Win: all rings released and tray empty.
- Lose: tray reaches 5 charms without a merge, OR moves = 0 while no ring is free.
- Every level is verified solvable without boosters by the solver (`tools/gen.js`).

## Rules (exact)
- Gap half-width: 28°. A link between rings A and B is open if A's gap or B's gap covers either intersection point.
- A ring is free if all links to still-present rings are open AND every pin on it is covered by its own gap.
- Rotation counts as 1 move when the drag exceeds ~8°. Tapping is free.

## 3-second ad hook
A tangled bracelet; one swipe rotates a ring, it glows, a tap sends a sparkling charm flying into the tray and three rubies merge with a pop.

## First 60 seconds (FTUE)
- Level 1 opens directly on the board, no menus, no account, no text wall.
- Ghost-hand animation shows one rotation, then one tap. First win in < 30 s.
- No interstitial ads in the first 20–30 minutes. Notification permission only after the first big win.

## Level format & production
- JSON per level: layout id, colors per ring, gap angles, pins, move limit, role, hint (see `levels/levels.json`).
- Solver-first pipeline: generator creates candidates → solver computes min moves and solvability (including tray) → levels sorted on a sawtooth curve.
- Every 10-level arc: 1 new mechanic intro · 2–4 normal · 5 Hard · 6 relief · 7–8 normal · 9 Super Hard · 10 bonus.
- Move limit = solver minimum + slack (tutorial +4, normal +2–3, hard +1, super hard +0).
- New mechanic cadence (v1.0, 100 levels): Pin (L3) · Fixed ring, cannot rotate (L11) · Twin-gap ring, second gap opposite the first (L21) · Lock ring, cannot be released before the first merge in the tray (L31) · Ice ring, max 2 rotations (L41). Levels 51–100 remix these. Every level stores a solver-verified solution (`sol`) that the tests replay through the real game rules.

## Game feel package
Spring/ease-out on touch · rotation tick sound every 15° + light haptic · "free" chime when a ring becomes free · release whoosh + medium haptic · merge arpeggio with rising pitch + heavy haptic · confetti only on level win · shake + error haptic on a locked tap · idle hint: a free ring pulses after 5 s. One FeedbackManager triggers all feedback; sound and vibration have separate toggles. Native haptics via Capacitor Haptics.

## Accessibility
Every color also has a symbol (ruby = heart, sapphire = diamond, emerald = triangle; later colors: amethyst = star, topaz = circle). High contrast against the velvet background.

## Meta (v1.0 — max 2 systems)
1. Win streak: consecutive first-try wins; at 3+ the next level starts with a bonus (+2 moves); visible on the fail screen ("Your streak will burn!").
2. Flexible daily reward ("log in 3 of 7 days"), day-7 reward larger than days 1–6 combined.
   Implemented as a 7-step track: one step per calendar day the game is opened; missed days never reset it. Days 1–6: 20/25/30+Undo/35/40+Magnet/50 coins; day 7: 250 coins + one of each booster.
- Coins (soft currency): win 10 · hard 15 · super hard 25. +3 moves on the out-of-moves screen costs 60 coins (rewarded ad in M7).
- Boosters: Undo 60 · Extra slot 90 · Magnet 120 coins after the 2 free uses. Magnet pulls every charm of the most common tray color; a level is won when all rings are out even if the Magnet left a partial color. Extra slot and Magnet can also rescue a full tray from the fail screen.

## Monetization (IAA + IAP)
- Rewarded video: +3 moves on fail, 2x coins at level end (optional), extra tray slot for one level.
- Interstitial: none in the first 20–30 minutes; afterwards every 2–3 levels at natural breaks only; never after the player declines "2x".
- Any IAP buyer: zero interstitials (permanent). No Ads bundle keeps optional rewarded videos available.
- IAP: Starter 2.99 · No Ads bundle 4.99 · coin packs 9.99–19.99 · big pack 49.99. Regional pricing.
- Boosters: Undo last rotation, Extra slot (6th tray slot), Magnet (pulls 1 charm out of the tray). First 2 of each free.
- Ad mediation with at least 2 networks. No misclick dark patterns.

## Tech stack (fixed — do NOT change mid-project)
TypeScript + Vite + HTML5 Canvas 2D (no game engine). Capacitor for Android/iOS. Capacitor Haptics. AdMob via @capacitor-community/admob. RevenueCat Capacitor SDK for IAP. Firebase Analytics. Local save (Capacitor Preferences). Android builds on Windows (Android Studio); iOS builds via a cloud Mac service (e.g. Codemagic) when the Apple account is opened.

## Analytics events
app_open · level_start{n} · first_move · ring_release · tray_merge · level_complete{n,moves_left,first_try} · level_fail{n,reason} · offer_shown/offer_accepted{type} · ad_shown{type} · iap_purchase{sku}. FTUE funnel: app_open → level_1_start → first_move → level_1_complete → level_2_start.

## Out of scope for v1.0 (do NOT build)
Story mode · room decoration · real-time PvP · clans/chat · more than 2 meta systems · accounts/login · 3D rendering.

## Schedule & gates
See `DECISION.md` and `ROADMAP.md`.

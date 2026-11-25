# ROADMAP.md — Charm Unlock production line

Give Antigravity ONE milestone prompt at a time. Wait until it finishes, test on your phone, then commit. Use "review-driven" mode, not Turbo.

---
## M1 — Project setup + port the prototype — DONE by Claude (Vite + TS, src/core with 11 unit tests, renderer, input, FeedbackManager)
```
Read GDD.md and AGENTS.md. Create a Vite + TypeScript project in this folder (keep prototype/, tools/, levels/ as they are).
Port prototype/index.html into modules: src/core (pure rules: rings, links, pins, freeness, tray, moves, win/lose), src/render (canvas drawing), src/input (pointer rotate/tap), src/feedback (FeedbackManager: sounds + haptics stub), src/levels (load levels/levels.json).
Behaviour and look must match the prototype exactly. Add Vitest unit tests for src/core. Run npm run build and npm test, then show me how to open it on my phone over Wi-Fi (npm run dev -- --host).
```
Check: the game plays the same as the prototype on your phone.

## M2 — Screens & save — DONE by Claude (home screen, settings, EN/TR, local save, 7 more tests)
```
Add a simple home screen (Play button showing the current level number, settings icon), a settings panel (sound on/off, vibration on/off, language EN/TR), level-complete and fail screens as in the prototype, and local save of current level, streak and settings (behind a SaveService interface). No menus before level 1 on first launch: the first launch goes straight into level 1.
```

## M3 — FTUE + game feel — DONE by Claude (ghost-hand hints, idle hint after 5 s, sparkle/merge kick/confetti, 10 more tests)
```
Implement the GDD "First 60 seconds" and "Game feel package": ghost-hand tutorial on levels 1–3 (no text walls), idle hint pulse after 5 s, feedback scaled by event rarity, particles with object pooling, confetti only on level win. Keep everything behind FeedbackManager.
```

## M4 — Content: 100 levels — DONE by Claude (fixed, twin-gap, lock, ice rings; 100 solver-verified levels with stored solutions; 200 more tests)
Claude (in chat) extends tools/gen.js with the new mechanics (fixed ring, twin-gap ring, lock ring, ice ring) and generates 100 solver-verified levels on the sawtooth curve. Then in Antigravity:
```
Implement the new mechanics from GDD (fixed ring, twin-gap ring, lock ring, ice ring) in src/core with unit tests, matching tools/gen.js rules exactly, and render them. Load the new levels/levels.json.
```

## M5 — Meta — DONE by Claude (coins, streak +2 bonus, 7-step daily reward, Undo / Extra slot / Magnet with 2 free each)
```
Implement GDD Meta: win streak with +2 moves bonus at 3+, streak warning on the fail screen, and the flexible daily reward (3 of 7 days). Coins as soft currency. Boosters: Undo, Extra slot, Magnet (first 2 free).
```

## M5.1 — DONE by Claude: Hint booster (auto hints only on teaching levels) and 1000 solver-verified levels

## M5.2 — DONE by Claude: level map, bomb / color-lock / heavy rings (L101, L201, L301), gem charms and new sounds, ads + shop flows in test mode

## M5.3 — DONE by Claude: Bracelet Workshop + chapter collection, animated home screen, 12 languages

## M6 — Capacitor + Android build (1–2 days)
```
Add Capacitor (Android first). Wire Capacitor Haptics into FeedbackManager and Capacitor Preferences into SaveService. Explain step by step how I install Android Studio on Windows and run the app on my Android test phone.
```
Note: You have an iPhone. For Android testing borrow a friend's Android phone or use the Android Studio emulator. iOS comes later via a cloud Mac build.

## M7 — Analytics, ads, IAP (2–4 days)
```
Add Firebase Analytics with the GDD events. Add AdMob (@capacitor-community/admob) with test ad IDs only, following GDD ad rules (no interstitials first 20–30 min, payers never see interstitials). Add RevenueCat for the IAP list in GDD (sandbox only). Put each behind its service interface with a browser fake.
```

## M8 — Closed test & store (3 weeks, mostly waiting)
- Google Play developer account (personal) → closed test with 15–25 testers for 14 continuous days (needed: at least 12 the whole time).
- 5 stranger playtests with the playtest form (Claude prepares it).
- Store page: icon, 6 screenshots, 15-s video, short + long description in EN/TR (Claude writes; images in Flow/Gemini).
- Fill in DECISION.md gates G1–G3 honestly.

## Parallel: marketing station (from today)
Record 15-s vertical gameplay clips from the prototype (screen recording) and post to TikTok/Shorts. Track views and comments → DECISION.md G2.

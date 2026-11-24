# AGENTS.md — rules for AI coding agents (Antigravity, Claude, Gemini)

Read `GDD.md` before every task. The owner does not write code: explain what you changed in plain, short English, and list anything they must click or install.

## Project rules
1. Stack is fixed: TypeScript + Vite + Canvas 2D + Capacitor. Never switch engine/framework or add a game engine.
2. Work in small, verifiable tasks: one module per task. Show a plan first, then implement, then run `npm run build` and `npm test`.
3. Keep game rules pure and testable in `src/core/` (no DOM, no canvas). Rendering in `src/render/`, input in `src/input/`, feedback in `src/feedback/`, platform services (ads, IAP, analytics, haptics, save) in `src/services/` behind interfaces with a fake implementation for the browser.
4. The rules in `src/core` must match `prototype/index.html` and GDD "Rules (exact)". Write unit tests for: link open, ring free, pins, tray merge, win/lose, move counting.
5. Never edit `levels/*.json` by hand. Levels come only from `tools/gen.js` (solver-verified). If a level needs a change, change the generator or its plan and regenerate.
6. Do not add npm packages without saying why; prefer official packages. For AdMob and RevenueCat follow their current official docs/agent skills.
7. All feedback (sound, haptics, particles, shake) goes through one `FeedbackManager`. No double triggers.
8. Performance: 60 FPS on a 4-year-old mid-range Android phone; object pooling for particles; no per-frame allocations in hot loops.
9. Ads/IAP rules from GDD are requirements, not suggestions (no interstitials in the first 20–30 min, payers see no interstitials, no misclick traps).
10. Commit to Git after each finished task with a clear message. Never run destructive terminal commands without asking.
11. Do not create accounts, publish, or spend money. Ask the owner.
12. Strings in `src/i18n/en.json` and `tr.json`; no hard-coded UI text.

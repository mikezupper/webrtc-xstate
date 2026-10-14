# Example visual design

Status: complete.

## Scope

Restyle the four private examples to the approved "weave" mock: phase-driven colour, a glass
masthead, the connection drawn as a thread with a step tracker, a video stage with a docked
control bar, chat bubbles, a stats dialog, a preview mirror and a transfer drop zone with a
progress ring. Public packages, protocols and existing regression assertions are unchanged.

## Decisions

- One hue per page comes from `main[data-phase]` through `:root:has()`; a registered `--hue`
  animates between phases. Moods are pure functions next to each view (`callMood`,
  `supportMood`, `mediaMood`, `transferMood`).
- Call and support share pure view parts in `src/call/parts.ts`: stage, dock, chat and report.
  The dock uses `aria-pressed` toggles with stable names; Start call and Hang up always render.
- Chat messages record their sender and time (`ChatMessage`); text no longer carries a prefix.
- The connection report is a modal `<dialog>` (`?modal`), refreshed by a two-second subscription
  while open. `summarizeStats` reads native stats into round trip, loss, jitter, route and rates.
- Native work stays out of views: `audioLevel` owns a Web Audio analyser for level meters and the
  speaking glow; `fileDrop` forwards dropped files to the file input. Both dispose with the element.
- Fonts are self-hosted Latin subsets (Unbounded, Onest, Martian Mono; SIL OFL 1.1) so the
  examples make no third-party requests and the packed-consumer check stays offline.
- Tier C features (cross-document view transitions, scroll-driven frost, customizable select,
  `corner-shape`, `interpolate-size`) are enhancements behind `@supports` or harmless when absent.
  Motion runs only without a reduced-motion preference; transitions are off with it.

## Test list

- [x] DOM-free tests: message sender history, stats summary and bitrates, phase moods, track
  descriptions, report open/close commands.
- [x] Browser: chat sender markup, microphone `aria-pressed` toggling, stats dialog open/Escape.
- [x] All existing end-to-end assertions unchanged and passing, including axe in three engines.

## Verification

- Observed the new model and browser tests fail before implementation.
- Found and fixed while verifying: a 4:3 remote video pushed the dock out of the stage; the
  stage's minimum height became a minimum width in Firefox; the reduced-motion rule made WebKit
  transition inherited text colour from black; a page-wide fade blanked the call while screen
  sharing ended.
- Screenshots of every call, support, media and transfer state reviewed at desktop (dark) and
  390 px (light) widths.

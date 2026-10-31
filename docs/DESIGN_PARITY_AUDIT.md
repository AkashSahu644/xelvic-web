# Design parity audit

This is a source-level design audit. No screenshot diff or device-lab comparison was run. The web is intentionally responsive rather than a pixel copy of a phone screen, so parity is judged by tokens, hierarchy, copy and interaction, not by identical coordinates.

## Brand

| Item | Android/APK source | Web | Status |
| --- | --- | --- | --- |
| Name | Xelvic | Xelvic | Match |
| Wordmark | APK asset | `BrandMark`, `public/xelvic.png`, `xelvic-white.png` | Match |
| Favicon | APK asset | `public/favicon.png` | Match |
| Old Xellom name | Legacy | Not used in new UI | Match |

## Typography

- Family: Manrope variable, shipped locally through `@fontsource-variable/manrope`.
- Headings: 17-20 px, weight 700-800, tight tracking.
- Body: 11-13 px on mobile surfaces, 13-14 px on desktop.
- Meta: 9-10 px uppercase with wide tracking.
- Numbers: tabular figures for counters.
- No second display face was introduced.

Gaps:

- The Android app uses a Flutter text theme with platform font metrics. The web does not reproduce line-height rounding exactly.
- Very small meta text (9 px) is legible in the current design but should be checked with browser zoom and assistive settings.

## Colour and theme system

- CSS custom properties are set on `<html>`: `--accent`, `--accent-pill`, `--page`, `--card`, `--line`, `--ink`, `--dim`, `--on-accent`, `--accent-soft`.
- Light/dark/system mode is stored locally and the resolved palette drives `color-scheme`.
- 18 designed themes are mirrored from the Android catalogue, including Pink, Unicorn, Cat Girl, Monsoon, Chai, Neon, Orchid, Tidepool, Ember, Cosmos, Sakura, Marigold, Aurora, Obsidian, Peacock, Solaris, Nebula and Eclipse.
- 15 painting themes are present as shell backdrops for Drops, Moments, Convo, Audio and Live.
- Theme covers are served from `public/themes/covers/`.
- Theme selection is written to `/auth/me/theme/`; a refused theme reverts and explains why.

Gaps:

- The theme shop, preview, tier/slot eligibility, purchase and wear actions are implemented in the Sparks page. Django purchase tests and a live flow remain unverified; see `API_INVENTORY.md` and `FINAL_VERIFICATION_REPORT.md`.
- Some theme character marks (`XMark`, `XCharacter`) are not reproduced.
- The default theme key is `pink`, matching the app's own.

## Layout and spacing

- Mobile: 16 px page gutters, 12-18 px card radii, 22 px glass navigation radius.
- Desktop: 88 px icon rail, 240 px expanded rail, max-width content columns (600-900 px).
- Cards use 1 px `--line` borders and `--card` fills.
- Bottom padding accounts for the player and safe areas.
- The five primary destinations keep the mobile hierarchy.

Gaps:

- No formal 4/8 px spacing scale is enforced; values are hand-written Tailwind arbitrary sizes.
- Desktop density is a web adaptation, not an Android tablet layout.
- Rewards are reachable through a mobile top-bar shortcut; the Android navigation hierarchy is adapted, not duplicated exactly.

## Components

| Component | Behaviour | Parity |
| --- | --- | --- |
| `Button` | primary/secondary/ghost/danger, sizes, loading | Good |
| `Avatar` | image, initials, online dot, sizes | Good |
| `Modal` | focus/Escape/backdrop, sizes | Good |
| `ConfirmDialog` | destructive confirm, loading | Good |
| `States` | skeleton, empty, error, compact error | Good |
| `PlayerBar` | queue, keyboard-accessible seek, next/previous | Partial; Media Session is wired where supported but not tested on device/browser controls |
| `DropCard` | media/text/poll, actions, menus | Good |
| `TrackRow` | cover, title, play, like, pick callback | Good |
| Toast | tone, title, description | Good |

## Motion

- Short CSS transitions on hover, press, modal and theme changes.
- No parallax, autoplay or long decorative animation.
- The room has a float-up reaction animation class; if the class is absent it degrades to a static reaction.
- `src/styles.css` includes a global `prefers-reduced-motion: reduce` rule. This was source-inspected but not exercised with the OS/browser preference enabled.

## Media presentation

- Images use lazy loading and async decoding where the component supports it.
- Authenticated media is fetched as a blob; the URL is revoked when no longer needed.
- Audio is a single element owned by the player provider; no autoplay.
- Video is rendered natively where a drop or message provides it.
- Aspect ratios come from the payload where available.

Gaps:

- No custom video controls or picture-in-picture.
- No waveform rendering for voice notes beyond what the payload provides.
- No camera capture; file picker only.

## Responsive and accessibility

Implemented:

- Semantic landmarks (`header`, `nav`, `main`, `aside`).
- Buttons have labels or `aria-label` where icon-only.
- Modals close on Escape.
- Native form labels and focus styles.
- Signed-in shell has a focus-revealed skip link to its main content.
- Touch targets generally at or above 40 px; primary buttons are 44 px.

Not verified or missing:

- No automated axe/Pa11y run.
- No screen-reader pass.
- Skip-link keyboard behavior has not been exercised in an authenticated browser session.
- Reduced-motion behavior has not been exercised with the browser preference enabled.
- No visual check at 360, 768, 1024 or 1440 px.
- Contrast was designed against the palette but not measured by a tool for every theme pair.

## Honest verdict

The design language is recognisably Xelvic: Manrope, compact type, rounded cards, accent-led palettes, painted shell backdrops and the same brand marks. It is not a pixel-identical port. Screenshot comparison, multi-viewport review, assistive-technology review and live theme purchase are still outstanding; the report does not claim full design parity.

# Remediation log

Date: 2026-10-24

This log records changes made during the parity and verification pass. It is not a full commit history.

## Backend contract corrections

| Finding | Correction | Files |
| --- | --- | --- |
| `Relation` was typed with `follows_you`; backend returns `follows_me` | Added the real fields and kept legacy optional fields for tolerance; UI reads `follows_me` | `src/types/api.ts`, `src/pages/ProfilePage.tsx` |
| `Profile` was assumed to include a chat gate | Confirmed the profile endpoint is a bare `Profile`; removed the assumption from the UI flow | `src/types/api.ts`, `src/pages/ProfilePage.tsx` |
| `PeopleState.gate` can be null | Changed the local state type to `ChatGate \| null` | `src/pages/ProfilePage.tsx` |
| `/sparks/` includes a `catalog` | Added `catalog` to `SparksData`; ladder uses it | `src/pages/SparksPage.tsx` |
| `/sparks/wallet/buy/` takes `{key}` | Wired the shop to send only `{key}`; displays the server charge/balance and refreshes wallet data | `docs/BACKEND_API_PARITY_MATRIX.md`, `src/features/sparks/ThemeShop.tsx` |
| Spark off uses the thread UUID | Kept thread-id usage; recorded in the matrix | `docs/BACKEND_API_PARITY_MATRIX.md` |
| `THROWS` emoji order was uncertain | Confirmed via Python codepoints: fire, clap, laugh, heart, hundred | `src/pages/RoomPage.tsx` |
| Report reasons used `harassment`, `hate` and `impersonation`; backend accepts only `spam`, `abuse`, `fake`, `other` | Replaced the profile report options with the backend values | `src/pages/ProfilePage.tsx` |
| `Device` was typed with `label`, `current`, `created_at` and `last_seen`; the serializer returns `id`, `platform`, `push_token`, `app_version`, `last_active` | Matched the type and settings list to the serializer; shows platform, version and last-active time | `src/types/api.ts`, `src/pages/SettingsPage.tsx` |

## Functional fixes

| Issue | Fix | File |
| --- | --- | --- |
| Message button was disabled on first profile load because `gate` is absent | Disable only when a gate exists and `can_type` is false | `src/pages/ProfilePage.tsx` |
| Saved shelf kept an unsaved drop until refresh | Added `onSavedChange` to `DropCard` and removed the row on unsave | `src/features/drops/DropCard.tsx`, `src/pages/SavedPage.tsx` |
| Settings ignored `?section=appearance` from the rail | Reads `section`, opens the matching tab and updates the query string | `src/pages/SettingsPage.tsx` |
| Sparks ladder selected the first staged spark, not the highest | Reduces by `spark.pos` | `src/pages/SparksPage.tsx` |
| Spark and medal links could point at `undefined` | Fall back to `/app/convo` | `src/pages/SparksPage.tsx` |
| `ChatPage` used a short-circuit expression as a statement | Replaced with an `if` | `src/pages/ChatPage.tsx` |
| `MomentsPage` cleanup captured a mutable ref | Captured the audio element in a local variable | `src/pages/MomentsPage.tsx` |
| `TrackRow` could not notify a parent when a track was picked | Added optional `onPicked` and called it from both play targets | `src/features/audio/TrackRow.tsx` |
| Settings "Allow contacts" posted an empty book, which would erase matches already uploaded by Android | Removed the browser allow action; settings now shows matches and can only deny; allowing is documented as Android-only | `src/pages/SettingsPage.tsx` |

## Type and lint fixes

| Issue | Fix | File |
| --- | --- | --- |
| Unused `cn` import and `canFollow` variable | Removed | `src/pages/ProfilePage.tsx` |
| Socket chat frame narrowed incorrectly inside a state updater | Captured `text` and `emoji` after the guard | `src/pages/RoomPage.tsx` |
| `React.FormEvent`/`React.ReactNode` used without a React namespace import | Imported `FormEvent` and `ReactNode` types | `src/pages/SettingsPage.tsx` |
| No ESLint config | Added a flat config with TS, hooks and unused-var rules | `eslint.config.js` |
| ESLint 10/react-hooks 7 compiler rules flagged pre-existing patterns | Limited hooks rules to `rules-of-hooks` and `exhaustive-deps` | `eslint.config.js` |
| Two unused eslint-disable directives | Removed | `src/features/auth/useQrSignIn.ts`, `src/providers/PlayerProvider.tsx` |

## Verification results

| Check | Before | After |
| --- | --- | --- |
| `npm run typecheck` | Failed on four errors | Pass |
| `npm run lint` | No config | Pass |
| `npm run build` | Not re-run after newest pages | Pass |
| Static preview | Not run | `/` and `/app/drops` return 200 |
| Settings module | Missing, `App.tsx` import failed | Implemented |

## Deliberately not changed

- No Android source was modified. Backend purchase entitlement checks and focused tests were added in `xelvic/backend/apps/sparks/`.
- No fake data was added to make a screen look complete.
- No calls, vault, crew, codepad or artist screen was stubbed as if it worked.
- The Git top level resolves to the user's home folder; the initial status query exposed unrelated home-directory entries. No commit, reset or unrelated file changes were made.
- Vitest was added as a development dependency for focused shop tests; no runtime dependency was added.

## Remaining high-priority work

1. Run the backend test suite successfully with a disposable PostgreSQL database and verify the purchase flow end to end.
2. Wire or explicitly defer account deactivation, own QR, crew list, vault, artist page and codepad.
3. Verify the room game subroutes and `/social/requests/` envelope against a live backend.
4. Add route-level code splitting, reduced-motion support and an accessibility pass.
5. Run a live end-to-end pass with two accounts.

## Theme shop implementation

| Change | Result |
| --- | --- |
| Android theme tiers and price rules | Matched the six earned tiers, included themes, one-pick paid tiers and three-pick 10,000 tier in `src/theme/shop.ts` |
| Shop surface | Added tier cards, earned progress, slot and balance eligibility, theme preview, separate wear action, purchase feedback and wallet refresh in `src/features/sparks/ThemeShop.tsx` |
| Temporary preview | Added non-persistent preview state to `ThemeProvider`; dismissing the preview restores the selected account theme |
| Theme ownership in Settings | Theme picker now displays only included, currently selected or wallet-owned designs; provides a link to the shop |
| Mobile access | Added a Rewards shortcut to the mobile top bar; Themes is the default `/app/sparks` tab |
| Purchase API | Uses `POST /sparks/wallet/buy/` with `{key}` only; displays the server-reported charge/balance and refreshes wallet and Sparks queries |
| Backend entitlement | Added server-side tier and slot checks with `tier_not_reached` and `tier_slots_exhausted`, preserving the success response and idempotent purchase behavior |
| Focused tests | Added five Vitest tests for included themes, earned and balance thresholds, slot limits, the final tier and progress |
| Strict checks | Removed unused unfinished declarations from unreferenced `ThemeMarkArt.tsx`; fixed nested Wordmark links on sign-in found by browser rendering |

Frontend verification passed: `npm test` (5 tests), `npm run typecheck`, `npm run lint` and `npm run build`. The backend test suite could not complete because the local PostgreSQL test database rejected the configured credentials. See `FINAL_VERIFICATION_REPORT.md` for the overall release status.

Backend files changed: `xelvic/backend/apps/sparks/services.py`, `themes.py` and `tests.py`. The focused command attempted was `.\.venv\Scripts\python.exe manage.py test apps.sparks.tests`; PostgreSQL at `127.0.0.1:5432` rejected password authentication for `xellom` before tests could start. No migration was added and the purchase success response shape did not change.

## Follow-up parity and accessibility pass

| Finding | Change | Evidence / remaining verification |
| --- | --- | --- |
| Design, feature and parity documents still claimed the implemented theme shop was missing | Reconciled `DESIGN_PARITY_AUDIT.md`, `FEATURE_INVENTORY.md`, `MASTER_GOALS.md`, `SCREEN_BY_SCREEN_AUDIT.md` and related status text | Source/docs cross-check; live shop remains unverified |
| Shared signed-in shell lacked a skip link | Added a focus-revealed link to a focusable `main#main-content` in `src/app/AppShell.tsx` | Typecheck/lint pass; requires authenticated keyboard exercise |
| Player seek was a pointer-positioned button, not keyboard-operable | Replaced it with a labelled native range input in `src/components/PlayerBar.tsx` | Typecheck/lint pass; requires keyboard/touch playback exercise |
| Player did not expose browser/OS media transport | Added feature-detected Media Session metadata, playback state, position and supported play/pause/track/seek handlers in `src/providers/PlayerProvider.tsx` | Typecheck/lint pass; requires supported-device/browser verification |
| Reduced-motion and accessibility docs were stale | Recorded the existing global reduced-motion CSS rule and remaining unverified accessibility work | Source inspection only |
| Landing-page brand mark had nested links before this request | Earlier fix used `Wordmark` as the single link; that marketing page was subsequently removed as requested | No longer applicable to current routes |
| Root URL opened a marketing page instead of login | Root now renders `SignInPage`; `/signin` remains compatible, saved sessions restore before showing login, removed `LandingPage.tsx`, and removed the redundant “Back to landing page” link | Production browser at `/` rendered the QR sign-in page; production QR API request remains blocked by CORS |
| Public playlist brand link nested a `Wordmark` link | Replaced nested Wordmark with a single Xelvic text-and-mark link targeting `/` | Typecheck/lint/build pass; link behavior remains source-inspected |
| Goal and completion evidence was not consistently traceable | Added stable IDs and an honest partial/incomplete status to `MASTER_GOALS.md`, parity matrices, test matrix and final report | Counts are limited to enumerated records; they do not assert exhaustive APK/API coverage |

All edits in this follow-up pass were made inside `xelvic-web/`. Android and backend sources and API documents were not edited in this pass.

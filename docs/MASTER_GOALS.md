# Master goals

## What this project is

`xelvic-web/` is a standalone React web client for the Xelvic account system. It shares the Django API with the Android app but does not share code, layout or build tooling with the older `web/` directory.

The work is a parity exercise, not a redesign. The Android app, the APK assets and the Django source are the references. The web client may adapt gestures and layout to a browser, but it must not invent features, fake API data or silently drop a capability.

## Authoritative sources

| Source | Used for |
| --- | --- |
| `xelvic/app/lib/` | screen inventory, navigation, copy, interaction rules, local catalogues |
| `xelvic/backend/` | routes, serializers, response shapes, permissions, error codes |
| `backend-api/WEB-API.md` | documented web contracts and route index |
| `backend-api/WEB-HANDOVER.md` | product rules, limits and design decisions |
| `backend-api/WEB-LOGIN.md` | QR sign-in flow |
| `app-release-2.apk`, `apk_extract/` | shipped assets, theme covers, brand marks |
| `xelvic/themes/`, `xelvic/char/` | theme art and character assets |

When the local backend and the documentation disagree, the local source is treated as the stronger evidence and the disagreement is recorded.

## Non-negotiables

1. Only `xelvic-web/` may be modified.
2. No fabricated API responses, demo rows or optimistic state that survives a failed request.
3. Missing server capabilities are shown as missing, with a sentence a person can understand.
4. Branding is **Xelvic**. The older Xellom name is not used in new UI.
5. Tokens, passwords and media credentials are never logged or committed.
6. TypeScript stays strict; `noUnusedLocals` and `noUnusedParameters` are not relaxed to hide dead code.
7. A feature is only marked verified when it was exercised. Static inspection is recorded as inspection, not as a live test.
8. Native-only abilities are documented as limitations rather than imitated with misleading UI.

## Scope

### In scope

- Account restoration, QR sign-in and the development password door.
- The five mobile destinations: Drops, Moments, Convo, Audio, Live.
- Chat threads, messages, attachments, reactions, polls, flags and group basics.
- Profiles, social graph actions, search, alerts, saved drops, sparks and settings.
- Theme selection, light/dark/system mode and theme assets.
- Responsive desktop rail and mobile navigation.
- Honest loading, empty, error, offline and capability states.

### Explicitly out of scope for this release

- Native camera capture, address-book reading, push notifications and OS background audio services. Media Session transport controls are provided where supported by the browser.
- Website-side QR scanning. The phone scans the website's code.
- Audio/video calls, live WebRTC media and the call surfaces.
- Staff consoles, ML developer APIs, deals, circles, drip and catalogue products.
- Account creation, OTP and password reset. The documented product creates accounts on the phone.

## Definition of done

A screen is done when:

- it has a real route and is reachable from the shell;
- it reads and writes only documented or source-confirmed endpoints;
- loading, empty, error and unauthorised states are distinct;
- the interaction has a keyboard and touch path where the browser allows one;
- it compiles under strict TypeScript and passes ESLint;
- its remaining gaps are recorded in the parity matrix and final report.

The release is not "full parity" unless every Android screen is either implemented, explicitly out of scope, or recorded as a blocker. This build does not meet that bar yet; see `APK_PARITY_MATRIX.md`.

## Evidence standard

| Label | Meaning |
| --- | --- |
| Verified | Exercised against a running service or a deterministic local check |
| Inspected | Read from source and matched by code, but not executed |
| Implemented, unverified | Code exists and compiles; no live proof |
| Partial | Some interactions or states are present; named gaps remain |
| Missing | No web implementation |
| Native-only | Cannot be reproduced faithfully in a browser |
| Blocked | The environment prevents verification |

## Traceable requirement register

Statuses use the assignment vocabulary. `VERIFIED` is reserved for executed checks; source inspection and a successful build alone do not verify product behavior.

| Requirement ID | Requirement | Source / web surface | Test and evidence | Status | Remaining work |
| --- | --- | --- | --- | --- | --- |
| `APK-SCREEN-001` | Inventory shipped Android screens and entry paths | `xelvic/app/lib/`, APK extraction; route inventory in `SCREEN_BY_SCREEN_AUDIT.md` | Existing source-level route inventory; no complete navigation-graph/APK reconciliation in this pass | `PARTIALLY_IMPLEMENTED` | Reconcile the complete APK-backed screen inventory, including conditional and overlay screens |
| `AUTH-ENTRY-001` | Open sign-in directly at `/` while preserving session restore | `src/App.tsx`, `src/app/ProtectedRoute.tsx`, `src/pages/SignInPage.tsx` | Production browser confirmed `/` and `/signin` show the login screen; auth restore redirect is source/typecheck verified | `IMPLEMENTED_UNVERIFIED` | Exercise the saved-session redirect with an authenticated browser session |
| `API-FEATURE-001` | Verify authenticated API feature flows against the local contract | `xelvic/backend/`, `backend-api/`; mappings in `BACKEND_API_PARITY_MATRIX.md` | Static source/documentation review only; no successful authenticated backend request | `BLOCKED` | A permitted backend/test environment and disposable credentials are required |
| `DESIGN-001` | Match visual design and responsive behavior | APK resources; `DESIGN_PARITY_AUDIT.md` | Source review only; no APK screenshot comparison or viewport capture | `IMPLEMENTED_UNVERIFIED` | Compare relevant screens at mobile, tablet and desktop widths |
| `A11Y-SHELL-001` | Provide a keyboard skip link to signed-in main content | `src/app/AppShell.tsx` | Added focus-revealed link targeting the focusable shell `<main>`; no authenticated browser exercise | `IMPLEMENTED_UNVERIFIED` | Exercise with keyboard and assistive technology on the authenticated shell |
| `A11Y-MOTION-001` | Respect reduced-motion preference | `src/styles.css` | Existing `prefers-reduced-motion: reduce` rule inspected; no OS/browser preference exercise | `IMPLEMENTED_UNVERIFIED` | Exercise with reduced motion enabled and audit timed content behavior |
| `PLAYER-KEYBOARD-001` | Make player seeking operable by keyboard and touch | `src/components/PlayerBar.tsx` | Replaced pointer-only seek button with a labelled native range input; TypeScript and lint passed | `IMPLEMENTED_UNVERIFIED` | Exercise the control with keyboard and touch while audio is playing |
| `PLAYER-MEDIA-001` | Expose supported browser/OS media controls | `src/providers/PlayerProvider.tsx` | Added Media Session metadata, playback state, position and supported transport/seek actions; TypeScript and lint passed | `IMPLEMENTED_UNVERIFIED` | Verify on browsers/devices that implement Media Session |
| `TEST-001` | Preserve frontend regression checks | `xelvic-web` test scripts | `npm test`: 5 tests passed; `npm run typecheck` and `npm run lint` passed | `VERIFIED` | Add interaction tests for the new player and shell accessibility behavior |
| `SECURITY-001` | Keep this task's file edits inside `xelvic-web/` | Workspace boundary | All edits in this task were applied under `xelvic-web/`; scoped Git status reports the directory as untracked under the home-level Git root | `VERIFIED` | Git cannot distinguish project-local pre-existing work because `xelvic-web/` is untracked |

This register is a traceable subset of the work performed, not a claim that every APK screen, section, interaction or backend endpoint has been independently enumerated. The linked matrices retain broader source-level inventories and known gaps. Overall parity remains `INCOMPLETE`.

## Environment constraints

- No successful authenticated browser session or live backend was available for this pass.
- Integrated browser tooling is available, but no authenticated session or APK screenshot comparison harness/device lab is configured.
- Git resolves to `C:/Users/HP`; scoped status shows `xelvic-web/` as untracked, so Git cannot establish its prior local change baseline.
- `rg` is available for bounded source searches.
- Browser media controls depend on platform Media Session support; media streams are fetched as authenticated blobs by the client.
- Media elements cannot attach Bearer headers; authenticated media is fetched as a blob by the client.

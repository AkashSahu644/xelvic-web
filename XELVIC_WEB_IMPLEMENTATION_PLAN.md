# Xelvic Web Implementation Plan

Date: 2026-11-01
Scope: `xelvic-web/` only. Mobile (`xelvic/app`) and backend (`xelvic/backend`)
are read-only references and the shared source of truth.

## Constraints

1. All edits stay inside `xelvic-web/`.
2. Backend endpoints, models, migrations, settings and contracts are untouched.
3. Mobile source is untouched.
4. No fake data, no fabricated receipts, no dead buttons.
5. Working web code is improved, not rewritten wholesale.
6. Stack stays React 19 + TypeScript + Vite + Tailwind + TanStack Query.

## Baseline (measured 2026-11-01)

- `npm run typecheck` — pass.
- `npm test` — 24/24 pass at baseline; 29/29 pass after the Phase 4 work.
- Web: 20 pages, 83 files, ~31k lines.
- Mobile reference: 151 screens, 283 files, ~256k lines.
- Shared backend: 24 Django apps.

## Phase 0 — Discovery and audit (COMPLETE)

Deliverables in this repository:

- `XELVIC_MOBILE_FEATURE_INVENTORY.md`
- `XELVIC_FEATURE_PARITY_MATRIX.md`
- `XELVIC_API_COMPATIBILITY_REPORT.md`
- `XELVIC_WEB_IMPLEMENTATION_PLAN.md` (this file)
- `XELVIC_PROGRESS_TRACKER.md`
- `XELVIC_TESTING_REPORT.md`
- `XELVIC_FINAL_GAP_REPORT.md`

## Phase 1 — Foundation

| Goal | Work | Status |
| --- | --- | --- |
| 1.1 | Confirm design tokens and shared primitives | DONE (existing, verified) |
| 1.2 | Route protection + lazy loading | DONE (existing) |
| 1.3 | Central API client + refresh + errors | DONE (existing) |
| 1.4 | Conversation cache helpers (insert/patch/remove) | DONE |
| 1.5 | Optimistic message model (`pending`/`failed`) | DONE (goal 4.2) |

## Phase 2 — Authentication and profile

Existing QR sign-in, dev login, refresh, profile, privacy, devices are wired.
Remaining work (not blocking conversation):

- Account deactivation (`/auth/deactivate/`).
- Account switching (needs a second credential store; deferred).
- Language preference surface.

## Phase 3 — Feature parity (social, media, notifications)

Priority order after the conversation phase:

1. ~~Notification preferences surface~~ — done as Phase 6, below.
2. Message search (web surface for `/chat/search/`).
3. Group admin surfaces (members, invites, rooms).
4. Media upload progress + video poster.
5. Mentions, mutuals, crew read surfaces.
6. Deals / circles / collabs (large, separate modules). *The marketplace was in
   this group and is done — see Phase 5.*
7. Editors and studio tools (large; browser constraints).

## Phase 5 — The marketplace and the theme (done 2026-11-01)

The one page the app calls a marketplace, ported aisle by aisle, and the
requirement that goes with it: a theme must reach every screen, not just the
shell's five.

| Goal | Work | Status |
| --- | --- | --- |
| 5.1 | One page, three aisles, one purse, one Settings row | DONE |
| 5.2 | Drip aisle (`drip.dart`) | DONE |
| 5.3 | Themes aisle (`theme_shop_view.dart`) | DONE |
| 5.4 | Logos aisle (`logo_shop_view.dart`) | DONE |
| 5.5 | The preview moves the whole web, both readings | DONE |
| 5.6 | One `Backdrop` component for every ground | DONE |
| 5.7 | Fix the shell's backdrop stack position | DONE |
| 5.8 | The marketplace's own ground, as a pushed screen | DONE |
| 5.9 | The theme's picture inside a chat | DONE |
| 5.10 | The chat accent on an uncoloured convo | OPEN — see the gap report |

## Phase 6 — Notifications, to the app's own rules (done 2026-11-01)

Two surfaces, ported rather than redrawn, and one honest boundary.

| Goal | Work | Status |
| --- | --- | --- |
| 6.1 | The alert row, to `screens/alerts.dart`'s geometry and layers | DONE |
| 6.2 | The in-app strip, to `notices.dart` + `notice_banner.dart` | DONE |
| 6.3 | A hidden tab's row: the browser's own notification, with a click that opens the row's destination | DONE |
| 6.4 | One routing table for every surface (`alertPath`) | DONE |
| 6.5 | The sounds and the switch, with copy that says where the sound stops | DONE |
| 6.6 | A notification after the site is **closed** | BLOCKED — the server pushes only to FCM device tokens; this build has no Firebase config, VAPID key or service worker, and the backend is read-only |

What the strip is, in one paragraph: a `thread.update` frame's `notice` is
offered to `deliver`, which refuses it when notifications are off, when the
conversation is muted, when it is a typing note, when its ordinal has been seen,
or when it is the conversation on screen. Everything left is either a strip
(the tab is visible) or a row on the browser's notification surface (it is
not). `alert.new` is never a strip, because the phone does not draw one either.

## Moments — the story walk, ported from `MomentViewScreen` (done 2026-11-01)

The ask for this pass, verbatim: *"moments ko app ke according kijiye jaise
moments aap me work kar raha hai waise hi isme bhi karna chahiye exact."* The
reference is `app/lib/screens/moment_view.dart`, read line by line, with
`app/lib/moments.dart`, `app/lib/strings/en.dart` and
`backend/apps/moments/{urls,views,services}.py` beside it.

The method matters as much as the result: `MomentViewer.tsx` was **rewritten as
a port**, not adjusted. Every rule the phone's viewer keeps is either kept here
with the line that decides it, or named as a gap below.

| Goal | Work | Status |
| --- | --- | --- |
| M.1 | The 60ms clock and `MomentItem.hold` (clip window, sound window capped at `kSoundLongest`, a carried picture's life, `HOLD_FLOOR`) | DONE |
| M.2 | The gesture: 32%/68% tap split, hold-to-pause at `kHoldToPause`, hold-to-leave at `kHoldToPause + kHoldToLeave`, and the clock that runs down in `_carriedTo`'s words while it is held | DONE |
| M.3 | Swallowing the browser's post-hold `click`, which Flutter's gesture arena would have swallowed for us | DONE |
| M.4 | `_carried` in order (item vibe → `made_from.vibe` → `made_from.drop` → sound → `source_id`) and `_carriedTo`'s four sentences | DONE |
| M.5 | Opening what is carried: the Vibes shelf at that clip, the drop, the Audio section, and a pushed walk over a `source_id` moment | DONE |
| M.6 | `_ownOrder`: my own walk opens on my last day, days reversed and items not | DONE |
| M.7 | Marking watched: per item as it comes up, and the day on its last item | DONE |
| M.8 | The heart (`kStoryLike`) and the faces (`kStoryFaces`), drawn from the server's answer | DONE |
| M.9 | The answers tally and the who sheet (viewers / reactors / voters, read when opened), drawn on my own day only | DONE |
| M.10 | Reply into a convo, holding the clock while the field is focused | DONE |
| M.11 | Share: the gate question, then the picker, one convo at a time, the true count reported | DONE |
| M.12 | Take down behind its confirm, and the three dots that hold only "Add to Memories" | DONE |
| M.13 | `/app/moments?memories=1` — a route parameter nothing read, so "New Memory" on my own profile was a dead button | DONE (fixed) |
| M.14 | `MomentStage`'s own metrics (`kNoteColumn`/`kNoteMargin`, `kSongCoverGap`/`kSongCoverMargin`, the `_overMedia` shadow) | DONE |
| M.15 | Carry: the app opens the picture in its Image editor first | PARTIALLY COMPLETE — the web's `CameraCapture` has no seed-with-an-existing-file door, so a carry lands unedited |
| M.16 | The Memory walk (`isMemory`): a Memory's own header words, `memories/{id}/react\|reply\|share/`, Remove in place of Take down | MISSING — deliberately not ported; `MomentViewer` is built for moments |
| M.17 | Together mode and stickers/drawings | MISSING |

Also removed in this pass, and recorded rather than hidden: the web had a
composite moment it called the **Morning Question**, built around a `prompt`
field that exists on neither `MomentSerializer` nor the app's model. It was
fabricated, so it is gone, and the field was struck from `src/types/api.ts` so a
build cannot type against it again. See `XELVIC_MOBILE_FEATURE_INVENTORY.md`.

Code status: M.1–M.14 pass typecheck, lint, unit tests and a production build.
Runtime behaviour against a live backend is **NOT VERIFIED**; M.15–M.17 are
named in `XELVIC_FINAL_GAP_REPORT.md`.

## Phase 4 — Conversation system (highest priority)

Goals and statuses:

| Goal | Work | Status |
| --- | --- | --- |
| 4.1 | Conversation architecture audit | DONE |
| 4.2 | Optimistic send + reconciliation via `client_id` | DONE |
| 4.3 | Honest receipts from `thread.status` / member watermarks | DONE |
| 4.4 | Fix Spark view-once endpoint (`open-once/`) | DONE |
| 4.5 | Forward messages (`/forward/`) | DONE |
| 4.6 | Group message info (`/info/`) | DONE |
| 4.7 | Live thread-card patch from `thread.update` + reorder | DONE |
| 4.8 | Conversation list preview + unread badge correctness | DONE |
| 4.9 | Composer polish (draft restore, emoji, attach menu) | DONE |
| 4.10 | Scroll/pagination verification | VERIFIED (static) |
| 4.11 | Message search surface | DONE (`/chat/search/` inside Convo search) |
| 4.12 | Offline outbox / durable sync replay | NOT STARTED (needs design) |
| 4.13 | Calls (WebRTC) | BLOCKED (separate product) |

Phase 4 code status: goals 4.1–4.11 are implemented and pass typecheck, lint,
unit tests and a production build. Runtime behaviour against a live backend and
a second authenticated device is **NOT VERIFIED** in this environment (see
`XELVIC_TESTING_REPORT.md`).

### Second pass — Spark lifecycle and chat-screen fidelity

The first pass still treated a Spark as a message kind and remembered opened
state in the browser. The backend does neither, so that path is replaced:

- Detection reads `payload.view_once`; opened reads `payload.opened_at`.
- Send goes through the app's camera/editor (`ChatPage` attach menu → "Spark")
  and posts `kind: image|video` with `payload: {view_once: true}` — the
  invalid `kind: "spark"` is gone.
- The viewer loads the media bytes first, then spends the look with
  `POST .../open-once/`; it walks the run of unopened incoming Sparks in
  ordinal order, closes on the last tap, and can reply.
- The app's exact Spark strings and dimensions are used for the recipient
  tile, the sent/opened/gone pill, and the server-driven screenshot line.

Chat-screen fidelity was brought to the app's spec: no clock above text
bubbles, day pills, 4/10/2 run gaps, group sender at run head, receipt under
every own bubble, edited marker inside cards, app bubble and composer
dimensions, and a heading with only name/face/verified tick.

## Phase 5 — Cross-device synchronization

Mechanism (verified against backend):

- Both clients share `api.xelvic.com` and the same JWT identities.
- Realtime is `wss://<api>/ws/?token=`; per-thread `subscribe` joins the group.
- `message.new` arrives for mobile-originated sends and is inserted once by id.
- `thread.update` carries unread + preview and is patched into the list.
- Receipts arrive as `thread.read`; presence as `presence`.
- Where no socket event exists, TanStack Query invalidation is the fallback.

Status: **implemented at the code level; live cross-device run unverified**
(no second authenticated device/backend in this environment).

## Phase 6 — Web-native UX

- Two-pane conversation layout already exists (desktop sidebar + pane).
- Responsive behaviour: sidebar collapses under `:threadId` on small screens.
- Remaining: keyboard shortcuts, composer focus retention, touch target audit.

## Phase 7 — API/state audit

Performed in `XELVIC_API_COMPATIBILITY_REPORT.md`. Mismatches fixed:
view-once path, preview rendering, receipt honesty, live card patching, direct
chat creation documentation.

## Phase 8 — Performance and security

- Deduplicate messages by id; sort by `ordinal`.
- Avoid list refetch on each `thread.update` (patch instead).
- No tokens logged; media fetched with auth helper; no `dangerouslySetInnerHTML`.
- Upload progress is measured from `XMLHttpRequest.upload` in `upload.ts` and
  painted on the optimistic bubble (`Uploading n%`).
- Remaining: virtualisation for very long histories.

## Phase 9 — Testing

Static: typecheck, lint, unit tests, production build.
Runtime: blocked by missing live backend/device credentials; documented in
`XELVIC_TESTING_REPORT.md`.

## Execution order from here

1. ~~Land the Phase 4 fixes (4.2–4.11) with typecheck/lint/test/build.~~ DONE.
2. ~~Message search + upload progress.~~ DONE.
3. ~~The marketplace and the theme (Phase 5, the second one).~~ DONE.
4. ~~Notifications to the app's own rules (Phase 6, the second one).~~ DONE.
5. ~~Moments: the story walk, ported from `MomentViewScreen`.~~ DONE, with M.15–M.17 named as gaps rather than claimed.
6. Group admin surfaces.
7. The Memory walk (`isMemory`) and together mode — the two named Moments gaps.
8. Remaining parity modules in the order above.
9. Keep the tracker and gap report current after every goal.
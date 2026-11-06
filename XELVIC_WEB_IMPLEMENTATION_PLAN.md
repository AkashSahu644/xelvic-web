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
- Web: 25 page files in `src/pages`, 191 `.ts`/`.tsx` files, ~61k lines
  (recounted 2026-11-01; the earlier 20 / 83 / ~31k figures were a stale
  baseline from before that day's passes).
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
| M.15 | Carry: the app opens the picture in its Image editor first | DONE (NOT VERIFIED live) — a carry with a picture opens `PhotoEditor` seeded with the carried bytes and posts the composed file with `source`; a clip, a note or a Vibe carries straight through `carry/`. `links` and `tags` do not ride across |
| M.16 | The Memory walk (`isMemory`): a Memory's own header words, `memories/{id}/react\|reply\|share/`, Remove in place of Take down | DONE (NOT VERIFIED live) — `MomentViewer` branches on `isMemory`, and the shelf, the Alerts row and the Moments page all open it through one `memoryAsMoment` |
| M.16a | Managing a Memory from the shelf — `manageMemory`'s four rows | DONE (NOT VERIFIED live) — long press on my own card: Add more to it, Rename, Change the cover, Remove |
| M.16b | A Memory named in an alert | DONE (NOT VERIFIED live) — `alertPath` → `/app/moments?memory=<id>`, opened out of `moments/memories/` |
| M.17 | Together mode and stickers/drawings | **not a feature** — `moment_view.dart` has neither, and `grep -rn "together\|Together\|watch party" app/lib` finds nothing. The editor's own stickers/drawings are `PhotoEditor`'s and were already there |
| M.18 | The live ring on a face (`Moments._rings` / `hasRing`) | DONE (NOT VERIFIED live) — `useLiveRings()`; `DropCard` and search's `PersonRow` wear it |

Also removed in this pass, and recorded rather than hidden: the web had a
composite moment it called the **Morning Question**, built around a `prompt`
field that exists on neither `MomentSerializer` nor the app's model. It was
fabricated, so it is gone, and the field was struck from `src/types/api.ts` so a
build cannot type against it again. See `XELVIC_MOBILE_FEATURE_INVENTORY.md`.

Code status: M.1–M.18 pass typecheck, lint, unit tests and a production build.
Nothing in that list has been run against a live backend; see
`XELVIC_TESTING_REPORT.md` §11a.
Runtime behaviour against a live backend is **NOT VERIFIED**; M.15–M.17 are
named in `XELVIC_FINAL_GAP_REPORT.md`.

## Circles — the section, the picker and the circle page (done 2026-11-01)

The ask: the app's Moments page has a Circles section with "Pick your
interests"; the web had none. The reference is `app/lib/screens/circles.dart`
(`CircleSection`, `CircleScreen`, `CirclePickerScreen`) and `app/lib/circles.dart`,
with `backend/apps/circles/{urls,views,serializers,services}.py` and
`apps/drops/views.py:write_fields` beside them.

| Goal | Work | Status |
| --- | --- | --- |
| C.1 | The section under the rail on `/app/moments` | DONE (NOT VERIFIED live) — `features/circles/CirclesSection.tsx`; header, empty card that is the picker, cards, "N more interests this month" |
| C.2 | A circle card | DONE — field glyph, `field · COUNTRY`, seats, flame, chevron, task line, status, post button, top three takes, "See all N takes" |
| C.3 | The picker ("Your interests", "Choose up to {n}") | DONE (NOT VERIFIED live) — read fresh each open; a pick lands in the circle it made |
| C.4 | One circle's page | DONE (NOT VERIFIED live) — `/app/circles/:circleId`: faces, task card, "Today's board", numbered `DropCard(read: false)` |
| C.5 | Posting a take | DONE (NOT VERIFIED live) — the shared `DropComposer` with `circle` set; posting goes through `POST /circles/{id}/`, which runs the same `write_fields` as a drop |
| C.6 | The window, drawn honestly | DONE — a sealed day's `task` is null and the section draws the hour; `open` is read together with `opens_in` so "not yet" and "over" are not the same sentence |
| C.7 | Four routes, none invented | DONE — `circles.service.ts`: `fields/`, `pick/`, `mine/`, `<id>/` (GET + POST), tabulated in `XELVIC_API_COMPATIBILITY_REPORT.md` |

Note about the source, recorded so it is not mistaken for parity: the phone's
Moments page now mounts `LiveNow` where the section used to sit
(`app/lib/screens/moments.dart:629`, commit `f4f7ffb7`, 2026-10-31). The section
and both of its screens are still shipped, and this port follows that shipped
source. Since the Audio and Live pass below, the web mounts the app's `LiveNow`
strip under the rail and keeps this section beneath it.

Code status: passes typecheck, lint, unit tests and a production build. Nothing
here has been run against a live backend.

## Audio and Live — to the app's shape (done 2026-11-01)

Sources read, not modified: `app/lib/screens/audio.dart`, `audio_bits.dart`,
`audio_studio.dart`, `live_now.dart`, `room.dart`, `room_bits.dart`;
`backend/apps/audio/{urls,views,studio}.py` and `apps/spaces/` for the contract.

| Goal | Work | Status |
| --- | --- | --- |
| A.1 | The Audio tab's doors: category chips open their own page, the board strip opens the chart, "Audio drops" reads the reco feed | DONE (NOT VERIFIED live) — `audio/board`, `audio/c/:key`, `/audio/feed/` |
| A.2 | A category's page | DONE (NOT VERIFIED live) — `AudioCategoryPage`, `GET /audio/categories/<key>/` |
| A.3 | The weekly board | DONE (NOT VERIFIED live) — `AudioBoardPage`, `GET /audio/board/`, `weekSpan`, the server's order |
| A.4 | The studio | DONE (NOT VERIFIED live) — `AudioStudioPage`, `GET /audio/studio/`; one's own only; unmeasured numbers say so |
| A.5 | One studio item and its audience | DONE (NOT VERIFIED live) — `AudioStudioDetailPage`: lifetime sums, the trend read (no band/score when `score` is null), rates ("Not measured"), components, audience bars, used-by, this week, false rights |
| A.6 | Every row's heart, drops included | DONE — a drop is felt at `/drops/{id}/like/`, a catalogue track at `/audio/tracks/{id}/like/` |
| A.7 | The app's downloads door | NOT IMPLEMENTED — a browser has no kept-tracks store here; named on the page |
| A.8 | The full-screen swipe deck | NOT IMPLEMENTED — the reco strip plays; the deck was not ported |
| L.1 | The app's Live surface — the "Live now" strip under the Moments rail | DONE (NOT VERIFIED live) — `LiveNow`, `?shelf=kept`, socket-refreshed, always drawn |
| L.2 | One create sheet for both doors | DONE — `OpenRoomSheet` (kind, name, note, tags, start) |
| L.3 | The shelf card's words | DONE — `crowdLine(room)` replaces a bare listener count |
| L.4 | The room's head | DONE — cover, "{host} · {crowd}", "Over" / start time / LIVE |
| L.5 | The three dots | DONE (NOT VERIFIED live) — Start now / Share the room / Report the room / Close the room / Leave quietly, the app's conditions |
| L.6 | Share the room, inside and out | DONE — convos first, "Share outside" with the clipboard fallback and the app's own sentence |
| L.7 | Report a room | DONE (NOT VERIFIED live) — `ReportSheet kind="room"`, reasons from the server |
| L.8 | Scheduled and closed words | DONE — the app's announcement lines and "Close the room?" |
| L.9 | Room sound | NOT IMPLEMENTED — the app's stage audio is a WebRTC mesh over `call.signal`; the web has had a client for that relay since the calls (2026-11-06) but the room page is not wired to it, and the page says so |

Deliberate difference, recorded: the web keeps `CirclesSection` below the strip,
because the app reaches circles from their own shelf and the web has none.

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
| 4.8 | Conversation list: the line under a name, the count and the row's marks, to the app's grammar | DONE (rebuilt 2026-11-03) |
| 4.9 | Composer polish (draft restore, emoji, attach menu) | DONE |
| 4.10 | Scroll/pagination verification | VERIFIED (static) |
| 4.11 | Message search surface | DONE (`/chat/search/` inside Convo search) |
| 4.12 | Offline outbox / durable sync replay | NOT STARTED (needs design) |
| 4.13 | The Spark sheet's "Add to Moments" — the card painter and the composer behind it | DONE 2026-11-04; sound row DONE 2026-11-05 (nothing posted live) |
| 4.14 | Calls — audio and video over the app's own relay | DONE 2026-11-06 (**NOT VERIFIED** — no live backend, no second device, no devices here) |

Phase 4 code status: goals 4.1–4.14 are implemented and pass typecheck, lint,
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

### Third pass — the list's own grammar, and the Spark a row opens (2026-11-03)

Goal 4.8 was marked done on the strength of a real preview and a numeric badge;
both were the web's own answers rather than the app's, and three defects were
reported against them. What changed:

- **The line under a name** is `listLine`, the phone's rule: `Say something`,
  my own receipt word, `N new`, `Nothing new` — and never the message.
- **The count** is `N new` under the name, plus a plate at the end of a group's
  name; the accent circle at the far right of every row is gone.
- **The spark's tap** opens a sheet about that run (`SparkSheet`, a port of
  `screens/spark.dart`) instead of navigating to the sparks wallet page.
- **The Unread lane** reads `unread_other_count`, so a convo whose only waiting
  line is a Spark stays off it.
- **The marks row** gained the pin and the birthday cake, and the phone's gaps.

Still outside: the row's play button (see `XELVIC_FINAL_GAP_REPORT.md`) and a
live run of any of it. The sheet's "Add to Moments" pill was outside then too,
and was closed in the fourth pass below.

### Fourth pass — the Spark card, and "Add to Moments" (2026-11-04)

The sheet's last pill was the one part of `screens/spark.dart` deliberately left
undrawn, because there was no composer behind it. There is now:

- **`SparkSheet`** draws the phone's `_comingUp()` row — the next rung's sentence
  and the stadium "Add to Moments" pill beside it — on every run the sheet can
  draw, including a broken one, as the phone does.
- **`features/sparks/card.ts`** is the port of `spark_moment.dart`'s painter: a
  1080×1920 picture of one run, the card 840×1520 inside the band a phone's crop
  leaves, paper from the award, fixed ink, the flame, the two curves with their
  chat and call marks, both faces, the ring, the award's name, the days, the rule
  and the closing line. The glyphs are `lucide-react`'s path data, so the picture
  keeps the client's own icon language; a face is drawn only from the media cache
  or a local blob, else initials, because a tainted canvas loses the whole card.
- **`features/sparks/SparkMoment.tsx`** is the phone's page: the card at post
  size (what is drawn *is* the file that uploads — painted once per opening, as
  the phone paints in `initState`), the audience pill, the mention switch, and
  one button — `uploadAsset` → `POST /moments/`, with the success line said only
  after the server takes it. It is a lazy chunk.
- **Fixed in the same pass, after the first opening of the page:** the painter
  was ported without the bound the phone puts on it — `spark_moment.dart` reads
  both faces through `Faces.keep`, whose `patience` is fifteen seconds, and the
  port awaited them for ever, so a media read that went quiet without closing
  left the modal on a spinner and the Share button dead. `FACE_PATIENCE_MS`,
  `FONT_PATIENCE_MS` and `within()` in `features/sparks/card.ts` are that bound,
  in the phone's own numbers, measured in a browser on 2026-11-04.
- **Fixed in the pass after that, when the page said it could not draw the
  card:** the taint the bullet above only warns about is what a public avatar
  does. `mediaCache.loadMedia` returns a non-API address untouched, so a CDN
  avatar arrives as an `https://…` URL and drawing it plainly poisons the canvas;
  `toBlob` then throws `SecurityError`. `faceImage` asks with
  `crossOrigin="anonymous"`, a name that is not a string and a `drawImage` that
  throws both fall back to the initials plate, and a whole failed paint is
  retried once with no pictures before the page is told. The page also prints
  the reason under the sentence on a dev build.
- **Not done:** a live posting run, with or without a sound. Named on the parity
  matrix.
- **Added 2026-11-05 — the phone's sound row.** `features/audio/` now holds the
  one implementation of "which sound, and which part of it": `SoundPicker` (the
  three shelves and search — the sheet the composer's audio tool already opened),
  `PartChooser` (the drag surface), `audioWindow.ts` (how long a part a post
  needs), `soundBits`, `preview.ts` and the moved `audioShelf`/`partLength`.
  `PhotoEditor` imports them back, and `SparkMoment` now draws `_soundRow()`:
  "Add audio", then the sound's name, its window as `soundWindowLabel`, "Choose a
  part" and an ✕. A card is one picture, so the part offered is the one-picture
  thirty seconds. What goes up is `sound`/`sound_start_ms`/`sound_end_ms` on the
  moment item, all three of which `PostItemSerializer` has accepted since before
  the page existed. **Not looked at in a browser, and not posted live.**
- **Added 2026-11-05 — four further card looks.** `SPARK_CARD_STYLES` is
  `["classic", "midnight", "sunset", "aurora", "noir"]`, chosen uniformly at
  random per card. The four after `classic` are the composition of a four-card
  design sheet: the classic skeleton underneath (both faces, the glyph, the
  award's name, the days, the closing line, all at the same coordinates), a
  violet pill behind the days and behind the closing line, and one motif per
  look drawn flat under the card's clip. The first ornaments were invented rather
  than read and did not match the sheet; they were **rebuilt on 2026-11-05**
  against measurements of it — a near-white field of `#F8F5FE` with the award's
  tone collecting at the two edges, an opaque motif in a stepped halo (a planet
  on an orbit with a rocket for `sunset`, a moon with a climbing rocket, stars
  and cloud for `midnight`, a segmented ring with four icon buttons for
  `aurora`, a stack of three tilted slabs over a contour bed for `noir`), and a
  foot of tone that climbs the two edges and dips through the middle. No
  gradients anywhere, per the house rule: stacks of flat shapes a step of alpha
  apart, never `createRadialGradient` — so the sheet's glow is approximated, not
  reproduced. `classic` is untouched and its fill list is pinned by a test, which
  caught the one regression that reached it. This is **beyond parity** — the
  phone has one card and these four exist only here — and `NOT VERIFIED`: they
  have been rasterised in headless Chrome and measured, never seen. Full detail
  in `XELVIC_PROGRESS_TRACKER.md` and `XELVIC_TESTING_REPORT.md` (**The four card
  looks, rebuilt**).

## Calls — audio and video over the app's own relay (done 2026-11-06)

Asked for as "jaise app me audio aur video call chal rha hai waise hi isme bhi".
The app's contract was followed rather than reinvented, because a call is the one
feature where being nearly the same as the phone means two handsets that never
connect.

Sources read, not modified: `app/lib/calls.dart` (the state machine),
`app/lib/screens/call.dart` and its neighbours, `app/lib/call_platform.dart`;
`backend/apps/calls/{urls,views,services}.py`, `apps/chat/consumers.py` (the
`call.*` branches), `apps/chat/events.py` (`CALL_*`).

| Goal | Work | Status |
| --- | --- | --- |
| C.1 | The signalling client — ring, accept, decline, leave, video, signal, pending, on the app's one authenticated socket | DONE (NOT VERIFIED live) — `src/features/calls/engine.ts` |
| C.2 | Peer connections — `GET /calls/ice/` into `RTCPeerConnection`, who offers, the collision rule, the candidate queue, the re-offer after a camera | DONE (NOT VERIFIED — no connection has ever been made) |
| C.3 | The screen — full-window overlay, the video grid with a mirrored self-view, the audio stage, the clock, mute / camera / hang up | DONE (NOT VERIFIED — never rendered) |
| C.4 | The two doors — the convo row's phone and video buttons, and a call-back from a history row | DONE (NOT VERIFIED live) |
| C.5 | Accepting a ring is the one thing that cannot wait for a page | DONE — `CallProvider` sits above the router, so a ring draws wherever the person is |
| C.6 | Media a browser refuses | DONE — the refusal is the app's own sentence, drawn in amber, and the call is carried rather than dropped |
| C.7 | Ringtone, vibration, wake lock, earpiece/speaker routing, camera flip | NOT IMPLEMENTED — the browser has no equivalent of `call_platform.dart`'s half, and none of it is faked |
| C.8 | `call.add` — starting or growing a group call from the web | NOT IMPLEMENTED — a group call can be drawn as its frames arrive, but nothing here starts one or adds a third person |
| C.9 | Removing a call from the history | NOT IMPLEMENTED — `DELETE /calls/<id>/` is unused; the row has no remove |

Deliberate differences, recorded: the phone's ring is answered from a banner and
a notification, and the web has neither — a ring draws as the overlay itself. The
phone routes audio to an earpiece and locks the screen awake; a browser does
neither, and nothing here claims it does.

**Nothing about a call is verified.** No connection was ever made, no microphone
or camera was ever opened, no live backend answered, and there was no second
device. The state machine and its arithmetic are covered by 42 unit tests (see
`XELVIC_TESTING_REPORT.md`, **The calls — 2026-11-06**); the connections are
covered by nothing. The parity matrix carries this as `PARTIALLY COMPLETE (NOT
VERIFIED)`.

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
- Upload progress now comes from axios `onUploadProgress` in
  `src/services/upload.service.ts` and is painted on the optimistic bubble
  (`Uploading n%`).
- Remaining: virtualisation for very long histories.

## Phase 9 — Testing

Static: typecheck, lint, unit tests, production build.
Runtime: blocked by missing live backend/device credentials; documented in
`XELVIC_TESTING_REPORT.md`.

## Phase 10 — Transport (done 2026-11-01)

The whole app was moved onto one HTTP client, in the shape the reference web
project uses: a config layer plus one service module per domain.

```
src/config/env.ts      addresses, timeouts, app name
src/config/urls.ts     absolute/relative media and API URL helpers
src/config/axios.ts    the single instance: bearer, refresh-once, ApiError
src/services/*.ts      21 domains, 202 methods, index.ts barrel
```

Rules this phase fixes in place:

- A screen never imports `axios`. It calls `someService.method()`.
- A service method is `async`, takes the arguments the screen already had, and
  returns `response.data` unreshaped. It never invents a value.
- A third-party host (geocoding, a public avatar) is dialled with bare `axios`,
  never the shared instance, so the account's bearer token cannot leave for
  another origin.
- Failures still reach the call site as `ApiError`; there is no global error
  toast, so no screen can show a fake success.

`src/lib/api.ts` and `src/lib/env.ts` are deleted. The completeness proof and
the two wire-level differences this introduces are in §12 of
`XELVIC_TESTING_REPORT.md`.

## Execution order from here

1. ~~Land the Phase 4 fixes (4.2–4.11) with typecheck/lint/test/build.~~ DONE.
2. ~~Message search + upload progress.~~ DONE.
3. ~~The marketplace and the theme (Phase 5, the second one).~~ DONE.
4. ~~Notifications to the app's own rules (Phase 6, the second one).~~ DONE.
5. ~~Moments: the story walk, ported from `MomentViewScreen`.~~ DONE, with M.15–M.17 named as gaps rather than claimed.
6. ~~Transport: every request on axios, through `src/services/`.~~ DONE (Phase 10).
7. ~~The Moments follow-through: the Memory walk, managing a Memory, a Memory out of Alerts, carry-with-edit, the live ring.~~ DONE (M.15–M.18), all NOT VERIFIED live.
8. Group admin surfaces.
9. Remaining parity modules in the order above.
10. Keep the tracker and gap report current after every goal.

## Round 18 — the ring, the notice, the camera, the layout, and a room's sound (2026-11-06)

The round that finished the six things the calls pass left out or left blunt. It
touches no backend and, like the calls, is `PARTIALLY COMPLETE (NOT VERIFIED)`
throughout — nothing here was exercised against a live backend, a second device, a
microphone, a camera or a real notification surface.

| Goal | Work | Status |
| --- | --- | --- |
| R.1 | A ringtone for incoming and outgoing calls — the app's own recording with a written tone behind it — plus vibration | DONE (NOT VERIFIED) — `src/features/calls/ring.ts`, 22 cases |
| R.2 | A call notice on the browser's notification surface, with Decline and Accept, fed back into the engine | DONE (NOT VERIFIED) — `src/features/calls/notice.ts`, `public/call-sw.js`, 8 cases |
| R.3 | Camera quality — 1080p at 30 fps with a floor, `maintain-resolution`, a bitrate from the picture, `contentHint`, a device list, and a `getStats` pill | DONE (NOT VERIFIED) — `src/features/calls/quality.ts`, 30 cases |
| R.4 | The call layout for a phone and a laptop — fit/fill, spotlight and grid, a draggable clamped self-view, fullscreen | DONE (NOT VERIFIED — never rendered) — `src/features/calls/CallOverlay.tsx` |
| R.5 | A room's sound, over the same relay an ordinary call uses | DONE (NOT VERIFIED — no connection has ever been made) — `src/features/rooms/`, `src/features/media/surfaces.tsx`, `CallEngine.ignoreCall` |
| R.6 | A listener past the relay's limit is named plainly rather than silently dropped | DONE — `RoomSoundView.tsx` says so, against `MEDIA_LISTENERS` |
| R.7 | The picture lifted into the browser's own corner window, and a room that the browser refuses to play saying so instead of claiming to be heard | DONE (NOT VERIFIED) — `requestPictureInPicture` in `CallOverlay.tsx`; the blocked-playback press in `RoomSoundView.tsx` and `features/media/surfaces.tsx` |

Two of the calls section's named gaps move. **C.7** is now partly done: ringtone,
vibration and camera flip are here; earpiece/speaker routing and the screen-awake
lock stay not implemented, because a browser offers neither. And **room sound**,
which the calls pass left out, is now wired over the same relay — no new endpoint,
the stage being a `calls.Call` on the server.

**Nothing about it is verified.** No connection was ever made, no microphone or
camera was ever opened, no notification was ever shown, and there was no second
device. The new arithmetic — the ring's tones, the notice's one-post-per-call rule,
the quality helper's bitrate and constraint building, the mesh's `whoOffers` and
`readSignal` — is covered by unit tests; everything that needs a browser is covered
by nothing. See `XELVIC_TESTING_REPORT.md`, **Round 18**.

## Round 19 — the mirror, the cards that fit, and Vibes in the feed (2026-11-06)

The round that answers three of the owner's own reports: the picture that was
mirrored when the phone would not mirror it, the card that asked for a box taller
than the screen, and a feed with no Vibe in it. The first two are complete as code
and `NOT VERIFIED`; the weave is complete as code and `NOT VERIFIED live`; and the
round's own limits — a Vibe still plays only its first clip, there is no Vibe
editor here, play counts never move and there is no own-posts shelf — are named
`NOT IMPLEMENTED` rather than left implicit.

| Goal | Work | Status |
| --- | --- | --- |
| R.8 | A mirror control for the picture, on a call and on a room's stage, following the phone's rule that only the front lens is mirrored | DONE (NOT VERIFIED) — `features/calls/engine.ts` (`Facing`, `mirrored`, `readFacing`), `CallOverlay.tsx`, `features/rooms/{stage,useRoomStage,RoomSoundView}`, `RoomPage.tsx`. **Turned round in Round 20**: see R.16 |
| R.9 | A card's picture kept inside the screen — a clip capped at `62dvh`, a still or a gallery narrowed to answer the same ceiling, from the phone's own `tallClipShare` / `0.78` | DONE (NOT VERIFIED) — `features/drops/DropCard.tsx`'s `frameBox`, `SensitiveVeil.tsx`'s `max-h-[78dvh]` |
| R.10 | A walk that no longer puts its caption and its player panel under a phone's bottom bar | DONE (NOT VERIFIED — reasoned, medium confidence) — `VibeViewer.tsx` became `fixed inset-x-0 top-0 h-[100dvh]`; `styles/index.css` moved `body` to `100dvh` and added `overflow-x: clip`; `PollBlock.tsx` gained `break-words` |
| R.11 | Vibes woven into the feed the way the phone's `mixedFeed` weaves them, from the server's `vibe_share` | DONE (NOT VERIFIED live) — `features/drops/mix.ts`, `mix.test.ts` (13 cases), `pages/DropsPage.tsx`, `types/api.ts`'s `Page<T>` |
| R.12 | The rail of Vibes above the feed, in `shelfOrder` less the clips the feed below already draws, capped at ten | DONE (NOT VERIFIED live) — `DropsPage.tsx`, `RAIL_CLIPS = 10` |
| R.13 | A clip in the feed drawn as a card whose single press opens the walk — a Vibe or a plain video, as the app opens both — without breaking the double-press that feels the post | DONE (NOT VERIFIED) — `DropCard.tsx`'s optional `onOpen`, waiting out the 220 ms window; `model.ts`'s `dropIsClip` and `mix.ts`'s `walkOf` decide it and where the walk starts |
| R.14 | A `?edit=<id>` deep link reading the drop route first and the Vibe route second, because a URL carries an id and not the table it lives in | DONE (NOT VERIFIED) — `EditDrop.tsx` |
| R.15 | A play signal, a Vibe editor, `category` / `interests`, and an own-posts shelf | NOT IMPLEMENTED — `POST /drops/<id>/play/` is uncalled, the composer never sends `recipe` / `category` / `interests` / `track_id`, and `GET /drops/mine/` and `GET /drops/interests/` are unused |

R.8–R.14 answer the owner's three reports and the omission the phone's `mixedFeed`
had exposed; none of them moves a gap the calls left open. R.15 is deliberately one
line of `NOT IMPLEMENTED` rather than several claims: the round wove the Vibes into
the feed but did not build the editor behind them, and a Vibe still plays as its
first clip alone because its `recipe` and `clip_urls` are read by nothing here.

**Nothing about it is verified.** No device and no browser run was made and no live
server was reached, so the mirror rule, the heights, the strip and the walk's door
are all unexercised where it counts. The mix's arithmetic is covered by the phone's
own cases carried over into `mix.test.ts`, the clip rule by `model.test.ts` and the
card's box by `frame.test.ts`, and the whole suite is
307 tests across 26 files with `npm run typecheck`, `npm run lint` and
`npm run build` all passing when the round closed (310 after Round 20). See
`XELVIC_TESTING_REPORT.md`, **Round 19**.

## Round 20 — the Mirror button, turned round (2026-11-06)

The round that answers the owner's next report, and reverses half of R.8: *"jo video
call me mirror par click karne par jo flip ho raha hai wo mere video card me raha
hai jabki reciever user video card me hona chahiye"*. Round 19's button overruled the
self-view's lens rule, so the one picture that was already right turned over. Asked
which picture it should turn, the owner chose the picture **arriving** — the other
person's — with the self-view left on the phone's own rule.

| Goal | Work | Status |
| --- | --- | --- |
| R.16 | The Mirror button turning the pictures **arriving** rather than this tab's own, with the self-view following the lens and nothing else | DONE (NOT VERIFIED) — `features/calls/engine.ts` (`remoteMirrored`, `toggleRemoteMirror()`, `mirrored()` reduced to `facing !== "environment"`), `CallOverlay.tsx` (`RemoteTile`'s `mirror?` at the grid, the spotlight and the rail; the pill on `call.remoteMirrored`), `features/rooms/{stage,useRoomStage,RoomSoundView}`, `RoomPage.tsx`, three cases in `engine.test.ts` |
| R.17 | A per-stream word for camera-versus-screen, so a remotely shared screen is not turned over with the cameras | NOT IMPLEMENTED — a call frame carries no such word, so `toggleRemoteMirror()` flips whatever is arriving and this is named rather than guessed |

R.16 is complete as code and `NOT VERIFIED`: a mirror is a display and not a
transmission (`VideoSurface`'s `-scale-x-100`, no track transformed), so it takes two
ends on a real call to be *seen*, and none was available. It is also a deliberate
divergence from the phone, which has no Mirror button at all. Two consequences are
named rather than left to be found: a webcam reporting no `facingMode` is now drawn
mirrored with no way to change it, and a remotely shared screen is flipped too.
See `XELVIC_TESTING_REPORT.md`, **Round 20**.

## Round 21 — a shared screen shown whole, and a call that can be put aside (2026-11-06)

Two more of the owner's own reports, and both faults lived in the same file for
different reasons: *"main screen laptop me share kar raha hu aur koi apne mobile me
dekh raha hai to pura screen nahi dikh raha hai use kewal beech ka dikh raha hai,
aur video call karne par main video hata kar chat par aa raha hu aur call chal hi
rahi hai to phir main video call par nahi aa raha pa raha hu"*. The crop was a
viewer's own **Fill** surviving into every later call; the missing way back was a
`fixed inset-0` overlay with nothing above it to press.

| Goal | Work | Status |
| --- | --- | --- |
| R.18 | The view choices — Fit/Fill, the layout and the focused seat — reset when a call ends instead of outliving it in a tab | DONE (NOT VERIFIED) — `CallOverlay.tsx`'s effect on `call.phase` returning to `idle` / `over` sets `fit`, `layout` and `focus` back to their opening values |
| R.19 | A far end whose picture changes shape mid-call — a camera replaced by a shared screen — drawn whole again, measured from the video element rather than from the signalling | DONE (NOT VERIFIED) — `features/calls/model.ts`'s `sourceChanged(before, after)` and `SHAPE_SHIFT = 0.12` with three cases in `model.test.ts`; `media/surfaces.tsx`'s `resize` listener (kept off the attach effect by a ref) beside `loadedmetadata`; `CallOverlay.tsx`'s `remoteShapeChanged` returning to **Fit** |
| R.20 | A **Minimize** pill and a bar that carries a running call over another page — picture or glyph, name, clock, microphone, camera, red button — with its own sound and a press to return | DONE (NOT VERIFIED) — `CallOverlay.tsx`'s `minimized` state, the bar above the router at `z-[95]`, `MiniButton`, `AudioSurface` per remote seat; reset with the next call |
| R.21 | A word in the call frame that says a stream is a screen and not a camera, so mirror and fit could both respect it | NOT IMPLEMENTED — the relay accepts only offers, answers and candidates (`SIGNAL_TYPES` in `backend/apps/calls/services.py`) and the backend is read-only, so the client infers from **shape** alone |
| R.22 | Rejoining a call that is still running after a page reload | NOT IMPLEMENTED — the engine holds no `callId`, `calls.pending` answers only for rings, and no read-only route lists the calls an account is on |

R.18 and R.19 are complete as code and `NOT VERIFIED`: both need two ends, a
laptop sharing a screen and a phone looking at it, and neither was available. R.19
has one named hole — a camera and a shared screen that are both 16:9 produce no
shape change, so a **Fill** pressed during that same call still crops until the
call ends. R.20 is complete as code and `NOT VERIFIED`, and it is deliberately not
the phone's window: `call_window.dart` can be dragged and docked and can shrink to
a mark, while this bar is fixed to the bottom and has one size.

The suite stands at 313 tests across 26 files, with `npm run typecheck`,
`npm run lint` and `npm run build` all passing when the round closed
(entry 510.67 kB / 158.99 kB gzip, CSS 134.30 kB). See
`XELVIC_TESTING_REPORT.md`, **Round 21**.


## Round 22 — the small call window is moved by hand (2026-11-06)

The follow-up of the same day, about Round 21's own bar: *"abhi video call minimize
karne par use drag aur drop nahi kar pa raha hoon chat screen me"*. Round 21's R.20
gave a running call somewhere to go; it left that place fixed to the bottom of the
screen, which the owner reported as half a feature.

| Goal | Work | Status |
| --- | --- | --- |
| R.23 | The small call window dragged anywhere on the page and docked against an edge, following the phone's own rules | DONE (NOT VERIFIED) — `src/features/calls/minibar.ts` (`homeSpot`, `clampSpot`, `dockEdge`, `WINDOW_GUTTER`), `minibar.test.ts` (8 cases), `CallOverlay.tsx` (pointer drag with capture and `DRAG_SLOP = 6`, the capture-phase click guard, placement by `left`/`top` once moved, the docked tab, `ResizeObserver` on the bar and a `resize` listener on the page, the `<audio>` elements moved out of the window) |
| R.24 | The phone's third size — a call hidden down to a single mark (`CallView.hidden`) | NOT IMPLEMENTED — the web has two sizes where the phone has three |
| R.22 | Rejoining a live call after a page reload | NOT IMPLEMENTED — unchanged; the round moved nothing on the wire |

R.23 is complete as code and `NOT VERIFIED`: no browser run and no device run, so
the drag, the click it swallows and the tab it folds into are reasoned and
unexercised. One cost is named in `minibar.ts`'s own tests rather than left to be
found — on a phone the bar fills almost the whole width, so it rests one gutter from
both edges and folds away from the smallest push, where the phone's 116-point window
on the same screen does not.

The suite stands at 321 tests across 27 files, with `npm run typecheck`,
`npm run lint` and `npm run build` all passing when the round closed
(entry 514.54 kB / 159.90 kB gzip, CSS 134.52 kB). See
`XELVIC_TESTING_REPORT.md`, **Round 22**.

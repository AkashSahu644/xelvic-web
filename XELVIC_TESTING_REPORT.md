# Xelvic Web — Testing Report

Date: 2026-11-01
Client: `xelvic-web` (React 19 + TypeScript + Vite + Tailwind + TanStack Query)
Backend / mobile: read-only references, **not modified**

## 1. What was executed

All commands were run from `xelvic-web/` on the development machine.

| Command | Scope | Result |
| --- | --- | --- |
| `npm run typecheck` | `tsc -b` over the whole app | **pass**, 0 errors |
| `npm run lint` | `eslint .` | **pass**, 0 errors / 0 warnings reported |
| `npm test` | Vitest | **pass**, 5 files, 29 tests |
| `npm run build` | `tsc -b && vite build` | **pass**, production bundle emitted |

The build output includes the lazy chunks for `ChatPage`, `ConvoLayout`,
`ConvoSheet`, `SettingsPage`, and the other route-level chunks, so the changed
conversation code is part of the verified bundle.

## 2. What was verified by reading code (static verification)

Because no authenticated backend session or second device existed in this
environment, the following were verified against the read-only backend source
and the web call sites, not by clicking through a live system:

- **Send contract** — `POST /chat/threads/{id}/messages/send/` accepts
  `client_id`; `services.send_message` deduplicates on `(sender, client_id)`
  and returns the same row on replay. The web reuses `client_id` on retry.
- **Socket echo** — `_broadcast_new` sends `message.new` to every seat
  (including the sender) and a per-seat `thread.update` with `unread`,
  `unread_other_count`, `at`, and an optional `preview` (`mine` flag). The web
  dedupes by id/`client_id` and patches the thread card from that frame.
- **Receipts** — `services.outgoing_status` produces
  `Waiting | Sent | Delivered | Opened`; `thread.read` frames carry
  `{user_id, delivered, read, read_at}` and member watermarks
  (`last_read_ordinal`, `last_delivered_ordinal`) are on `ThreadMember`.
  The web renders a word only from these values.
- **View-once** — the route is `messages/{mid}/open-once/`, not `open/`.
- **Forward** — `messages/{mid}/forward/` with `{threads: [uuid]}` (1–20),
  response `{messages: [...]}`.
- **Message info** — `messages/{mid}/info/`, group-only, response
  `{seen, delivered, not_delivered}` with `{user, at}` rows.
- **Search** — `GET /chat/search/?q=` returns `{query, messages}`.
- **Upload** — `POST /chat/assets/` multipart with `file`, `upload_id`,
  `kind`, optional `thumb/width/height/duration_ms`; response `{asset}`.
  XHR progress reports the request body, not server processing.

## 3. What was NOT executed

| Area | Why | Consequence |
| --- | --- | --- |
| Live sign-in (QR / dev login) | no backend instance, no credentials | auth surface remains **NOT VERIFIED** at runtime |
| Mobile ⇄ web cross-device run | no second authenticated device | cross-device sync is **NOT VERIFIED** |
| Real message send/receive | same | optimistic + socket flow **NOT VERIFIED** at runtime |
| Reconnect / backoff under a dropped socket | no live socket | reconnection logic **NOT VERIFIED** at runtime |
| Upload progress against a slow link | local files only | progress math verified statically, not observed |
| Long-history pagination | no data set | scroll anchoring **NOT VERIFIED** at runtime |
| Calls | no live backend, no second device, no devices | the state machine is tested; **no connection has ever been made** |
| Room sound | the stage is a `Call` and the room page is not wired to it | still **NOT IMPLEMENTED** |

No test or check in this report should be read as proof that the backend
behaved a certain way. It is proof that the web code compiles, lints, tests,
and builds, and that its calls match the backend source as read.

## 4. Regression risk

- `ChatPage.tsx` carries most of the change. Its riskiest new paths are the
  optimistic insert/reconcile (`client_id`) and the failed-send retry. Both are
  covered by the type system and a production build, but not by live traffic.
- `ConvoPage` now patches `["threads"]` instead of always refetching. If a
  frame ever arrives whose thread is absent from the cache, the code falls
  back to `invalidateQueries` — this is the deliberate safety valve.
- `ThreadCard.unread_other_count` was added to the web type to mirror the
  serializer field; it is optional, so older payloads still typecheck.
- The Spark viewer spends a look only after its bytes have loaded, and guards
  against a double spend in the same mount with a ref. The riskiest path is the
  group first-opener case, which was not exercised here.
- `ChatPage`'s "Spark" entry now loads `CameraCapture` lazily; it is the same
  chunk the convo list already used, so the bundler does not duplicate it.

## 5. Spark and chat-screen pass (same day, second pass)

The same four checks were re-run after the Spark and chat-fidelity edits:
`typecheck` pass, `lint` pass, `npm test` 5 files / 29 tests pass, `build`
pass (the lazy `CameraCapture` chunk is emitted, and `ChatPage` includes the
Spark viewer and run logic).

Verified by reading the read-only backend and the call sites:

- **A Spark is not a kind.** `Message.Kind` has no `spark`; `payload.view_once`
  is what `services.open_view_once` checks. The web now detects, sends and
  opens on that flag only.
- **Send** — `POST .../messages/send/` with `kind: image|video`,
  `payload: {view_once: true}`. The previous `kind: "spark"` request was
  refused by the server.
- **Serialization** — for a view-once message the serializer nulls
  `asset.content_url`/`thumbnail_url` once opened (or for the sender), so the
  web's "Spark · opened / gone" state comes from `payload.opened_at` and the
  presence of a URL, not from anything this browser remembered.
- **Open** — `POST .../open-once/` is idempotent and only the recipient may
  spend it; in a group the first opener spends for everyone. The viewer fetches
  bytes with `useMediaUrl` first, then spends, so a failed fetch never burns a
  look.
- **Shot** — the web renders `payload.shot_at` as the app's screenshot line.
  A browser cannot detect screenshots, so the web neither fabricates nor POSTs
  the shot mark.
- **Sound** — `payload.sound` is an asset id, not a URL; the band fetches
  `/api/v1/chat/assets/{id}/content/` through the authenticated media helper,
  the same door `AssetContentView` serves for the look itself, and honours
  `sound_start_ms` / `sound_end_ms`. Not played live here.
- **Chat fidelity** — the compared literals come from `chat.dart`
  (`_viewOnceBubble`, `messageUnderLine`, `_isViewOnce`, `sparkShotLine`,
  bubble/composer paddings and radii, heading) and from the theme/strings files.
- **Glyphs** — the web sources had double-encoded UTF-8 in a few strings
  (`â¤ï¸`, `Â·`, `typingâ€¦`). They were repaired to `❤️ 😂 🔥 👍 😮 😢`,
  `·`, `—`, `…` and `✨`; the reaction set now matches `kReactions` exactly.

Not executed (same reasons as §3): a real Spark send, a real open, the group
consumption path, and the reply from the viewer. All of those remain
**NOT VERIFIED** at runtime.

## 6. Marketplace and theme pass (same day, third pass)

The same four checks were re-run after the marketplace, backdrop and chat-ground
edits: `typecheck` pass, `lint` pass, `npm test` 5 files / 29 tests pass,
`build` pass. The emitted CSS was checked for the two utilities the new
backdrop depends on (`.-z-10{z-index:-10}`, `.isolate{isolation:isolate}`), so
the stack position the fix relies on is really in the bundle and not dropped by
the Tailwind scan.

Verified by reading the read-only backend and the call sites:

- **Every marketplace route exists and is mounted where the web calls it.** The
  six `config/urls.py` / app-level pairs are listed in
  `XELVIC_API_COMPATIBILITY_REPORT.md`. Nothing was added for the web.
- **The three aisles are the app's three aisles.** `ShopTab` (drip = 0,
  themes = 1, logos = 2), the `TabBar` that draws them, the header with the
  purse, and the ring of files each aisle came from are recorded in
  `XELVIC_PROGRESS_TRACKER.md`.
- **`X.pageGround` is `clear` on any theme with art** (`theme.dart:1680`), which
  is why a picture theme's bars and composer are glass in the app and opaque on
  a theme of colours. The web now asks the same question.
- **`ThemeBackdrop`'s default page is Convo** (`backdrop.dart`, `page = XPage.convo`),
  which is what the app's pushed screens get — so the marketplace's ground is
  the theme's Convo picture, not a picture of its own choosing.
- **The chat's theme picture is the last answer, not the first** — `chat.dart`
  returns early for a picked wallpaper and for a taken photo, and only then
  falls through to `X.theme.chatWall`, washed with the page's own ink at
  `kWallScrim` (`0.78`). The web's ordering and wash now match.

Not executed: any purchase, any wear, any figure pick, and any second-device
check that a logo or theme bought on the web arrives on the phone. The
marketplace is **NOT VERIFIED** at runtime. Nothing here should be read as
proof that a purchase succeeded.

## 7. Known divergences, named rather than hidden

- The chat's accent on a convo with no colour of its own: the phone uses
  `theme.chatTint ?? #E31B66`, the web still uses `--accent`. See
  `XELVIC_FINAL_GAP_REPORT.md`.
- `TINT_HEX` in `src/features/convo/skin.ts` carries the server's dark-scheme
  hexes; the phone's `kTints` are the light-scheme readings of the same hues.
  This affects the tint swatches and any convo given a colour of its own.
- The theme preview and the marketplace each render their own copy of the
  ground rather than one shared widget on one screen, because on the web they
  are a route and a view rather than a pushed screen. Both go through the one
  `Backdrop` component, so there is still one copy of the crop-and-wash rule.

## 8. Suggested first live pass

1. Sign in on web with the QR door from a phone.
2. Send from web, confirm the phone receives it and the web bubble flips from
   `Sending` to the server's receipt word.
3. Reply from the phone, confirm `message.new` inserts once and the sidebar
   card reorders without a full refetch.
4. Kill the network, send, confirm `Not sent`, restore, tap retry, confirm one
   bubble (no duplicate).
5. Open a Spark on web; confirm the phone shows it consumed.
6. Forward a message to two convos; open Message info in a group.
7. Search a phrase that exists only in an old conversation.
8. Settings → Marketplace: open each of the three aisles, buy nothing, and
   confirm the purse in the header reads the same number the tiles are priced
   against. Then wear Unicorn (free, single-ground) and Cat Girl (free,
   per-page) and confirm the whole web repaints — including the settings list,
   the marketplace itself and the inside of a chat — with the picture *behind*
   the cards rather than over them.
9. Open a theme's preview, press Dark and Light, and confirm the reading changes
   across the whole web under the overlay, then Apply and confirm the reading
   that was looked at is the one that survived the reload.
10. Buy the cheapest logo and the cheapest figure with a known balance and
    confirm the balance in the header drops by exactly the price and the mark
    changes in the corner of every screen.

## 9. Settings and profile passes — what was checked, and how

Nothing in this section is a live-backend claim. There is no running server and
no second device in this environment, so every write named below is **NOT
VERIFIED** at runtime; what *was* done is written next to it.

**Static checks, re-run after each change in both passes**

| Command | Result |
| --- | --- |
| `npx tsc -b` | pass |
| `npx eslint src` | pass |
| `npm test` | 29/29 pass (5 files) |
| `npm run build` | pass |

**The bundle was read back, not assumed.** After the final build the emitted
assets were grepped for every string and hook the two passes added —
`Send request`, `xelvic://u/@`, `birthday-fall`, `Hold to see their photo`,
`Nothing is up right now`, `Could not open those moments`, `xelvic-ask-breath` —
and each is present, with `MomentViewer` emitted once as a shared 10 kB chunk
rather than copied into both `MomentsPage` and `ProfilePage`.

**Verified by reading the read-only sources**

- **The birthday fall is the app's drawing, number for number.** `_Balloon.rolled`,
  `_BirthdayPainter.paint` and `_paintBalloon` in `app/lib/birthday.dart` were
  read for the eleven constants the web uses: the fixed seed `20260229`, eleven
  seconds a crossing, six crossings, thirteen balloons, three theme tones, the
  `above = 3` body-widths of overshoot at each end, the 0.13 fill / 0.55 hairline
  / 0.30 highlight / 0.50 knot / 0.42 string alphas, the `veil = 0.4 + 0.6 ×
  strength` floor, and the drawn highlight arc's rect, start angle and sweep
  (`π·0.85`, `π·0.55`). The web's SVG coordinates are those numbers in a 100×125
  body.
- **The ring is the app's `Ring`.** `widgets.dart:477` is a 2.5px border of
  `X.accent` (or `X.fade(X.text, 0.16)` once watched) round a 2.5px gap and the
  face. The web's `.story-ring` was a conic gradient and no longer is.
- **The face dialog is `showFace` / `_showPhoto`.** A 240 square, rounded 22,
  cover-cropped, the name under it, tap anywhere to close.
- **The person page's exclusivity is the app's.** `person.dart` draws exactly one
  of Keep / Let go / the gate's CTA / the ask, precedes it with the convo disc
  when the gate allows one, and never draws a count the payload withheld.

**Not executed**

- Opening a real profile, watching a real day, or seeing a ring turn quiet after
  watching one; no account was signed in.
- A birthday on the day: the devices' clocks were not moved, so the fall was
  reviewed as code and as a built asset, never as a running animation.
- Any reduced-motion run in a real browser.
- The settings sub-pages' writes: every one of them names its endpoint, and none
  was called against a live server here.

## 10. Notifications pass — what was checked, and how

The same rule as §9: nothing below is a live claim. A strip, a browser
notification and an alert row can only be proven by two signed-in clients and a
running socket, and this environment has neither.

**Static checks, re-run after the pass**

| Command | Result |
| --- | --- |
| `npx tsc -b` | pass |
| `npx eslint src` | pass |
| `npm test` | 29/29 pass (5 files) |
| `npm run build` | pass |

**The bundle was read back, not assumed.** The emitted assets were grepped for
what the pass added — `Nothing will interrupt you`, `Saved for calls`,
`xelvic-notice-in`, `mentioned you`, `is typing`, `Memories are not on the web
yet`, `Notification.permission` and `visibilitychange` — and every one is
present. The new provider and banner had no names to grep for, because the build
minifies identifiers; their presence is the code in `src/features/notices/` and
the chunk it produced.

**Verified by reading the read-only sources**

- **The rules are the phone's, one for one.** `app/lib/notices.dart` was read for
  the hold (`4s`), the depth (`5`), the single current notice, the replacement of
  a queued notice from the same conversation, the refusal to draw a strip for a
  muted conversation or a typing note, the per-conversation ordinal dedupe, the
  skip when the conversation is the one on screen, and the chime that follows
  only for a notice that survives all of that. The web's `deliver` is those rules
  in the same order.
- **The strip's geometry is `notice_banner.dart`'s.** 20pt card, 11pt gap, 42pt
  face, 16pt bold name, 13.5pt dim line, a 19pt close glyph in a 36pt door,
  `env(safe-area-inset-top)` at the top, a 40pt horizontal swipe to dismiss, and
  a 150pt media block with the play disc for a clip.
- **The alert row is `screens/alerts.dart`'s.** The card, the face square, the
  tone badge ringed in the card's own ground, the mark door that shares its
  corner, the tile with its word under it, the keep answers, and the unread dot
  all come from the phone's own widgets, and `accentAt` + `inkOn` supply the
  colours the theme would.
- **The server sends what the strip draws.** `apps/chat/notices.py` was read to
  confirm the `notice` payload (`row`, `muted`, `ordinal`, `card`, `media`,
  `mention`, `by`) and that it is built for every member except the sender and is
  absent for a system note. The web reads those fields and no others.
- **`alert.new` is not a strip.** `alerts.dart` and `home.dart` show the phone
  only updating the list and its count; a bell badge was therefore *not* added,
  rather than invented.

**Not executed**

- Any two-client exchange: the strip, the queue, the 4s hold, the same-conversation
  replacement, the ordinal dedupe, the mute rule and the skip-when-watching are
  **NOT VERIFIED** at runtime.
- The browser's notification permission prompt, a hidden-tab row, and a click on
  one that focuses the tab and opens its destination: **NOT VERIFIED**. The code
  path is `Notification` API guarded by `Notification.permission === "granted"`,
  and it has not fired against a real browser here.
- A live `alert.new` / `alert.read` frame: the cache patch is code, not a run.
- A real chime: the sound preference is read from the same local store as the
  settings page, but no audio was played.

**Blocked, and said so**

- A notification after the site is **closed** cannot be built from this project.
  `apps/accounts/push.py` pushes through Firebase v1 to `Device.push_token`; a web
  push needs a Firebase web app config, a VAPID key and a service worker, none of
  which exist in this build, and the backend is read-only. The Notifications page
  now says exactly this rather than implying a sound that would never come.

## 11. Moments pass — what was checked, and how

The same rule as §9 and §10: there is no running server and no second device
here, so every write named below is **NOT VERIFIED** at runtime. What *was* done
is written next to it.

**Static checks, re-run after the final edits to `MomentViewer.tsx`**

| Command | Result |
| --- | --- |
| `npx tsc -b` | pass, 0 errors |
| `npx eslint src` | pass, 0 errors / 0 warnings |
| `npm test` | 29/29 pass (5 files) |
| `npm run build` | pass, built in 3.35s |

The first two checks were run *after* the gesture refs, the Escape guard and the
Send button's `busy` change went in, not before; the build followed them.
Two of the four checks had caught real defects earlier in this pass and are the
reason they are re-run rather than assumed: `tsc` found `VisibilityOff` used
where this version of lucide-react exports `EyeOff` (`AudienceSheet.tsx`,
`ShareMoment.tsx`), and it found two constants `MomentStage.tsx` declared and
never used (`NOTE_COLUMN`, `SONG_COVER_GAP`) — both fixed, and the constants
wired into inline styles rather than deleted.

**The bundle was read back, not assumed.** The emitted assets were grepped for
every string this pass added — `Hold to open`, `Let go to open`,
`Who watched and answered`, `Who chose what`, `Nobody yet`, `Take this down?`,
`It goes for everybody`, `This moment`, `Add to Memories`, `Share into`,
`No convo to share it into`, `It is on your moment now`,
`That moment is no longer there`, `Whoever answers turns up here`, and the
`rgba(0,0,0,0.8)` over-media shadow — and every one is present.
`MomentViewer` is emitted **once**, as `dist/assets/MomentViewer-*.js`
(41.13 kB / 11.48 kB gzip), shared by `MomentsPage` and `ProfilePage` rather
than copied into both.

The word "morning" *does* appear in the bundle, and it was checked rather than
waved off: both hits are theme moods in the catalogue
(`theme/catalog.ts:628`, `theme/painted.ts:349`). The removed Morning Question
left no string behind in `src/` or in `dist/`, and `prompt` survives in `src`
only as the camera's real overlay and `VaultModal` state.

**Verified by reading the read-only sources**

- **The clock is `MomentItem.hold`, constant for constant.**
  `app/lib/moments.dart` was read for the hold rule: the clip window, the sound
  window capped at `kSoundLongest`, a carried picture's own life, and
  `kHoldFloor`. `moment_view.dart` was read for `kBarTick` (60ms),
  `kHoldToPause` (480ms), `kHoldToLeave` (750ms, used as
  `kHoldToPause + kHoldToLeave` = 1230ms), `kStoryLike`, `kStoryFaces`, the
  32%/68% tap split, `_carried`'s order, `_carriedTo`'s four sentences and
  `_ownOrder`'s reversal of days-not-items. The web's `holdMs()` is those rules
  written out.
- **The tally the web declines to draw is the tally the server declines to
  send.** `apps/moments/services.py` `_reactions` returns
  `{count: 0, counts: {}, mine}` to a non-owner. That is why the answers row and
  every sheet behind it are drawn on my own day only: a reader is shown no
  number, not an invented one.
- **Share is gate-then-deed.** `apps/moments/views.py` `MomentShareView` was read
  to confirm a body-less `POST` is the question and `{thread}` the deed, and that
  a refusal arrives as the server's own 403 rather than as a sheet whose Send
  would fail.
- **The routes exist where the web calls them.** All 22 are tabulated against
  `apps/moments/urls.py` and `config/urls.py:175` in
  `XELVIC_API_COMPATIBILITY_REPORT.md`. Nothing was added for the web.

**A real bug found and fixed by reasoning about the platform, not by a test**

Flutter has a gesture arena; the browser does not. A `pointerup` that ended a
long press is still followed by a `click`, so the first implementation would
have paused on hold **and then** stepped forward when the finger came up. A
`consumed` ref is now set the instant the hold fires and spent by the click
handler (with a 400ms reset), and the react button carries a `facesPressed`
ref for the same reason. This is the one part of the pass that a static check
could never have caught and that a real touch device would have caught
immediately — which is why it is written down here.

**Not executed**

- No moment was posted, watched, answered, carried, shared or taken down
  against a running backend. Every write is **NOT VERIFIED** at runtime.
- The hold-to-leave gesture has not been tried on a touch screen. The 480ms and
  1230ms thresholds are the phone's numbers, but a browser's pointer timing on
  real glass was not observed here.
- The nested walk over a `source_id` moment, and the hand-off from a Vibe to
  `/app/drops?vibe={id}`, were not run.
- A video's bar read off the element's own clock was not watched for a full
  clip; the `at >= end - 120` advance threshold is the phone's and was not
  observed against a real video.
- **Nothing in the Memory walk was run against a server.** The `isMemory`
  branches are ported (header words, the four `memories/{id}/…` answers, Remove
  in place of Take down, no watchers and no seen calls), and so are the shelf's
  long press, its four rows, and the `?memory=` deep link from Alerts — but no
  Memory was opened, renamed, covered, added to, removed or answered live. A
  carry now goes through the editor first; that editor path was not run end to
  end on a real picture either.
- Together mode and viewer-level stickers/drawings were checked and do not
  exist in the app, so there is nothing to test. The editor's own stickers,
  text, frames and drawings are `PhotoEditor`'s and are unchanged by this pass.

### 11a. The same day's follow-through

The Memory branches, the shelf's long press, carry-with-edit and the `?memory=`
deep link were added after the block above was written, and the four checks were
run again after the last edit:

| Command | Result |
| --- | --- |
| `npx tsc -b` | pass, 0 errors |
| `npx eslint src` | pass, 0 errors / 0 warnings |
| `npm test` | 29/29 pass (5 files), 595 ms |
| `npm run build` | pass, built in 3.79 s |

`MomentViewer` is still emitted **once**, now `dist/assets/MomentViewer-BXPkAMdr.js`
(43.28 kB / 12.28 kB gzip), imported by `MomentsPage`, `ProfilePage` and
`MemoriesShelf`. The bundle was grepped for what this half added — `Your Memory`,
`in this Memory`, `Who answered`, `Remove this Memory?` and `That Memory is no
longer on your shelf` — and all five are present, and for `Memories are not on
the web yet`, which is **absent**: the refusal is gone rather than reworded.
`/app/moments?memory=` is in the main chunk (`alertPath`) and
`moments/memories/` is in the moments service chunk.

**Still not executed.** No Memory was opened, renamed, covered, added to,
removed, answered or shared against a running backend; the `?memory=` route was
not walked from a real alert row; and a carry through `PhotoEditor` was not run
end to end on a real picture. The hold gesture on the shelf card (480 ms) has
not been tried on a touch screen.

## 12. Transport pass — what was checked, and how

This pass changed *how* the web dials the backend, not *what* it dials. It has
no new feature to test, so what follows proves the substitution is complete and
that nothing regressed, and then states plainly what it cannot prove.

**Completeness — the old method is gone, not merely deprecated**

| Check | Result |
| --- | --- |
| Bare `fetch(` under `src/` | **0** (the 59 `refetch(` hits are react-query and are not transport) |
| Imports of `@/lib/api` or `@/lib/env` | **0**; both files deleted |
| Requests issued outside `src/services/` | **0**, except the third-party geocoding and public-avatar reads described below |
| Modules importing `axios` | 3 — `src/config/axios.ts`, `src/services/media.service.ts`, `src/features/camera/CameraCapture.tsx` |
| Service modules | 21 files, **202** methods, re-exported by `src/services/index.ts` (counted 2026-11-01 as `^\s{2}\w+:\s*async` under `src/services/*.service.ts`; the earlier figure of 191 was stale before this count and before `circles.service.ts`) |

**The four static checks, re-run after the last edit**

| Command | Result |
| --- | --- |
| `npx tsc -b` | pass, 0 errors |
| `npx eslint src` | pass, 0 errors / 0 warnings |
| `npm test` | 29/29 pass (5 files) |
| `npm run build` | pass, built in 3.32 s |

The build emits the client as its own `axios-*.js` chunk (100.20 kB /
35.58 kB gzip), which is the evidence that the whole app really is going through
it. `MomentViewer` is still emitted once as a shared 40.85 kB chunk.

**Two behaviours the type checker would not have caught, and where they stand**

- **A `204` answers `""`, not `undefined`.** The old wrapper returned `undefined`
  for an empty body; axios resolves an empty response with an empty string. Any
  call site that tested the answer instead of the status would see a truthy
  value. This was searched for rather than assumed. The backend has seven `204`
  responses (`calls/views.py:61`, `chat/views_groups.py:127`,
  `chat/views_media.py:110` and `:205`, `chat/views_messages.py:155`,
  `chat/views_threads.py:457`, and the group-leave view); the web calls three of
  them — `chatService.removeThread`, `chatService.leave` and
  `chatService.removeMessage` — and all three are typed `Promise<void>`, awaited,
  and decide success by the promise resolving while `ApiError` carries any
  non-2xx. The other four are routes the web never dials. No behaviour changed,
  but it is written here so a future call site does not build on the old
  accident.
- **Six writes now pass an explicit `{}`.** A `POST` to a route that reads no
  field still needs a second argument on axios, so the six such writes in
  `src/services/` (mark-as-read, leave, withdraw-and-similar) pass `{}` where the
  old call sites passed nothing. Each of those routes ignores the body, so the
  answer is unchanged; it is a difference on the wire and it is recorded rather
  than hidden. `verifyService.withdraw` is the one write still sent with no body
  at all, which is also what DRF has always accepted for it.

**Third-party hosts do not get the account's token.** The geocoding lookups in
`CameraCapture` and the public avatar fetch in `features/marketplace/queries.ts`
use bare `axios`, and `mediaService.blob` takes `authenticated: false` for
public media. The shared instance attaches `Authorization` and prefixes the API
base URL, so using it there would have leaked a bearer token to another origin —
the one behavioural risk in this pass that was caught while converting, not
after.

**Not executed**

- No request in this pass was issued against a running backend. The transport
  compiles, lints and builds; it is **NOT VERIFIED** at runtime here — sign-in,
  refresh-on-401, upload progress, a blob read and every service method carry the
  same unverified status they carried before, on a different client.
- No route was added, removed or altered in this pass, and the backend was not
  touched, so the compatibility report's MATCH table is unchanged by it.

## 13. Audio and Live pass — what was checked, and how

The ask: Audio and Live to the app's shape. Two new sets of pages, one shared
strip, one shared sheet, and the room screen's menu and report. Nothing here was
run against a server; the four static checks and a read of every route and shape
are what this section can honestly offer.

**The four static checks, after the last edit**

| Command | Result |
| --- | --- |
| `npx tsc -b` | pass, 0 errors |
| `npx eslint src` | pass, 0 errors / 0 warnings |
| `npm test` | 29/29 pass (5 files) |
| `npm run build` | pass, built in 3.75 s |

The build emitted its own chunks for the new surfaces —
`AudioCategoryPage-*.js` (5.20 kB), `AudioBoardPage-*.js` (3.05 kB),
`AudioStudioPage-*.js` (2.41 kB), `AudioStudioDetailPage-*.js` (8.29 kB),
`OpenRoomSheet-*.js` (5.40 kB) and `LivePage-*.js` (6.30 kB) — and `ReportSheet`
once (4.16 kB), shared by the room's report and the drop's.

## 14. Drops and Vibes pass — what was checked, and how

The ask: fix the feed playing several clips at once, give it the app's
pagination, and make it load fast. Three behaviours were changed and one
contract was corrected (`seen=strict`, `limit=8`, `caught_up`).

**The four static checks, after the last edit**

| Command | Result |
| --- | --- |
| `npx tsc -b` | pass, 0 errors |
| `npx eslint src --max-warnings=0` | pass, 0 errors / 0 warnings |
| `npm test` | 29/29 pass (5 files) |
| `npm run build` | pass, built in 3.82 s |

Emitted chunks for the pass: `DropsPage-*.js` 42.79 kB (12.53 kB gzip),
`DropCard-*.js` 39.60 kB (11.58 kB), `DropComposer-*.js` 23.32 kB (6.70 kB),
`VibeStudioPage-*.js` 6.73 kB, `VibeStudio-*.js` 7.39 kB,
`drops.service-*.js` 2.89 kB, `DropPage-*.js` 2.32 kB.

**Not executed**

- No clip was heard and no feed was walked against a running backend. The
  one-ear rule, the viewport gating and the infinite scroll are code claims and
  are **NOT VERIFIED** at runtime.
- No loading time was measured in a browser. "Faster" here means fewer requests
  issued before the reader looks — not a measured millisecond figure.
- `seen=strict` and `caught_up` are read from the backend source, not from a
  live response.

**Two regressions found by reading, and fixed**

1. A row's heart was hidden on `source === "drop"` rows, but the app likes a
   drop at `POST /drops/{id}/like/` (`audio.dart`), so the web was refusing a
   heart the server accepts. Every row now draws it and tells `LikeButton` which
   half of the catalogue it came from.
2. `rowTrack` passed `row.episode` straight through, and a shelf row may carry a
   string there. `Track.episode` is a number, so the row now keeps a numeric
   episode and drops anything else — caught by `tsc`, not by a test.

**Verified by reading the backend, not assumed**

- The studio's `null` semantics: rate `null` means the denominator was zero;
  `used_by.countries` is `null` for an uploaded sound (never recorded) and `[]`
  when the read found none. The page draws each as a different absence.
- `?shelf=kept` is the server's own shelf name (`apps/spaces/views.py`), not a
  filter invented on the web — which is why the strip asks for it rather than
  filtering the live shelf.
- The room's action routes, the board's five, and the report reasons route. Each
  web call is listed route-by-route in the compatibility report's new table.

**Not executed**

- No page in this pass was loaded against a running backend: no category opened,
  no board read, no studio item reached, no room opened, joined, started, ended,
  shared or reported. Every write is **NOT VERIFIED**.
- **Room sound is not tested because it does not exist here.** The app's stage
  audio is a WebRTC mesh over the `call.signal` relay. Calls themselves now have
  an engine (2026-11-06) but the room page was not wired to it, so the stage
  still has nothing to exercise and the page says so in as many words instead of
  drawing a microphone button that would do nothing.
- Real-time claims: the Live strip and the room's chat/reactions ride the
  existing socket events (`room.new`, `room.update`, `room.gone`, `room.say`,
  `room.react`, `room.game`). The code is wired to the server's frames, but no
  frame was received in this environment, so no real-time behaviour is claimed.

## 15. Convo cards, the strip and the share sheet (2026-11-02)

The ask: the chat screen's messages are not the app's, the "This convo is
encrypted" chip is missing from the top of a thread, and passing a post on does
not work the way the phone's does.

**The four static checks, after the last edit**

| Command | Result |
| --- | --- |
| `npx tsc -b` | pass, 0 errors |
| `npx eslint src --max-warnings=0` | pass, 0 errors / 0 warnings |
| `npm test -- --run` | 41/41 pass (7 files) |
| `npm run build` | pass, built in 3.65 s |

Emitted chunks for the pass: `ChatPage-*.js` 96.19 kB (25.47 kB gzip) and
`MomentViewer-*.js` 43.01 kB (12.18 kB gzip) — the viewer is now split off the
convo page, because only a thread that carries a story card needs it. Entry
chunk 455.79 kB (143.10 kB gzip).

**Verified by reading the app, line by line**

| What was claimed | Where it was read |
| --- | --- |
| The strip belongs at the very top and says two different sentences | `screens/chat.dart:6476` (`_strip`) and `:6333` — "Index 0 sits at the bottom of a reversed list, so the strip is the last item — which puts it at the very top of the thread"; the words are `Str.chatEncrypted` and `Str.convoDisappearingSet` |
| The strip's geometry | `X.card`, radius 20, padding 11/6/12/6, glyph 12, words 10.5 w600, accent at 40 % when vanish is on |
| Which cards a bare message is | `screens/chat.dart:8112` — `bare` lists picture, view-once, story, song, album, drop, profile, live and sticker |
| The card kinds and their order | `screens/chat.dart:8055` onwards |
| The song card's shape | `screens/chat_track.dart` — sleeve 44, title 14 w700, byline 11.5 dim, the wave from `waveShape(seed, 26)`, both clocks |
| The wave is deterministic off the track's seed | `screens/audio_bits.dart:35` — ported to `waveBars` with `Math.imul`, because a JavaScript product loses the low bits before the modulus is taken |
| The profile card is a snapshot and a door | `screens/chat_profile.dart:77` (`profileShareOf`) and `:100` (`ChatProfileCard`) |
| The story card is a way in, not a copy | `screens/story_card.dart:1545` (`StoryShare`) and `:1614` (`storyShareOf`) — "That is what makes a shared story behave like a story" |
| The story card's frame | `story_card.dart:42-43` — 224 × 348, `SensitiveVeil` over it, the name band, the item bars, "Tap to watch" |
| The named line and when it is drawn | `chat.dart:8353` — `named: share.mention && !mine`, and the words are `Str.storyCardPutYou` / `Str.storyCardPutYouBy` |
| The moment-reply header | `chat.dart:8547` (`_momentRef`), `:8560` (`_momentQuote`), `:8634` (`_openMomentRef`) |
| The share sheet is a tick strip with a tally | `screens/sheets.dart:351` (`ShareCard`), `:1053` (`_StripFace`), `:1252` (`sendToMany`) |

**Verified by reading the backend, not assumed**

- Every new card's payload has a writer. `payload.playlist` at
  `audio/services.py:1643`; `payload.moment_ref` at `moments/services.py:2356`;
  the story card's `story`/`moment`/`mention`/`by` at `moments/services.py:2818`
  (a forward), `:2889` (a tag) and `:2912` (a remention back); the retraction's
  `retracted` shape at `:2162`. `payload.track` and `payload.profile` are written
  by the *phone* and passed through by `chat/views_messages.py:113` — so they are
  read and drawn, never invented.
- The two stream routes are two rows behind one id: `source: "drop"` →
  `/drops/drops/{id}/content/`, else `/audio/tracks/{id}/stream/`
  (`audio.dart:396`, `AudioTrack.toShare`).
- A share is a row per hand-off, and only when the thing actually left:
  `drops/services.py:3642 share()` answers `sent: 1` for the one convo it was
  given, writes one `DropShare` for it, and writes **nothing** for
  `where="link"` (`DropShare.SENT` excludes it). One request carries one drop to
  one convo, which is why the sheet sends once per ticked convo and counts what
  landed rather than assuming one press means one share — and why "Copy a link"
  reports nothing at all.
- The poster's number moves the same way: "A share counts the same whichever way
  the thing left — a convo, an app, a moment" — so `onShared(sent)` is fed by the
  per-convo results and not by a constant.

**Not executed**

- Not one card was seen in a browser against a real thread. There was no
  account to sign in with and the backend cannot be run locally, so every claim
  in this section is **NOT VERIFIED** at runtime: a real song share, a real
  story share, a real moment reply, the chip over a real thread, and a real
  multi-convo share with the tally.
- `waveBars` reproduces the phone's `waveShape` only in shape, not bar for bar:
  Dart's arbitrary-precision `%` and JavaScript's 32-bit `Math.imul` agree on the
  low 32 bits, which is what the modulus takes, but no output was compared
  against a real Dart run in this environment. The two waves have not been
  placed side by side.
- No end-to-end test was added for the new cards. The suite's 41 tests do not
  cover `ChatPage`; the new code is covered by typecheck and lint only.
---

## 16. The camera's open, the sticker shelf and the song list (2026-11-02)

> **Superseded in part, same day.** The song-list part of this section — the ask
> for the server's own ceiling on `/audio/tracks/` — treated the wrong shelf as
> the right one. The list the phone's picker draws is the *uploads*
> (`?source=drop`), not the catalogue, and the sheet fell back to the Audio tab's
> rows when the catalogue read came back short. See **§17** for that pass; the
> camera and sticker findings above it still stand.

The four checks, run at the end of this pass:

```text
npx tsc -b                      PASS
npx eslint src --max-warnings=0 PASS
npm test                        52/52 PASS (8 files, was 41/41 in 7)
npm run build                   PASS in 3.64 s, no chunk-size advisory
```

New tests: `src/services/stickers.service.test.ts`, 11 cases in five groups —
the name a service row takes (first tag, else its pack's name), a row with no
address being nothing at all, an own-server row's comma-separated `keywords`
column becoming words, an own-server row with no picture being dropped, the
search rule (a second word narrows, order and case do not matter, part of a word
matches, an empty box shows everything, a shelf filter), and the shelf list's
order and counts. `widget`-level rendering is still uncovered — there is no test
that draws `StickerSheet`, the sticker card or the camera.

### What was read, and where

| Claim | Read from |
| --- | --- |
| The app's shelf is the sticker service first, our own server second | `app/lib/editor/stickers.dart:1-19` (library comment), `search()` at `:300`, `_far()` at `:346`, `_near()` at `:317` |
| A service row's name is its first tag, else its pack's name | `StickerRow.ofService`, `:145-165` |
| The shelf is paged 100 at a time up to 1000 | `stickerPage`/`stickerShelf`, `:36-51`; the loop in `_far`, `:346-384` |
| A refusal is remembered for the session, so a keystroke never waits on a dead host | `_farDown`, `:213-218` |
| Search means "every word lands somewhere", case-insensitive, over name+tags+pack | `Stickers.sift`, `:399-415` |
| A comment's sticker id is validated against **our own** rows only | `backend/apps/drops/services.py:3883-3903` (`_comment_sticker`) |
| The editor's sticker sheet is a search box over a four-column grid | `app/lib/screens/editor/image_editor.dart:3940-4028` |
| The convo's sticker sheet is the same shape | `app/lib/screens/chat_sticker.dart:120-250` |
| A sticker is sent as an ordinary `text` line carrying `{id, url, name}`, never as its own kind | `_sendSticker`, `app/lib/screens/chat.dart:4666-4700` |
| A received sticker is a 148 px picture, `object-contain`, and a payload with no url falls back to the line's own words | `ChatStickerCard`, `chat_sticker.dart:54-86`; `StickerShare.of`, `:33-52` |
| `TrackListView` answers `{tracks, query}` and slices to `min(limit, 500)`, default 200 — no cursor of any kind | `backend/apps/audio/views.py:503-578` |
| The phone asks the catalogue with no `limit` and never asks for a second page | `Audio.tracks()` (`app/lib/audio.dart:1683-1717`), and the view's own comment at `:569-575` |

### The live service, measured

Asked from this machine on 2026-11-02, with `Origin: https://xelvic.com`:

```text
GET https://sticker.gaongram.in/api/stickers?limit=3&offset=0
  200  access-control-allow-origin: *   {"total":381,"matched":381,...}
GET ...?limit=100&offset=0/100/200/300/400
  100 / 100 / 100 / 81 / 0 rows
GET https://res.cloudinary.com/.../32/03d99012-....webp
  200  Access-Control-Allow-Origin: *
```

So the paging the client walks really does end at 381, and both the catalogue and
the pictures are readable from a browser origin without a token.

### Not executed

- **No signed-in browser run.** The backend is not reachable from this
  environment and there are no account credentials, so nothing below has been
  watched happening: the camera opening from the convo header, from the menu row
  and from the Spark row; a warm chunk being reused by the real import; a sticker
  picked in the editor's sheet landing on a composed picture; a sticker sent from
  this client and *received* by the phone; a sticker sent from the phone drawing
  its picture here; the audio sheet's "All" tab holding more than a hundred songs.
- **The camera's open time was not measured.** The claim is about what is on the
  critical path being removed (two chunks and a parse), not a stopwatch figure.
  No timing was taken before or after, on any device.
- **The sticker count the editor's sheet draws was not observed.** The service
  returns 381 rows to `curl`; whether the sheet renders all of them in a browser
  is not something this environment can show.
- **No visual comparison** of the two sticker sheets, of the sticker card against
  the phone's, or of the audio sheet's list length.

### Read-only project check

`git -C xelvic status --short` is byte-for-byte the same eight pre-existing
entries it reported in the previous pass — seven modified `app/` files and the
untracked `.tools/` — with **nothing under `backend/`**. Nothing outside
`xelvic-web/` was created, edited or deleted.

## 17. The sound sheet's shelf and the save route (2026-11-02, sixth round)

Two reports: the editor's sound sheet shows nine songs where the phone shows all
of them, and Save does not save.

### The four checks

```text
npx tsc -b                      PASS
npx eslint src --max-warnings=0 PASS
npm test                        62/62 PASS (9 files)
npm run build                   PASS in 4.22 s
```

The four were re-run after the last change of the pass — deleting the dead
`dropsService.save` (below) — and all four pass on the final tree: entry chunk
455.61 kB (143.08 kB gzip), `PhotoEditor` 74.61 kB, stylesheet 122.06 kB.

### What was read, and where

| Claim | Read from |
| --- | --- |
| The route answers the *catalogue* unless `?source=drop` is asked for | `apps/audio/views.py:TrackListView.get` — `found = services.catalogue()` on the default path, the drop branch above it |
| The catalogue branch's ceiling is `min(limit, 500)`, default 200 | `apps/audio/views.py`, `limit = max(1, min(int(raw) if raw.isdigit() else 200, 500))` |
| The drop branch's ceiling is 100, default 60 | `apps/audio/views.py`, `max(1, min(int(raw) if raw.isdigit() else 60, 100))` |
| The drop branch really does narrow by `q` | `apps/audio/services.py:uploads(limit, podcast, played, query)` — "`query` narrows to the sounds whose title, words or uploader match" |
| A sound row is `source: "drop"`, its `id` is the drop's, its `stream` is `/api/v1/drops/drops/<uuid>/content/` | `apps/audio/services.py:sound_row` |
| A board row's `source` is `catalogue`, `playlist` or `drop` | `apps/audio/services.py:_board_row` |
| The weekly board rides inside `GET /audio/`, not an endpoint of its own | `apps/audio/services.py:home`, `"trending": trending(user)`; `trending()` returns `sounds`, `podcasts`, `playlists`, `boards`, `creators` |
| The phone's picker draws no catalogue row on any chip | `app/lib/screens/audio_picker.dart:_AudioPickerSheetState._load` — `all → _uploads()`, `trending → _trending()`, `saved → _saved()`; and the `AudioPickerTab` docstring |
| The phone's chip count is 60 | `app/lib/screens/audio_picker.dart`, `const int kPickerRows = 60` |
| The phone's box asks the uploads shelf whichever chip is lit | `_load`, `if (query.isNotEmpty) { found = await _uploads(query: query); } else { switch (_tab) … }` |
| The phone's carousel is the list's own first four rows, and stands down while there is a query | `_AudioPickerSheetState._body`, `if (_query.isEmpty && featured.length > 1) _carousel(featured)` over `rows.take(4)` |
| The phone's Trending drops everything that is not an upload | `_trending()`, `if (track.fromDrop) track` |
| The phone's Saved chip reads the *saved shelf*, not the hearts | `_saved()`, `Saved.it.open()` → `Saved.it.shelf` → `thing.audio` |
| The phone's bookmark is one write to `POST /saved/` | `app/lib/saved.dart:Saved.toggle` → `api.post('/api/v1/saved/', …)` |
| What that route accepts | `apps/saved/views.py:SavedView.post` — `{kind, id, on}`, id parsed as a UUID, 404 on a body that names nothing |
| Nothing else writes a save | `apps/drops/urls.py` has **no** `save` route at all |
| The two shelf-failure sentences | `app/lib/strings/en.dart` — `audioPickerNothingHereYet: 'Nothing here yet.'`, `audioPickerNothingMatched: 'Nothing matched "{1}".'`, `audioCouldNotLook: 'Could not look for that.'` |

### The defect, stated exactly

`PhotoEditor.tsx` asked `GET /api/v1/audio/tracks/` with **no `source`**, so the
server answered `services.catalogue()` — the shipped songs and episodes — and
then, when that came back empty, the effect drew the Audio tab's own
`recent + podcasts + hero` instead. Neither list is the one the phone's sheet
draws.

Which of the two the reported nine rows came from is **not established**: the
catalogue path is the better fit of the two — the phone's own docstring puts the
shipped catalogue at ten tracks, and `seed_audio.py` ships four songs and two
episodes, either of which reads as a list of about that size — while the Audio
tab's `recent + podcasts + hero` would not naturally land on nine. What the code
does establish is that the sheet could not have been drawing the uploads, because
it never asked for them. No count was taken against the live database, and none
can be from here.

The same file's bookmark wrote `POST /api/v1/drops/{id}/save/` for an uploaded
sound. **That route does not exist**, so every Save on an upload was a 404 and
the failure toast was the only true part of it.

### The wrong address, deleted rather than left standing

`src/services/drops.service.ts` carried a `save` method that posted to
`/{base}/{id}/save/` — the same shape as `like` and `hide` beside it, and an
address no urlconf in the backend defines (`apps/drops/urls.py` has no `save`
path). The editor was its last caller, so the method and its `DropSaveResponse`
type are deleted, with a comment in their place naming `POST /saved/`,
`store/saved.ts` and `hooks/useSaved.ts` as the one road onto the shelf. Left
there, it is the shape a future caller would reach for and get a 404 from — which
is exactly how this one was written.

### New regression tests

`src/features/audio/audioShelf.test.ts`, 10 cases:

```text
the weekly board's sounds
  keeps the uploads and drops the catalogue half                     PASS
  drops the playlists chart, whose rows are shelves and not sounds    PASS
  reads an older answer's named keys when there are no boards         PASS
  is nothing at all when the tab has not answered yet                 PASS
a board row read as a list row
  carries the source through, which is what the bookmark files under   PASS
  falls back to a shelf row's own name, which has no title            PASS
a kept thing read as a sound
  is the track's own row when a catalogue track was saved             PASS
  turns a saved upload's card into the row a sound list draws         PASS
  names a sound nobody titled by what the poster wrote under it       PASS
  is nothing for a saved picture, clip or note                        PASS
```

`npm test` is now 62 cases over 9 files.

### Not executed

- **No signed-in browser run.** The backend is not reachable from this
  environment and there are no account credentials, so none of this has been
  watched happening: the sheet drawing the uploads shelf; a search narrowing it;
  the Trending chip drawing the week's uploads; the Saved chip drawing what the
  bookmark wrote; Save filing a sound and the glyph filling.
- **The number of rows the sheet draws was not observed.** That the route
  answers a different, larger list with `source=drop` is read off the view; how
  many rows that is on the live database was never counted, and the sheet stops
  at 60 by design either way.
- **No visual comparison** of the two sound sheets, of the carousel against the
  phone's, or of the failure sentences.

### Read-only project check

`git -C xelvic status --short` is byte-for-byte the same eight pre-existing
entries it reported in the previous pass — seven modified `app/` files and the
untracked `.tools/` — with **nothing under `backend/`**. Nothing outside
`xelvic-web/` was created, edited or deleted.

## 18. The part-length pill's menu (2026-11-02, seventh round)

Reported: in "Choose a part" the seconds button should open a dropdown, and it
opened a bar of its own.

### The four checks

```text
npx tsc -b                      PASS
npx eslint src --max-warnings=0 PASS
npm test                        71/71 PASS (10 files)
npm run build                   PASS in 4.56 s
```

Build output: entry 455.61 kB (143.07 kB gzip), `PhotoEditor` 76.55 kB,
stylesheet 121.98 kB.

### What was read, and where

| Claim | Read from |
| --- | --- |
| The phone offers **eleven** part lengths, ten to sixty in fives | `_WindowViewState._durationSeconds`, `app/lib/screens/audio_picker.dart:2426-2428` |
| The web offered six (ten to thirty-five), so forty to sixty could not be asked for | `AUDIO_PART_WINDOWS` as it stood in `PhotoEditor.tsx:114` |
| The phone opens a modal sheet here, with the chips in a horizontal scroll | `_pickDuration`, `audio_picker.dart:3343-3383`, and `_durationChoice`, `:3385-3405` |
| The phone's heading over them is "How many seconds" | `Str.audioHowManySeconds`, `app/lib/strings/en.dart:3637` |
| Each chip's label is `{n}s` | `_durationChoice`, `'${seconds}s'` |
| The phone's start–end readout is **inert** — a `Container`, no gesture | `_readout`, `audio_picker.dart:3260-3280` |
| The readout and the length pill sit on one line with "Use" | `audio_picker.dart:3476` (`Expanded(child: _readout())` in that row) |

### What changed, and the one deliberate difference

The list is the phone's eleven now. The **presentation is not**: the phone opens
a modal bottom sheet of chips, and this is a menu anchored to the pill, because
that is what was asked for. The heading's wording, the `10s`…`60s` labels, the
readout becoming inert and the lengths themselves are all the phone's.

The start–end readout being a button was a web-only invention: **both** pills
opened the same chooser, which put two controls on one line for one question.

### New regression tests

`src/features/audio/partLength.test.ts`, 9 cases:

```text
the lengths a part may be
  is the phone's own list: ten to sixty, in fives                     PASS
  holds the forty to sixty it used to leave out                       PASS
where the menu opens
  opens upwards above a pill at the foot of the sheet, full list       PASS
  opens downwards when there is more room below the pill               PASS
  stops at the window's edge instead of hanging off it                 PASS
  never runs off the left edge either                                  PASS
  grows no wider than the longest label needs, however wide the pill   PASS
  takes the taller side and scrolls when neither side fits the list    PASS
  is never shorter than one row, on a window with no room at all       PASS
```

`npm test` is now 71 cases over 10 files.

### Not executed

- **No browser run at all.** Whether the menu draws above the pill in the real
  sheet, whether it keeps up while the sheet scrolls under it, and whether a pick
  moves the frame and the readout are all unwatched. The arithmetic is tested and
  the list is the phone's; the rendering is not.
- **No measurement of the menu against the sheet's own height.** The sheet is
  capped at 86% of the editor, and the menu's 456 px is assumed to fit above the
  pill inside that. If it does not on a short screen, the menu scrolls rather
  than overflowing — which is the tested fallback — but that it scrolls has not
  been seen.
- **No keyboard pass.** Arrow keys, Home/End, Escape and the initial focus are
  written and lint-clean, but no keyboard was driven through it.
- **No visual comparison** with the phone's sheet.

### Read-only project check

`git -C xelvic status --short` is byte-for-byte the same eight pre-existing
entries it reported in the previous pass — seven modified `app/` files and the
untracked `.tools/` — with **nothing under `backend/`**. Nothing outside
`xelvic-web/` was created, edited or deleted.

## 19. The feed's own options, and one lock for four overlays (2026-11-02, eighth round)

Two reports, neither of them a missing feature. The first was an error on the
drops feed — **"Something went wrong. options.getNextPageParam is not a
function"** — arriving sometimes and never on a feed that had just been opened.
The second was a page that would not scroll when it was reached from another
page, which a refresh fixed.

### Nothing here is a library bug

The message is the library's own, from a call it does not guard. In the
installed `@tanstack/query-core` 5.104.5:

- `infiniteQueryBehavior.js` asks `options.getNextPageParam(...)` for every page
  after the first, unguarded, and reaches it only when there is more than one
  page to re-read (`remainingPages = pages ?? oldPages.length`).
- `query.js` — `Query.fetch(options, fetchOptions)` begins
  `if (options) this.setOptions(options)`, and `setOptions` **replaces**:
  `this.options = { ...this.#defaultOptions, ...options }`. It is not a merge,
  so an option left out of the object being passed is an option the query no
  longer has.
- `queryClient.js` — `invalidateQueries({ queryKey: ["drops"] })` (the default
  `refetchType: "active"`) reaches `refetchQueries`, which calls
  `query.fetch(void 0, …)` — **the query's own options**, not the observer's.
  This is what liking, keeping, commenting, hiding or reporting a drop does.
- `queryClient.js` — `fetchQuery` skips the fetch when the data is fresh
  (`query.isStaleByTime(...)`), which is why a prefetch only does damage when it
  actually re-reads.

Put together: `src/routes/prefetchData.ts` warmed the feed's two queries with
its own statement of them — the same key, the same first ask, and **without
`getNextPageParam`**. That was harmless while the cached feed was fresh (no
fetch, no `setOptions`) and harmless on a one-page feed (the page rule is never
reached). With a feed older than the prefetch's `staleTime` and more than one
page already in hand, the prefetch replaced the query's options with an object
that had no page rule in it, and the next invalidate threw. That is the whole of
the intermittency: three conditions, none of them true on a feed that was just
opened.

### Proven, not assumed

The diagnosis was checked against the old shape in a scratch test: the same
options object with the page rule struck out, prefetched, then two pages put in
the cache, then one invalidate. It went to `status: "error"` with exactly
`options.getNextPageParam is not a function`. With the rule stated it stays
`status: "success"` and asks for the page the rule names. The scratch file was
deleted; the committed test is the healthy half of that pair.

### The fix

- New `src/features/drops/feedQueries.ts`: `dropsFeedQuery` and
  `dropsVibesQuery` — key, fetch, first ask, page rule and `staleTime` in one
  object each.
- `src/pages/DropsPage.tsx` reads them; `src/routes/prefetchData.ts` warms them
  by the same objects rather than by a second copy. There is now no second copy
  to disagree, in the options or in the key.
- The prefetcher inherits the feed's own 60 s freshness (it warmed on 30 s
  before). A prefetch that re-reads a feed the page would then treat as fresh is
  the waste; asking the page's question is the point.
- `prefetchData.ts`'s docstring stopped claiming that a mistake here costs "a
  wasted request, never a wrong answer". It cost a wrong answer once.

### The page that would not scroll

`src/utils/scrollLock.ts` is new, and it is one lock where there were four
save/restore pairs. The document is what scrolls in this app — `AppShell`'s
`main` is `min-h-dvh` and grows, there is no inner scroll box — so
`document.body.style.overflow = "hidden"` is the whole of "the page behind this
overlay stays put". Four overlays wrote it: `Modal`, `VibeViewer`,
`MomentViewer` and the convo's Spark viewer. Each kept the value it found and
wrote it back on close, which is correct for one overlay at a time and wrong for
two:

- **Two overlays, closing out of order.** A reads `""`, writes `hidden`; B reads
  `hidden`, writes `hidden`. A closes and restores `""` — B is now open over a
  page that scrolls. B closes and restores `hidden` — the page is now locked
  with nothing on it.
- **An effect that re-runs while it is open.** `VibeViewer`'s effect depends on
  the clip it is on and on the viewer's own callbacks, and `MomentViewer`'s on
  the moment it is showing and on each of its sheets, so both re-run on a screen
  that stays up. A re-run cleans up first, and the cleanup writes back the value
  that was read *before* whatever opened meanwhile — releasing the lock that is
  still on screen and adopting the other overlay's state as the "original".

Either order leaves `overflow: hidden` on a page with no overlay, and the only
thing that clears it is a reload — which is the report: arriving at a page from
another page and finding it will not move, fixed by a refresh.

The count fixes both. The original value is read once, by the first lock, and
written back once, by the last release; a re-run in the middle changes nothing;
a release is idempotent, so an effect cleanup and a click handler can both run
it. All four sites now take the lock and release it, and there is no other write
to `body.style.overflow` anywhere in `src/`.

### Two more things the convo's Spark viewer was doing

Reading that viewer for the lock turned up two defects, both from the same fact:
**the host keeps it mounted for the length of a convo** and hands it an empty run
while no Spark is open (`ChatPage.tsx`: `<SparkViewer looks={sparkView ?? []} …>`,
unconditionally).

- Its effect took the lock on mount, not on opening, so the convo page held
  `overflow: hidden` for as long as a convo was open — whether or not a Spark
  ever was. That is a lock held by nothing on screen, and it is the state the
  save/restore pairs could hand back to the *next* page: whatever the viewer had
  read as the "original" is what it wrote back when the convo was left. The lock
  is now taken only while a run is actually open.
- The walk's own position (`at`) outlived a run, because the component does not
  unmount. Escape out of a two-look run at index 1, open a one-look run, and the
  viewer drew **nothing** — a tap that appeared to do nothing at all, which is
  the one thing this project's rules forbid. The position goes back to the start
  when a run ends, along with the reply draft and the sent mark.

Both were found by reading, not by testing, and both come with the same
`NOT VERIFIED` status as the rest of this pass.

### Checks at the end of this pass

```text
npx tsc -b                       PASS
npx eslint src --max-warnings=0  PASS
npm test                         80/80 PASS (12 files)
npm run build                    PASS in 5.79 s
```

Production build: the entry chunk is 455.68 kB (143.11 kB gzip) and the
stylesheet 122.08 kB (no file under `src/styles/` was touched; the stylesheet is
Tailwind's own output over the source tree). The drops page is 42.42 kB, the
convo 99.87 kB and the moment viewer 42.89 kB.

### New regression tests

`src/features/drops/feedQueries.test.ts`, 3 cases, over a mocked drops service
and a real `QueryClient`:

```text
the feed's own query options
  carry the next-page rule for both shelves                            PASS
  turn the address the server handed out into a path to ask for        PASS
  leave a feed with two pages in hand unharmed by an invalidate        PASS
```

The third is the reported error: prefetch by the page's own options, two pages
in the cache, an invalidate, then no error, `status: "success"`, and the asks
recorded as page one followed by the page the rule names.
`refetchType: "all"` stands in for a mounted page — a real invalidate refetches
the *active* queries, and both reach the same `query.fetch(void 0, …)`.

`src/utils/scrollLock.test.ts`, 6 cases, each on a fresh copy of the module and
a fake document:

```text
lockScroll
  holds the page still, and hands it back on release                   PASS
  stays held until the last overlay lets go, not the first             PASS
  changes nothing when an effect re-runs over a second overlay         PASS
  restores the value the page had, not an empty one                    PASS
  counts a release once, however many times it is called               PASS
  is a no-op with no document to lock                                  PASS
```

`npm test` is now 80 cases over 12 files.

### Not executed

- **No browser run of either fix.** That the feed recovers after a prefetch and
  an invalidate, and that a page reached from another page scrolls, were both
  reasoned out of the installed library's source and pinned by the unit tests
  above; neither has been watched in a signed-in browser. The error itself was
  reproduced in Node against the old shape — that part is measured.
- **Not every order that used to strand the lock is covered.** The six cases
  cover the two orders that were read out of the code (two overlays closing out
  of order, an effect re-running over a second overlay), not an exhaustive
  interleaving of four overlays and their sheets.
- **The report was intermittent, so a repeat is the only real proof.** If the
  error or the stuck scroll is seen again, the browser console can now name
  which path it came in on: the feed query's state carries the error, and the
  lock's count is one number.

### Read-only project check

Unchanged: the same eight pre-existing entries, nothing under `backend/`, and no
file outside `xelvic-web/` created, edited or deleted.

## 20. One surface for the camera's editor (2026-11-02, ninth round)

Reported: *"photo editor me jaise audio ka background aur text color hai waise hi
text aur sticker aur other tabs ka kijiye"* — the Audio tool's panel, in the
background and text colour the theme gives it; the Text and Sticker tools, and
the rest of the editor, left on the surface the editor had before it followed
the theme at all.

### Two grammars in one editor

Read out of `src/features/camera/PhotoEditor.tsx`, the editor's surfaces were
split down the middle:

| Surface | Background and text before | Reached by |
| --- | --- | --- |
| Audio sheet | `bg-card` / `text-ink` | the Audio rail tool, which always opens it |
| "Choose a part" (trim) sheet | `bg-card` / `text-ink` | a track in the audio sheet |
| Tag sheet | `bg-card` / `text-ink` | the Tag rail tool |
| **Sticker sheet** | `bg-[#15151d]` / `text-white` | the Sticker rail tool |
| **Filter, Text, Draw, Cut out, Crop, Aura, layer bar** | `bg-[#171316]/95` / `text-white` | the rail tools, floating over the picture |
| **Audio strip** (the tool's own panel, above the sheet) | `bg-[#171316]/15`, `rounded-lg`, `shadow-lg` | the Audio rail tool once the sheet is dismissed |

The last row was the odd one even among the strips: every other panel was 95%
charcoal at `22px`, and the audio strip alone was 15% at `8px`.

The theme tokens are not a detail here — `--card` is `#ffffff` on the default
theme, so the Audio sheet has been a white sheet with near-black words while the
Sticker sheet beside it was near-black with white words, and the text panel's
*selected* sub-tab was `bg-card text-ink`: a white chip reading as the off one
among the white-on-charcoal chips around it.

### The surface, named once

`PANEL`, `CHIP`, `CHIP_OFF` and `CHIP_ON` now sit at the top of `PhotoEditor.tsx`
and every tool panel, every control on a panel and the sticker sheet read them,
instead of each panel restating a surface freehand. A surface restated per panel
is a surface that drifts — the same shape of mistake as the drops feed's two
copies of one query's options in the eighth round
(`src/features/drops/feedQueries.ts`), which cost the feed an error. The Audio
sheet's own tab row now reads `CHIP_ON`/`CHIP_OFF` as well, so the pair the rest
of the editor borrowed is provably the pair the audio sheet uses.

### Three things the light surface forced

1. **The text field could no longer be the colour preview.** It carried
   `color: selectedText.color`, and `EDIT_TEXT_COLORS` opens on `#ffffff`. White
   words are an empty-looking field on a light panel — and the near-black at the
   other end of the same palette is the same problem on a dark one, so no single
   ground fixes it. The words are now the theme's ink and the chosen colour is
   the dot at the head of the field. **This is the one deliberate behaviour
   change in the pass, and the one a user could read as a loss**: the colour is
   still chosen one tap away in the Color tab, and what the words will really
   look like is on the picture under the panel.
2. **A pill painted in a colour cannot write its name in the panel's ink.** The
   Background and Outline rows draw each pill in the colour it chooses with the
   colour's name on top. "White" was a near-white pill with white words on it
   *before* this pass, on any theme; on a light panel every pill's label went the
   same way. `inkOn()` — exported beside the palettes it is about, in
   `editorTypes.ts` — answers the panel's ink for the pill that *is* the panel
   (`none`, and anything the panel shows through) and a fixed black or white for
   the rest.
3. **The current tab had no accent anywhere except the audio sheet.** The sub-tab
   rows in the text panel and the sticker sheet marked the current one with a
   brighter grey. They now mark it the way the audio sheet does: `bg-accent` with
   `text-on-accent`, against `border-line bg-card text-dim`.

### What deliberately did not change

The controls that sit *on* the photograph — the header's close, undo and next
pills, the crop's dim and corner handles, the frame tool's zoom row and fill/fit
chip, the AudioArt glyph on album art, the posting veil. Words over a picture
need a scrim or a shadow to stay legible, and the theme cannot know what is
behind them. The comment over the new constants says so, so that the next pass
does not "finish the job" by painting them too.

The app's own editor is charcoal in **every** tool's panel (`_sheet` in
`app/lib/screens/editor/image_editor.dart` returns one `_chrome` for all of them,
and the sticker sheet's search row carries a comment saying it is a dark row on a
sheet that is dark in every theme). The web's Audio sheet, trim sheet and Tag
sheet had already chosen the theme instead. This pass follows the user's
instruction and the majority of the web's own sheets, not the phone. That is a
deliberate divergence and it is recorded as one — not as parity — in
`XELVIC_FEATURE_PARITY_MATRIX.md`.

### Checks at the end of this pass

```text
npx tsc -b                       PASS
npx eslint src --max-warnings=0  PASS
npm test                         85/85 PASS (12 files)
npm run build                    PASS in 5.80 s
```

Production build: the entry chunk is 455.68 kB (143.12 kB gzip) and the
stylesheet 121.96 kB, down from 122.08 kB — the hardcoded colours this pass
removed were Tailwind arbitrary values, and eight of them no longer exist to be
generated. The picture editor's own chunk is 76.20 kB, down from 76.55 kB. The
drops page is 42.42 kB, the convo 99.87 kB and the moment viewer 42.89 kB. The
build was re-run after the last source edit and produced the same chunk hashes
(`index-dmPhtnjd.js`, `PhotoEditor-DOa5Eb01.js`), so the sizes above are the
committed source's, not an earlier draft's.

### New regression tests

`src/features/camera/editorTypes.test.ts`, five more cases, taking the suite
from 80 to 85:

```text
ink on the editor's own colours
  puts dark words on a light plate and light words on a dark one       PASS
  reads the panel's own ink where the panel is the ground              PASS
  reads the translucent ends of the plate row against what shows
  through                                                             PASS
  never paints a plate's name in the plate's own colour                PASS
  answers every plate in the row with a definite ink                   PASS
```

The fourth is the regression: it asserts the white plate is not given white
words and the black plate is not given black ones. The fifth walks all nine
values of the row, so a plate added later cannot quietly arrive without an
answer.

### Not executed

- **Nothing here was seen rendered.** The whole pass is class names in one file,
  and the suite is `environment: "node"` — it does not render a component. The
  four checks above prove this compiles, lints and bundles; they do not prove it
  looks right. No signed-in browser run is possible in this environment.
- **No contrast measurement.** `inkOn` splits on a 0.5 luma threshold, which is
  a heuristic and not a WCAG check; the palette's mid values (`#4da3ff` at 0.594,
  `#b36cff` at 0.524) sit close to it. Nothing ran a contrast checker over the
  plate row, the accent-on-card pairs or the accent-filled tab.
- **The light theme is the one that matters and the one untested.** The default
  theme is light (`--card: #ffffff`), which is where the two grammars were most
  visible, and it is exactly the state no run in this environment can show.
- **The dark themes were not walked either.** Every class here is a theme token,
  so the change should follow the theme — that is reasoned, not observed.

### Read-only project check

Unchanged: `git -C ../xelvic status --short` reports the same eight pre-existing
entries (seven modified files under `app/`, plus `?? .tools/`), **nothing under
`backend/`**, and no file outside `xelvic-web/` created, edited or deleted.
`app/lib/screens/editor/image_editor.dart` was read for the parity comparison
above and not written to.

## 21. The convo list's line, its count, and the Spark a row opens (2026-11-03, tenth round)

Reported: *"convo ke userlist me abhi sab kuch exact app ke jaisa nahi hai jaise
user name ke neeche galat data aa raha hai aur spark icon par click karne par
kuch aur open ho raha hai jabki app me spark ka modal show hota hai us user ke
related aur abhi unread count aa raha hai jab ki app me unread count dusare way
se hai username ke neeche hi"* — three defects in the chat list, and one
instruction over all of them: make the row however the app has it.

### The rule the line was breaking

Read out of `app/lib/screens/home.dart::listLine`, whose own comment is the whole
reason the rule exists:

> **Never the message itself.** A chat list is the screen people read over your
> shoulder, so the last line of a private conversation has no business on it.

What is left when the words are taken away is four things, and the phone's order
between them matters:

1. **Nothing in it at all** → `Say something`. This comes *first*, ahead of any
   count — a count on a row with no line under it is a number about nothing.
2. **My own line is the last one and the server gave it a receipt word** →
   that word (`Sent`, `Delivered`, `Opened`). It describes *my* outgoing bubble,
   never the incoming line the row is about, which is why it is read only behind
   `preview.mine`.
3. **Something is waiting** → `N new` — with no noun. `message` is a word this
   product does not use, and `convos` would be a lie because they are all in one.
4. **Otherwise** → `Nothing new`.

A convo with myself has its own line — its own receipt word, or
`Convo with yourself` — because there is no second person whose words could be
it, and `Say something` is an invitation to a conversation that does not exist
here.

The web before this pass printed the preview: `You: see you at six`,
`Photo`, `A drop`, `Something arrived`, `Waiting for them`, and
`3 new messages` in the one case where there was no preview. The leak is the
first of those and the noun is the last; the rest are words the app does not
have.

### What the row says now

`listLine(thread, unread)` in `src/features/convo/model.ts` is the phone's order
line for line, and `lineTone(line, unread)` decides the colour from the words
actually on screen rather than from the receipt behind them — the phone's own
reason: a run of theirs with nothing since draws `Nothing new`, and a colour
picked from a receipt that is not on screen ends up accenting the words
`Nothing new`. `Opened` is bold and accented whatever is waiting; a waiting line
is full-strength ink; everything else is quiet.

### The count, moved under the name

| | Before | After |
| --- | --- | --- |
| Direct convo | accent circle, far right of the row, under the clock, `99+` clamped | `N new` as the line under the name |
| Group | the same circle on every row | a plate at the **end of the name**, and `N new` under it |
| Convo with nothing new | no count | no count |

The plate is groups only on purpose (`convoUnreadBadge`'s own comment): a
one-to-one is one other voice, and `N new` already answers how much of it is
unread, while a group is several and the number is the only compact way to say
how many. The row's right-hand corner therefore has no count in it at all any
more — that corner is the clock's and the marks', and a number that has to be
found across the width of a row is a number read against the wrong name.

Muted rows need no rule of their own: the phone draws a `Muted` tag under the
line (`_tags`: a `Group` tag, then a `Muted` tag, in a wrap), the web already
drew both pills in the same place, and this pass left that alone. The muted row
shows its count and its line exactly as any other row does, on both clients.

### The Spark, opened rather than navigated to

The chip's tap used to call `navigate("/app/sparks")` — the **wallet**: the
balance, everything ever earned and spent. That is a different question from the
run between the two people on the row, so the tap opened the right product and
the wrong screen.

It now opens `SparkSheet`, a port of `app/lib/screens/spark.dart`:

- the ring, read from the lap's own `pct`, around the head award's glyph;
- the figure (the one place a spark is ever a number) — `12 / days`, `Broken`,
  `Hidden`, `Not started`, `Count starts again`;
- the awards worn, each in its own colour, faded when the run is cold;
- each person's own clock in amber, from their own last message: past 24 hours
  of one person's silence their timer shows, at 48 hours the run breaks to 0;
- the closing sentence naming *whose* clock is running out;
- the broken banner with the day it leaves the list, and the buy-back offer with
  its price, the wallet balance, the deadline and the refusal sentence the server
  sends;
- the hidden banner and the `Hide this Spark` switch;
- the next rung and how many days off it is;
- the seven-rung ladder with its names and its day ranges;
- the rules paragraph.

Three service methods were added for it — `one`, `setOff`, `restore` — each on
an endpoint the phone already calls and the backend already serves
(`GET /sparks/threads/<id>/`, `POST .../off/`, `POST .../restore/`). Nothing new
was invented server-side, and the backend was read and not written to.

The sheet draws the row's copy at once and refines it from the fresh read; a
failed or null read leaves the row's copy up rather than emptying the sheet. A
1-second interval re-renders the two countdowns off the last-message dates the
one payload already carried, so an open sheet counts down without asking the
server again. A refused restore shows the server's own sentence; anything else
(no network, a crash) shows `Could not restore this Spark just now.` rather than
the server's words for a refusal it did not send.

### The rest of the marks row

While the corner was being rebuilt, the rest of the phone's line was brought
across, in its order — `if (pinned)`, `if (isBirthdayTodayIn(other))`,
`if (spark.timerMine || atRisk)`, the spark, the clock:

- **The pin**, a 16 px disc with a 9 px glyph, accent-tinted on a waiting row
  and ink-tinted on a quiet one (`convoPin`).
- **The cake**, on the one day of the year it means anything, read off the
  row's `other` — so a group and my own convo never draw one. The server puts
  `birthday` on every user card for exactly this reason
  (`UserCardSerializer.get_birthday`); the web's `UserCard` type was missing the
  field and now carries it.
- **The gaps** are the phone's and are not one number: 3 px between the timer
  and the spark (they are one mark in two parts), 7 px between the spark and the
  clock whether or not the timer is drawn.
- **The waiting bar** went from 7 px full-height to the phone's 3 px mark inset
  14 px from the top and bottom with a rounded trailing end — a short mark beside
  the face rather than a rule separating the row from its neighbours.

The birthday rule itself moved into one module, `src/features/profile/birthday.ts`
(`birthdayFromMonthDay`, `todayMonthDay`, `isBirthdayToday`,
`isBirthdayTodayIn`), and the two profile pages now read it instead of keeping
their own copies of a string compare. That compare had a real divergence: it
required the padded form, so `11-3` from a server that did not pad would not have
drawn the day. The new parse accepts the pair and refuses a pair that is not a
day of the year — the 31st of February rolls forward in a `Date`, so the round
trip is the check.

### The Unread lane

`unread_other_count` is the part of a row's count that is not an unread Spark,
and the phone's `convoInUnread` uses it to keep a convo whose only waiting line
is a Spark off the Unread lane — the owner's rule of 2026-10-24, because a Spark
is played from the row and the lane is a list of words somebody still has to
read.

The web's lane filtered on the whole count. It now uses `inUnreadLane`, which
asks the count first (so the lane and the row's tint can never disagree about
whether a convo is waiting at all) and then the split. A card from a server
without the split keeps the old answer — unread is unread — because guessing
"only Sparks" from a missing key would hide a convo with words in it.

### Deliberately not drawn

- **The play button.** The phone draws one when a convo holds unread Sparks and
  plays the run on the spot. This build's Spark run viewer lives inside
  `ChatPage` (it needs the thread's message pages and its own scroll lock), so a
  row cannot open one without a thread; the button is not drawn rather than
  drawn as a tap that navigates and then does nothing. Recorded as
  `NOT IMPLEMENTED` in `XELVIC_FINAL_GAP_REPORT.md`.
- **"Add to Moments"** on the sheet — no spark-moment composer exists here, and
  the pill is a door that would open nothing. *(Closed in the eleventh round:
  the pill now opens a real composer. See §22.)*
- **The muted-row rule.** The phone treats a muted row as nothing waiting for
  the purposes of its line's tone. The web keeps its own muted pill and its
  existing tone; changing that is a behaviour decision rather than a fix to any
  of the three reported defects, and it is named in the parity matrix instead of
  being changed quietly.

### Checks at the end of this pass

```text
npx tsc -b                       PASS
npx eslint src --max-warnings=0  PASS
npm test                        112/112 PASS (14 files)
npm run build                    PASS in 4.33 s
```

Production build: the entry chunk is 456.05 kB (143.23 kB gzip) and the
stylesheet 125.89 kB, up from 121.96 kB — the new row's marks, the sheet and the
ladder are mostly Tailwind arbitrary values, and those are what the stylesheet
grew by. `ConvoLayout` — where the row and the sparks model landed — is 86.91 kB,
the convo 99.87 kB and the picture editor 82.48 kB.

The per-chunk figures from the ninth round are not comparable with these: the
recorded `PhotoEditor` size was 76.20 kB for a file this pass did not touch, and
a build of this tree before the row changes gave 82.48 kB, so the difference is
the toolchain's rather than this pass's. What moved because of this pass is the
stylesheet and `ConvoLayout`; those are the two the source changes are in.

### New regression tests

`src/features/sparks/model.test.ts` (new, 18 cases) and
`src/features/profile/birthday.test.ts` (new, 6 cases), plus 6 more in
`src/features/convo/model.test.ts`, taking the suite from 85 to 112 over 14
files:

```text
the ladder
  is the seven rungs the prototype has, in order and unbroken           PASS
  finds a rung by key, both ways the payload carries one                PASS
  writes the days it covers                                             PASS
  lights the ladder from the best ever, not from the run               PASS
what a run wears
  gives a broken run the rung it broke on, drawn cold                  PASS
  puts the Century first and the live rung beside it                   PASS
  shows nothing for a run that ended before it got anywhere, or is
  hidden                                                                PASS
the two clocks
  counts each side off its own last message                            PASS
  says a side's clock only when the run is going                       PASS
  names the side that is running out                                   PASS
  reads a span in the largest unit it has                              PASS
the offer on a broken run
  takes both keys or neither                                           PASS
  reads the deadline off hold_until, in days and then in minutes       PASS
what the sheet says
  tells the four things the number can be                              PASS
  promises nothing about a run that is not going                       PASS
the shape the server sends a birthday in
  reads a pair, padded or not                                          PASS
  refuses anything that is not a day of the year                       PASS
whether today is somebody's day
  writes today the way the server does                                 PASS
  answers for the day and only the day                                 PASS
  reads the field off whatever the caller is holding                   PASS
listLine
  never prints what was said, from either side                         PASS
  reads my own run as its receipt and theirs as a fact                 PASS
  counts without the noun the rest of the product does not use         PASS
  keeps an empty row's invitation ahead of its count                   PASS
  stays quiet on a held line rather than describing it                 PASS
  gives an empty convo an invitation and my own convo its own line     PASS
  reads the count off either name the server sends it under            PASS
the Unread lane
  reads the split, and reads a missing split as no split               PASS
  leaves a convo whose only waiting line is a Spark off it             PASS
lineTone
  points at Opened whether or not anything is waiting                  PASS
  decides waiting and quiet from the words on screen                   PASS
```

Two of these are worth naming as regressions rather than coverage.
`listLine`'s *"keeps an empty row's invitation ahead of its count"* pins the
phone's order and the old web wording at once — the web put `3 new messages`
there. And *"reads a pair, padded or not"* pins the birthday divergence the two
profile pages had with their own string compare.

### Runtime status: NOT VERIFIED

- **Nothing here was seen rendered.** The suite is `environment: "node"` and
  does not render a component; the four checks prove the pass compiles, lints and
  bundles. They do not prove the row's marks sit where the phone's do, and no
  signed-in browser run is possible in this environment.
- **The spark sheet's live behaviour is unexercised.** The refresh read, the
  1-second tick, the hide switch and the restore button have never been run
  against a server. The three routes were confirmed by reading
  `backend/apps/sparks/urls.py` and matched against the phone's own requests;
  that is all that was confirmed.
- **The buy-back is the one write here that spends.** It was not executed: no
  wallet was drawn down, and whether the server's refusal arrives as the 400 the
  sheet treats as a sentence was read from the contract, not observed.
- **The line's own data was reasoned from shapes, not observed.** That
  `preview.mine` and `status` arrive together for my own last line, and that a
  held line carries `preview.held`, are the contract's; no live thread was read.
- **The Unread lane's split was not watched.** `unread_other_count` is in
  `ThreadCardSerializer`'s fields and the socket's `thread.update` passes it
  through; that a Spark-only convo disappears from the lane is the rule the
  phone and the server state, not a thing that was seen.

### Read-only project check

Unchanged: `git -C ../xelvic status --short` reports the same eight pre-existing
entries (seven modified files under `app/`, plus `?? .tools/`), **nothing under
`backend/`**, and no file outside `xelvic-web/` created, edited or deleted. This
pass read `app/lib/screens/home.dart`, `app/lib/birthday.dart` and
`backend/apps/chat/serializers.py`, `backend/apps/accounts/serializers.py` and
`backend/apps/sparks/urls.py`, and wrote to none of them.

## 22. The Spark card, and the sheet's "Add to Moments" (2026-11-04, eleventh round)

The tenth round left one thing off the Spark sheet and named it: the phone's
sheet ends with an "Add to Moments" pill, and this build had no composer for it,
so the pill was left off rather than drawn as a door that opens nothing. That
pill is now drawn, and so is the page behind it — a port of
`app/lib/screens/spark_moment.dart` (`SparkMomentScreen` and its painter).

### What the sheet gained

`SparkSheet` drew the next rung's sentence alone. It now draws the phone's own
`_comingUp()` row: that sentence, and the pill beside it. The pill is the
stadium the phone draws — `Sparkles` at 15 px, 12.5 px w700, padding `h12/v7`,
ground `color-mix(in srgb, var(--accent) 12%, transparent)`, accent ink — and it
is drawn on **every** run the sheet can draw, including a broken one and one that
has not started, because the phone draws it on every run: a card is a thing a
person does with a run, not a prize for a good one. The tap opens the page over
the sheet rather than navigating away, so the run is still behind it when the
page closes, which is the phone's own arrangement (its card is pushed, and the
sheet pops itself when a moment goes up).

### The card (`src/features/sparks/card.ts`)

The phone paints the card; it does not build a widget for somebody else's phone
to draw. This is the same decision, ported to a canvas:

- **The page is 1080×1920 and the card is not the whole of it.** The card is
  840×1520, left 120, top 248 — the width a phone actually shows once a vertical
  moment crops its sides (`kSparkCardWidestCrop` 120 each side), and a nudge of
  48 px below the middle because the viewer's own bars are not the same height
  top and bottom. Both facts are the phone's, and both are pinned by tests.
- **Nothing about it is themed.** The paper is the award's own colour at 10 %
  over white, the ink is fixed (`#1B1420`), the dim is fixed (`#8A8394`), and the
  one colour that means anything is the award's. A card is looked at on somebody
  else's phone; it wears what it was about, not what the app looked like that
  day.
- **The award drawn is the one the run is on**, by the sheet's own rule
  (`headAward`): the highest rung worn, or the current one when nothing is worn.
  A run that broke after a Century wears the medal, which is a thing that was
  won.
- **What is on it**: the flame in the award's colour, the two lines up to it with
  a chat mark and a call mark sitting *on* the curves at t=0.30 and t=0.62 (the
  two things a Spark is kept by), both faces with their names and the list's own
  green dot for whoever is here, the ring with the award's glyph, the award's
  name in its letter-spaced caps, the days, the rule, and the closing line
  ("A little message keeps the Spark going.") between a sparkle and a heart.
- **The glyphs are `lucide-react`'s path data, written out by hand.** A canvas
  cannot take a React component, and the alternative — a second icon set drawn
  only for this picture — would put two icon languages in one client. The
  ladder's seven rungs, the chat and call marks, the sparkle and the heart are
  all the same marks the rest of the web draws, stroked from the same geometry.
  `AWARD_GLYPH_KEYS` is asserted to cover every rung, because a rung with no mark
  would fall back to the flame and read as a bug in the picture.
- **Faces come through the tab's own media cache, or not at all.** The painter
  draws a picture only when it can get one without tainting the canvas —
  `utils/mediaCache.ts` for this API's own file paths, or a local `blob:`/`data:`
  URL. A CDN address whose CORS headers this client cannot know falls back to the
  initials plate, which is what the list itself does. A card with initials still
  posts; a tainted canvas posts nothing at all.
- **`roundRect` is guarded.** It is newer than the rest of the canvas, so a
  browser without it walks the four corners itself rather than drawing a card
  with square ones.
- **There are five looks, and the first is the phone's.** `SPARK_CARD_STYLES` is
  `["classic", "midnight", "sunset", "aurora", "noir"]`; `randomSparkCardStyle()`
  picks one uniformly. `classic` is everything described above, and the four
  after it are the design sheet's own composition on that same skeleton — see
  **The four looks after the first card** below.

### The four looks after the first card — 2026-11-05

The four alternate styles had been invented here as thin variations on the
classic card. They were replaced with the composition a four-card design sheet
carries. `classic` was not touched.

**How the sheet was read.** This session cannot see an image, and `Read` on a
PNG returns bytes rather than a picture, so the sheet was *measured*. A
pure-stdlib PNG decoder (zlib + the unfiltering loop) was written outside the
repo and run with `-I` over the file to give pixel access; on top of it, two
probes: one that prints per-band mean/darkest/lightest and the commonest colours
per card, and one that finds the cards themselves by column and row variance
against the flat board behind them. The words came from Windows' own OCR engine
through WinRT (`Windows.Media.Ocr`) driven from PowerShell. A local vision model
was also pulled and asked; its *structural* answers (which motif is on which
card, that every card carries a pill under the award) matched the measurements
and are what is recorded, while its naming of the four cards was inconsistent
between asks and was not relied on.

**What the sheet says.** Four cards, one spark, one skeleton under all four: the
two faces with names at the top, the motif at norm. y ≈ 0.40–0.44, the award's
name at ≈ 0.65, the days at ≈ 0.75, the closing line at ≈ 0.88. A **violet pill
sits behind the days on all four**, and behind the closing line on three. Grounds
measured off the sheet: TL `#F4F1FB`, TR `#201040` (the only dark card), BL
`#F3F2FB`, BR `#F1EAFB`. There is **no brand wordmark** on any card — the OCR
string that looked like one was the engine reading a photograph in the left
avatar.

**What was drawn, round one — superseded on 2026-11-05.** All four on the classic
skeleton, with one flat ornament each (a sun of four concentric discs, four discs
and seven stars, three bezier ribbons, a low wash with hairlines). That version
did not match the sheet and was replaced; see *"The four card looks, rebuilt"*
below.

**No gradients.** The house rule holds here as everywhere (`birthday.dart`:
*"No gradients, ever."*). What could have been a radial gradient is a stack of
flat discs a step of alpha apart, and the night's light is a flat `rgba()` at a
fixed lift (`washOf`), never `createRadialGradient`.

**The first card is pinned.** `classic` draws no ornament, takes no slab, keeps
its white paper, and its whole `twoOfUs` + `flame` + `rung` branch is unedited.
`card.test.ts` holds that as a literal: the classic card's list of fills, in draw
order, as a pinned 20-element array.

**How this is tested, and what testing cannot reach.** `card.test.ts` went from
21 cases to 26. A second recording canvas was added beside the first — the first
answers *what did it say*, the second answers *in what* — capturing each shape's
fill, stroke and rounded-corner count and each word's ink. Five new cases: each
look draws the ground the sheet gave it; each of the four draws exactly two
slabs and the first card none; the dark card's words are the light and the
others' are the app's ink; all five still draw both people, the award and the
days; and the first card's fills are the pinned array.

**`NOT VERIFIED`.** No canvas here can render, so **no card of any style has been
looked at on this machine** — not in a browser, not as a PNG. The four looks have
no counterpart on the phone at all, so there is nothing to diff them against
there either. And the sheet is 4:5 per card against the real card box's 840×1520,
so what was ported is the measured composition, not a pixel-exact copy. The
mapping of the four *names* onto the four cards is a judgement: the sheet carries
no labels, so `sunset` = top-left (filled disc = a sun), `midnight` = top-right
(the only dark ground), `noir` = bottom-left (palest ground, hard ring), `aurora`
= bottom-right (the diagonal wave). If a name is on the wrong card, it is a
one-line move in `LOOKS`.

### The four card looks, rebuilt (2026-11-05)

The first attempt above was rejected — none of the four read as the sheet's card.
The reason was structural: the sheet's cards are **not** bare paper with an
ornament on them. They are a near-white *field* (`#F8F5FE`, the commonest colour
on all three of its light cards) with the award's tone collecting along the left
and right edges, and a dense, mostly opaque motif at the centre. A flat pale
ground with a thin concentric ornament could never match that.

**Two things changed about the method.** First, the painting was made visible:
a throwaway harness outside the repository bundles the real `card.ts` with
`rolldown` and rasterises all five looks into real canvases in headless Chrome.
Second, that raster was made readable: `ascii.py` draws a PNG as text by how far
each cell is from its ground, and `patch.py` takes the mean of a percentage
rectangle so a sheet crop and my own render can be asked the same question. There
is no vision model on this machine any more, so this is the whole feedback
channel — and it is measurement, not sight.

**What the loop found, in order.**

1. `aurora`'s ring was **invisible**: `awardRing` drew its track in
   `palette.track` (`#EFEAF2`), which is the first card's track for white paper
   and almost the same value as the new field. `awardRing` now takes a track
   colour; the three pale looks pass `fade(award.colour, 0.24–0.3)`.
2. `noir`'s stack was about a third of the width the sheet's is. The slabs went
   from 300 px at ±42/±46 to 420–432 px at ±96/+104 and gained rims — without a
   rim, three stacked tints read as one wash.
3. The foot of every pale look was a **flat full-width stripe** where the sheet
   draws tone that climbs the two edges and dips through the middle. It is now
   `wave(..., wavelength = card width, phase = −π/2)`.
4. The harness was drawing every ring with `pct` unset, so no progress arc was
   ever on the card — a shape no real Spark produces. The harness now passes
   `pct: 0.72`.
5. Two decorations the sheet does not have were removed: a pair of `laurel`
   branches either side of the award's name, and the `quadraticPoint` helper
   only the laurel used.
6. **A real regression, caught by the pinned test.** `lookField` laid the
   `#F8F5FE` field on `classic` too, which meant **the first card's white paper
   had been changed**. `lookField` now returns early for `classic` as well as
   `midnight`, and the classic card measures `#FFFFFF` again. This is the second
   time that test has caught a leak into the card the user asked not to touch.

**Two test-double gaps were also fixed.** Both recording canvases lacked
`ellipse`, `rotate` and `setLineDash`, which the new painter calls; the first run
of the suite failed with `ctx.ellipse is not a function` in 8 of 8 look tests.
Real canvas has all three. They are now on both doubles.

**Measured against the sheet** (motif region, rows 30–60 %, columns 25–72 % of
each card):

| look | sheet | this build |
| --- | --- | --- |
| `sunset` | `#D9C6FA` | `#D0C4F2` |
| `midnight` | `#C3ADE8` | `#B8ADD5` |
| `aurora` | `#E0D4F9` | `#E6DEF9` |
| `noir` | `#D7C7F3` | `#DAD0F4` |

All four are within about 4 % of their counterpart, and the shapes were checked
one by one in text against the sheet's crops.

**Still `NOT VERIFIED`, and this is the honest line.** Measuring is not looking.
A colour average can be right while a shape is wrong, and no card of any style
has been *seen* on this machine. The sheet's 4:5 against the box's 840×1520
means the composition is adapted, not copied. And the sheet's softness is smooth
where this file's is stepped — the house rule forbids gradients, so every glow is
a stack of flat steps and the match is as close as that rule allows. The
name-to-card mapping is unchanged and is still a judgement.

### The page (`src/features/sparks/SparkMoment.tsx`)

The phone's page in its three parts — the card at the size it will be posted,
the two questions it asks before the share, and one button:

- **The picture on the screen is the upload.** The card is painted once into a
  canvas, encoded once, and what the page draws is that file read back through an
  object URL — not a second drawing that could disagree with the bytes. This is
  the phone's own rule with `PreparedMediaSource`.
- **It is painted once per opening.** The sheet's fresh read lands a second
  later, and a card that repainted itself under the tap would swap the picture
  out from under somebody about to share it. The ground and the button follow the
  newest numbers; the picture is the run as it stood when the page opened. (The
  phone paints in `initState` for the same reason.)
- **Who it is for** is the header's pill, which opens the same `AudienceSheet`
  the moment composers use (`everyone` / `except` / `only`).
- **Whether the other person is named** is one switch on the page, on by
  default, because a run is a thing two people keep and the moment being shared
  *is* that run. Who it names is the phone's two-step rule
  (`spark_moment.dart::_them`, then `moment_composer.dart::sparkMomentMention`,
  extracted here as `features/sparks/moment.ts`): the run's own `other` first, so
  a page opened before the list has loaded still knows who it is about; then the
  one live run this account keeps, and only when there is exactly one — two live
  runs have no honest default, and a guessed name on a moment is somebody's name
  in front of a thing that was not about them. A hidden run does not count, and
  the answer is never me. It reads the `["sparks"]` cache and never fetches, the
  way the phone reads its own store; a browser that has not been told anything
  answers nobody. The id rides in the item's `mentions` only when that rule
  answers somebody.
- **The card's second face falls back to the row's title**, as the phone does
  (`widget.them ?? SparkFace(name: widget.title)`): a card is about two people
  and only one of them is ever missing, and the picture reads a name and a photo
  and nothing else.
- **One button**, in the award's colour: `uploadAsset(card)` → `POST /moments/`.
  The success line is said only after the server has taken it, and a refusal says
  so with the server's own sentence. Nothing here claims a moment that does not
  exist.

`SparkMoment` is a lazy chunk (`lazy()` + `Suspense`), the same convention as the
route table: the composer is 15.71 kB and only a tab that opens the card fetches
it. Splitting it was not cosmetic — the painter and the page landed inside
`ConvoLayout` first and took it from 86.91 kB to 103.45 kB; it is 90.57 kB with
the split.

### The sound row — added 2026-11-05, and what is tested about it

- **The row is drawn.** The phone's page offers "Add audio" — a picked sound, its
  own window into it ("Choose part") and a way to take it off — and as of this
  round so does this one. The picker and the part chooser behind it are the app's
  shared `features/audio/SoundPicker` and `features/audio/PartChooser`, the same
  two sheets the camera's audio tool opens, so there is no second picker to
  drift. What goes up is `sound`/`sound_start_ms`/`sound_end_ms` on the item.
- **`features/audio/audioWindow.test.ts` (11 cases) is the arithmetic behind it**:
  the user's own table of 30/40/50/60/70 for one to five pictures, what a card
  asks for, and the two readings the row makes of a window (`hasWindow`,
  `soundWindowLabel`). It is unit-tested and nothing more. An earlier draft of the
  module also carried a `clampSoundWindow` and a `soundSpanForClip`; both were
  removed rather than tested, because nothing in this client called either — the
  chooser holds a window inside the file on its own paths, and the clip rule has
  no caller until something here posts a sound on a clip.
- **NOT TESTED, and not claimed:** the row has never been rendered in a browser
  here, no sound has been picked through it, and no moment has been posted with
  one. The three fields were confirmed by reading `PostItemSerializer` in
  `backend/apps/moments/serializers.py`, which was read and written to nowhere.
- **The play button on the convo row** stays `NOT IMPLEMENTED` for its own
  reason, unchanged by this round.

### Two differences that are decisions, not omissions

- **The card's words are English only.** The phone's card and sheet read every
  word out of `strings/en.dart` — the days in their plural forms, `BROKEN`, the
  closing line — so a phone set to Hindi draws a Hindi card. This client has no
  dictionary entries for any of them, and the painter takes no translator, so a
  moment posted from a Hindi session carries an English picture. It is named
  here rather than papered over, and it is the same partial-i18n position the
  whole web app is in (34 files call `t`, and the dictionaries are
  settings-shaped). Localising the painter is a change to its signature and a
  hundred dictionary lines, not a fix to this round.
- **My own face's green dot.** The phone asserts it (`SparkFace(..., online:
  true)` in `_myFace`) because the person painting the card is by definition
  holding the phone. This client passes the server's own answer for
  `me.online` instead — `UserCardSerializer`'s `OnlineGate` always shows a
  reader their own presence, so the dot is there whenever the server says this
  session is on, and absent when it says otherwise. That is the honest reading
  of the same fact, and it is a difference from the phone rather than a bug: the
  phone assumes, this client asks.

### Nothing waits for ever

*"add moments par click karne ke baad jo modal open ho raha hai, usme card draw
nahi ho raha hai"* — the owner's own report of 2026-11-04, and a real fault. The
first port of `renderSparkCard` awaited three things from outside itself with no
bound at all: the app's font (`document.fonts.ready`), my face, and the other
person's face. A face whose bytes never come is a face the paint waited for for
ever — the modal opened, the spinner span, the Share button stayed dead, and
nothing on the page said why. Measured in a browser (below): **the card was never
painted at all**, and in the app the same wait was capped only by axios's own
120-second timeout, doubled by a 401 renewal.

The phone has never had this hole. `Faces.patience` bounds the wait for a face at
fifteen seconds, and its comment gives the reason: *"a socket that has gone quiet
without closing hands back neither bytes nor an error."* Both waits are now
bounded, in the phone's own numbers:

```text
FACE_PATIENCE_MS  15s   the phone's `Faces.patience`, for each of the two faces
FONT_PATIENCE_MS   2s   this client's own: the font is the app's own file
```

`within(work, ms)` is a bound on **waiting and not on the work** — the fetch is
left running, so a read shared with the rest of the screen still fills the media
cache and the next opening of the composer reads it straight off `peekMedia`. A
cancelled request would have failed every other avatar on the page, which is why
this is not `AbortSignal.timeout`. After the bound the card is painted without
that face, in the initials plate the list itself falls back to: a card with
initials on it posts, and a card that was never painted posts nothing.

### Checks at the end of this pass

```text
npx tsc -b                       PASS
npx eslint src --max-warnings=0  PASS
npm test                        138/138 PASS (16 files)
npm run build                    PASS (3.5–4.6 s run to run)
```

Production build: the entry chunk is 456.11 kB (143.24 kB gzip: the only figure
here taken from the toolchain rather than from `ls`) and the stylesheet 127.50
kB, up from 125.89 kB — the pill, the composer's ground and its rows are mostly
Tailwind arbitrary values, and those are what the stylesheet grew by.
`ConvoLayout` is 90.57 kB (the sheet's new row and the `face` prop),
`SparkMoment` 15.71 kB (6.88 kB gzip) — 14.22 kB when the page was first built,
so the bounds, the CORS ask, the fallbacks and the second attempt have cost
1.49 kB raw (1.02 kB gzip) in total,
`AudienceSheet` 7.78 kB, the convo 99.85 kB.

### New regression tests

`src/features/sparks/card.test.ts` (new, 21 cases, 26 after the four looks) and
`src/features/sparks/moment.test.ts` (new, 5 cases), taking the suite from 112 to
138 over 16 files, then to 144 with the five cases the four looks added, and to
155 over 17 files with the eleven the sound row's arithmetic added
(`src/features/audio/audioWindow.test.ts`, 2026-11-05), and to **275 over 23
files** with the 42 the calls added (`src/features/calls/model.test.ts` and
`src/features/calls/engine.test.ts`, 2026-11-06):

```text
the card's page
  keeps the picture inside the band a phone actually shows                PASS
  sits a little below the middle of the page and nothing else             PASS
sparkCardPaper
  lets the award's tone most of the way out over white                    PASS
  stays a colour a canvas can read for every rung of the ladder           PASS
sparkCardAward
  draws the same rung the sheet's own big glyph does                       PASS
  wears the medal on a run that broke after a Century                     PASS
  falls back to the first rung for a run this build cannot read           PASS
sparkCardDays
  says a broken run is broken rather than on nought days                  PASS
  counts the days, and counts one of them in the singular                 PASS
paintSparkCard
  paints a whole card without a photo anywhere                            PASS
  says a broken run is broken, and a run that never counted is not        PASS
  draws a nameless side as a dash rather than as nothing                  PASS
  draws the initials when a picture arrives but will not draw             PASS
  reads a name that is not a string as initials rather than failing       PASS
the award glyphs
  has a mark for every rung the ladder draws                              PASS
what a card is willing to wait for
  hands back the work when the work is quick                              PASS
  gives up on a face that never arrives, rather than waiting for ever     PASS
  waits the phone's own fifteen seconds for a face and not a moment more  PASS
  lets a failure through rather than turning it into a wait               PASS
a card the browser will not paint the first time
  is painted a second time, without its pictures, instead of giving up    PASS
  says so only after the second paint has failed too                      PASS
the person a spark moment names
  names the run's own other before anything in the list                   PASS
  falls back to the one live run's other person                           PASS
  says nobody when two runs are alive                                     PASS
  does not count a run I have hidden                                      PASS
  never names me, and never names an empty card                           PASS
```

Some of the card's cases are worth naming. *"wears the medal on a run that broke
after a Century"* is the case where the rung a run is on and the rung it wears
come apart, and it is the one the first version of this test passed by accident
(through the worn list) rather than by the rule it claimed. *"keeps the picture
inside the band a phone actually shows"* and *"sits a little below the middle"*
pin the two geometry facts that a phone's crop would otherwise eat. And the
whole-card case walks `paintSparkCard` end to end against a recording canvas —
Node has no `CanvasRenderingContext2D`, so it is handed one that calls nothing
and remembers every word drawn; that is also why it asserts the closing line by
its opening rather than in full: how much of it fits is a fact about the font,
not about this code.

The mention cases are the other half of "the sheet matches the app". The two-step
rule and its three silences — two live runs, a hidden run, my own id — are what
the phone does, and each is a case rather than a comment, because a mention is
somebody's name put in front of a moment and the wrong name is worse than no
name.

The four the second pass added are about waiting rather than about drawing, and
they are the four the fault above earns: the bound hands back quick work
unchanged, gives up with `null` on a promise that never settles, holds the
phone's fifteen seconds and not more, and — deliberately — still lets a real
failure through, because what turns a failure into initials on a card is
`faceImage`, which catches everything it asks for. A test of the last one is what
stops the next person "fixing" the bound into a swallow.

The four the third pass added are about the fallbacks rather than the bound, and
each stands for one of the ways a card was still being lost: *"draws the initials
when a picture arrives but will not draw"* (a `drawImage` that throws), *"reads a
name that is not a string as initials rather than failing the card"* (`name:
42`), and *"is painted a second time, without its pictures, instead of giving
up"* and *"says so only after the second paint has failed too"* — the retry
counted in attempts, and the sentence held back until the second attempt has
also failed.

### The card that was tainted

The bound above made the composer stop spinning. It did not make it draw: the
page then said **"Could not draw that card just now."** — the painter was not
waiting, it was throwing.

The cause is one line of `utils/mediaCache.ts` meeting one hole in the painter.
A public media address — a CDN or storage host, which is how avatars arrive on
this backend — is a path this API does not serve, so `loadMedia` hands the
address back **untouched** rather than reading it into a blob. An avatar already
on screen is therefore cached as its own `https://…` address, and `peekMedia`
answers with that address. `faceImage` drew it. A cross-origin picture drawn
into a canvas taints the canvas, and a tainted canvas **throws on `toBlob`**:

```text
Uncaught SecurityError: Failed to execute 'toBlob' on 'HTMLCanvasElement':
Tainted canvases may not be exported.
```

Measured in a real browser (a second origin on this machine, a PNG, no CORS
header): drawing the picture plainly taints the canvas and `toBlob` throws. The
same picture asked for with `crossOrigin="anonymous"` at a host that sends
`access-control-allow-origin` is clean and encodes (588 bytes). That is the fix:
the image request asks, and a host that will not answer fails to load — which is
a face that did not come, and the initials plate.

Three further things were closed in the same pass, each a way the card could be
lost for something smaller than the card:

- **`faceImage`'s doc promised a rule the code did not keep.** It said an
  address that is not this API's file and not a local blob "falls back to
  initials", but that check was skipped whenever the cache already had an
  answer — which is exactly the avatar case, and the line above.
- **A name that is not a string killed the paint.** The serializer promises
  one; a cached row from an older build does not. `nameOf` reads it as nothing
  and the plate carries initials.
- **A picture that loads and then will not draw** is caught inside `face` and
  becomes the same plate, rather than taking the other face and the card with
  it.

And behind all three, the last resort: a paint that fails for any reason is
tried **once more on a fresh canvas with neither picture** before the page is
allowed to say it could not draw one. A card with initials on it posts; a card
that was never painted posts nothing.

The page now also names the reason, on a dev build, under the sentence — and
writes it to the console on any build. A page that says "could not draw that
card just now" and nothing else is a page nobody can act on; this sentence cost
a round of guessing that it should not have.

### What was actually seen

Three of these were looked at rather than reasoned about, in three sessions.

The first was the **painter**, in the pass that wrote it: a throwaway page that
imported `renderSparkCard`, a real sample run (a Blaze, 12 days, two names, no
photos), and headless Chrome on this machine at device scale 1 — and the PNG it
produced was examined. It draws what it should: the award's paper, the white card
and its corner, the flame in the award's colour, `BLAZE`, `12 days`, the closing
line, both names, and the two initials plates where the photos would be.

The second was the **page**, in the pass that fixed the fault above, because a
picture that paints is not the same claim as a composer that shows one. The same
throwaway page was pointed at `SparkMoment` itself, mounted in `StrictMode` with
the real `Modal`, the real stylesheet and the real Manrope face behind it, and
the tab's own media routes were answered by the dev server so that a face could
be made fast, slow, or silent. Chrome cannot be asked for its DOM after real
seconds have passed, so the page reported itself to the server instead, and the
paint was timed by watching for the picture:

```text
face=hang     (accepted, never answered)   painted at 15 400 ms   ← was: never
face=slow     (bytes after six seconds)    painted at  6 410 ms
face=nothing  (nobody has a photo)         painted at    401 ms
face=fast     (bytes in hand)              painted at    410 ms
```

The first line is the fault and the fix in one number: before the bound, the same
run **never painted at all** — the DOM was asked for after fifteen seconds of
virtual time and there was no picture in it, and the tab was still waiting. With
the phone's bound in place, the card is there at 15.4 seconds with initials on the
silent face, the Share button live, and no failure sentence. The `slow` line is
the same defect from the other side and is *not* something this pass changed: a
face that takes six seconds holds the card six seconds, which is what the phone
does too.

The third was the **taint**, in the pass that followed, once the bound had left
the page saying "could not draw that card just now" instead of spinning. All of
that harness answered media from the page's own origin, so it could not reproduce
the fault — the third session put one PNG on a second local origin with no CORS
header, asked for it twice (plainly, then with `crossOrigin="anonymous"`), and
drew and encoded both:

```text
plain, cross-origin, no CORS header   canvas TAINTED
                                      SecurityError: Failed to execute 'toBlob'
                                      on 'HTMLCanvasElement': Tainted canvases
                                      may not be exported.
same URL, crossOrigin="anonymous",
host sends access-control-allow-origin canvas CLEAN (588 bytes)
```

Two lines, and the whole round: the canvas is not "slow", it is poisoned, and no
amount of waiting or retrying unpoisons it. The fix is the attribute on the
request that the second line carries.

All the throwaway pieces — the three pages, the stub sessions, the log the page
wrote, the second origin and the dev server — were removed after the checks;
nothing of any of them is in the tree. None of the runs signed in, so what they
prove is bounded on purpose: the **painter** draws the right picture in a real
browser, the **composer's page** reaches a painted card from real media with the
real Modal and the real font, and a **canvas given a cross-origin picture is
unexportable until the request asks for it**. None says anything about an
authenticated session, a real avatar from this API, or a real post — see
**Runtime status** below.

### Runtime status: NOT VERIFIED

- **The composer has never posted anything.** `uploadAsset` and `POST /moments/`
  were read from the contract and matched against the phone's own
  `postMomentNow` (which builds `mentions` the same way and is likewise silent on
  success), but no authenticated session exists in this environment, so no
  moment was created and no server refusal was observed. The success line, the
  error line and the moment appearing in the rail are all unexercised.
- **The card has not been compared against the phone's own rendering.** The
  geometry, the order and the words were ported by reading
  `app/lib/screens/spark_moment.dart`; no phone screenshot was diffed against
  this painter, so "the same as the app's" here means "the same numbers as the
  app's code", not "the same pixels".
- **Whether this API's own avatar host sends `access-control-allow-origin` is
  unchecked.** The fix asks for every `http(s)` face with `crossOrigin`, and a
  host that does not answer is a face drawn as initials — so the card still
  paints, but real avatars may never appear on a real card. That could only be
  settled against a real session and a real avatar, and neither exists here.
- **The sheet's own live behaviour is still unexercised** (the tenth round's
  note stands): the refresh read, the 1-second tick, the hide switch and the
  restore have never run against a server.
- **No component is rendered by the suite.** The suite is `environment: "node"`,
  so the pill and the sheet's rows are covered by nothing but the four static
  checks and the tests above. The composer itself was rendered once, by hand, in
  a browser (see **What was actually seen**) — with a stub session, and not from
  the sheet's own pill, so the glass sheet opening the card is still unexercised.
- **The media cache's queue has no bound of its own** (found while looking for
  this fault, not changed by this pass): `utils/mediaCache.ts` lets six reads
  cross the wire at once and every later one queues behind them, so six reads that
  stall leave every further read waiting. They cannot stall for ever — axios's
  120-second timeout ends them, doubled once by a 401 renewal — but the card was
  the one screen that *blocked* on that queue rather than drawing a placeholder
  and filling in, which is why this fault showed up as a missing card and not as
  a slow avatar.

### Read-only project check

Unchanged: `git -C ../xelvic status --short` reports the same eight pre-existing
entries (seven modified files under `app/`, plus `?? .tools/`), **nothing under
`backend/`**, and no file outside `xelvic-web/` created, edited or deleted. This
pass read `app/lib/screens/spark_moment.dart` and `app/lib/faces.dart` (for
`Faces.patience`, the number the two bounds are taken from) and wrote to neither.



## The sound row's arithmetic — 2026-11-05

The phone's sound row was added to the Spark card page this round, and with it the
one piece of it that is arithmetic rather than layout: how long a part a post
asks for. `XELVIC_MOBILE_FEATURE_INVENTORY.md` has the row; this is what is
tested about it.

### Checks at the end of this pass

```text
npm run typecheck                PASS
npm run lint                     PASS (eslint ., no warnings)
npm test                         155/155 PASS (17 files)
npm run build                    PASS (4.27 s)
```

`SparkMoment` is 28.98 kB as its own chunk (10.73 kB gzip), up from 15.71 kB: the
sound row, the two sheets it opens and their shared sleeve. `SoundPicker` is a
chunk of its own at 23.98 kB (8.03 kB gzip) and `PhotoEditor` is 59.72 kB, down
from what it was before the sound code was lifted out of it.

### What the eleven new cases cover

`src/features/audio/audioWindow.test.ts` is the user's own table of what a run of
pictures asks for — 30/40/50/60/70 for one to five — plus the two readings the
row makes of a window. The table is the point: the part chooser opened on half a
minute whatever it was opened for, and the numbers a person gave for a run were
not being used at all. The cases that matter are the two that pin the shape
rather than the values — *"is the step and not a multiple of it"* (a run of two is
the base plus one step, not two steps) and *"keeps counting past the minute a
moment will play"* (sixty seconds is what a moment plays, not what a run asks
for, and the ceiling is applied where a sound is played rather than here).

Nothing in this file renders anything. It is `environment: "node"`, so it cannot
say that the row draws, that the picker opens, or that a moment posted with a
sound arrives with one. None of those three is claimed anywhere.

### Read-only project check

`git -C ../xelvic status --short` still reports the same eight pre-existing
entries (seven modified files under `app/`, plus `?? .tools/`), **nothing under
`backend/`**, and no file outside `xelvic-web/` created, edited or deleted. This
round read `app/lib/audio_window.dart` (for the two rules and the table),
`app/lib/screens/spark_moment.dart` (for `_soundRow` and `_choosePart`) and
`app/lib/screens/audio_picker.dart`, and wrote to none of them. The backend's
`apps/moments/serializers.py` was read to confirm the three sound fields on
`PostItemSerializer` and written to nowhere.

## The calls — 2026-11-06

Audio and video calling were drawn on the web this round, over the app's own
contract: the ring, the answer and every piece of the connection travel on the
one authenticated socket, and the media itself is peer to peer. The parity matrix
has what is and is not here; this is what is tested about it.

Everything under test lives in two files and neither of them renders anything:

| File | Cases | What it covers |
| --- | --- | --- |
| `src/features/calls/model.test.ts` | 20 | the arithmetic and the sentences — the server's ring window, the collision rule, reading a frame, who is on a call, the two lines |
| `src/features/calls/engine.test.ts` | 22 | the state machine — what a frame does to it and what it says to the server |

### What the twenty model cases pin

- **The ring ends on the server's clock, not ours.** `ringSeconds` reads
  `ring_seconds` off the party frame and answers 45 only when the frame says
  nothing usable. Both ends giving up at the same moment is the only way "No
  answer" is true on both phones at once, so the fallback is tested as a
  fallback.
- **The glare rule has exactly two answers.** `offersAfterCollision(mine,
  theirs)` is `mine > theirs`, and the cases are written as the property rather
  than as values: the two ends of one crossing get opposite answers, and two
  different ids never both get the same one. Dart's `compareTo` and JavaScript's
  `>` order strings the same way, which is what lets the web and the phone agree
  about who re-offers without either telling the other.
- **A frame is read defensively.** `frameData` takes the `data` object and
  nothing else; `text` names nobody for an empty or missing id; `partyOf`
  refuses a frame with no call in it. A frame this build cannot read has to
  leave the engine where it was, not put a broken screen up.
- **Who is on a call, and what to call them.** `seatOf`, `otherSeats`,
  `seatIsHere`, `personName` (name, then handle, then a neutral word) and
  `callTitle` by who is still there.
- **The two lines a screen draws.** `goodbyeLine` for a missed call, a plain
  end, a ring of ours nobody picked up, and somebody walking out of a live call;
  `ringLine` for the kind that is arriving, **Offline only when the server said
  a ring cannot reach them**, Connecting once somebody has picked up, and
  nothing at all once the call is up or over.

### What the twenty-two engine cases pin

The engine takes its `send` as a constructor argument, so every case is driven
with a socket that is a plain function. No `RTCPeerConnection` is ever built:
`callsSupported()` is false in `environment: "node"`, and that is itself the
subject of one case — *"carries a call it cannot open a microphone for"* asserts
the engine says so instead of throwing.

- **Arriving and being turned away.** A ring is drawn with who is calling; a
  second ring while this tab is already on a call is declined; a party frame
  about somebody else's call leaves the engine alone.
- **The call changing shape.** Somebody turning a camera on makes it a video
  call; somebody leaving is marked as gone rather than closing the call.
- **Ending, and ending once.** A ring nobody answered is drawn as a missed call
  and the screen goes away a moment later; the first reason a call ended is the
  one kept; a late frame about the call just said goodbye to cannot put it back
  on the screen — but a **different** ring arriving during that goodbye still
  draws, which is the case that caught the first version of that guard.
- **What is said to the server.** A call is placed, the engine waits for the
  server's own word and hears it; a refused ring is reported rather than
  pretended to have been placed; a request the socket could not carry is said
  again when it comes up, and said only once; `call.pending` is asked the moment
  the socket comes up and never while already on a call.
- **Order of operations.** Hanging up stops the media first and says the goodbye
  after; a goodbye the socket could not carry is held and said when it can be;
  the microphone is turned off and the change is said; the server is told a
  camera is wanted before the browser is asked for one.
- **The screen is republished when anything it draws changes** — the version
  counter a `useSyncExternalStore` subscriber reads.

### What is not tested, and cannot be from here

- **No connection has ever been made.** There is no `RTCPeerConnection` in
  `environment: "node"`, so the offer, the answer, the candidates, the glare
  rule in practice, the candidate queue and the re-offer after a camera is
  turned on are all **unexercised**. The collision rule is tested as arithmetic;
  the two handsets it is supposed to keep apart have never shaken.
- **No microphone and no camera.** `getUserMedia` is never called by the suite.
  The path where a person refuses the permission is covered only as far as the
  engine's own branch (the node case above), not as the refusal a browser sends.
- **No live backend.** `GET /api/v1/calls/ice/` and `GET
  /api/v1/calls/<id>/` are read by the engine and have never answered here, so
  the shapes they are typed as are confirmed statically in
  `XELVIC_API_COMPATIBILITY_REPORT.md` and nowhere else.
- **No component is rendered.** `CallOverlay` — the video grid, the mirrored
  self-view, the buttons, the clock — is covered by nothing but the type checker
  and the linter. Nothing here claims it draws correctly.
- **No second device, and so no real call.** Everything a two-person call needs
  beyond one tab's own state machine is unverified, which is why the matrix
  carries the calls as `PARTIALLY COMPLETE (NOT VERIFIED)` and this report does
  not claim more.

### Checks at the end of this pass

```text
npm run typecheck                PASS
npm run lint                     PASS (eslint ., no warnings)
npm test                         275/275 PASS (23 files)
npm run build                    PASS
```

The entry chunk is 506.15 kB (158.00 kB gzip) with the call engine, the overlay
and the provider in it — a call can arrive on any page, so none of the three is
lazily split off. `SparkMoment` is 29.43 kB as its own chunk (10.89 kB gzip) and
`SoundPicker` 24.06 kB (8.08 kB gzip), neither of which this round touched: the
numbers moved only because the shared entry moved under them.

### Read-only project check

`git -C ../xelvic status --short` still reports the same eight pre-existing
entries (seven modified files under `app/`, plus `?? .tools/`), **nothing under
`backend/`**, and no file outside `xelvic-web/` created, edited or deleted. This
round read `app/lib/calls.dart` — the whole state machine this port follows: the
ring, the answer, the collision rule, the candidate queue, the ring window and
the goodbye — and the backend's
`apps/calls/urls.py`, `apps/calls/views.py`, `apps/calls/services.py`,
`apps/chat/consumers.py` and `apps/chat/events.py` to confirm the socket
actions, the frames and the three routes. **Every one of them was written to
nowhere.**

## Round 18 — the ring, the notice, the camera, the layout, and a room's sound (2026-11-06)

Six things, all inside `xelvic-web`, all `PARTIALLY COMPLETE (NOT VERIFIED)`: a
call rings, a ringing call reaches the browser's own notification surface, the
camera is asked for a better picture, the call screen is laid out for a phone and
a laptop, and a live room's sound is carried over the same relay an ordinary call
uses. None of it was exercised against a live backend, a second device, a real
microphone, a real camera or a real browser notification surface.

**The ring** (`src/features/calls/ring.ts`, 22 cases). It rings the app's own
recording, `public/ringtone/call.wav` — served from this build and preloaded when
the socket comes up, so the first ring is not a download. Where that will not play
it falls back to a Web Audio tone: the incoming ring is the phone's classic ring
(640 Hz for 0.4 s, a short gap, 510 Hz, a gap, the pair again, then quiet — 3.1 s,
level 0.85, 6 ms edges so it does not click, 22050 Hz); the outgoing ringback is
440+480 Hz for 1 s then 2 s of silence, deliberately **not** the ringtone, because
a caller who heard their own ring would think they were being called. An incoming
ring vibrates where there is a vibrator (`navigator.vibrate`,
`[0,500,300,400,300,500,1200]`), and where the browser refuses the sound outright
the ring screen says so rather than pretending it rang.

**The notice** (`src/features/calls/notice.ts`, `public/call-sw.js`, 8 cases). A
ringing call is posted to the browser's notification surface once per call, with an
icon, a tag (`xelvic-call`) so the row can be taken down when it stops ringing,
`requireInteraction`, and two actions, Decline and Accept, which the worker draws.
The worker has no fetch handler at all: it posts the press back to a focused page as
`{type:"xelvic-call", action, callId}`, and a press with no page open opens `/app`.
`CallProvider` feeds those presses into the engine, so Accept really answers and
Decline really declines. Permission is asked from a pill on the ring screen, never
on page load, and where the browser has refused the pill says so. A call this tab
placed itself, or one already being talked on, is deliberately not posted.

**Camera quality** (`src/features/calls/quality.ts`, 30 cases). The browser is now
asked for 1920x1080 at 30 fps with a floor of 640x480 (it used to ask for 1280x720
through an inline constraint), with echo cancellation, noise suppression and
automatic gain control on the microphone. Every video sender's encoder is told
`degradationPreference: "maintain-resolution"` — keep the picture, drop the frames
— with a bitrate worked out from the size of the picture (0.1 bits per pixel per
frame, floored at 600 kbps, capped at 4 Mbps), and each track's `contentHint` is
`motion` for a camera and `detail` for a shared screen. A camera, microphone and
speaker can each be picked from the browser's own devices. A pill reads the
browser's `getStats` report every second and says "Unsettled connection" or "Weak
connection" when the round trip or the packet loss says so, and nothing when the
call is fine — measured, not guessed.

**The layout** (`src/features/calls/CallOverlay.tsx`, rebuilt): the whole picture
fits the screen (`object-contain`, with a fit/fill toggle to crop), spotlight is
the default with a grid toggle, the self-view can be dragged and resized and is
clamped inside the stage, fullscreen was added, and screen share, camera flip and
the device menus sit in one row. The picture can also be lifted out of the page
into the browser's own corner window (`requestPictureInPicture`), offered only
when there is a single picture to lift; whether it is out there is read from the
browser's `enterpictureinpicture` / `leavepictureinpicture` events rather than
from this tab's own memory of pressing the button, because the window can be
closed from the window.

**A silence that would have been described as sound.** A browser may refuse to
start a sound no press asked for, and a room somebody walked into by opening a
page is exactly that shape. `AudioSurface` and `VideoSurface` report that refusal
instead of swallowing it, and the room's tile row shows "Tap to hear the room"
in place of "Hearing the room" until a press has satisfied the browser — the same
rule the ring already followed. No unit test covers it: it needs a browser whose
autoplay policy refuses a stream.

**A room's sound.** A room's stage is a `calls.Call` on the server, so a room is
carried over the same relay an ordinary call uses, with **no new endpoint and no
server change**. `src/features/rooms/mesh.ts` (21 cases) is the rules as arithmetic
over plain values: `whoOffers` (the lower id offers, compared by code unit exactly
as the phone's `compareTo` does, so both ends of a pair always agree; a listener,
whom the stage has never heard of, always offers), `needsRebuild`, `readSignal`
(null for anything unrecognised rather than throwing, because an exception in an
ICE callback is a connection that quietly never completes) and `receiveOnlyKinds`.
`stage.ts` is the `RoomStage` mesh: a reconcile rather than paired add/remove calls,
candidates queued until the remote description is set, connections rebuilt when the
stage changes, a failed connection repaired by rebuilding, a listener that opens no
microphone, and no renegotiation anywhere. `useRoomStage.ts` is the React wiring;
`RoomSoundView.tsx` draws the tiles — a picture, a voice, or the person's own face
saying "Connecting" rather than a black rectangle under a name. `surfaces.tsx` holds
`VideoSurface` and `AudioSurface`, moved out of `CallOverlay` so a room tile and a
call tile attach a stream the same way. `CallEngine.ignoreCall(callId)` was added: a
room's stage is a call, so a single `call.joined` out of a room would otherwise put
it on the 1:1 screen and answer it — the room page names its call and the engine
refuses to act on it. `RoomPage.tsx` now draws the real stage and voices, the bullet
that said this build carries no room sound was deleted, and the page says plainly
when a listener is past the relay's limit: the server carries the stage plus its
first 8 listeners (`MEDIA_LISTENERS`), and somebody past that is still in the room
and simply not sent anything.

**What is not tested, and cannot be from here.** The mesh's arithmetic is tested;
the mesh itself has never connected to anything. The suite is `environment: "node"`
and renders nothing, so `CallOverlay`, `RoomSoundView` and the device menus are
covered by the type checker and the linter alone, and no microphone, camera,
vibrator or notification surface is ever opened. There is no live backend and no
second device, so not one of the six has been seen against a real server.

### Checks at the end of this pass

```text
npm run typecheck                PASS
npm run lint                     PASS (eslint ., no warnings)
npm test                         275/275 PASS (23 files)
npm run build                    PASS (4.38 s)
```

The entry chunk is 506.15 kB (158.00 kB gzip). It now passes 500 kB, so the build
emits one chunk-size warning; the entry is not split, because a call can arrive on
any page and the engine has to be there before it does.

### Read-only project check

`git -C ../xelvic status --short` still reports the same eight pre-existing entries
and nothing under `backend/`. This round read `app/lib/stage.dart` — the phone's
own mesh: who connects to whom, when a listener is let go of, how a rebuild is
decided — and, read-only, `backend/apps/spaces/services.py` (`MEDIA_LISTENERS = 8`,
`_hears`, `room_row(..., media=True)`, `_go_live`, `_sync_call`). None of them was
written to.

## Round 19 — the mirror, the cards that fit, and Vibes in the feed (2026-11-06)

Three of the owner's own reports and one omission: a picture that was mirrored when
the phone would not mirror it, a card whose media box could ask for a height taller
than the screen, and a feed that never carried a Vibe. The mirror and the heights
are complete as code and `NOT VERIFIED`; the weave is complete as code and
`NOT VERIFIED live`; and the round's own limits — a Vibe still plays only its first
clip, there is no Vibe editor here, play counts never move and there is no
own-posts shelf — are named `NOT IMPLEMENTED`.

**The mirror** (`src/features/calls/engine.ts`, `CallOverlay.tsx`,
`src/features/rooms/{stage,useRoomStage,RoomSoundView}.tsx`, `RoomPage.tsx`). The
phone's rule (`app/lib/calls.dart`, `_selfMirrored`) is that only the front lens is
drawn mirrored; the web mirrored unconditionally, which is what the owner saw as
*"video me jo video ban raha hai wo ulta ban raha hai aur phone me sahi hai"*. The
engine now carries a `Facing` (`"user" | "environment" | null`) and a `mirrored`
flag on `CallSnapshot`; `mirrored()` answers a person's own choice when they have
made one and otherwise `facing !== "environment"`; `readFacing(track)` reads
`track.getSettings().facingMode` from `openCamera()` and `openDevice()`, and both
fields reset in `closeMedia()`. The self picture is drawn
`mirror={!call.sharing && call.mirrored}`, with a **Mirror** pill (active when
mirrored) after the existing **Flip camera** pill; a room's own tile carries the
same rule and button through the stage's `toggleMirror`. No device or browser run
was made — the rule is unexercised, and a webcam that reports no `facingMode` at
all falls back to mirrored, which is the honest default rather than a known-good
one. *(The button's own half was reversed the same day on the owner's report — see
Round 20; the self-view half stands.)*

**The cards that fit the screen, in a column** (`src/features/drops/frame.ts`,
`frame.test.ts`, `DropCard.tsx`, `SensitiveVeil.tsx`, `VibeViewer.tsx`,
`src/pages/DropsPage.tsx`, `src/styles/index.css`, `PollBlock.tsx`).
The media box took the card's whole width and derived its height from the server's
`ratio` with no ceiling, so a portrait post asked for a box taller than the screen
at every width. `frameBox(ratio, clip)` caps a single clip's **height** at `62dvh`,
cropped by `object-cover` — the phone's own `tallClipShare`
(`app/lib/screens/drops.dart`) — and draws a still at the poster's shape up to
four-to-five with the card's full width, because a box with an automatic width is
narrowed by the browser to satisfy `max-height`. The first version of this rule
narrowed a still instead, which is the phone's own rule and is what the owner
photographed on 2026-11-06 (*"card bhi ganda lag raha hai aur width bahut jyada
hai"*): a card a thousand points wide holding a picture three hundred wide. The
feed column is capped at 660 points and centred at every size — it was
`max-w-[1240px]` in one column below `xl`. `SensitiveVeil` takes that exact box as
a `frame` prop; `VibeViewer`'s walk became
`fixed inset-x-0 top-0 h-[100dvh]` because a four-edge `fixed` box resolves against
the layout viewport, taller than the visible area under a phone's bottom bar;
`body` moved from `min-height: 100vh` to `100dvh` with `overflow-x: clip`; and
`PollBlock` gained `break-words` on an answer in three places. The `VibeViewer`
change is a reasoned fix with medium confidence and is recorded as such, not as
watched.

**The weave** (`src/features/drops/mix.ts`, `mix.test.ts`, `src/pages/DropsPage.tsx`,
`src/types/api.ts`, `DropCard.tsx`, `EditDrop.tsx`, `MomentDropCard.tsx`). The
server's `vibe_share` (0.20 for a reader it knows, 0.40 for a cold start) and the
phone's `Drops.mixedFeed` were both ignored, so the feed carried no Vibe. `mix.ts`
is a whole port of `mixedFeed` / `_mixSlots` / `shelfOrder` / `shelfKey`, with the
hash multiply done by `Math.imul` — the one place a JavaScript number would have
diverged from the phone's `int`, which holds the whole product before masking.
`DropsPage.tsx` reads `vibe_share` off the feed's first page, draws a salt once per
opening, keeps a rail of ten in `shelfOrder` less the clips the feed below already
draws, weaves via `mixedFeed`, opens a woven clip's picture into the walk, and
fills a `caught_up` feed from the shelf's own tail past the rail's ten.
`EditDrop.tsx` reads the drop route first and the Vibe route when it finds nothing.
`MomentDropCard.tsx`'s exported `previewPath` — which named `/app/drops/vibes/<id>`,
a route that does not exist, and had no callers — is deleted. **Not verified against
a live server.**

**What is not tested, and cannot be from here.** No device, no browser and no live
server was available, so the mirror, the heights, the strip and the walk's door are
covered as arithmetic and by the type checker and the linter alone; nothing was
rendered, no camera was ever opened, and no feed was ever read. A webcam without a
`facingMode` still falls back to mirrored. And the round's own gaps are unexercised because they
are not implemented at all: a Vibe still plays only its own `asset` (its `recipe`
and `clip_urls` are read by nothing, so no voiceover, music lanes, per-clip trim or
speed, overlays, filter or frame shape), there is no Vibe editor on the web
(`recipe`, `category`, `interests` and `track_id` are accepted by the server and
never sent), nothing under `src/` calls `POST /drops/<id>/play/` so play counts
never move, and `GET /drops/mine/` and `GET /drops/interests/` are uncalled. All
`NOT IMPLEMENTED`.

### New regression tests

`src/features/drops/mix.test.ts` (new this round, now 24 cases). Its first thirteen
are the phone's own assertions carried over from `app/test/drops_mix_test.dart`, in
that file's own words: exactly a share per block of ten rather than a coin toss;
forty per cent is four a block; every drop comes back in the order it arrived; a
clip is never woven twice; a shelf that runs out leaves the rest as drops; nought,
or an empty shelf, is the feed itself; the same salt answers the same arrangement
and different salts answer different ones; a page arriving on the end moves nothing
already on screen; a clip that is already a card of its own is not woven again; and
the hash stays inside thirty-two bits. Six more hold the strip: it drops the clips
the feed is drawing beside it, it is not emptied by a feed somebody has scrolled,
it keeps a clip the feed only reaches screens further down, a shelf the feed has
taken every clip of is still a strip, a filled page is the shelf's own head, and an
empty shelf is nothing at all. Five more hold the walk's list: it opens on the clip
that was pressed whatever the shelf thinks, keeps the shelf's order behind it,
never draws one clip twice, is the shelf itself when nothing was carried, and is a
walk of one when the shelf has not arrived.

`src/features/drops/frame.test.ts` (new, 4 cases): a clip keeps the card's own width
and caps its height; a still stands no taller than four-to-five and carries no
screen height; a shape that already fits is left alone; a payload with no ratio
reserves a real box.

`src/features/drops/model.test.ts` (new, 4 cases): `dropIsClip` is a video and a
Vibe and nothing that is not one; a sound's own asset is not a clip; the first
upload is a clip only when the post is a single one; and a row with no url — or no
asset — has no clip to draw or open.

No component is rendered by any of them. The suite is now 307 tests across 26
files, up from 288 across 24 at the start of the round.

### Checks at the end of this pass

```text
npm run typecheck                PASS
npm run lint                     PASS (eslint ., no warnings)
npm test                         307/307 PASS (26 files)
npm run build                    PASS
```

The entry chunk is 507.29 kB (158.29 kB gzip), up from 506.15 kB (158.00 kB gzip)
at the start of the round — the mix, `walkOf`'s rule and the clip test ride in the
entry, which already passes 500 kB and so already draws the one chunk-size warning
the build emits. The round made no backend change; the entry moved only by what the
client gained.

### Read-only project check

`git -C ../xelvic status --short` is unchanged: the same eight pre-existing entries,
and nothing under `backend/` or `app/` was touched by this round. This
round read `app/lib/calls.dart` (`_selfMirrored`), `app/lib/screens/drops.dart`
(`tallClipShare = 0.62`, the photograph's `0.78`), `app/lib/drops.dart`
(`mixedFeed`, `_mixSlots`, `shelfOrder`, `shelfKey`), `app/test/drops_mix_test.dart`
(the phone's own cases) and, read-only, `backend/apps/drops/services.py`
(`feed_vibe_share`). None of them was written to.

## Round 20 — the Mirror button, turned round (2026-11-06)

The owner's report: *"jo video call me mirror par click karne par jo flip ho raha
hai wo mere video card me raha hai jabki reciever user video card me hona chahiye"*.
Round 19's button overruled the self-view's own lens rule, so the one picture on
screen that was already right was the one that turned over. Asked which picture the
button should turn, the owner chose the other person's — the picture arriving here.

**The button** (`src/features/calls/engine.ts`, `CallOverlay.tsx`,
`src/features/rooms/{stage,useRoomStage,RoomSoundView}`, `RoomPage.tsx`). The
engine's snapshot gained `remoteMirrored` (`private remoteMirror`, false until
pressed, cleared in `closeMedia()` so the next call opens unflipped), set by
`toggleRemoteMirror()`; `mirrored()` is now `facing !== "environment"` alone and the
hand-overrule is gone with `toggleMirror()`. That is the phone's own shape:
`app/lib/screens/call.dart` mirrors `_mine` and nothing else — every remote tile goes
through `_feed(person, mirror = false)` — and `app/lib/screens/room.dart` does the
same with `mirror: person.id == mine && Stage.it.selfMirrored`. `RemoteTile` gained a
`mirror?` prop handed straight to `VideoSurface`, passed `call.remoteMirrored` at all
three of its sites (grid, spotlight, rail); `SelfView` is unchanged at
`mirror={!call.sharing && call.mirrored}`. The pill is active on
`call.remoteMirrored`, and it now waits for a picture to arrive
(`others.some((seat) => streamFor(seat.user)?.getVideoTracks().length)`) instead of
waiting for this tab's own camera — the button is about what is on the screen, and a
pill over a seat whose camera is off would be a button this screen cannot answer. A
room's tile draws `mirrored` for self and `remoteMirrored` for everybody else, with
the same guard.

**What could not be tested.** The flip needs two ends on a real call to be watched,
and no device, no browser and no live server was available, so it is `NOT VERIFIED`.
It is also a display and not a transmission — `VideoSurface`'s `-scale-x-100` is the
only thing a mirror touches, and no track is ever transformed — so nothing it does
can be observed from the other end, which is exactly what the owner's chosen option
said. Two consequences are named rather than left to be found: a webcam reporting no
`facingMode` (most laptops) is drawn mirrored with no way to change it now that the
hand-overrule is gone, and a remotely *shared screen* is turned over as well, because
a call frame carries no word for whether what is arriving is a camera or a screen.

### New regression tests

Three cases in `src/features/calls/engine.test.ts`, under "turning the arriving
picture over": an incoming camera is drawn as it was sent until somebody says
otherwise (`remoteMirrored` false on a call); a press sets it, publishes it, and
leaves this tab's own `mirrored` exactly where the lens had it; and it is a switch
over somebody else's picture rather than a setting — the next call opens unflipped
after a hang-up and a reset.

### Checks at the end of this pass

```text
npm run typecheck                PASS
npm run lint                     PASS (eslint ., no warnings)
npm test                         310/310 PASS (26 files)
npm run build                    PASS
```

The entry chunk is 507.43 kB (158.33 kB gzip) and the stylesheet 133.89 kB — a
hundred-odd bytes and a class over Round 19's 507.29 kB / 132.16 kB, from the new
prop and the pill's changed condition. The round made no backend change and reached
no server.

### Read-only project check

`git -C ../xelvic status --short` is unchanged: the same eight pre-existing entries,
and nothing under `backend/` or `app/` was touched by this round. This round read
`app/lib/screens/call.dart` (`_mine`, `_feed`), `app/lib/calls.dart`
(`selfMirrored`) and `app/lib/screens/room.dart` (`Stage.it.selfMirrored`). None of
them was written to.

## Round 21 — a shared screen shown whole, and a call that can be put aside (2026-11-06)

Two reports in one message: a shared screen that was cropped to its middle on a
phone held upright, and a call screen that could not be returned to after leaving
it. Both are complete as code and `NOT VERIFIED`.

**The crop** (`src/features/calls/CallOverlay.tsx`, `src/features/media/surfaces.tsx`,
`src/features/calls/model.ts`). The picture was not being cropped by a rule — it was
cropped because `fit` is one piece of state in `CallOverlay`, a component that lives
as long as the tab, so a **Fill** pressed once (Round 18 added the control because
the owner asked for a resize option) stayed on for every call after it, and a wide
desktop drawn to fill a portrait phone shows only its middle. Three changes: the
view choices (`fit`, `layout`, the focused seat) reset when a call ends; a picture
that changes shape mid-call is taken to be a new source, and the picture returns to
**Fit**; and `VideoSurface` now listens for the element's `resize` event as well as
`loadedmetadata`, because a track replaced under a picture that is already playing —
`RTCRtpSender.replaceTrack`, which is how `shareScreen()` starts a share — changes
the frame without changing the stream, and `loadedmetadata` never fires twice. The
signal is a shape and not a word: a call frame carries no "this is a screen", and the
relay accepts only offers, answers and candidates (`SIGNAL_TYPES` in
`backend/apps/calls/services.py`), so the backend would have to change to say it.

**The way back** (`CallOverlay.tsx`). There was none: the overlay is `fixed inset-0`
above the router, so it covered every page, and nothing drew a way to return once it
was out of the way. The phone gives a call three sizes — a page, a window and a small
mark (`app/lib/screens/call_window.dart`) — and the web now gives it two. A
**Minimize** pill swaps the screen for a bar over whatever page the person went back
to; the bar draws the picture (or a phone glyph), the name and the clock, the
microphone, the camera on a video call, and the red button; tapping it returns to the
call. It carries the sound through `AudioSurface`s of its own, because the full
screen's `<video>` elements are unmounted while it is up. It is reset when the call
ends, so the goodbye is never hidden behind it.

**What is not tested, and cannot be from here.** No device and no browser run was
made: a shared screen seen on a phone, and a call minimized and picked up again, are
precisely the two things this round exists for and neither was watched. The shape
rule is a heuristic with one named hole — a far end whose camera and shared screen
share an aspect ratio (16:9 either way) produces no shape change — and it is recorded
as such rather than as a fix that always holds. A reload still loses a live call: the
engine has no `callId` after one, and nothing in the read-only backend lists the calls
an account is on (`calls.pending` answers only for rings), so a call that survives on
the server cannot be rejoined from a fresh tab. `NOT IMPLEMENTED`.

### New regression tests

Three cases in `src/features/calls/model.test.ts` for `sourceChanged`: a camera that
keeps its frame has not changed source (including a few per cent of noise); the switch
between a 4:3 camera and a 1512×982 desktop changes it in both directions; and a
shape that has never been measured — zero or `NaN` — has nothing to have changed
from.

### Checks at the end of this pass

```text
npm run typecheck                PASS
npm run lint                     PASS (eslint ., no warnings)
npm test                         313/313 PASS (26 files)
npm run build                    PASS
```

The entry chunk is 510.67 kB (158.99 kB gzip) and the stylesheet 134.30 kB, up from
Round 20's 507.43 kB / 158.33 kB and 133.89 kB: the shape rule, the minimized bar and
`VideoSurface`'s `resize` listener all ride in the entry, which already passes 500 kB
and so already draws the one chunk-size warning the build emits. The round made no
backend change and reached no server.

### Read-only project check

`git -C ../xelvic status --short` is unchanged: the same eight pre-existing entries,
and nothing under `backend/` or `app/` was touched by this round. This round read
`app/lib/screens/call_window.dart` (the phone's three sizes for a call) and
`backend/apps/calls/services.py` (`SIGNAL_TYPES`). Neither was written to.

---

## Round 22 — the small call window is moved by hand (2026-11-06)

The same day as Round 21 and about Round 21's own work: *"abhi video call minimize
karne par use drag aur drop nahi kar pa raha hoon chat screen me"*. Round 21's bar
could be reached but not placed.

### What was built

`src/features/calls/minibar.ts` (new) holds the phone's window arithmetic from
`app/lib/screens/call_window.dart`, which was read and not written to:
`homeSpot`, `clampSpot`, `dockEdge` and `WINDOW_GUTTER = 12`. It owns no DOM, which
is the whole reason it exists as a file — the rules are testable without a browser.
`CallOverlay.tsx` grew the placement, the pointer drag with `setPointerCapture` and
a six-pixel slop, the capture-phase click guard, the docked tab, and a
`ResizeObserver`/`resize` measurement of the bar and the page.

### New regression tests

Eight cases in `src/features/calls/minibar.test.ts`, a new file:

- the opening corner, clear of the sides, and inside a screen too small to hold the
  bar;
- a spot pushed off both the top-left and the bottom-right pulled back inside, and a
  spot already inside the gutter left exactly where it was;
- docking left only once the bar is past the gutter — including the boundary case at
  exactly the gutter line, which floats;
- docking right only once the bar's own edge is inside the gutter, with the same
  boundary case;
- never docking from the middle of the page;
- and the named cost: on a phone, where the bar fills the width, it rests one gutter
  from both edges and docks from a single pixel of push.

### Checks at the end of this pass

```text
npm run typecheck                PASS
npm run lint                     PASS (eslint ., no warnings)
npm test                         321/321 PASS (27 files)
npm run build                    PASS
```

The entry chunk is 514.54 kB (159.90 kB gzip) and the stylesheet 134.52 kB, up from
Round 21's 510.67 kB / 158.99 kB and 134.30 kB: the drag arithmetic and the docked
tab ride in the entry chunk, which already passes 500 kB and so already draws the one
chunk-size warning the build emits. Nothing was run in a browser and no device was
touched, so the drag itself — the pointer capture, the click it swallows, the tab it
folds into — is reasoned and unexercised.

### Read-only project check

This round read `app/lib/screens/call_window.dart` again and wrote nothing outside
`xelvic-web/`. No backend file was read or modified, and the round made no change to
any request, address, body, header or response.

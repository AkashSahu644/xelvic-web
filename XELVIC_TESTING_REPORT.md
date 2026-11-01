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
| Calls | no WebRTC product | intentionally unavailable |

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
- **The Memory walk is not implemented**, so there is nothing to test: the
  `isMemory` branches of `moment_view.dart` were read and deliberately not
  ported. Together mode and stickers/drawings are likewise MISSING, and a carry
  lands unedited because the web's `CameraCapture` has no
  seed-with-an-existing-file door.
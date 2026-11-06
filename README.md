# Xelvic Web

A standalone React web client for the Xelvic account system. It shares the Django API with the Android app and uses the APK's brand and theme assets.

This is a parity build, not a redesign. The current status is recorded honestly in [`docs/FINAL_VERIFICATION_REPORT.md`](docs/FINAL_VERIFICATION_REPORT.md); the client is not yet full Android parity.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS
- TanStack Query
- React Router
- Native WebSocket
- `qrcode.react`
- Manrope variable font, shipped locally

No UI kit is used. Components are built from the mobile design language.

## Requirements

- Node.js 22.12.x or 24.x and newer (required by the current Vite/Vitest toolchain)
- npm
- A reachable Xelvic API for real data
- For local API work: the backend's documented Python/Postgres/Redis stack

The web client can build and run without a backend; data screens will show their real connection errors.

## Setup

```bash
cd xelvic-web
npm install
copy .env.example .env
npm run dev
```

The dev server prints its local URL (normally `http://localhost:5173`).

### Environment

```env
VITE_API_URL=http://127.0.0.1:8000
VITE_ENABLE_DEV_LOGIN=0
```

- `VITE_API_URL` is the API origin. The client appends `/api/v1/`.
- `VITE_ENABLE_DEV_LOGIN=1` shows the password door. It is intended for local development; the documented product signs in with a QR from the phone.

Do not commit `.env` or real credentials.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run typecheck` | Strict TypeScript build check |
| `npm run lint` | ESLint |
| `npm test` | Regression tests (theme eligibility, persisted query cache, media disk cache, sticker shelf, sound shelf, part-length menu, the feed's query options, the page's scroll lock, the editor's plate ink, the spark card's painter and its five looks, the bound on what a card waits for, the person a spark moment names, and the Vibe feed weave's own mix) |
| `npm run build` | Typecheck and production build into `dist/` |
| `npm run preview` | Serve the production build locally |

## Routes

### Public

- `/` - direct QR sign-in and optional dev login
- `/signin` - compatibility route for direct sign-in
- `/s/:token` - shared playlist landing
- `*` - not found

### Signed in

- `/app/drops` - feed
- `/app/drops/:dropId` - drop detail
- `/app/moments` - moments
- `/app/convo` - conversations
- `/app/convo/:threadId` - chat
- `/app/audio` - audio home
- `/app/audio/:playlistId` - playlist
- `/app/live` - live rooms
- `/app/live/:roomId` - room
- `/app/u/:username` - profile
- `/app/search` - people/audio search
- `/app/alerts` - requests
- `/app/saved` - saved drops
- `/app/sparks` - theme shop, wallet, sparks, medals
- `/app/settings` - account and appearance

## Architecture

```text
src/
  components/        presentational building blocks, grouped by responsibility
    ui/              primitives: Avatar, Button/Spinner, EmptyState/ErrorState, Blank
    common/          app-wide pieces: ErrorBoundary, Splash
    layout/          page furniture: PageHeader/Tabs/Divider, Backdrop, PlayerBar
    media/           authenticated image and video elements
    overlays/        Modal, ConfirmDialog, PrivacyConfirm
    icons/           brand marks and verified tick
  config/            env addresses, axios client
  constants/         storage keys and other invariant values
  context/           React context objects (created once, read by hooks)
  features/          domain code: drops, moments, convo, audio, live, deals, …
  hooks/             every custom hook (useAuth, useAlerts, useDeals, …)
  layouts/           route layouts (AppShell)
  pages/             route screens
  providers/         implementations behind the contexts (auth, theme, socket, …)
  routes/            route table, guards, lazy page registry and prefetching
  services/          one module per backend area; the only place URLs are called
  store/             client state, persistence and cache actions (no requests)
  styles/            global stylesheet and Tailwind layers
  theme/             palettes, catalogue, assets mapping
  types/             API contracts
  utils/             pure helpers, caches and formatters
public/              brand, favicon, theme covers and paintings
docs/                audit, parity, remediation and verification records
```

Folders exist where there is code to hold. There is no `workers/` folder
because nothing in the app currently does work heavy enough to move off the
main thread; an empty directory is a promise the code does not keep.

- TanStack Query owns server state. The cache keeps a page for 30 minutes and
  treats it as fresh for 60 seconds, so returning to a tab draws what was there
  and revalidates behind it.
- The last answers survive a reload: every query answer (except search results,
  mention pickers and QR sessions) is written to `sessionStorage` per account
  and hydrated into the query client before the first render, so a reload paints
  data instead of skeletons while the network revalidates
  (`src/store/queryCache.ts`).
- A tap opens on the row it tapped: a drop, a room and a convo header are read
  out of the list that cached them and passed as `placeholderData`, so the page
  draws immediately while its own request replaces the seed
  (`src/store/seed.ts`).
- Routes are code-split and prefetched: hovering, focusing or touching a tab
  starts both that page's chunk *and* its first API read, and the five shell
  tabs' chunks are warmed while the browser is idle
  (`src/routes/lazyPages.tsx`, `src/routes/prefetchData.ts`,
  `src/hooks/useRoutePrefetch.ts`). A prefetch reads the page's own query
  options rather than restating them (`src/features/drops/feedQueries.ts`),
  because a query's options are *replaced*, not merged, by the next fetch that
  carries any — a prefetch one option short is not a wasted request, it is a
  query that is wrong from then on.
- One counted scroll lock holds the page still behind an overlay
  (`src/utils/scrollLock.ts`). The document is what scrolls here, so a lock
  written back in the wrong order is a page that never moves again; four
  save/restore pairs became one lock with a release each.
- The camera's editor draws every tool panel and the sticker sheet on one named
  surface — the theme's card and ink, the pair the Audio sheet already used
  (`src/features/camera/PhotoEditor.tsx`). Its controls that sit *on* the
  photograph keep their dark scrim: words over a picture need contrast the theme
  cannot supply.
- The API client is the only place that knows about tokens, refresh and URL joining.
- One socket provider owns connect/reconnect/heartbeat; feature screens subscribe.
  The handshake is opened on idle so it never competes with the first page read.
- Auth has loading, signed-out and signed-in states. The last account is kept
  in `sessionStorage` for the tab so a reload paints the shell instead of
  waiting on `/auth/me/`.
- Themes are CSS custom properties on `<html>`.
- One audio element is owned by the player provider. No autoplay.
- Authenticated media is fetched as a blob because `<img>`/`<audio>` cannot send Bearer headers.
- Those blob reads are invisible to the browser's HTTP cache (an `Authorization`
  header disqualifies a response), so a reload used to re-download every picture
  in the feed. The bytes are now written to `Cache Storage` in a cache named
  after the account (`xelvic-media-<id>`, 400 files, 20 MB per file) and read from
  there before any network request; a disk hit does not queue for a network slot.
  Sign-out, 401 and expiry delete every `xelvic-media-*` cache
  (`src/utils/mediaCache.ts`, `src/providers/AuthProvider.tsx`).
- Long feeds mark each card with `content-visibility: auto`, so cards below the
  fold are neither laid out nor painted until the scroll nears them. Their
  infinite-scroll sentinels sit 1400–2000 px out, so the next page is asked for
  well before the reader reaches the foot rather than when they do.
- Authenticated media reads are capped at six in flight, so a rail of thumbnails
  cannot queue in front of the JSON the page actually needs, while a screenful
  still drains in one pass (`src/utils/mediaCache.ts`).
- A picture is asked for up to 1600 px before it can be scrolled into view
  (about three phone screens), rather than when it is reached, because the first
  byte here takes a few hundred milliseconds
  (`src/components/media/Media.tsx`).

## Verification

Last recorded results:

```text
npm test           PASS (321 cases, 27 files)
npm run typecheck  PASS
npm run lint       PASS
npm run build      PASS
```

Production build output: the entry chunk is 514.54 kB (159.90 kB gzip) and the
stylesheet is 134.52 kB; every page is a separate lazy chunk, so
opening one screen does not download the rest (the largest are Settings 120.64 kB
and a convo 99.67 kB, and the moment viewer is split off from the convo at
42.89 kB because only a thread that carries a story card needs it). The spark
card's page is its own chunk too, 29.43 kB (10.89 kB gzip), because only a sheet
whose "Add to Moments" is tapped needs it — 15.71 kB before the four card looks
landed and 20.26 kB before the sound row joined it. The sound sheets are a chunk
of their own (`SoundPicker`, 24.06 kB / 8.08 kB gzip) and the editor that opens
the same two sheets imports them back: `PhotoEditor` is 59.72 kB, down from
82.48 kB, because "which sound, and which part of it" now lives once in
`src/features/audio/` instead of twice. A face is asked for with
`crossOrigin="anonymous"` — a public avatar address is drawn straight from its
host, and a cross-origin picture drawn plainly taints the canvas and makes it
unexportable — and a paint that fails anyway is retried once without pictures
before the page says it could not draw one. The card itself has five looks —
`classic` (the phone's own card) and `midnight`/`sunset`/`aurora`/`noir`, drawn
from a four-card design sheet and picked at random per card; the four exist only
here, and `classic` is untouched (`card.test.ts` pins its list of fills, and that
test caught a regression during the 2026-11-05 rewrite). The four were rebuilt
on 2026-11-05 against measurements of the sheet: a near-white field of `#F8F5FE`
with the award's tone collecting along the left and right edges, an opaque
motif at the card's centre inside a soft halo of flat steps, the two faces at the
top, the award's name at y 985, the days on a pill, and a foot of tone that
climbs the two edges and dips through the middle. Their soft edges are stacks of
flat shapes a step of alpha apart and never a gradient, per the house rule — so
the sheet's glow is *approximated*, not reproduced. Each look was rasterised
through the real painter in headless Chrome and measured against the sheet (the
motif region of all four now sits within about 4 % of its sheet counterpart) —
but they have never been seen, only measured, and the sheet's cards are 4:5
where the real box is 840×1520, so this is an adaptation of the composition and
not a pixel-exact copy.
The camera's
two chunks (60.20 kB and the picture editor's 59.72 kB, plus the 20.15 kB they
share) are fetched while a convo is being read rather than on the tap that opens
the camera — see `src/features/camera/warm.ts`. No chunk-size advisory is
emitted. Production preview verified that `/` and `/signin` render the sign-in
flow. No authenticated end-to-end pass was possible because the backend was not
available, so the boot-speed, camera, sound-shelf, part-length, prefetch,
drops-feed, scroll-lock, editor-surface, convo-row and Spark-card sound-row
changes below are **NOT VERIFIED** against a live session.

The API itself was measured from this machine on 2026-11-02 (Cloudflare edge in
Singapore, so these numbers are dominated by distance, not by Django):

```text
GET /health/  cold connection   TTFB 0.40–0.61 s (TCP ~0.10 s, TLS ~0.31 s)
GET /health/  keep-alive        TTFB 0.16–0.27 s per request
OPTIONS preflight               TTFB 0.42 s, Access-Control-Max-Age 86400
```

That floor is why the frontend now hides the first round trip (persisted cache,
data prefetch, earlier scroll triggers) and stops paying it twice for media
(blob bytes kept in `Cache Storage`) rather than trying to shorten it. The
improvement a reader sees is **NOT MEASURED in a browser** against a signed-in
session, and the disk-store logic is covered only by the unit tests in
`src/utils/mediaCache.test.ts` (6 cases: round trip, miss, per-account
separation, size limit, session-end wipe, no Cache Storage).

See [`docs/TEST_AND_REGRESSION_MATRIX.md`](docs/TEST_AND_REGRESSION_MATRIX.md) for the full matrix and [`docs/FINAL_VERIFICATION_REPORT.md`](docs/FINAL_VERIFICATION_REPORT.md) for the release verdict.

## Known limitations

- Stickers come off **our own sticker service** first
  (`https://sticker.gaongram.in/api`, a public token-free catalogue that answers
  `access-control-allow-origin: *`; 381 stickers measured 2026-11-02), falling
  back to this API's `/api/v1/stickers/` when that service refuses — which is
  what the phone does, and the reason a picker reading only our own server showed
  a different and much shorter list. A respond's and a note's sticker picker
  reads our own server alone on purpose: those send an id back, and the server
  can only check the ids it has rows for. The camera's code is fetched while a
  convo is being read rather than on the tap, but `getUserMedia` still runs only
  inside the mounted camera, and the first ask is still video *and* audio in one
  call — splitting it would either prompt twice or quietly record clips with no
  sound.
- A convo's audio sheet draws the **uploads shelf** — `/audio/tracks/?source=drop`
  — and not the shipped catalogue, because that is the list the phone's picker
  draws on all three of its chips (`app/lib/screens/audio_picker.dart`). The sheet
  used to ask the route with no `source` at all, which answers the catalogue
  instead — a handful of seeded songs and episodes, which is exactly what a short
  list on that path looks like — and then fell back to the Audio tab's own rows
  when that came back empty. Neither list is the one the phone draws. It asks
  once for 60 rows, the phone's own `kPickerRows`, instead of paging a cursor the
  route does not have, so neither platform can see past the server's cap on the
  drop branch (100). Search narrows the same shelf on every chip, as the phone's
  box does.
- Not full Android parity. Missing: vault, crew list, codepad, artist pages, own QR, account deactivation and several rich chat sheets.
- **Audio and video calls are real, and never verified.** Added 2026-11-06: the two buttons in a convo's header and the call-back button on a call-log row now place a call on the server and ring it, and the tab draws the phone's own phases — dialling, ringing, live and the goodbye — with the same buttons. The media is peer to peer and never touches the server: `RTCPeerConnection` under `features/calls/engine.ts`, the relay's address from `GET /calls/ice/`, the mesh built on the rules `app/lib/calls.dart` already settled (people already in the call offer to the newcomer and the newcomer only answers; two crossed offers are thrown away and the higher id offers again; candidates wait until there is a remote description to add them to), and the signalling is the app's own `call.ring` / `call.accept` / `call.decline` / `call.leave` / `call.video` / `call.signal` / `call.pending` over the one authenticated socket. A request that could not be sent is said again when the socket comes up, a ring that runs out is given up on the server's own `ring_seconds`, and a goodbye that failed is held rather than pretended. **What is not here:** no earpiece/speaker switch (the browser has no such route control — nothing is drawn for it either), and no way to *add* somebody to a call (`call.add` is not sent by this client, so a group call can be received and drawn but not started here). The ringtone, the vibration, the answer from a system notification and the camera flip named here were added on 2026-11-06 (Round 18), and the **Mirror** pill turns the pictures *arriving* rather than this tab's own (Round 20) — a display, never a transmission. **Not verified:** the backend was never reachable from here and there is no second device, so not one frame of this has been seen against a live server — the state machine is covered by tests, the connections are not.
- A convo draws every card kind the phone does — a post, a mention line, a waiting share, an uploaded sound with its player, a song, a playlist, a person, a story, a live room, a sticker, and the header over a reply to a moment — but three of them differ on purpose: a story card does not play the story inside itself and offers no heart or "Remention" (all three are in the viewer it opens), a shared song's heart starts unfelt because a share carries no liked state, and the site can *receive* a song share and a profile share but has no flow that sends one. "Put it on your Moments" is not on the share sheet for the same kind of reason: the site's composer takes files off the roll and a post that is already up has no road to it.
- Passing a post on is the phone's sheet — search, a tick strip, a pinned send button, one card per convo with a tally — and the count on the card moves by what actually landed. None of it has been seen against a live session.
- The chat list is the phone's row: the line under a name never shows the message, the count is `N new` under the name plus a plate on a group's name, and the spark's tap opens the sheet about that run. The sheet's "Add to Moments" pill is drawn on every run and opens the phone's card page — the card painted at the size it will be posted, the two questions before the share, one button — whose composer posts an image moment with a mention, an audience and — added 2026-11-05 — the phone's own **sound row**: "Add audio" opens the same picker the convo's audio sheet uses, "Choose a part" the same window chooser, and the part that is kept is sent as `sound` / `sound_start_ms` / `sound_end_ms` on the moment item, which is the three fields the backend already accepted. The card is painted from the app's font and the two faces **under a bound** (`FACE_PATIENCE_MS`, the phone's `Faces.patience` of fifteen seconds; `FONT_PATIENCE_MS`, two) and never waits for a picture that is not coming: a face that does not arrive in time is drawn as the initials plate the list itself uses, because a card with initials on it posts and a card that was never painted posts nothing. A face is also asked for CORS-clean, and a name that is not a string or a picture the browser will not draw falls back to that same plate — the card is lost only if two whole paints fail. What is still not drawn: the row's play button (the Spark run viewer lives inside a convo, so a row cannot open one). The card's own words are English only — Android reads them from its string table, so a Hindi phone draws a Hindi card and this one does not. Muted rows are drawn like any other.
- Theme purchase now follows Android tier/slot rules in both the web UI and local API; paid theme wearing is ownership-checked. Backend tests were added but could not run because local PostgreSQL rejected the configured test credentials.
- The web Sparks page adds a Themes tab and mobile shortcut, while retaining streaks, ladder and medals tabs beyond Android's Themes/Wallet Reward shape.
- The browser cannot read the device address book, show native push or provide OS background audio controls. Settings can show matches and deny contact uploads; allowing uploads stays in Android.
- Media elements cannot send Bearer headers; the client uses blob URLs.
- Room games are wired against assumed subroutes and need a live check.
- No automated accessibility or visual-regression pass has been run.
- There is no `workers/` folder: no current work is heavy enough to justify
  moving it off the main thread.

## Documentation

- [`docs/MASTER_GOALS.md`](docs/MASTER_GOALS.md)
- [`docs/APK_PARITY_MATRIX.md`](docs/APK_PARITY_MATRIX.md)
- [`docs/SCREEN_BY_SCREEN_AUDIT.md`](docs/SCREEN_BY_SCREEN_AUDIT.md)
- [`docs/SECTION_AND_INTERACTION_AUDIT.md`](docs/SECTION_AND_INTERACTION_AUDIT.md)
- [`docs/BACKEND_API_PARITY_MATRIX.md`](docs/BACKEND_API_PARITY_MATRIX.md)
- [`docs/DESIGN_PARITY_AUDIT.md`](docs/DESIGN_PARITY_AUDIT.md)
- [`docs/TEST_AND_REGRESSION_MATRIX.md`](docs/TEST_AND_REGRESSION_MATRIX.md)
- [`docs/REMEDIATION_LOG.md`](docs/REMEDIATION_LOG.md)
- [`docs/FINAL_VERIFICATION_REPORT.md`](docs/FINAL_VERIFICATION_REPORT.md)

Earlier inventory documents are also kept in `docs/`.

## Round 18 — the ring, the notice, the camera, the layout, and room sound (2026-11-06)

The calls added on 2026-11-06 now ring, reach the browser's own notification
surface, ask the camera for a better picture and lay themselves out for a phone
and a laptop, and a live room's sound is carried over the same relay an ordinary
call uses — with no new endpoint, because a room's stage is a `calls.Call` on the
server.

New: `src/features/calls/ring.ts` (the app's own `public/ringtone/call.wav` with a
written Web Audio tone behind it, and vibration), `src/features/calls/notice.ts`
and `public/call-sw.js` (one notice per ringing call, with Decline and Accept fed
back into the engine), `src/features/calls/quality.ts` (1080p at 30 fps with a
floor, `maintain-resolution`, a bitrate from the picture, device pickers and a
`getStats` pill), a rebuilt `src/features/calls/CallOverlay.tsx` (fit/fill,
spotlight and grid, a draggable clamped self-view, fullscreen), and
`src/features/rooms/` with `src/features/media/surfaces.tsx` for the room's sound.

This closes what the calls bullet in Known limitations had listed as missing —
the ringtone and the vibration, the answer from a system notification, and the
camera flip; earpiece/speaker
routing and `call.add` still stand as not implemented, and nothing is drawn for
either. **None of it is verified.** No connection was ever made, no microphone,
camera, vibrator or notification surface was ever opened, and there was no second
device, so every one of these is `PARTIALLY COMPLETE (NOT VERIFIED)`.

## Round 19 — the flipped picture, the cards that fit, and Vibes woven into the feed (2026-11-06)

The round that answers three of the owner's own reports and one omission.

**The picture is no longer mirrored when it should not be.** The phone mirrors
only its front lens (`app/lib/calls.dart`, `_selfMirrored`); the web mirrored
unconditionally, which is what the owner saw as *"video me jo video ban raha hai
wo ulta ban raha hai aur phone me sahi hai"*. `src/features/calls/engine.ts` now
carries a `Facing` (`"user" | "environment" | null`) and a `mirrored` flag on the
snapshot: `mirrored()` returns a person's own choice when they have made one and
otherwise answers `facing !== "environment"`, so a camera reporting a back lens
is not flipped. The facing is read off the track itself —
`track.getSettings().facingMode`, called from `openCamera()` and from
`openDevice()` — and both fields reset in `closeMedia()`.
`src/features/calls/CallOverlay.tsx` draws the self picture with
`mirror={!call.sharing && call.mirrored}` and adds a **Mirror** pill (active when
mirrored) after the existing **Flip camera** pill. The same rule and the same
button sit on a room's own tile, through `src/features/rooms/stage.ts` (which
exposes `toggleMirror`), `useRoomStage.ts`, `RoomSoundView.tsx` and
`RoomPage.tsx`. This is complete as code and **not verified**: no device or
browser run was made, and a webcam that reports no `facingMode` at all falls back
to mirrored, which is the honest default rather than a known-good one. *(The
self-view half of this was reversed the same day, on the owner's own report: the
Mirror button is about the pictures arriving rather than this one, and `mirrored()`
is the lens alone. See Round 20.)*

**A card's picture can no longer ask for a box taller than the screen, and the
card is a column rather than the whole window.** The owner's report was *"jo card
video aur post ka ban raha hai wo pure screen ke andar hi aaye screen se bahar na
jaye jaise instagram me hai"*. The cause was that the media box took the card's
whole width and derived its height from the server's `ratio` (height ÷ width)
with no ceiling, so a portrait post wanted a box taller than the screen at every
width, a 1440-pixel desktop window included. Both numbers are the phone's own
(`tallClipShare = 0.62`, the photograph's `0.78`, in
`xelvic/app/lib/screens/drops.dart`, whose comment is the owner's earlier report
of 2026-10-27).

**The second pass, on the owner's screenshot of 2026-11-06.** They reported
*"design sahi nahi hai aur card bhi ganda lag raha hai aur width bahut jyada hai,
aur for you ke upar jo vibes ka section tha wo bhi hat gya hai, please use
rakhiye"* beside a photograph of a card 1000 points wide holding a picture 318
points wide. Three faults, three changes, all in `xelvic-web`:

- **The column.** `DropsPage.tsx`'s grid was `max-w-[1240px]`, one column below
  the `xl` breakpoint, so a card was drawn the whole width of the window — 1240
  points on a desktop. The feed column is now capped at the 660 points the `xl`
  breakpoint already gave it and centred at every size, which is the closest
  thing to the phone's 390-point card a desktop has.
- **The box.** `frameBox` was written so that a still answered the height
  ceiling by *narrowing*, which is the phone's rule and is invisible there — at
  390 points wide and 800 tall, the ceiling costs a portrait photograph about a
  tenth of its width. On a wide, short browser window the same rule costs two
  thirds of it, and the card is left with a strip of picture in the middle and
  empty card either side. A box with an automatic width is narrowed by the
  browser to satisfy `max-height`; `src/features/drops/frame.ts` now writes
  `width: 100%` outright, so **the box keeps the card's width and the ceiling
  takes the height**, with `object-cover` cropping. A still is drawn at the
  poster's shape up to four-to-five — the tallest a card stands anywhere — and
  the whole picture is on the post's own page (`DropPage`). A clip keeps the
  app's own `62dvh`. `SensitiveVeil.tsx` takes the exact box as a `frame` prop
  so the cover and the picture are the same box, before and after lifting.
- **The strip.** The rail dropped every clip the feed was drawing *anywhere*,
  so a shelf of eight clips against two scrolled pages of ten left it empty and
  took the whole section off the page. `mix.ts`'s `railClips` now bounds the
  exclusion to the feed's **first block** — the cards the strip is on the screen
  with — never draws an empty strip over a shelf that has clips, and is the
  app's rule unchanged on a filled page.
- **The door.** A clip in the feed is a card a thumb opens, and in the app that
  is true of a plain video as much as of a Vibe: `DropVideo.onOpen` is
  `isVibe ? openVibe : _openFrame`, and `_openFrame` is `openClip`, which is
  `openVibe` (`app/lib/screens/drops.dart`). Here only a woven Vibe had a door,
  so a video somebody posted played where it sat and a press on it did nothing —
  the owner's report of 2026-11-06: *"app me drops ke for you post me video post
  par click karne par ek dusare page me wo video open hota hai waise isme nahi ho
  raha hai"*. `model.ts`'s `dropIsClip` is the app's own test
  (`(kind == 'video' || isVibe) && asset.content_url`) and now has both readers:
  the card asks it whether to draw the clip, the page asks it whether to hand
  the card a door. A clip the shelf does not hold is carried **in front of** it —
  `mix.ts`'s `walkOf` — so the walk opens on the clip under the thumb and the
  shelf is a swipe away, which is the phone's `Drops.it.carry`. A still is left
  alone, as the app leaves it. `reco.ts` now sends each row's own `kind` (`drop`
  or `vibe`, as `Reco.served` does): the server resolves an id against the table
  its `kind` names (`_KINDS` in `apps/reco/services.py`), so a plain video
  reported as a `vibe` was a row `_existing` could not find — dropped in silence.

`VibeViewer.tsx`'s walk stopped pinning all four edges of a `fixed` box — it is
`fixed inset-x-0 top-0 h-[100dvh]` now, because a box pinned on every edge
resolves against the *layout* viewport, taller than the visible area when a phone
browser shows its bottom bar, which had put the caption, the comment rail and the
clip's player panel underneath it while the page scroll was locked.
`src/styles/index.css` moved `body` from `min-height: 100vh` to
`min-height: 100dvh` (it was the app's only `100vh`; every page root already used
`dvh`) and added `overflow-x: clip` as a guard against a sideways spill, and
`PollBlock.tsx` gained `break-words` on an answer's text in three places, so a
long unbroken word is not cut off by the row it is in. This is complete as code
and **not verified** on a device; the `VibeViewer` height change is a reasoned
fix with medium confidence and is not claimed as watched.

**Vibes are woven into the feed.** The server states a policy and the client does
the weaving: `GET /drops/` answers `vibe_share` (0.20 for a reader it knows, 0.40
for a cold start, `apps/drops/services.py:feed_vibe_share`), and the phone's
`Drops.mixedFeed` lays the clips out. The web ignored the field and had no weave,
so its feed never carried a Vibe. `src/features/drops/mix.ts` is now a whole port
of `mixedFeed` / `_mixSlots` / `shelfOrder` / `shelfKey` from
`xelvic/app/lib/drops.dart` — `shelfKey` (FNV-1a, salted), `shelfOrder`, `mixSlots` (a partial Fisher–Yates
over ten slots), `mixPerBlock`, `mixedFeed`, `filledWithVibes` and
`RAIL_CLIPS = 10`. One thing in the port could have gone quietly wrong and is
named: the hash multiply is done with `Math.imul`, because the phone's `int`
holds the whole product before masking and a JavaScript number does not.
`src/pages/DropsPage.tsx` reads `vibe_share` off the feed's first page (falling
back to the app's 0.20 until a page carries one), draws a salt once per opening of
the page, keeps a rail of the shelf in `shelfOrder` **less the clips the feed's
first block is drawing** — capped at ten, and never emptied while the shelf has a
clip on it: a clip met twice on one screen is two counters a like would have to
move together (the owner's *"dono rahe"* was about the two shapes, not about one
clip in both places), but a strip that vanishes takes its heading with it, which
is what the owner reported on 2026-11-06 — weaves the feed through
`mixedFeed`, draws a clip (a Vibe or a plain video) as a card whose picture opens
the walk, and — for
a `caught_up` feed with nothing left — fills from the shelf's own tail *past the
rail's ten*, with the foot asking for the next hand of clips instead of a page of
drops. Hiding or taking a card down now sweeps **both** the feed and the Vibes
queries. `src/types/api.ts`'s `Page<T>` gained `vibe_share?: number`.
`DropCard.tsx` gained an optional `onOpen`: a single press on the picture waits
out the 220 ms double-press window and then opens, so a double press still only
feels the post, and a card given no `onOpen` behaves exactly as before (the mute
button stops propagation, so muting does not also open). `EditDrop.tsx` reads the
drop route first and the Vibe route when that says there is nothing there,
because a URL carries an id and not the table it lives in. `MomentDropCard.tsx`'s
exported `previewPath`, which named `/app/drops/vibes/<id>` — a route that does
not exist — is deleted; it had no callers. This is complete as code for the weave
and the rail and **not verified** against a live server.

**What this round does not do, said plainly.** A Vibe still plays only its own
`asset`: the recipe (`recipe`) and the addresses of the uploads it names
(`clip_urls`) are sent by the server and read by **nothing** here, so a Vibe
edited on the phone plays on the web as its first clip alone — no voiceover, no
music lanes, no per-clip trim or speed, no overlays, no filter and no chosen
frame shape — `NOT IMPLEMENTED`. There is no Vibe editor on the web: the composer
posts `{asset, caption, music, mentions, sensitive}` to `POST /drops/vibes/` and
never sends `recipe`, `category`, `interests` or `track_id`, though the server
accepts all four — `NOT IMPLEMENTED`. Play counts never move from the web:
nothing under `src/` calls `POST /drops/<id>/play/`, which the phone calls at
`xelvic/app/lib/audio.dart:1975`, so a sound played in the browser does not
advance `plays` and the poster's own numbers do not include it —
`NOT IMPLEMENTED`, and a silent omission rather than a claim on screen. And
`GET /drops/mine/` and `GET /drops/interests/` are still unused, so there is no
"my own posts" shelf and a post made here carries no interests and cannot be
filed — `NOT IMPLEMENTED`.

**Nothing in the round is verified.** `npm run typecheck`, `npm run lint` and
`npm run build` pass, and the suite was 307 tests over 26 files when the round
closed (310 now, after Round 20), with
`mix.test.ts` (24 cases) carrying the phone's own weave over plain values and
`model.test.ts` holding the clip rule both readers ask and `frame.test.ts` the
box a card draws in. But
no device and no browser run was made at all, so the mirror rule, the cards that
now fit the screen, the restored strip and the clip that opens the walk are all
unexercised in a real browser or against a live server.
`git -C ../xelvic status --short` is unchanged: nothing under
`backend/` or `app/` was touched.

## Round 20 — the Mirror button now turns the other person's picture, not mine (2026-11-06)

The owner's report: *"jo video call me mirror par click karne par jo flip ho raha
hai wo mere video card me raha hai jabki reciever user video card me hona
chahiye"*. Round 19's button did the opposite of what was wanted: it overruled
the self-view's own lens rule, so the one picture on the screen that was already
right was the one that turned over.

Asked which picture the button should turn, the owner chose **the other person's**
— the picture arriving here — with the self-view left on the phone's own rule.

**The phone's own answer, for the self-view.** `app/lib/screens/call.dart` has no
Mirror button at all: `_mine` draws this tab's own tile through
`mirror: calls.selfMirrored` (front lens mirrored, back lens not) and every remote
tile through `_feed(person, mirror = false)`, and `app/lib/screens/room.dart` does
the same with `mirror: person.id == mine && Stage.it.selfMirrored`. So
`CallEngine.mirrored()` is now `facing !== "environment"` and nothing else, the
hand-overrule is gone with `toggleMirror()`, and a browser webcam that reports no
`facingMode` is drawn mirrored — which is the honest reading of a camera somebody
is sitting in front of, and is named as a gap below.

**The button, turned round.** `src/features/calls/engine.ts` carries a
`remoteMirrored` flag on the snapshot (`private remoteMirror`, false until
pressed, cleared in `closeMedia()` so the next call starts unflipped), set by
`toggleRemoteMirror()`. `CallOverlay.tsx`'s `RemoteTile` gained a `mirror?` prop
handed straight to `VideoSurface`, and all three of its sites pass
`call.remoteMirrored` — the grid, the spotlight and the rail thumbnails — so the
button means one thing on every tile. `SelfView` is unchanged at
`mirror={!call.sharing && call.mirrored}`. The pill is active on
`call.remoteMirrored`, and it waits for a picture to arrive
(`others.some((seat) => streamFor(seat.user)?.getVideoTracks().length)`) rather
than for this tab's own camera to be on: the button is about what is on the screen
and not about what this tab is sending, and a pill over a seat whose camera is off
would be offering something the screen cannot answer. A room's tile carries the
same meaning through `features/rooms/stage.ts`'s `toggleRemoteMirror()`,
`useRoomStage.ts`, `RoomSoundView.tsx` (the self tile draws `mirrored`, every other
tile `remoteMirrored`) and `RoomPage.tsx`, with the same wait-for-a-picture guard.

**What this is, and what it is not.** It is a **display and not a transmission**:
nothing in the outgoing track is transformed, so nobody else's screen changes when
it is pressed — there is no way for it to change anyone else's screen, since a
mirror is applied by `VideoSurface`'s `-scale-x-100` to a `<video>` element and
never to a track. A picture the far end is *sharing* rather than filming is turned
over too, because a call frame carries no word for which of the two a stream is,
so there is nothing on this side to tell them apart. This is a deliberate
divergence from the phone, which has no such button at all, and it was added
because the owner asked for it.

**Not verified, and the two honest gaps.** `npm run typecheck`, `npm run lint`,
`npm test` (310 cases, 26 files) and `npm run build` all pass, and
`engine.test.ts` gained three cases over the new flag — the default, the press
that leaves this tab's own `mirrored` alone, and the reset that a next call opens
unflipped. But no device and no browser run was made, so the flip was never
watched: two ends on a real call is the only thing that can say the receiver's
picture turns and the sender's does not. And because the self-view can no longer
be overruled by hand, a webcam reporting no `facingMode` — most laptops — is drawn
mirrored with no way to change it.

## Round 21 — a shared screen shown whole, and a call that can be put aside (2026-11-06)

Two reports in one message: *"screen share wale me problem aa raha hai jaise ki,
main screen laptop me share kar raha hu aur koi apne mobile me dekh raha hai to
pura screen nahi dikh raha hai use kewal beech ka dikh raha hai"* and *"video call
karne par main video hata kar chat par aa raha hu aur call chal hi rahi hai to phir
main video call par nahi aa raha pa raha hu"*.

**A shared screen is shown whole.** The crop was the *viewer's* own Fit/Fill choice,
kept for as long as the tab lived: `fit` was one piece of state in `CallOverlay`,
so once somebody pressed **Fill** — which Round 18 put there because the owner asked
for a resize control — every later call was cropped, and a wide desktop cropped to
fill a phone held upright is only its middle. Two rules now hold:

- **The choice belongs to the call.** `fit`, `layout` and the focused seat are put
  back to their defaults when a call ends (`idle` or `over`), so the next call opens
  the way the screen's own comment describes: the whole picture, letterboxed.
- **A picture that changes shape is a different source.** A camera does not change
  its own frame mid-call, so a far end that does is switching what it sends — a
  camera for a screen, or back. `model.ts`'s `sourceChanged(before, after)` answers
  that with a 12 % threshold, and `CallOverlay` returns the picture to **Fit** the
  moment it answers true. The measurement comes from
  `src/features/media/surfaces.tsx`, which now listens to the video element's
  `resize` event as well as `loadedmetadata`: a track replaced under a picture that
  is already playing (`sender.replaceTrack`, which is how a share starts) changes
  the frame without changing the stream, and `loadedmetadata` never fires twice.

The measurement is honest about what it is: a *shape* change, not a word from the
server saying "this is a screen". A call frame carries no such word, and the signal
relay accepts only offers, answers and candidates (`SIGNAL_TYPES` in
`backend/apps/calls/services.py`), so there is nowhere to put one without changing
the backend — which this project does not.

**A call can be put aside and come back to.** There was no way to leave the call
screen while a call was running: `CallOverlay` is `fixed inset-0` above the router,
so it covered every page, and nothing drew a way back once it was out of the way.
The phone has three sizes — a page, a window and a small mark
(`app/lib/screens/call_window.dart`) — and the web now has two: the screen, and a
**Minimize** pill in the toolbar that swaps it for a small bar over whatever page
the person went back to. The bar carries the picture (or a phone glyph when there
is none), the name and the clock, the microphone, the camera on a video call, and
the red button; tapping it returns to the call. It carries the sound through
`<audio>` elements of its own, because the full screen's `<video>` elements are
gone while it is up and a call that went quiet when its screen was out of the way
would be a call somebody thinks has dropped. It is reset when the call ends, so the
goodbye is never hidden behind it.

**Not verified.** `npm run typecheck`, `npm run lint`, `npm test` (313 cases, 26
files) and `npm run build` all pass, and `model.test.ts` gained three cases for
`sourceChanged` — a camera that keeps its frame, the 4:3-to-desktop switch in both
directions, and a shape that has never been measured. But no device and no browser
run was made: a shared screen seen on a phone, and a call minimized and picked up
again, were never watched. The shape rule is a reasoned fix with high confidence,
not a watched one.

## Round 22 — the small call window can be dragged, and it docks (2026-11-06)

The owner's own report of the same day, about Round 21's own work: *"abhi video call
minimize karne par use drag aur drop nahi kar pa raha hoon chat screen me"*. Round 21
gave a call somewhere to go; it did not let that place be chosen. The bar was pinned
to the bottom of the screen by five classes of CSS, and a phone glyph in its corner
was the only hint that moving it was ever meant to be possible.

**It moves now, and it can be put against an edge.** The rules are the phone's, taken
from `app/lib/screens/call_window.dart` (read, never written to) and kept in a file
of their own — `src/features/calls/minibar.ts` — because they own no DOM: they take
rectangles and return them, so they can be tested without a browser.

- It is dragged by pointer events on the bar itself, and the drag is **captured**, so
  the window keeps following the finger or the cursor after it leaves the bar's own
  rectangle — which is almost immediately. Only after six pixels of travel does a
  press become a drag (`DRAG_SLOP`), so a slightly unsteady tap on the microphone or
  the red button is still a tap; a drag that a browser still turns into a click is
  stopped by the bar's capture-phase handler rather than being allowed to mute
  somebody by accident.
- It is **clamped on every draw**, not only while it is being moved: a rotation, a
  narrowed window or a phone keyboard all move the edge it was keeping clear of, and
  a window nobody can reach is a call nobody can answer.
- Letting go **into** an edge folds it to a 28-pixel tab at that edge, at the height
  it was let go at; a press brings the window back and it stays where it was left.
  "Into" and not "near", for the phone's reason: while it floats it is held a
  12-pixel gutter clear of every side, so its own edge can only be inside that gutter
  if somebody pushed it there. Tapping rather than dragging the tab, also for the
  phone's reason — the strip along a screen edge belongs to the browser's and the
  device's own back gestures.
- The sound is drawn **beside** the window rather than inside it, so folding the
  window into a tab does not take the call's voice with it.

**Not verified, and one cost named honestly.** `npm run typecheck`, `npm run lint`,
`npm test` (321 cases, 27 files) and `npm run build` all pass — `minibar.test.ts` is
new and carries eight cases over the corner, the clamp and the two edges. But no
browser run and no device run was made: nothing was dragged, docked or pulled back on
a real screen. And on a phone the bar fills almost the whole width, so it rests
already exactly one gutter from both edges and comes back docked from the smallest
push — the phone's own window has the same rule and not this problem, because it is
116 points wide on the same screen. That cost is pinned by a test rather than left to
be discovered.

**Still missing, and named rather than implied.** The phone's third size — a call
hidden down to a single small mark and nothing else (`CallView.hidden`) — has no
counterpart here, and a page reload still loses a live call outright.

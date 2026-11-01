# Xelvic Web — Progress Tracker

Date: 2026-11-01
Scope: `xelvic-web/` only. `xelvic/app` (mobile) and `xelvic/backend` were read
and were **not modified**.

Evidence, re-checked at the end of every pass in this file:
`git -C xelvic status --short -- app backend` reports only the same pre-existing
`app/` Flutter/Gradle edits (`analysis_options.yaml`, `android/*`, `pubspec.*`,
all stamped 2026-10-31, before any of this work) and **nothing at all under
`backend/`**. No file outside `xelvic-web/` was created, edited or deleted.

Status words in this file mean exactly what they say:

- **DONE** — the code path exists, calls the real endpoint, and the static
  checks (typecheck, lint, tests, build) pass.
- **NOT VERIFIED** — the code path exists but was not exercised against a live
  backend or a second device in this environment.
- **NOT STARTED** — no code path.

## Phase 0 — Discovery and audit

| Item | Status | Evidence |
| --- | --- | --- |
| Mobile feature inventory | DONE | `XELVIC_MOBILE_FEATURE_INVENTORY.md` |
| Web/mobile parity matrix | DONE | `XELVIC_FEATURE_PARITY_MATRIX.md` |
| API compatibility report | DONE | `XELVIC_API_COMPATIBILITY_REPORT.md` |
| Implementation plan | DONE | `XELVIC_WEB_IMPLEMENTATION_PLAN.md` |
| Baseline checks | DONE | typecheck pass, 24/24 tests pass |

## Phase 1 — Foundation

| Goal | Status | Where |
| --- | --- | --- |
| 1.1 Design tokens and primitives | DONE (pre-existing, verified) | `src/index.css`, `src/components` |
| 1.2 Route protection + lazy routes | DONE (pre-existing) | `src/App.tsx` |
| 1.3 API client, refresh, errors | DONE (pre-existing) | `src/lib/api.ts`, `src/lib/errors.ts` |
| 1.4 Conversation cache helpers | DONE | `useMessageCache` in `src/pages/ChatPage.tsx` |
| 1.5 Optimistic message model | DONE | `Message.pending/failed`, `client_id` |

## Phase 4 — Conversations (the priority)

| Goal | Status | What was actually changed |
| --- | --- | --- |
| 4.1 Architecture audit | DONE | audit written into the API report and plan |
| 4.2 Optimistic send + reconciliation | DONE (NOT VERIFIED live) | `deliver()` in `ChatPage` inserts a `pending` row with a `client_id`, uploads, sends, and replaces the row with the server message (socket echo and HTTP response are deduped by id/`client_id`). Failures mark the row `failed` and offer retry with the same `client_id`. |
| 4.3 Honest receipts | DONE | `receiptWord()` reads `thread.status` and seat watermarks only. The literal `"Delivered"` default is gone. `thread.read` frames merge into local state and the thread cache. |
| 4.4 Spark view-once path | DONE (NOT VERIFIED live) | Detection is the server's `payload.view_once` (a Spark is an ordinary photo/clip, not a kind); send goes through the app's camera/editor as `kind: image|video` + `payload: {view_once: true}`; open reads `payload.opened_at` only, and the viewer fetches the bytes before `POST .../open-once/`. The old browser-local opened state and invented kinds are gone. |
| 4.5 Forward | DONE | `ForwardSheet` → `POST .../messages/{id}/forward/` `{threads}`; result count comes from the server response. |
| 4.6 Group message info | DONE | `MessageInfoSheet` → `GET .../messages/{id}/info/`, rendered for groups only. |
| 4.7 Live thread-card patch | DONE | `thread.update` patches `["threads"]` in place (preview, unread delta, timestamp, pinned-first re-sort); unknown threads fall back to a refetch. |
| 4.8 Preview + unread badge correctness | DONE | `ConvoRow` renders the real preview from `thread.preview`; numeric unread badge replaced the play glyph; `threadLine` no longer hides an incoming preview behind an outgoing status. |
| 4.9 Composer polish | DONE | per-thread draft restore via `localStorage` (guarded), emoji panel, attach menu, auto-grow, Enter/Shift+Enter. |
| 4.10 Scroll/pagination | VERIFIED (static) | newest-first pages rendered ascending; older pages prepend with a scroll anchor; optimistic rows sort last. |
| 4.11 Message search | DONE | `/chat/search/?q=` rendered under the Convo search field; opening a result navigates to its thread. |
| 4.12 Offline outbox / durable sync | NOT STARTED | needs a design decision; `/chat/sync/` is unused |
| 4.13 Calls | BLOCKED | no WebRTC product surface; buttons say so honestly |

Additional work in the same pass:

| Item | Status | Where |
| --- | --- | --- |
| Upload progress | DONE | `upload.ts` XHR progress callback; bubble shows `Uploading n%` + bar |
| Retry without re-upload | DONE | the uploaded asset id is kept on the send intent |
| Location messages | DONE | renders a maps link from `payload.location/place` |
| Collab / vanish-ask cards | DONE | payload-driven card with honest answer state |
| Edited marker | DONE | `Edited ·` prefix on the receipt line |

## Spark and chat-screen fidelity pass (2026-11-01, second pass)

| Item | Status | Where |
| --- | --- | --- |
| Spark send contract | DONE (NOT VERIFIED live) | `CameraCapture` posts an ordinary `image`/`video` message with `payload: {view_once: true}`. `kind: "spark"` was rejected by the backend and is removed. |
| Spark entry in chat | DONE | attach menu → "Spark" opens the same `CameraCapture` editor used by the app (`fromChat`). |
| Spark bubble — recipient | DONE | "A Spark for you" tile (38px accent circle, sparkles, 15 w700 + 12.5 dim "Tap to open · once only"), accent-42% border, accent-10% card wash, radius 18. |
| Spark bubble — sent/opened/gone | DONE | pill with `auto_awesome`/`visibility_off_outlined` and the exact app words "Spark · sent", "Spark · opened", "Spark · gone"; state from `payload.opened_at` only. |
| Spark viewer | DONE (NOT VERIFIED live) | full-screen black; "Spark" + "{n} of {m}"; close; loading sparkles/spinner; gone copy; tap advances through the unopened run, last tap closes; reply bar posts a real `reply_to` message. |
| Screenshot line | DONE | rendered only when the server sets `payload.shot_at`; browser screenshot detection is impossible, so none is fabricated or POSTed. |
| Spark sound band | DONE (NOT VERIFIED live) | reads `payload.sound` as an asset id (like `SparkLook.of`), fetches `/chat/assets/{id}/content/` with auth, plays/pauses with the payload's start/end window, and shows `sound_title` or "Sound attached". |
| Chat design fidelity | DONE | heading carries only name/face/verified tick (no `online` / `typing…` subtitle); no clock above text bubbles (clock only on bare media/cards); day pills; 4/10/2 run gaps; group sender at run head only; receipt under every own bubble; `Edited` marker inside non-bare cards; bubble padding 14/10/14/8, radius 18/6, 76% max; composer 12/8/8/8, 22px field, 46px send. |
| Emoji and separator glyphs | DONE | `ChatPage`, `ConvoPage` and `ConvoRow` carried double-encoded UTF-8 (`â¤ï¸`, `Â·`, `typingâ€¦`); they now hold the real ❤️ 😂 🔥 👍 😮 😢 set, `·`, `—`, `…` and ✨. |

## Marketplace and theme pass (2026-11-01, third pass)

The ask: Settings → Marketplace must be the app's, exactly — one page, the three
aisles, the same structure and flow — and a theme must reach *every* screen the
way it does on the phone.

| Item | Status | Where |
| --- | --- | --- |
| One marketplace, three aisles | DONE | `features/marketplace/MarketplaceView.tsx` — the strip (Drip / Themes / Logos, accent underline the width of the label, as the app's `TabBar`) and one aisle mounted under it. Ported from `screens/marketplace.dart`. |
| One purse, one reading | DONE | `MarketPurse` sits in the Settings header, as the app's `_header()` does with `SparkPurse(compact: true)`; all three aisles read the same `/sparks/wallet/` query, so the header and the tiles cannot disagree. |
| One Settings row, not two | DONE | The web-only "App logo" row and its `view === "logos"` sub-page were deleted. `screens/settings.dart` carries the owner's note that the app has exactly one Marketplace row; `?tab=logos` survives as `initialTab`, which is the deep link the app's own links use. |
| Themes aisle | DONE | `ThemeShopView.tsx`: the Mode button (Light → Dark → System), the shelf three to a row, "Mix your own" and its one-colour / mix-three picker, ported from `theme_shop_view.dart`. |
| The preview moves the whole web | DONE (NOT VERIFIED) | `previewDesign` puts the design on before the page is drawn and `clearPreview` takes it back off, and `setPreviewDark` moves the Light/Dark segments — the same pair of calls as `ThemeProvider.apply` on the phone. Applying records the reading that was looked at. |
| Logos aisle | DONE (NOT VERIFIED) | `LogoShopView.tsx`: twelve plates three to a row at the app's `side = ((maxWidth - 32 - 24) / 3).clamp(64, 132)`, the tile is the preview, a tap on a locked plate opens a price sheet, and buying wears it in the same breath. |
| Drip aisle | DONE (NOT VERIFIED) | `DripView.tsx`: the on-now figure with its time left, the shelf, the profile switch, and the full figure page. |
| Theme picture behind the shell | DONE (bug fixed) | The shell's backdrop layer was drawn at `z-index: auto`, which paints *after* every plain card and line of text in the same stacking context — so on a picture theme (Unicorn, Cat Girl) the picture covered the page instead of standing behind it. It is now `-z-10` inside an `isolate` shell, which is the stack position Flutter's `ThemeBackdrop` gives its first child. |
| Theme picture behind the marketplace | DONE | The app's Marketplace is a pushed screen with `Scaffold(backgroundColor: X.pageGround, body: ThemeBackdrop(...))`, and a `ThemeBackdrop` with no page named is the **Convo** page. `SettingsShell` takes that backdrop, so the page where a colour is chosen repaints itself under the thumb that chose it. Every other settings view keeps the app's own flat `Scaffold(backgroundColor: X.ink)`. |
| Theme picture behind the preview | DONE | `ThemePreviewPage` draws the design's own ground; `theme_preview.dart` is a `ThemeBackdrop` for the same reason. |
| Theme picture inside a chat | DONE (NOT VERIFIED) | `ChatPage` draws `theme.chatWall` under the thread when nobody picked a wallpaper, at `chatVeil ?? WALL_SCRIM` of the page's own ink — the app's ordering and the app's wash. The chat's bar and composer become glass while the theme stands on a picture, which is what `X.pageGround` being `clear` means. |
| One copy of the ground | DONE | `src/components/Backdrop.tsx`, ported from `screens/backdrop.dart`: the picture, the crop, and one tone of wash, for all four callers. |
| `markSizeFor` gate | DONE | Now gated on the row setting a mark at all (`row.mark.isNotEmpty`), not on it being a shape this build draws — a row's number is honoured even when its shape falls back. |

Not claimed: the chat's accent on a convo with no colour of its own. The phone
uses `theme.chatTint ?? #E31B66`; the web computes that value into
`--convo-accent` but the chat still falls back to `--accent`. See the gap report.

## Settings pass (2026-11-01, fourth pass)

The ask: Settings must be the app's, every page and sub-page of it. What stands
now, all of it inside `src/pages/SettingsPage.tsx` and `src/features/settings/`:
the one list with the app's rows and the app's order, and the sub-pages behind
them — profile, privacy, professional, verification, marketplace, language,
notifications (switch, message sound, ringtone, calls), devices and their
revocation, kept people, chat lock, permissions, and account deletion behind its
password. The Marketplace keeps its single row and its three aisles (see the
marketplace pass above).

## Profile pass (2026-11-01, fifth pass)

The ask: the profile must be the app's on both pages — mine and somebody else's
— and every part of it must work the way the phone's does.

| Item | Status | Where |
| --- | --- | --- |
| One handle, two pages | DONE | `ProfilePage` branches on the handle, so my own page is my own page from the first frame rather than a stranger's copy that turns into mine |
| Somebody else's page | DONE (NOT VERIFIED live) | `features/profile/PersonProfile.tsx`, a port of `person.dart`: cover band and theme art, the face, the trade, the name and tick, `@handle · private/public`, the birthday line, the professional pills, the counts the payload actually allows, the mutual strip, the posed bio, their Memories and their shelf, the gate card, and the floating discs in the app's order (⋮, convo / keep / let go / ask, their QR) |
| The day behind the face | DONE (NOT VERIFIED live) | `FaceButton` in `features/profile/parts.tsx` draws the app's `Ring` — a flat 2.5px accent hairline while their day is unwatched, the text colour at 16% once it is — from the `["moments-tray"]` row for that person; the tap opens `MomentViewer` over the page (`_openLive`), the hold opens the face |
| The face, as large as it goes | DONE | `FaceDialog` — `showFace` / `_showPhoto`: a 240 square, rounded 22, their name under it, tap anywhere to close |
| Birthday fall | DONE | `features/profile/BirthdayFall.tsx`, a port of `birthday.dart`: 13 balloons rolled once from the fixed seed, six eleven-second crossings then rest, flat tones and hairline strokes with no gradient, `pointer-events-none`, and nothing drawn at all under `prefers-reduced-motion` |
| Mutuals | DONE (NOT VERIFIED live) | `MutualStrip` → `MutualsModal` → `/social/users/{id}/mutuals/` (`mutuals.dart`); the count and the three faces come off the profile payload, the list is read only when opened |
| Their QR | DONE | `xelvic://u/@<handle>`, the exact string `qr.dart` writes and its scanner reads |
| The viewer, shared | DONE | `MomentViewer` moved out of `MomentsPage` into `features/moments/MomentViewer.tsx`, so the profile's ring and the moments page open the same walk; the build emits it as one 10 kB chunk both pages import |
| The ring's colour | DONE | `.story-ring` was a conic gradient of four colours; the app's `Ring` is one flat accent, and the convo row and the profile now both wear that |

Not claimed in this pass:

- The theme-bundled **figure** behind a bio. The catalogue carries the figure's
  name but not its pictures, so `PosedBio` draws the pose without it. See the
  gap report.
- The app's ⋮ sheet on somebody else's page also carries that convo's own
  settings; the web has no convo-settings sheet there, so the web's ⋮ holds
  mute and report only.
- Nothing on this page is a live-backend claim: no profile, ring, day or
  birthday was exercised against a running server here.

## Notifications pass (2026-11-01, sixth pass)

The ask: notifications must be the app's — every kind, live, and arriving the
way a phone's does, including when nobody is looking at the page.

| Item | Status | Where |
| --- | --- | --- |
| The alert row | DONE | `pages/AlertsPage.tsx`, rebuilt to `screens/alerts.dart`: a 16pt card with 10pt padding and an accent-10% ground when unseen; a 48pt face square holding a 44pt avatar, or the kind's own 22pt glyph on accent-14% for a self-spoken row; the person's door under everything else; a 20pt badge in `accentAt(alertTone)` ringed 2pt in the card's ground with an 11pt glyph in `inkOn`; the 28pt mark door offset 4pt past the badge's corner; a 58×76 tile whose word sits *under* the picture; keep answers side by side as 44pt doors around 34pt washes; and a 9pt dot in a 48pt-high column at the far end |
| More rows | DONE | scroll-for-more at the app's 400pt threshold (an `IntersectionObserver` sentinel) instead of a "Load older" button |
| Where a row goes | DONE | `alertPath` in `features/alerts/model.ts` — the phone's `_open` as one table, including `route` for studio news (`/theme/<key>`, `/c/<key>`, `/o/<id>`, `/l/<key>`) |
| The kinds the row did not know | DONE | `friend_moment` and `studio` join the model: a sentence each, a tone each, a mark label each, and a glyph each |
| The in-app strip | DONE | `features/notices/` — `NoticeProvider` (the decision) and `NoticeBanner` (the drawing), ports of `notices.dart` and `notice_banner.dart` |
| A hidden tab's row | DONE | `Notification` API, permission-gated; a strip that is up when the tab goes away is handed to it; a click focuses the tab and opens the row's destination |
| Live alerts | DONE | `alert.new` / `alert.read` are applied to the `["alerts"]` cache by `useAlerts`, and a hidden tab gets a system row composed by `alertSummary` rather than the alert's often-empty `body` |
| One owner for the sound | DONE | `SocketProvider` now owns only the connection; the chime and every system row come from `NoticeProvider`, which is the only place that knows whether the conversation is on screen, muted, or already announced |

Not claimed in this pass:

- **A notification after the site is closed is BLOCKED.** The server pushes only
  through Firebase, to the `Device.push_token` the phone app registers. This
  build has no Firebase project config, no VAPID key and no service worker, and
  the backend is read-only, so there is no honest web-only version of it. The
  Notifications page says exactly that instead of implying a sound it cannot
  produce.
- **No live run.** No two clients exchanged a line here; the strip, the dedupe,
  the mute rule and the hidden-tab row are implemented against the server's
  documented frame shapes and are **NOT VERIFIED** at runtime.

## Moments pass (2026-11-01, seventh pass)

The ask: Moments must work the way they work on the phone — exactly, and nothing
dropped. The reference is `app/lib/screens/moment_view.dart`, read line by line,
with `app/lib/moments.dart`, `app/lib/strings/en.dart` and
`backend/apps/moments/{urls,views,services}.py` alongside it.

`MomentViewer.tsx` was rewritten as a **port** of `MomentViewScreen` rather than
a redrawing of it. What that means, item by item:

| Item | Status | Where |
| --- | --- | --- |
| The clock and the per-item hold | DONE (NOT VERIFIED live) | a 60ms ticker (`kBarTick`). `holdMs(item)` is `MomentItem.hold` ported exactly: a clip holds for its own `clip_start_ms`…`clip_end_ms` window; a sound holds for its window capped at `kSoundLongest` (60s) but never shorter than the picture's own life; a picture carried in from a post keeps the life written on it; the floor is 5s. A video's bar is read off the element's own `currentTime`, so a paused clip is a paused bar. |
| The gesture | DONE (NOT VERIFIED, and needs a touch device) | tap steps: the left 32% of the width goes back, everything else forward. Hold pauses at 480ms (`kHoldToPause`); holding past 1230ms (`kHoldToPause + kHoldToLeave`) arms "let go and I'll take you there", and letting go calls `openCarried()`. The hold is drawn as a clock running *down* under the header, in `_carriedTo`'s own words: "Hold to open the drop" / "Let go to open the drop". |
| The browser's extra click | DONE (a real fix) | Flutter has a gesture arena; the web does not, so a `pointerup` that ended a long press is still followed by a `click`. Left alone, a hold would pause *and* step forward. A `consumed` ref is set the moment the hold fires and the click handler spends it, and a `facesPressed` ref does the same job for the react button's long press. |
| What a moment carries | DONE | `carried` reads in `_carried`'s order — a Vibe on the item, then `made_from.vibe`, then `made_from.drop`, then a sound, then `source_id` — and `where` speaks `_carriedTo`'s words ("Vibes", "the drop", "Audio", "what it came from"). |
| Opening a carried thing | DONE | a Vibe closes the walk and goes to `/app/drops?vibe={id}`, which is the Vibes *shelf* walk at that clip (`_openReels(vibeId:)`, and the web has no per-vibe route to push); a drop goes to `/app/drops/{id}`; a sound goes to `/app/audio`; a `source_id` fetches `GET /moments/{id}/` and **pushes a second walk over the one original moment** (`_openSource`). |
| My own day opens last | DONE | `_ownOrder` reverses the **days** on my own moments and not the pictures inside them, so my walk opens on what I last put up while each day still plays first to last. |
| Marking watched | DONE | `POST /moments/items/{id}/seen/` as each item comes up, and `POST /moments/{id}/seen/` on the item that ends the day — the phone's two calls, in the phone's places. |
| The heart | DONE (NOT VERIFIED live) | `POST /moments/{id}/react/`; a tap is `kStoryLike` (❤️) or a blank emoji to take it back; a long press opens `kStoryFaces` (❤️ 😂 🔥 👏 😮) under "Answer with". The server's answer is what is drawn, never a local guess. |
| The answers tally and the who sheet | DONE (NOT VERIFIED live) | drawn on my own day only, because `services._reactions` sends a non-owner `{count: 0, counts: {}, mine}` — so a reader is shown no number rather than a made-up one. The sheet reads viewers, reactors and (on a poll) voters **when it is opened**, and draws the app's three groups: "Who watched and answered", "Answered", "watched", and "Who chose what". |
| Reply | DONE (NOT VERIFIED live) | `POST /moments/{id}/reply/` — a message into a convo, not a like. The field is `Reply...`, 2200 characters, and focusing it holds the clock (`_held || _typing`). |
| Carry | PARTIALLY COMPLETE | `POST /moments/{id}/carry/` on the item that names me (the `mentions` list decides). The app opens the picture in its Image editor first; the web's `CameraCapture` has no "seed with an existing file" door, so a carry here lands the moment unedited. Named in the gap report, not papered over. |
| Share | DONE (NOT VERIFIED live) | gate then deed: `POST /moments/{id}/share/` with no body asks whether this account may share it, and only then does the picker open; `{thread}` is the send, one convo at a time, and the count reported is the number that actually arrived. A refusal is the server's own refusal, so the web never opens a sheet whose Send would fail. |
| Take down | DONE | behind `ConfirmDialog` with the app's own words — "Take this down?" / "It goes for everybody, now, and there is no getting it back." — then `DELETE /moments/{id}/`. |
| The three dots | DONE | `_hasOptions` is mine **and** a non-empty strip: the sheet is titled "This moment" and holds "Add to Memories" and nothing else. |
| Add to Memories | DONE (NOT VERIFIED live) | `AddToMemories` reads `/moments/awaiting/` and the Memory list, and files a new Memory (`POST /moments/memories/`) or adds to one (`PATCH /moments/memories/{id}/`). |
| `/app/moments?memories=1` | DONE (a dead button fixed) | "New Memory" on my own profile opened a route parameter that nothing read. `MomentsPage` now consumes it, opens `AddToMemories`, and strips the parameter so a reload does not reopen it. |
| The stage's own metrics | DONE | `MomentStage` now uses `kNoteColumn` / `kNoteMargin` (520 / 44) for a text moment's column and `kSongCoverGap` / `kSongCoverMargin` (18 / 28) for a track moment's title, and both it and the viewer draw over media with `_overMedia` — `text-shadow: 0 0 4px rgba(0,0,0,0.8)` — rather than a veil. |

Not claimed in this pass:

- **The Memory walk is MISSING.** `MomentViewer` is built for moments. The app's
  `isMemory` branches — a Memory's own header words, the
  `memories/{id}/react|reply|share/` routes, and Remove instead of Take down —
  are not ported, so a Memory is listed and filed but not walked.
- **Together mode and stickers/drawings are MISSING.**
- **No live run.** No moment was posted, watched, answered, carried or shared
  against a running backend here. Every write above is **NOT VERIFIED**.
- **A carry lands the moment unedited**, as described in the Carry row.

Also corrected in this pass, and recorded in
`XELVIC_MOBILE_FEATURE_INVENTORY.md`: the web had a composite moment it called
the **Morning Question**, built around a `prompt` field that exists on neither
`MomentSerializer` nor the app's model. It was fabricated, so it was removed and
the field was struck from `src/types/api.ts`.

## Checks run after these changes (2026-11-01)

| Command | Result |
| --- | --- |
| `npm run typecheck`  (`npx tsc -b`) | pass |
| `npm run lint` (`npx eslint src`) | pass |
| `npm test` | 29/29 pass (5 files; new `features/convo/model.test.ts`) |
| `npm run build` | pass |

All four were re-run after the settings, profile and notifications passes with
the same result (29/29, five files).
The emitted bundle was grepped for what the profile pass added — `Send request`,
`xelvic://u/@`, `data-birthday-fall`, `Hold to see their photo`,
`Nothing is up right now`, `Could not open those moments`, and the four
`xelvic-ask-*` keyframes — all present, and `MomentViewer` emitted once as a
shared chunk rather than copied into both pages.

Nothing in this file is a live-backend claim. Every marketplace write is
**NOT VERIFIED** at runtime: no purchase, wear or figure pick was executed
against a running server in this environment.

## Still open (not started in this pass)

- Group admin surfaces (members/roles/invites/rooms) beyond the existing
  partial `ConvoSheet` flows.
- Notification preferences backed by the server (BLOCKED: no endpoint).
- A notification after the site is closed (BLOCKED: FCM-only push, no web
  address — see the notifications pass above).
- Mutuals, crew, mentions read surfaces.
- Account deactivation, language preference.
- Offline outbox / durable sync.
- Calls (WebRTC) — blocked.
- The chat's accent on an uncoloured convo (see the gap report; it changes
  screens that were not the subject of this pass).
- Deals, circles, collabs, creator tooling, editors.
- The Memory walk (`isMemory`): a Memory's own header words, its
  `memories/{id}/react|reply|share/` routes, and Remove in place of Take down.
- Together mode, and stickers/drawings on a moment.
- A carry that opens the picture in an editor before it lands; the web has no
  "seed the camera with an existing file" door.
- Live cross-device verification (needs a second authenticated device), and now
  also a live marketplace run (buy, wear, figure pick) and a live moments run
  (post, watch, answer, carry, share) against a real server.
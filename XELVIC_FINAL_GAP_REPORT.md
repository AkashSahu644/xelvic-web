# Xelvic Web — Final Gap Report

Date: 2026-11-01
Target: `xelvic-web/` only.
Reference (read-only): `xelvic/app` (Flutter, 151 screens, ~256k lines) and
`xelvic/backend` (Django, 24 apps).

## Honest headline

**Full mobile-to-web parity has not been reached.** The conversation system —
the stated highest priority — is implemented end to end at the code level and
passes typecheck, lint, unit tests and a production build. It has **not** been
verified against a live backend or a second device, because this environment
has neither.

The mobile app is 151 screens and ~256k lines; the web app is 25 page files in
`src/pages` and ~61k lines of `.ts`/`.tsx` across 191 files (recounted
2026-11-01 — the earlier "20 pages, ~31k lines" was a stale baseline). Closing
the rest is a multi-phase effort, not something this pass completed.

## Status key

- **COMPLETE** — web surface exists, main interactions call real endpoints,
  static checks pass.
- **PARTIALLY COMPLETE** — some workflows exist; named sub-features are absent.
- **MISSING** — no web surface.
- **BLOCKED** — no honest web-only implementation exists.
- **NOT VERIFIED** — code exists but was not exercised live.

## Project integrity

- No file under `xelvic/` (mobile or backend) was created, edited or deleted by
  this work. Only reads were performed against the backend and mobile source.
- Checked again at the end of the Spark/chat pass:
  `git -C xelvic status --short -- app backend` shows only the same pre-existing
  `app/` Flutter/Gradle edits that were already there before this work
  (`analysis_options.yaml`, `android/*`, `pubspec.*`); `backend/` shows no
  changes. Nothing from this session appears in that list.
- Checked again at the end of the marketplace pass: the same result — only the
  pre-existing `app/` edits, and `backend/` clean. The marketplace work read
  `apps/studio/urls.py`, `apps/drip/urls.py`, `apps/sparks/urls.py`,
  `apps/accounts/urls.py` and `config/urls.py` to confirm the six endpoints it
  calls exist and are mounted where it calls them; it changed none of them.
- All edits and all seven documents live inside `xelvic-web/`.
- Checked again at the end of the Moments pass: the same result. The pass read
  `app/lib/screens/moment_view.dart`, `app/lib/moments.dart`,
  `app/lib/screens/drop_card.dart`, `app/lib/screens/memory_add.dart`,
  `app/lib/strings/en.dart`, `backend/apps/moments/urls.py`,
  `backend/apps/moments/views.py` and `backend/apps/moments/services.py` to
  confirm the ten routes the viewer calls (eleven calls — `{id}/` is both the
  read and the Take down) and the rules it keeps; it changed
  none of them. All 22 Moments routes the web uses are tabulated against
  `apps/moments/urls.py` and `config/urls.py:175` in
  `XELVIC_API_COMPATIBILITY_REPORT.md`. `git -C xelvic status --short -- app
  backend` still shows only the pre-existing `app/` Flutter/Gradle edits.
- Checked again at the end of the Memory-alert wiring: the same result. That
  step read `apps/moments/urls.py`, `apps/moments/views.py` and
  `apps/moments/serializers.py` to place the four `memories/{id}/…` views and to
  read `MemoryEditSerializer`'s keys. It changed none of them.
- Checked again at the end of the Circles pass: the same result. That pass read
  `app/lib/screens/circles.dart`, `app/lib/circles.dart`,
  `app/lib/screens/drop_post.dart`, `backend/apps/circles/urls.py`,
  `backend/apps/circles/views.py`, `backend/apps/circles/serializers.py`,
  `backend/apps/circles/services.py`, `backend/apps/drops/views.py`
  (`write_fields`) and `config/urls.py:191` to confirm the four routes and the
  drop body a take is written with; it changed none of them. `backend/` is
  clean.
- Checked again at the end of the two Spark-composer fixes: the same result.
  Both passes read `app/lib/screens/spark_moment.dart` and `app/lib/faces.dart`
  (for `Faces.patience`) and nothing else outside `xelvic-web/`; they changed
  none of it. `git -C xelvic status --short` shows the same eight pre-existing
  entries (seven `app/` edits and the untracked `.tools/`) and nothing under
  `backend/`.

## Moments (ported from `MomentViewScreen`, 2026-11-01)

| Piece | Status | Note |
| --- | --- | --- |
| Walk, clock and per-item hold | COMPLETE / NOT VERIFIED live | 60ms ticker; `MomentItem.hold` ported exactly (clip window, sound window capped at `kSoundLongest`, a carried picture's own life, else `HOLD_FLOOR`); a video's bar read off the element's own clock |
| Tap / hold gestures | COMPLETE / NOT VERIFIED | tap steps (left 32% back, else forward); hold pauses at 480ms (`kHoldToPause`) and arms leaving at 1230ms (`kHoldToPause + kHoldToLeave`); the click the browser fires after a hold is swallowed by hand, because the web has no gesture arena to do it |
| Carried, and the line that names it | COMPLETE / NOT VERIFIED | `_carried` order and `_carriedTo` words ported; "Hold to open X" / "Let go to open X" drawn only when the item carries something |
| Seen | COMPLETE | per item as it comes up, and the moment on its last item |
| Answers tally + who sheet | COMPLETE / NOT VERIFIED | drawn on my own day only, exactly as `_reactions` gates it; the sheet reads viewers, reactors and (on a poll) voters when it is opened |
| Faces and the heart | COMPLETE / NOT VERIFIED | tap = `kStoryLike` or a take-back, hold = `kStoryFaces`; the server's answer is what is drawn |
| Reply | COMPLETE / NOT VERIFIED | `/reply/`, a message into a convo; holding the clock while the field is focused |
| Carry | COMPLETE / NOT VERIFIED live | A picture off somebody else's item goes through the web's own editor first — `carryMoment`'s rule — and posts with `source`, so the credit and the Remention card are the server's. Everything with nothing to draw on (a clip, a note, a Vibe, no picture) still carries straight through `/carry/`. Two things the phone's editor carries are **not** carried on the web, because the web editor has no field for them: `links` and `tags` (the positions the named people were drawn at). The mentions ride across; the pills' own positions do not |
| Share | COMPLETE / NOT VERIFIED | gate then picker, one convo at a time, count reported from what actually arrived |
| Add to Memories | COMPLETE / NOT VERIFIED | `AddToMemories` from the three dots, and `/app/moments?memories=1` from "New Memory" on my own profile — which was a live dead button before this pass |
| Memory walk (`isMemory`) | COMPLETE / NOT VERIFIED live | Ported on 2026-11-01: a shelf opens the *same* viewer a moment opens in, told `isMemory`. No watchers and no eye row, no `seen`/`itemSeen` calls, "Your Memory" / "Memory" / "{n} in this Memory" for the header line, answers at `/moments/memories/{id}/react|reply|reactors|share/`, "Whoever answers turns up here." in the who sheet, no three dots (the one row behind them is "Add to Memories" and it already is one), and Remove with the app's own wording instead of Take down. A Memory of a playlist opens where that playlist lives rather than as a walk |
| Managing a Memory from the shelf | COMPLETE / NOT VERIFIED live | The long press on my own card — the web's first — opens the app's four rows: Add more to it (the picker, with the shelf already decided), Rename, Change the cover (one of its own pictures, or one off this device), Remove. A playlist Memory leaves out the two rows that have no meaning over one |
| A Memory named in Alerts | COMPLETE / NOT VERIFIED live | Done on 2026-11-01, once `MomentViewer` could draw one. `alertPath` sends a `memory` target to `/app/moments?memory=<id>`; the page asks `moments/memories/` (a Memory has no by-id read) and opens the one it names through the same `memoryAsMoment` the profile's shelf uses — playlist Memory to the playlist, a marked one it may not open to the app's own sentence, an empty one to "There is nothing left on this shelf". The old refusal ("Memories are not on the web yet.") is gone |
| Together mode, stickers/drawings | **not a gap** | Corrected on 2026-11-01 after reading the app again: `moment_view.dart` has no together mode and no sticker or drawing tools, and neither has the app anywhere else (`grep -rn "together\|Together\|watch party" app/lib` finds only unrelated wording). Stickers, drawings, text and frames are the *editor's* — `PhotoEditor` on the web and `ImageEditorScreen` on the phone — and the web has all four |
| The Morning Question | **removed** | A composite moment built around a `prompt` field that exists on neither the server nor the app. It was fabricated, so it is gone rather than hidden; `XELVIC_MOBILE_FEATURE_INVENTORY.md` records the correction |

## Circles (ported from `circles.dart`, 2026-11-01)

Added on request: the app's Moments page has a Circles section with "Pick your
interests" and the web had none.

**About the source.** The phone's Moments page no longer draws the section —
`app/lib/screens/moments.dart:629` mounts `LiveNow` ("This is where the Circles
section used to sit") since commit `f4f7ffb7` on 2026-10-31. The section, both
of its screens and all four backend routes are still shipped, and the port
follows that shipped source. That is the ask; it is not a claim that the web and
the phone's current Moments page match.

| Piece | Status | Note |
| --- | --- | --- |
| The section | COMPLETE / NOT VERIFIED live | `CirclesSection` under the rail on `/app/moments`. Header with the month while nothing is picked and the run's flame once something is, "+" while there is room, the empty card that *is* the picker, the cards, and "N more interests this month" off the server's `max_picks` |
| A circle card | COMPLETE | field glyph, `field · COUNTRY`, seats, flame, chevron, task line, status, post button, the top three rows and "See all N takes". One transparent button under the content opens the circle, so the post button inside it does not also open the page |
| The picker | COMPLETE / NOT VERIFIED live | "Your interests", "Choose up to {n}", a tick / lock / plus / spinner per row, read fresh every time it opens because the ticks are monthly, and a pick that lands straight in the circle it made (`pick/` answers with the day) |
| The circle page | COMPLETE / NOT VERIFIED live | `/app/circles/:circleId` — members' faces, the task card, "Today's board" with the server's count, and a numbered `DropCard(read: false)` per take. The board is already ranked by `services.board`; the web does not re-sort it |
| Posting a take | COMPLETE / NOT VERIFIED live | The shared `DropComposer` with `circle` set. `POST /circles/{id}/` runs the same `write_fields`, so the body is the drop composer's own; the task's `kind` only chooses the door (text → note, sound → sound, clip → a video upload, picture → pictures). Heading "Your take", button "Drop it" |
| The window, honestly | COMPLETE | `open` is false both before and after a day, so the copy is chosen with `opens_in`: "The board opens when the day does." / "Nothing went up today." / "Nobody has answered yet." A sealed day sends `task: null`, and the web draws the hour instead of inventing a task |

**Still open here:** the section and both screens are **NOT VERIFIED** against a
running server. No interest was picked, no take was posted and no board was read
live in this environment.

A side-by-side of the two Moments pages showed Circles on the web and not on the
phone, since both were honest to their own source. Since the Audio and Live pass
the web draws the phone's own `LiveNow` strip under the rail *above* the section,
so the only remaining difference is that one extra door — kept because the app
reaches circles from their own shelf and the web has no such shelf.

## Audio and Live (2026-11-01)

Brought to the app's shape on request. Sources read, not modified:
`audio.dart`, `audio_bits.dart`, `audio_studio.dart`, `live_now.dart`,
`room.dart`, `room_bits.dart`, with `apps/audio/{urls,views,studio}.py` and
`apps/spaces/` read for the contract.

| Piece | Status | Note |
| --- | --- | --- |
| Category doors | COMPLETE / NOT VERIFIED live | `/app/audio/c/:key` — the server's shelf, its title and subtitle, rows that play with the shelf as the queue |
| Weekly board | COMPLETE / NOT VERIFIED live | `/app/audio/board` — `weekSpan` and the server's order; no re-ranking |
| Studio | COMPLETE / NOT VERIFIED live | `/app/audio/studio` — one's own only; an unmeasured number says so |
| One studio item | COMPLETE / NOT VERIFIED live | `/app/audio/studio/:itemId` — lifetime sums, the trend read (no band or score when `score` is null; the outcome word and the server's `why` instead), rates ("Not measured"), components, audience bars, "Where they are" (null → "Not recorded." + why), used by, this week, false rights |
| Row hearts | COMPLETE | Every row, an uploaded sound included — a drop is felt at its own route |
| Downloads door, swipe deck | NOT IMPLEMENTED | A browser has no kept-tracks store here; the swipe deck was not ported. Both are named on the page's own header |
| "Live now" strip | COMPLETE / NOT VERIFIED live | `?shelf=kept` under the Moments rail; always drawn; socket-refreshed; silent on failure. Circles stay below it (recorded difference) |
| Create a room | COMPLETE | One `OpenRoomSheet` for both doors; the toast names what the server made — a room on air or an announcement |
| Room head and menu | COMPLETE / NOT VERIFIED live | Cover, "{host} · {crowd}", "Over" / start time / LIVE; Start now, Share, Report, Close, Leave quietly — the app's conditions, behind one deliberate press |
| Share outside | COMPLETE | `navigator.share` with the clipboard fallback; the line is the app's `roomLine` plus the address |
| Report a room | COMPLETE / NOT VERIFIED live | `ReportSheet kind="room"`, reasons from the server, never on your own room |
| **Room sound** | **NOT IMPLEMENTED** | The app's stage audio is a WebRTC mesh over the `call.signal` relay. The web has had a client for that relay since the calls (2026-11-06), but the room page was not wired to it, so the page draws the stage, hands, chat, reactions and board and says plainly that the voices are not here |

**Still open here:** none of it has been run against a live server in this
environment.

## Conversation system (Phase 4)

| Area | Status | Note |
| --- | --- | --- |
| Two-pane layout, responsive | COMPLETE | desktop sidebar + pane; mobile full-screen |
| Optimistic send | COMPLETE / NOT VERIFIED | `client_id`, pending row, server reconciliation |
| Failed send + retry | COMPLETE / NOT VERIFIED | retry reuses `client_id`, no duplicate; asset not re-uploaded |
| Upload progress | COMPLETE / NOT VERIFIED | XHR `upload.onprogress`, `Uploading n%` + bar |
| Message types | COMPLETE (NOT VERIFIED live) | text, image, video, voice/audio, doc, poll, location, collab, vanish-ask, system, and every shared card the app's `chat.dart` dispatches: drop/post/Vibe (+ the mention line and the waiting shell), an uploaded sound with a real player, a song (`payload.track`), a playlist, a person (`payload.profile`), a story (`payload.story`, including the retracted shape), a live room and a sticker. Corrected on 2026-11-02: the four that were being dropped on the floor are drawn now |
| The strip over a thread's first message | COMPLETE (NOT VERIFIED live) | Added 2026-11-02. "This convo is encrypted" on every thread, and "Disappearing convo · {window}" with the accent border when vanish is on — the app's `_strip`, its geometry and its own two strings. Before this it was drawn only while disappearing messages were on, so an ordinary convo said nothing about what it is |
| Reply to a moment (`payload.moment_ref`) | COMPLETE (NOT VERIFIED live) | Added 2026-11-02. The header over the bubble ("Replying to their moment · clip" / "Replied to your moment"), and the press reads the moment and opens it; a moment past its day says so rather than failing |
| Passing a post on | COMPLETE (NOT VERIFIED live) | Rebuilt on 2026-11-02 as the app's `ShareCard`: search, a tick strip of ten faces, a pinned send button, one card per convo (`sendToMany`) with a tally of what landed, a partial run said out loud, "Another app" written only once the hand-off happened, "Copy a link" writing nothing. "Put it on your Moments" is **NOT IMPLEMENTED** — the site's composer takes files off the roll, so the row would open an empty composer and is not drawn |
| Camera's open from a convo | PARTIALLY COMPLETE (NOT VERIFIED live) | Changed 2026-11-02. The tap used to be the moment two chunks (`CameraCapture` 57.46 kB + `PhotoEditor` 76.44 kB) began downloading, and `getUserMedia` could not start until both had parsed. The chunks are now fetched in the browser's idle gap and on hover/focus/touch of the camera button, and the convo's own mount draws a real sheet while it arrives instead of `null`. What remains: `getUserMedia` itself, which cannot start before the component mounts, and the first `getUserMedia` still asks for video and audio together — splitting that would either prompt twice or silently record clips with no sound, which is a faster wrong answer |
| The phone's own sticker shelf | COMPLETE (NOT VERIFIED live) | Changed 2026-11-02. `app/lib/editor/stickers.dart` reads `https://sticker.gaongram.in/api` first and our own `/api/v1/stickers/` only as a fallback; the web read the server alone and therefore showed a different, much smaller list. The service is a public, token-free read that answers `access-control-allow-origin: *`, so the browser asks it directly |
| "All" in the editor's audio sheet | COMPLETE (NOT VERIFIED live) | Rewritten 2026-11-02, sixth round. It now draws the **uploads shelf** — `GET /audio/tracks/?source=drop&limit=60`, the phone's own `kPickerRows` — which is what `app/lib/screens/audio_picker.dart` draws on all three of its chips. The earlier version of this row described an ask for the *catalogue* at `limit=500`; that was the bug, not the fix: with no `source`, `TrackListView` keeps the catalogue (the shipped songs and episodes — `seed_audio.py` ships four songs and two episodes, so that path draws a short list of exactly the shape reported), and the sheet fell back to the Audio tab's `recent`/`podcasts`/`hero` whenever that read came back empty. Either way the list was not the one the phone draws. Which of the two the reported nine rows came from cannot be told without the live database — the catalogue path is the better fit, since the phone's docstring puts the shipped catalogue at ten tracks and the local seed ships four songs and two episodes, either of which reads as a list that size; that the sheet read neither the uploads shelf nor anything like it is certain from the code. Both the wrong ask and the fallback are gone. Search narrows the same shelf (`?source=drop&q=`), as the phone's box does; neither platform pages, and the drop branch caps at 100 server-side |
| The editor's Save on a sound | COMPLETE (NOT VERIFIED live) | Fixed 2026-11-02, sixth round. It called `POST /drops/{id}/save/`, which is **not a route in any urlconf** — `apps/drops/urls.py` has no `save` path — so every Save on an upload was a 404 behind a success toast. It now files the sound through `POST /saved/` with `{kind, id, on}` (`src/store/saved.ts`, `hooks/useSaved.ts`), under the key the app itself uses: `AudioTrack.savedKind`, i.e. `drop` for an upload and `track` for a catalogue row. The catalogue path used to go to `/audio/tracks/{id}/like/`, the heart, which is a different question |
| The part-length chooser in "Choose a part" | COMPLETE (NOT VERIFIED live) | Fixed 2026-11-02, seventh round. It offered **six** lengths (10–35 s in fives) where the phone offers **eleven** (`_WindowViewState._durationSeconds`, 10–60 s), so a 40- to 60-second part could not be asked for on the web at all. The list is the phone's now, and it opens as a **menu anchored to the pill** rather than the portal sheet it used to open — the one deliberate difference from the phone, which draws a modal sheet of chips here (this was the ask). The start–end readout stopped being a button, as it is on the phone, so the line has one control for its one question instead of two that did the same thing |
| Replies / edit / delete / copy / react / vote | COMPLETE | existing, preserved |
| Forward | COMPLETE / NOT VERIFIED | `ForwardSheet` → `/forward/` |
| Message info (group) | COMPLETE / NOT VERIFIED | `MessageInfoSheet` → `/info/` |
| Receipts | COMPLETE | server `status` + watermarks only; no fabricated "Delivered" |
| Typing + presence | COMPLETE / NOT VERIFIED | socket events |
| View-once / Spark | COMPLETE / NOT VERIFIED | correct send contract (`payload.view_once`), `open-once/`, recipient tile, sent/opened/gone pill, run viewer, sound band, reply, server shot line |
| Chat-screen design fidelity | COMPLETE (static) | app heading, bubble/composer metrics, run spacing, day pills, sender-at-run-head, receipt and edited placement |
| Theme's own picture inside a chat | COMPLETE / NOT VERIFIED | `theme.chatWall` behind the thread when no wallpaper was picked, at `chatVeil ?? WALL_SCRIM` of the page's own ink; the bar and composer go glass while the theme stands on a picture |
| Chat accent on an uncoloured convo | COMPLETE / NOT VERIFIED live | Fixed on 2026-11-01. `ChatPage` rebinds the whole accent family (`--accent`, `--accent-soft`, `--accent-chip`, `--accent-strong`, `--accent-rgb`) to `--convo-accent`, which `ThemeProvider` already computed as `chatTint ?? accent` — the phone's `convoAccent()`. `TINT_HEX` now carries the phone's own light-scheme readings (`kTints`: `#0E7C8C`, `#0E7A4A`, `#96590A`, `#C42348`, `#9B2FAE`) instead of the server's dark-scheme hexes, and `tintHex` answers for `default` with the app's pink `#E31B66` rather than null |
| Typing / presence surface | PARTIALLY COMPLETE | typing events still real; web shows a dot line, the app shows the other side's character pose (no web character catalogue); header `online` text removed to match the app |
| Live thread card + reorder | COMPLETE / NOT VERIFIED | `thread.update` patched in place |
| Conversation list line, unread count and row marks | COMPLETE (NOT VERIFIED live) | Rebuilt 2026-11-03 as `home.dart`'s row. The line under a name is never the message: `Say something`, my own receipt word, `N new`, or `Nothing new` (`listLine`). The count is `N new` under the name plus a plate at the end of a **group** name, and no longer an accent circle at the far right of every row. The right-hand side is the phone's one line in its order: pin, birthday cake, timer (3 px from the spark), spark, clock (7 px). The waiting bar is the phone's 3 px mark inset 14 px. The Unread lane drops a convo whose only waiting line is a Spark (`inUnreadLane`, off `unread_other_count`) |
| Message search | COMPLETE / NOT VERIFIED | `/chat/search/` in the Convo search field |
| Drafts, emoji, attach menu, auto-grow | COMPLETE | |
| Scroll / pagination | VERIFIED (static) | anchor preserved when older pages load; optimistic rows sort last |
| Group admin (members/roles/invites/rooms) | PARTIALLY COMPLETE | list and basic management only |
| Vault / vanishing | PARTIALLY COMPLETE | mode shown; consent flow limited |
| Disappearing-message consent sheets | MISSING | |
| Sticker picker | COMPLETE (NOT VERIFIED live) | Built on 2026-11-02 as the app's `_StickerPicker`: **plus → Sticker** in a convo, a search box, a four-column grid, and the shelf read from our sticker service first (381 stickers measured 2026-11-02) with our own server as the fallback. A picked sticker sends the app's own contract — an ordinary `text` line whose payload carries `{id, url, name}` — so the picture stays where it lives and a build that has never heard of stickers still reads the name. Before this there was no sticker entry in the attach menu at all |
| Sticker in the editor and in a respond | COMPLETE (NOT VERIFIED live) | The editor's sheet reads the same shelf, with the search box narrowing what is already in hand; a respond's and a note's picker still reads **our own server only**, because `_comment_sticker()` validates the id against our own rows. A sticker arriving from the phone used to draw `"[object Object]"` — it now draws the picture the app draws, 148 px, `object-contain` |
| Keep / collab consent sheets | MISSING | |
| Offline outbox / durable sync | MISSING | `/chat/sync/` unused; needs design |
| Calls (audio/video) | PARTIALLY COMPLETE (NOT VERIFIED) | Added 2026-11-06. Real WebRTC, not a placeholder: the engine opens the devices, builds the peer mesh and speaks the phone's own socket protocol, with the relay's address from `GET /calls/ice/`. The convo header's two buttons and a call-log row's call-back button now place calls instead of toasting; the call screen draws dialling, ringing, live and the goodbye. **Missing:** ringtone, notification-based answering, an earpiece/speaker switch, camera flip, and `call.add` — a group call can be drawn but not started from the web. **Not verified:** no live backend and no second device here, so the state machine is tested and the connections are not |

### The convo row: what is still not the app's (2026-11-03)

- **The play button** — `NOT IMPLEMENTED`. The phone's `SparkPlayButton` plays the
  Sparks a convo is holding, one after another, fetched by the row's own tap. This
  build's Spark run viewer lives inside `ChatPage` (it needs the thread's pages
  and its lock), so a row cannot open one; the button is left off rather than
  drawn as a tap that navigates and then does nothing.
- **The Spark card's sound row** — `COMPLETE` as of 2026-11-05, and it was the
  last part of the card composer that was missing. "Add audio" opens the app's own
  picker (`features/audio/SoundPicker` — trending, saved, your uploads and search,
  which is what the composer's shelf already reads), its answer opens the part
  chooser (`features/audio/PartChooser`, the same drag surface the editor's audio
  tool uses), and the row then shows the sound, the part of it that will play,
  "Choose a part" and a way to take it off — the phone's `_soundRow()` exactly.
  What goes up is `sound`/`sound_start_ms`/`sound_end_ms` on the item, which the
  server has accepted since before the page existed. **Nothing has been posted
  with a sound from here against a live server**, and that is the one thing about
  this row that is `NOT VERIFIED`.
- **The muted row's tone** — unchanged, and a divergence. The phone passes a
  muted row's count as zero into its line's tone in one of its two row builders;
  this build draws a muted row exactly like any other. The tags themselves match
  (`Group`, then `Muted`, under the line).
- **The row's type sizes are the web's** — the name, the line and the clock are
  a tenth of a point to a point larger than the phone's, which is the desktop
  reading chosen in the first pass, not a port. The marks, their order and their
  gaps are the phone's.
- **Nothing here has been seen rendered.** See above.

## Other module families

| Family | Status | Remaining gap |
| --- | --- | --- |
| Shell, theme, navigation | COMPLETE | account switching missing (needs a second credential store); language preference now has its page |
| Auth (QR, dev, refresh, logout) | COMPLETE / NOT VERIFIED live | deactivation is surfaced behind its password; signup remains phone-only (backend unavailable concept) |
| Profile, privacy, devices | COMPLETE (NOT VERIFIED live) | both profile pages, the day behind the face, the face dialog, the birthday fall, mutuals, their QR; professional profile and verification each have their page; devices list and revoke. Named gaps below. |
| Social graph | PARTIALLY COMPLETE | mutuals and the crew lists are surfaced, and Insights has its page; collabs and deals remain missing (Circles is not a social-graph feature — it is on the Moments page and has landed; see the Circles rows above) |
| Drops / feed | COMPLETE core | notes and the full media sheets still partial; the Vibes shelf, walk and studio are in, and since 2026-11-06 the feed **weaves Vibes in** through the server's `vibe_share` and the phone's `mixedFeed` (`NOT VERIFIED live`). Still not in, and named rather than implied: a Vibe plays only its own `asset` (its `recipe` and `clip_urls` are read by nothing, so no voiceover, music lanes, per-clip trim or speed, overlays, filter or frame shape), there is no Vibe editor on the web, play counts never move (`POST /drops/<id>/play/` is uncalled), `category`/`interests` are never sent, and `GET /drops/mine/` is uncalled so there is no own-posts shelf — all `NOT IMPLEMENTED` |
| Moments | COMPLETE at the code level (NOT VERIFIED live) | The viewer is a port of `MomentViewScreen` — hold, carried, faces, who sheet, carry-with-edit, share gate, Add to Memories — and of its Memory branches, the shelf's long press and the Alerts deep link; see the rows above. Three things are still not the app's, and they are the only three: `links`/`tags` do not ride across with a carried picture (the web editor has no field for them), the Morning Question was removed as fabricated rather than ported, and nothing here has been run against a live backend |
| Audio | COMPLETE core (NOT VERIFIED live) | the tab's doors (category pages, the weekly board), the reco strip and every row's heart are in, and the **studio** is now a real surface — `/app/audio/studio` and one item at `/app/audio/studio/:itemId` with its audience read. Still not the app's: the full-screen swipe deck over the reco rows, the music-sheet share (playlist share only), and the downloads door (a browser has no kept-tracks store here) |
| Live rooms | COMPLETE core (room sound NOT IMPLEMENTED) | The app's Live surface is the "Live now" strip under the Moments rail, the room screen and the create sheet — all three are now the web's, plus the room's three dots (Start now / Share / Report / Close / Leave quietly) and `ReportSheet kind="room"`. The web's `/app/live` shelf is a web-only door. **Room sound is NOT IMPLEMENTED**: the app's stage audio is a WebRTC mesh over the same relay the calls use, and although the web has had a client for that relay since 2026-11-06, the room page was not wired to it; the page says so |
| Sparks / rewards | PARTIALLY COMPLETE | leaderboard and reward screen partial; the run sheet opened from a convo row landed 2026-11-03 (`SparkSheet`, a port of `screens/spark.dart`) and its "Add to Moments" pill, the card painter and the composer behind it landed 2026-11-04 (`features/sparks/card.ts`, `SparkMoment.tsx`); the composer's own two faults were both found by opening it and both fixed the same day (an unbounded face wait, then a cross-origin avatar tainting the canvas — the picture is now asked for CORS-clean, falls back to initials, and is retried once without pictures). On 2026-11-05 the painter gained **four looks the phone does not have** (`midnight`, `sunset`, `aurora`, `noir`, drawn from a four-card design sheet, chosen at random per card; `classic` is the phone's card and is unchanged and pinned by a test — that test caught the one regression that reached it, a field colour laid over its white paper, which is fixed). The four were rebuilt later the same day against measurements of the sheet after the first attempt was rejected for not matching it. That is the web being *ahead*, not a gap — but it is also `NOT VERIFIED`: the four were rasterised in headless Chrome and measured (each within ~4 % of its sheet counterpart in the motif region), but never seen; measuring is not looking, the names on the four cards are a judgement the sheet does not state, and the house rule against gradients means the sheet's smooth glow is approximated by stacks of flat steps |
| Marketplace (Drip / Themes / Logos) | COMPLETE / NOT VERIFIED | one page, three aisles, one purse, ported aisle by aisle from `marketplace.dart`, `drip.dart`, `theme_shop_view.dart`, `logo_shop_view.dart`; every write goes to an existing endpoint |
| Themes, logos and drip in the shell | COMPLETE / NOT VERIFIED | a theme's picture now reaches the shell, the marketplace, the preview and the inside of a chat; the preview moves the whole web rather than a box in it |
| Notifications | COMPLETE on the app's own rules (NOT VERIFIED live) | list, in-app strip, hidden-tab rows and one routing table; a row after the site is **closed** is BLOCKED (FCM-only push), and server-backed preferences do not exist |
| Media pipeline | PARTIALLY COMPLETE | video poster generation missing; upload progress now done |
| Deals / collabs / codepad | MISSING | large separate modules. Circles landed on 2026-11-01 and is tabulated above |
| Studio / editors (image, video, vibe) | PARTIALLY COMPLETE / MISSING | browser-constrained |

## Profile: what is still not the app's

The two profile pages are ports, not redrawings, and the list below is what a
careful reading of `profile.dart` and `person.dart` still finds missing.

| Item | Status | Why |
| --- | --- | --- |
| The theme-bundled figure behind a bio | PARTIALLY COMPLETE | `PosedBio` draws the pose and the character's name, but the web's theme catalogue does not carry the figure's *pictures*, so the figure itself is absent. The name is real; the art is not on this build. |
| The ⋮ sheet's convo section on somebody else's page | MISSING | `person.dart` folds that convo's own settings into the sheet (rename, mute, wallpaper, vanish). The web has no convo-settings sheet on a profile, so the web's ⋮ holds mute and report only — it does not draw rows it cannot honour. |
| Live-moment ring on the *drops* feed and in search | COMPLETE / NOT VERIFIED live | Done on 2026-11-01. `useLiveRings()` (`src/features/moments/live.ts`) reads the same `["moments-tray"]` query the Moments tab draws and answers with the `unseen` authors, which is `Moments._rings` / `hasRing` on the phone. `DropCard` rings the author's face with it and so does `PersonRow` in search — the feed and the results no longer draw a bare face for somebody with something still to watch |
| The face's hold on a touch screen | COMPLETE, NOT VERIFIED | The hold is a 480ms pointer hold with the follow-up click swallowed. It has not been tried on a real touch device here. |

## Notifications: what stands, and what cannot

The third phase of the ask — *notifications exactly as the app has them, real
time, and a popup when the site is closed* — is two thirds done and one third
impossible from inside this project.

| Piece | Status | Why |
| --- | --- | --- |
| Alerts list, to the app's geometry | COMPLETE (static) | card, face, badge, mark door, tile, keep answers, unread dot and scroll-for-more all read off `screens/alerts.dart` |
| Alert kinds the row did not know | COMPLETE | `friend_moment` and `studio` now have a sentence, a tone, a glyph and a route |
| Live alerts | COMPLETE (NOT VERIFIED live) | `alert.new` / `alert.read` patch the list; a hidden tab also gets a system row |
| In-app strip | COMPLETE (NOT VERIFIED live) | `features/notices`, the phone's `Notices` rules: 4s hold, five deep, same-conversation replacement, ordinal dedupe, muted and watching skipped, chime only in front |
| The tab's own row while the site is open in the background | COMPLETE (NOT VERIFIED live) | the browser's `Notification`; a strip that is up when the tab goes away is handed over to it |
| A row after the site is **closed** | **BLOCKED** | the server's only push road is Firebase, to `Device.push_token`. A web push endpoint needs a Firebase project config, a VAPID key and a service worker — none exist in this build, and the backend may not be changed. Nothing was faked: the Notifications page says the sound stops when the site closes |

This is a limit of the address, not of the code: the same server, asked by the
phone, rings a pocket. A browser has no such address yet.

## What is deliberately not claimed

- **No 100% parity claim.** Large product families above remain unimplemented.
- **No live real-time claim.** The socket wiring is implemented and matches the
  backend frames, but no live two-client run happened here. Cross-device sync
  is `NOT VERIFIED`.
- **No fabricated state.** Receipts, unread counts, previews and forward counts
  come from server responses. Where a capability is absent (calls, signup,
  sync replay), the UI says so instead of simulating it. The marketplace keeps
  this rule as tightly as the chat does: nothing is bought optimistically, a
  purchase that the server refuses leaves the shelf exactly as it was and says
  so, and no button in the three aisles is a button that does nothing.
- **No card is drawn for a payload nothing writes.** The four convo cards added
  on 2026-11-02 (`payload.track`, `payload.profile`, `payload.story`,
  `payload.moment_ref`) were each traced to a writer first — the server for the
  playlist, the story and the moment reference, the phone (passed through by
  `chat/views_messages.py`) for the song and the person — and the story card's
  "Remention" offer, which on the phone opens the editor before the picture goes
  up, is not drawn on the web rather than drawn as a button that could not do
  what it says.
- **No live convo run.** Not one of the eleven card kinds has been seen in a
  browser against a real thread, and no share was sent. `ChatPage`'s chunk was
  built and its types checked; that is all that was checked.
- **No live marketplace run.** Not one purchase, wear or figure pick was
  executed against a running backend. The aisles are wired to endpoints that
  were confirmed to exist by reading the backend's URL conf, and that is all
  that was confirmed.
- **No claim to have seen the four card looks.** The four looks added on
  2026-11-05 were built from a design sheet that was *measured*, not looked at —
  this session cannot view an image, so the sheet was read by a PNG decoder
  written here, by colour-band probes over each card rectangle, and by Windows'
  own OCR for the words. The composition, the grounds and the pill are therefore
  measurements. Two things are not, and are recorded as judgement rather than as
  fact: **which of the four names belongs to which of the four cards** (the sheet
  carries no labels) and the adaptation itself, since the sheet's cards are 4:5
  while the real card box is 840×1520. Nothing has been rendered: no card of any
  style has been drawn on this machine, and the phone has no counterpart to
  compare against.

- **No live audio-shelf or save run.** The two sixth-round fixes — the editor's
  sound sheet drawing the uploads shelf, and Save filing a sound through
  `POST /saved/` — were made against a route read out of `apps/audio/views.py`
  and a write read out of `apps/saved/views.py`, and both are pinned by unit
  tests over the pure rules (`src/features/audio/audioShelf.test.ts`). Neither
  has been watched happening in a signed-in browser, so both are
  `NOT VERIFIED`, not done. In particular, how many rows the uploads shelf
  actually holds on the live database was never counted.
- **No live run of the part-length menu either**, from the same seventh-round
  pass: that it draws above the pill inside the sheet, follows the sheet's scroll
  and moves the frame when a length is picked are all unwatched. Its arithmetic
  is covered by `src/features/audio/partLength.test.ts` and its list was read off
  the phone, but nothing has rendered it.
- **No live run of the two eighth-round fixes.** The feed's error
  (`options.getNextPageParam is not a function`) was reproduced outside a browser
  against the old shape and is gone with the shape fixed
  (`src/features/drops/feedQueries.ts`), and the stuck page lock is a counted
  lock now (`src/utils/scrollLock.ts`) instead of four save/restore pairs that
  could strand it. Both are pinned by unit tests; **neither has been watched in a
  signed-in browser**, so neither is called verified. The bug reports themselves
  were intermittent, which is the one thing a unit test cannot reproduce.
- **Two more defects were found while reading that code and are only read, not
  reproduced**: the convo's Spark viewer held the page lock for the whole life of
  a convo rather than while a Spark was open, and its walk kept its position
  across runs, so a shorter run reopened afterwards drew nothing at all — a tap
  that did nothing, now reset. Both are fixed in the same pass and both are
  `NOT VERIFIED`, same as everything above them.
- **No live look at the editor's one surface either** (ninth round). Every tool
  panel, every control on one and the sticker sheet now draw on the theme's card
  and ink — the pair the audio sheet already used — from four named class
  constants in `PhotoEditor.tsx`. The suite does not render a component, so the
  four checks prove it compiles, lints and bundles and nothing else; the light
  default theme, which is where the two grammars were most visible, is exactly
  the state no run here can show. `inkOn`'s black-or-white split is a luma
  threshold, not a contrast measurement, and no checker was run over the plate
  row or the accent-filled tab.
- **And one thing was deliberately taken away.** The editor's text field used to
  write its own words in the chosen colour. It no longer does: the palette opens
  on `#ffffff` and ends at `#111111`, so on a light panel the first is an
  empty-looking field and on a dark one the second is, and no single ground fixes
  both. The colour is now a dot at the head of the field. It is the only
  subtraction in this pass and it is stated here rather than left to be noticed.
- **The editor is not the phone's editor.** The app's own panel is charcoal in
  every tool's sheet; the web's is now the theme's card. That is a divergence
  from the reference this build is otherwise measured against, taken at the
  user's instruction and recorded as a divergence, not as parity, in
  `XELVIC_FEATURE_PARITY_MATRIX.md`.
- **No live run of the convo row or the Spark sheet either** (tenth round). The
  three reported defects are fixed in source and pinned by tests — the line's
  grammar, the plate's placement and the lane's membership are pure functions
  with cases over them — but the suite is `environment: "node"` and renders
  nothing, no backend is reachable here, and the sheet's live behaviour (the
  refresh read, the 1-second tick, the hide switch, the restore button) has
  never been exercised. The buy-back is the one write in this pass that spends,
  and no wallet was drawn down. The three routes it uses were confirmed by
  reading `backend/apps/sparks/urls.py`, the backend was not written to, and
  nothing was added to the contract.
- **The Spark sheet's last pill is now drawn, and its card with it** (eleventh
  round, 2026-11-04). The sheet ends with the phone's `_comingUp()` row — the next
  rung's sentence and the "Add to Moments" pill — and the pill opens a real
  composer: the card painted exactly as `spark_moment.dart` paints it, the
  audience pill, the mention switch, and one button that uploads the card and
  posts it to `POST /moments/`, saying so only after the server has taken it. One
  thing about it is not claimed: **nothing has been posted from this composer** —
  the routes were read from the contract and matched against the phone's own
  `postMomentNow`, but no authenticated session exists in this environment, so no
  moment was created and no refusal was observed. The painter was run in a real
  browser on this machine and looked at, and so was the composer page itself —
  mounted with the real `Modal`, the real font and real media answers, where the
  card was timed as painting at 401 ms with no photos and at 15.4 s against a
  media read that is never answered; the picture has not been diffed against a
  phone's own rendering. The phone's sound row, which this pass left off, landed
  on 2026-11-05 (see the sound row above); two differences from the phone are
  still named rather than closed: the card's words (English only here; the phone
  draws them from `strings/en.dart`, so a Hindi phone draws a Hindi card, and the
  painter takes no translator), and my own face's presence dot (this client passes
  the server's answer for `me.online` rather than the phone's assumed `true`). The
  row's play button still stands as `NOT IMPLEMENTED` for its own reason.

## Recommended next steps, in priority order

1. Run the live pass in `XELVIC_TESTING_REPORT.md` §5 with a real device pair.
2. Group admin surfaces (members, roles, invites, rooms) — the largest
   remaining conversation gap.
3. Web push, if the backend ever grows a browser address: a Firebase web app, a
   service worker and a `Device` row are the three missing pieces, and none of
   them can be added from `xelvic-web/` alone.
4. Offline outbox design (this is where the mobile app's `offline/*` store has
   no web equivalent yet).
5. Then the large independent modules (collabs, deals, editors), one at a
   time, each with its own tracker entry. Circles was closed out on 2026-11-01
   (see its section above) and is no longer on this list.

Closed in the 2026-11-01 Moments pass, and left here so the list is not read
as the whole of it: the Memory walk (`isMemory`), managing a Memory from the
shelf, a Memory opened out of Alerts, carry-with-edit, the live ring on the
feed and in search, and the chat accent on an uncoloured convo — and, in the
Circles pass the same day, the whole Circles section, its picker and its own
page.

## Round 18 — what is still not claimed (2026-11-06)

The round that added a ring, a call notice, camera quality, a new call layout and
a room's sound. Everything below is what it does **not** claim.

- **No live verification of any of the six.** The backend was not reachable from
  here, and there was no second device, no microphone, no camera, no vibrator and
  no real browser notification surface. A ring, a notice, a device list, a
  `getStats` pill and a room's voices are all written and tested as arithmetic; not
  one has been seen working. They are `PARTIALLY COMPLETE (NOT VERIFIED)`.
- **No claim that the mesh connects.** `features/rooms/mesh.ts` and the calls' own
  rules are covered by unit tests over plain values: who offers, when a pair is
  rebuilt, what a signal reads as. `RoomStage` itself — the connections, the
  candidate queue, the rebuild — is covered by nothing, because `environment:
  "node"` has no `RTCPeerConnection` in it.
- **No claim that a notification is answered.** The service worker's Decline and
  Accept are drawn and the press is fed back into the engine, but no browser
  notification was ever shown one, so the round trip from the notice to the call is
  unexercised.
- **No sound for a listener past the relay's limit.** The server carries the stage
  plus its first 8 listeners (`MEDIA_LISTENERS`); a listener past that is in the
  room and is not sent anything, and the page says so rather than pretending
  otherwise. The web's copy of that number is a client-side constant that will
  drift silently if the server's value moves.
- **No audio a browser refuses.** Where a browser denies sound outright — no
  recording and no audio context — the ring screen says so. Nothing claims a
  ringtone in a browser that will not play one.
- **No parity claim, and no call the phone cannot make.** `call.add` is still not
  sent by this client, so a group call can be drawn but not started or grown from
  the web, and there is no earpiece/speaker route switch because the browser offers
  no such control. The room's sound rides the same relay the phone's `stage.dart`
  uses; it is a port of it, not a second implementation to be trusted.

## Round 19 — what is still not claimed (2026-11-06)

The round that answered three of the owner's own reports — the flipped picture,
the card that spilled off the screen, and a feed with no Vibe in it — and, with
the last of them, wove the Vibes into the feed that the phone had been weaving all
along. Everything below is what it does **not** claim.

- **No live verification of any of the three.** The mirror rule, the card that
  now fits the screen and the feed weave are all written; the weave's arithmetic
  is tested, and nothing else is. No device and no browser run was made, and no
  live server was reached, so not one of the three has been seen working in a real
  browser or against real data. The mirror rule falls back to *mirrored* for a
  camera that reports no `facingMode` at all, which is an honest default rather
  than a known-good one, and the `VibeViewer` height change is a reasoned fix with
  medium confidence, not a watched one.
- **A Vibe still plays only its own `asset`.** The server sends the recipe
  (`recipe`) and the addresses of the uploads it names (`clip_urls`) and this
  client reads neither, so a Vibe edited on the phone — with a voiceover, music
  lanes, per-clip trim and speed, overlays, a filter and a chosen frame shape —
  plays on the web as its first clip alone. `NOT IMPLEMENTED`.
- **No Vibe editor on the web.** The composer posts `{asset, caption, music,
  mentions, sensitive}` to `POST /drops/vibes/`; `recipe`, `category`, `interests`
  and `track_id` are accepted by the server and never sent by this client.
  `NOT IMPLEMENTED`.
- **Play counts never move from the web.** Nothing under `src/` calls
  `POST /drops/<id>/play/`, which the phone calls (`app/lib/audio.dart:1975`), so
  a sound played in the browser does not advance `plays` and the poster's own
  numbers do not include it. `NOT IMPLEMENTED` — a silent omission, not a claim
  on screen.
- **No own-posts shelf, and nothing to file into.** `GET /drops/mine/` is called
  by nothing here, so there is no "my own posts" shelf, and `GET /drops/interests/`
  is uncalled with `category` / `interests` never sent, so a post made here
  carries no interests and cannot be filed. `NOT IMPLEMENTED`.
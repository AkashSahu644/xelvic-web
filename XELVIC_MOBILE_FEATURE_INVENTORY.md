# Xelvic Mobile — Feature Inventory (reference audit)

Date: 2026-11-01
Reference root (read-only): `xelvic/`
Mobile client: `xelvic/app/` — 283 Dart files, 151 screens, 255,946 lines
Backend: `xelvic/backend/` — 24 Django apps, read-only contract source

This inventory is the authoritative feature list used by the parity matrix. It
was built from the screen/service file tree, the backend app tree, `WEB-API.md`,
and targeted source reads. Nothing in `xelvic/` was modified.

## 1. Application shell and identity

| Area | Mobile evidence | Notes |
| --- | --- | --- |
| Five-destination shell | `main.dart`, `nav.dart`, `screens/home.dart` | Drops, Moments, Convo, Vibe, Audio — `kDropsTab` 0 … `kAudioTab` 4. **There is no Live tab**: `Live.it.watchShelf` is switched on while the Moments tab is showing, because Live is the "Live now" strip on that page (see §7). The web's `/app/live` destination is a web-only door |
| Theme system | `theme_provider.dart`, `theme_shop.dart`, `theme_art.dart` | Server-synced theme key; dark/light |
| Language | `language.dart`, `screens/language_screen.dart` | Locale preference |
| Onboarding/permissions | `screens/onboarding.dart`, `permissions_screen.dart` | First run |
| QR sign-in (phone approves web) | `qr.dart`, `screens/qr_approve.dart`, `web_signin.dart` | Seven auth doors |
| Own QR code | `screens/qr_code.dart` | Display account QR |
| Account switching | `screens/switch_account.dart` | Multiple sessions |
| Session/device management | `screens/sessions.dart`, `session.dart` | Devices, revoke |
| Signup / OTP / reset | `signup.dart`, `phone.dart`, `reset.dart` | Phone-only account creation |
| Profile refinement/verification | `refine_profile.dart`, `get_verified.dart`, `professional_details.dart` | |

## 2. Social graph and profile

Profile (`profile.dart`, `person.dart`), cover/avatar (`cover_frame.dart`,
`avatar_frame.dart`), follows, requests (`requests.dart`), mutuals
(`mutuals.dart`), crew (`crew.dart`), blocking, reporting (`report.dart`),
insights (`insights.dart`), contacts (`contacts.dart`), audience selection
(`audience_sheet.dart`), share sheets (`share_in.dart`, `share_out.dart`,
`share_who.dart`), mentions (`mention_sheet.dart`, `mention_typing.dart`).

## 3. Drops (posts / feed)

`drops.dart`, `drop_feed.dart`, `drop_grid.dart`, `drop_post.dart`,
`drop_sheets.dart`, `drop_card.dart`, `vibes.dart`, `vibes_tab.dart`,
`video.dart`, `vibe_studio.dart`, `tags.dart`, `hashtags.dart`,
`gallery_grid.dart`, `media.dart`, `media_gallery.dart`, `send_media.dart`,
`respond_media.dart`, `like_heart.dart`, editor screens under `screens/editor/`.

Capabilities: cursor feed (people / mine / tag), text, image, poll, place,
tag, likes, saves, comments, notes, shares, hide, delete, vibes (short video)
playback and studio, image/video/vibe editors.

## 4. Moments (stories)

`moments.dart`, `moment_composer.dart`, `moment_post.dart`, `moment_view.dart`,
`moment_poll.dart`, `poll_moment.dart`, `spark_moment.dart`, `text_moment.dart`,
`track_moment.dart`, `story_card.dart`, `memories.dart`, `memory_add.dart`,
`add_to_memories.dart`.

Capabilities: tray (mine/unseen/seen), timed viewer, reactions/replies, image
and text moments, polls, track moments, sparks, viewers and reactors, memories
list/editor. Two corrections to this list, both made after reading the app
again on 2026-11-01: there is **no "together mode"** anywhere in `app/lib`
(`grep -rn "together\|Together\|watch party" app/lib` finds nothing), and the
Circles section this page used to carry is inventoried in §9 — `moments.dart:629`
draws `LiveNow` there since commit `f4f7ffb7` (2026-10-31), while the section
itself is still shipped.

### Correction, 2026-11-01 — the "Morning Question" was not a mobile feature

An earlier web build carried a composite moment it called the Morning Question,
built around a `prompt` field on the moment payload. There is **no `prompt` on
`MomentSerializer`** and no such field on the app's `Moment` model; the feature
and its copy were invented on the web side. It has been removed, and the `prompt`
field was struck from `src/types/api.ts` so a build cannot type against it
again. The app's own list above is what stands.

### What `moment_view.dart` actually does (read for the web port)

`MomentViewScreen` is one screen with more rules in it than its size suggests.
The ones the web port had to keep, each with the line that decides it:

- A tap steps and never leaves: left 32% of the width goes back, everything else
  goes forward. Where a moment's *carried thing* opens from is the hold, because
  a tap that did two different things was a tap nobody could predict.
- `kHoldToPause` = 480ms pauses the clock; `kHoldToPause + kHoldToLeave` =
  1230ms is where letting go means "take me to it", and `_carriedTo` says in
  words where that is.
- `MomentItem.hold` decides how long a picture is up: a clip plays exactly its
  `clip_start_ms`…`clip_end_ms` window; a sound holds for its own window capped
  at `kSoundLongest` (60s) but never less than the picture's own life; a picture
  carried in from a post keeps the life written on it; the floor is 5s.
- `_ownOrder` reverses the **days** on my own moments and not the pictures, so my
  own walk opens on what I last put up while each moment still plays first to
  last.
- `_carried` reads, in order: a Vibe on the item, then `made_from` (vibe or
  drop), then a sound, then `source_id`.
- The heart is `POST /moments/{id}/react/` with `kStoryLike`, a blank emoji
  takes it back, and a long press on the same button opens `kStoryFaces`. A
  reader is sent no tally (`services._reactions`), so the answers row and every
  sheet behind it are the author's alone.
- The reply field focuses into a held clock (`_held || _typing`) and its send is
  `POST /moments/{id}/reply/` — a message into a convo, not a like.
- Share is asked as a question first (`POST /moments/{id}/share/` with no body)
  and only drawn if the account's privacy allows it; `{thread}` is the deed.
- `_hasOptions` is mine **and** not a Memory **and** a non-empty strip: the three
  dots open onto "Add to Memories" and nothing else.
- A Memory is not a moment: it has its own header words, its own
  `/moments/memories/{id}/…` routes and Remove in place of Take down.
- `MemoryShelf.open` builds the walk out of a Memory; `manageMemory` behind a
  long press on my own card is its four rows — Add more to it, Rename, Change
  the cover, Remove — and `_patched` is how each reports. A playlist Memory
  leaves out the two rows that have no meaning over one and opens at its
  playlist instead.
- `Moments._rings` / `hasRing` is the ring on a face, fed by the tray's
  `unseen` authors rather than by a query of its own.
- There is **no together mode and no viewer-level sticker or drawing tool** in
  the app: `grep -rn "together\|Together\|watch party" app/lib` finds nothing.
  Stickers, drawings, text and frames belong to `ImageEditorScreen`, which is
  what the web's `PhotoEditor` stands in for.
- The sticker **shelf** is not ours first. `editor/stickers.dart` reads
  `https://sticker.gaongram.in/api/stickers` (a public, token-free catalogue that
  answers `access-control-allow-origin: *`) and falls back to our own
  `/api/v1/stickers/` only when that service refuses — *"that is where the
  stickers are added now and it holds far more of them"*. Measured 2026-11-02:
  381 stickers, served in pages of 100. It matters which shelf a picker reads:
  a respond's or a note's sticker sends its id back to our server, which can only
  check the stickers it has a row for (`_comment_sticker()`), so those pickers
  read the near shelf on purpose (`pickSticker(ownShelf: true)`).


## 5. Convo (messaging) — highest priority

List and shell: `convo.dart`, `screens/convo.dart`, `group.dart`,
`chat_profile.dart`, `request` states, search, saved/vault.

The list's own grammar (`screens/home.dart`) is four helpers the web now ports
one for one, and each is a rule rather than a layout detail:

- `listLine` — what a row says under the name, and **never the message itself**.
  Four answers in this order: `Say something` (nothing in it), my own receipt
  word, `N new` (a count with no noun), `Nothing new`. A convo with myself keeps
  its own line. A chat list is read over your shoulder, which is the whole reason
  the rule exists.
- `convoLineTone` — the line's colour, decided from the words on screen rather
  than from the receipt behind them.
- `convoUnreadBadge` — the count, as a plate at the end of the **group** name and
  not as a badge on the far right; a direct convo relies on `N new` under its
  name (the owner's call, 2026-10-23). Height and least width are both 18.
- `convoInUnread` — the Unread lane's membership. A convo whose only waiting line
  is a Spark stays off it (`unread_other_count`, the owner's rule of 2026-10-24),
  and a card without the split reads as the old answer.

The row's right-hand side is one line, in this order: pin disc, birthday cake
(`isBirthdayTodayIn(other)`), the play button, the 48-hour timer, the spark, the
clock — with the phone's own gaps (3 between the timer and the spark, 7 between
the spark and the clock). The waiting bar is 3 wide, inset 14 from the top and
bottom, rounded at its trailing end. The web draws every one of those but the play
button; see `XELVIC_FINAL_GAP_REPORT.md`.

Conversation: `chat.dart` (9,741 lines) and 15 supporting sheets:

- `chat_media.dart` — image, video, document, audio attachments
- `chat_audio.dart` — voice notes and recorded audio
- `chat_sticker.dart` — stickers
- `chat_drop.dart`, `chat_live.dart`, `chat_playlist.dart`, `chat_track.dart` — shares
- `chat_link.dart` — link previews
- `chat_keep.dart` — Keep requests
- `chat_collab.dart` — collab requests
- `chat_share_preview.dart` — forwarding/preview
- `chat_vanish_consent.dart` — disappearing-message consent
- `message_info.dart` — per-member delivery/read info
- `vault.dart`, `lock_chat.dart` — code-locked conversations
- `mention_sheet.dart` — mentions

Behavior: text/media sends, replies, edits, delete for me/everyone, reactions,
polls, forwarding, message info, typing, presence, read/delivered receipts,
disappearing messages, group rooms/channels, group membership and roles,
invites, group avatar, pinned/muted/vaulted seats, sparks (view-once), clear,
wallpaper/tint themes, offline sync/outbox.

Calls: `app/lib/calls.dart` (the state machine), `screens/call.dart` (the
screen), `screens/call_banner.dart`, `screens/call_bits.dart`,
`screens/call_window.dart`, `screens/calls_list.dart` (the history),
`call_platform.dart` (the platform bits — earpiece routing, wake locks,
vibration). Signalling rides the chat socket and the media is peer to peer, so
nothing of a call except its state ever reaches the server.

Read on 2026-11-06 for the web port, because a call is the one feature where
being *nearly* the same as the phone means two handsets that never connect. What
the port had to match exactly:

- **The ring window is the server's.** `ring_seconds` arrives on the party frame
  and both ends give up on that same clock; the constant 45 is only what is used
  when a frame says nothing. Two ends timing a ring differently is how one screen
  says "No answer" while the other still rings.
- **Who offers is fixed, not negotiated.** People already in the call offer to a
  newcomer; the newcomer only answers. The second reason to offer is a camera
  being turned on, which re-offers to everybody already linked.
- **A crossing is settled by id.** When both ends offer at the same instant,
  `offersAfterCollision(mine, theirs)` is `mine > theirs`: the lower id drops its
  connection, records that it owes an offer, and offers again after the answer
  arrives. Dart's `compareTo` and JavaScript's `>` order strings identically,
  which is what lets the two clients agree without either telling the other.
- **Candidates that arrive before a description are queued**, per peer, and
  flushed after `setRemoteDescription` on both sides.
- **Media is opened during the ring**, and picking up starts the media and the
  connection in parallel with `call.accept` rather than after it.
- **The goodbye is 1400 ms** and the first reason a call ended is the one kept;
  a call this phone walked out of and could not say is said when the socket comes
  back.
- **A ring that arrived while the phone was asleep is asked for**, not waited on:
  `call.pending` goes out the moment the socket comes up and on every return to
  the front, which is why a ring is the one frame that cannot wait to be
  collected.

`call.add` and the delete on a history row exist on the phone; the web draws
neither.

## 6. Audio

`audio.dart`, `audio_section.dart`, `audio_window.dart`, `audio_deck.dart`,
`audio_prefs.dart`, `player.dart`, `track_list.dart`, `artist.dart`,
`music_sheet.dart`, `share_track.dart`, playlist screens, audio studio
(`audio_studio.dart`, separate product surface).

Read on 2026-11-02 because the web's clip editor was drawing a different list
than the phone's picker: **`screens/audio_picker.dart` is the sheet that chooses
a sound for a picture, a Vibe or a moment**, and it draws **uploads only, on all
three of its chips** — `_uploads()` is `GET /audio/tracks/?source=drop` with
`limit: kPickerRows` (60), `_trending()` is the week's board with everything whose
`fromDrop` is false filtered out, and `_saved()` is `Saved.it.open()` →
`Saved.it.shelf` → `thing.audio`. It holds no catalogue row on any chip, the
carousel is the list's own first four rows (`rows.take(4)`) and stands down while
the search box has anything in it, the search debounces 250 ms and asks the
*uploads* shelf whichever chip is lit. Two consequences worth keeping: a saved
catalogue track arrives as a row already and a saved upload arrives as the drop's
card and has to be turned into a row, and **a sound's bookmark is filed by which
table its id addresses** — `AudioTrack.savedKind` is `fromDrop ? 'drop' : 'track'`
(`app/lib/audio.dart:256`), which the web was getting wrong in the editor.

Not to be confused with `editor/tracks.dart`, whose `kBundledTracks` is dead
code: nothing in the app imports it.

The same file also holds **"Choose a part"** — `_WindowView`, the trim a picture,
a Vibe, a drop or a moment opens on a sound. Three numbers live on it and each is
the app's own: the part may be **ten to sixty seconds in fives** and no other
value (`_WindowViewState._durationSeconds`), the two times are a plain pill with
**no gesture on it** (`_readout` — the only control on that line is the length
beside it), and the length pill opens a **modal sheet** of those eleven chips
heading "How many seconds" (`_pickDuration`, `Str.audioHowManySeconds`). The
frame on screen is the same width whatever the span is, so a fifty-second part of
a twenty-minute song is slid into place rather than squeezed — see
`audio_window.dart`.

## 7. Live rooms

`live_now.dart`, `room.dart`, `room_talk.dart`, `room_bits.dart`,
`room_boards.dart`, `room_game.dart`, `games.dart`, `live_socket.dart`.

The surface is three things, not a tab: the `LiveNow` strip at the end of
Moments (`moments.dart:629`, `?shelf=kept`), the room screen with its three-dot
menu, and the sheet a room is made in. Stage audio and video travel as a WebRTC
mesh over the `call.signal` relay (`stage.dart`); the web ports the strip, the
room, its menu, share, report and board, and carries no media — recorded on the
room page itself and in the gap report. The room's media is **the same relay the
calls use** and the web now has a client for it (2026-11-06), but the room page
was not wired to it: the stage still carries no audio or video here, and the page
says so rather than drawing a microphone that would do nothing.

## 8. Rewards and Sparks

`sparks.dart`, `sparks_leaderboard.dart`, `reward.dart`, `wallet_view.dart`,
`logo_shop.dart`, `logo_provider.dart`, `catalogue.dart`, `theme_shop.dart`,
`screens/spark.dart`.

`screens/spark.dart` is the sheet a convo row's spark opens — the modal that is
the whole of what this feature is, and the reason the row itself carries an award
and never a number:

- a ring off the lap's own `pct` around the head award's glyph;
- the figure — `12` / `days`, `Broken`, `Hidden`, `Not started`, `Count starts
  again` — the one place a spark is ever a number;
- the awards worn, each in its own colour, faded when the run is cold;
- **two clocks, per person**: past 24 hours of one person's silence their timer
  shows, at 48 hours the run breaks to 0. The sheet says each side separately
  because the two start at different moments;
- the closing sentence, which names *whose* clock is running out;
- the broken banner with the day the run leaves the list, and the buy-back offer
  (price, wallet, deadline);
- the hidden banner and the "Hide this Spark" switch — mine alone, and the run
  keeps counting for both either way;
- the next rung, the seven-rung ladder (`Ember` … `Century`, 1–3 … 100+ days) and
  the rules paragraph;
- "Add to Moments" (`spark_moment.dart`), which draws a card of the run.

`spark_moment.dart` is 1,275 lines of its own — a painter, a page and the write
between them — and it is worth reading as three things rather than one:

- **The card is painted, not composed.** A fixed 1080×1920 page with the card
  840×1520 inside it, left 120 and 248 down — the band a vertical moment's crop
  leaves, nudged 48 px below the middle because the viewer's bars are not the
  same height at both ends. The paper is the award's own colour at 10 % over
  white and everything else is fixed ink; nothing here is themed, because a card
  is looked at on somebody else's phone. On it: the flame in the award's colour,
  two curves from the faces up to it with a chat mark and a call mark sitting on
  them at t=0.30 and t=0.62, each face ringed in the award's colour with the
  list's green dot when that person is here, then the ring with the award's
  glyph, the award's name in letter-spaced caps, the days, a rule, and one
  closing line between a sparkle and a heart. The award drawn is the one the run
  is **on** (`_head`'s rule), so a run that broke after a Century wears the medal.
- **The page shows the upload.** The card is painted once into a canvas and
  encoded once; what is on screen is that file read back (`PreparedMediaSource`),
  so the picture a person approves is the bytes that go up. Painted in
  `initState` — a card that repainted itself under the tap would swap the picture
  out from under the person about to share it.
- **Three things are asked before the share**: the reach (`audience_sheet.dart`,
  the same sheet every moment composer uses), whether the other person is named
  (`_mention`, on by default, sent as `mentions: [id]`), and the sound
  (`_soundRow()`: "Add audio" opens `audio_picker.dart`, and once a sound is on
  the card the row shows it with "Choose part" — `AudioWindowSheet` — and a way
  to take it off). The write is `postMomentNow` with `sound`/`soundStartMs`/
  `soundEndMs`, and it is silent on success: the page pops, and the sheet behind
  it pops too because a moment went up.

- **`Faces.patience` is a bound the card inherits.** `_faceImage` goes through
  `faces.dart`, and that store waits at most fifteen seconds for one face —
  *"a socket that has gone quiet without closing hands back neither bytes nor an
  error"* — before the card is painted with initials on it. The web port copied
  the painter and not that bound at first, and a silent media read left its
  composer on a spinner for ever; the bound was taken from here on 2026-11-04
  (`FACE_PATIENCE_MS` in `features/sparks/card.ts`).

The painter also has a hazard of the browser the phone does not have: a face
loaded from a public host is cross-origin, and drawing it without
`crossOrigin="anonymous"` taints the canvas so it cannot be exported at all —
which is the fault the composer then showed as "could not draw that card". The
web asks for the picture cleanly and treats a host that will not answer as a face
that did not come: initials, and a card that posts.

The web port (2026-11-04, sound row 2026-11-05) is `features/sparks/card.ts` and
`features/sparks/SparkMoment.tsx`, and all three things it asks are there — the
reach, the name, and the sound row, which is `_soundRow()` ported. The picker
behind it is the app's own `features/audio/SoundPicker` (the three shelves every
other sound surface reads) and the part chooser is `features/audio/PartChooser`,
the same drag surface the editor's audio tool opens. A card is one picture, so
the part it offers is the one-picture thirty seconds — `momentSoundSpan()`.

**The one place the web is ahead, and it is not parity.** On 2026-11-05 the web
gained four further card looks — `midnight`, `sunset`, `aurora`, `noir` —
alongside this card, which the web calls `classic`. The phone has no
counterpart: `spark_moment.dart` draws the one card above and nothing else, so
there is nothing on this side to be parity *with*. The four were drawn from a
four-card design sheet — first as invented ornaments that did not match it, then
rebuilt on 2026-11-05 against measurements of it — and are described in full in
`XELVIC_PROGRESS_TRACKER.md` and `XELVIC_TESTING_REPORT.md`. They are
**`NOT VERIFIED`**: rasterised in headless Chrome and measured against the sheet,
but never seen. `classic` is this card and was not changed.

The shop itself is one page with three aisles, and the file layout says so:

- `marketplace.dart` — the page: the way out, the title, the tab strip and the
  purse (`ShopTab.drip/themes/logos`, `SparkPurse(compact: true)`). The three
  bodies below it own no scaffold, no app bar and no title, which is what makes
  them shelves of one shop rather than three shops. `opensOn` is how a link that
  already names a shelf lands on it.
- `drip.dart` (`DripView`) — the figures a convo draws: the one on now with its
  time left, the shelf, the profile switch, the figure's own page.
- `theme_shop_view.dart` (`ThemeShopView`) — the Mode button, the design shelf
  three to a row, and the "Mix your own" picker.
- `logo_shop_view.dart` (`LogoShopView`) — twelve plates, the tile is the
  preview, a locked one opens a price sheet and buying wears it in the same
  breath.
- `backdrop.dart` (`ThemeBackdrop`) — the one widget that draws a theme's
  picture, used by the shell, by the marketplace and preview as pushed screens,
  and by the inside of a chat. `page` defaults to `XPage.convo`.

## 9. Other modules

- Deals / creator directory: `deals/creator_directory.dart`, `deals_home.dart`,
  `deal_detail.dart`, `invite_compose.dart`
- Circles: `circles.dart` (the model — `Interest`, `CircleTask`, `CircleDay`,
  `title`, `filling`, `waiting`), `screens/circles.dart` (`CircleSection`,
  `_CircleCard`, `CircleScreen`, `CirclePickerScreen`). **The section is ported
  to the web** (`src/features/circles/`, `/app/circles/:circleId`) — see the
  Circles pass in `XELVIC_PROGRESS_TRACKER.md`. One thing to know when reading
  the app: `screens/moments.dart:629` no longer mounts `CircleSection`; it draws
  `LiveNow` ("This is where the Circles section used to sit") since commit
  `f4f7ffb7` (2026-10-31). The section and both screens are still in the tree
  and all four backend routes are still mounted, which is what the web port
  follows
- Collabs: `collabs.dart`, `collab_sheets.dart`
- Marketplace: `marketplace.dart`
- Codepad: `codepad.dart`
- Birthday: `birthday.dart`
- Alerts/notifications: `alerts.dart`, `screens/alerts.dart`,
  `notification_settings.dart`, `push.dart`, `notices.dart`,
  `screens/notice_banner.dart`
- Camera: `screens/camera/*`, `editor/*`
- Offline: `offline/*` (repository, store, runtime, models)
- Telemetry: `telemetry.dart`

## 10. Transport and state services

| Service | Evidence | Contract |
| --- | --- | --- |
| REST client | `api.dart` (1,925 lines) | Bearer access token, `/api/v1/` |
| Auth/session | `session.dart` | access + refresh, device id, secure storage |
| Realtime | `live_socket.dart`, `live_socket_web.dart` | `wss://<api>/ws/?token=...`; frames `{event,data}` |
| Presence | `presence.dart` | socket action `presence`, `presence` frames |
| Offline sync | `offline/*`, `chat` sync | `/chat/sync/?cursor=` journal |
| Push | `push.dart`, `notices.dart` | FCM/APNs; notice payloads mirror socket |
| In-app notice | `notices.dart`, `screens/notice_banner.dart` | The `thread.update` frame's `notice` turned into one strip: 4s hold, queue of 5, same-conversation replacement, muted and typing skipped, per-conversation ordinal dedupe, skip when that conversation is on screen, chime after. **Ported to the web** in `src/features/notices/`; `alert.new` never becomes a strip on the phone either |

## 11. Backend capability map

Apps: accounts, alerts, audio, calls, chat, circles, collabs, common, console,
deals, discovery, drip, drops, hashtags, links, mlapi, moments, reco, saved,
social, spaces, sparks, stickers, studio, telemetry, verify.

The backend is the shared source of truth. Its chat contract is documented in
`XELVIC_API_COMPATIBILITY_REPORT.md`.

## 12. Round 18 — the phone's own stage, read and ported (2026-11-06)

This round read one more of the phone's files to port rather than invent, and it
belongs here beside the rest.

- **`app/lib/stage.dart` — the stage's mesh.** A live room's sound on the phone is
  a WebRTC mesh, not a broadcast, and its rules are the ones the web now follows:
  who offers to whom, when a connection is rebuilt rather than left to recover, and
  when a listener is let go of. The web's `src/features/rooms/mesh.ts` holds
  `whoOffers` — the lower id offers, compared by code unit exactly as `stage.dart`'s
  own ordering is, so both ends of a pair reach the same answer, and a listener,
  whom the stage has never heard of, always offers — beside `needsRebuild`,
  `readSignal` and `receiveOnlyKinds`; `stage.ts` holds the mesh itself. The file
  was read, not written to.
- **A stage is a `Call`.** On the backend a room's stage is a `calls.Call`
  (`backend/apps/spaces/services.py`), carried over the same `call.signal` relay an
  ordinary call uses. That is why the web's room sound needed no new endpoint, only
  wiring — the same reason the earlier calls pass needed none either.
- **A listener is bounded by the relay.** The server carries the stage plus its
  first 8 listeners (`MEDIA_LISTENERS`); past that a listener is in the room and is
  simply not sent anything. The web page says so.
- **Still not ported from the phone's call and stage code:** `call_platform.dart`'s
  half — earpiece/speaker routing and the screen-awake lock — because a browser has
  no equivalent, and `call.add`, which the web still does not send. Neither is
  claimed, and nothing is drawn for either.

## 13. Round 19 — the phone's mirror rule, its card heights and its feed weave, read and ported (2026-11-06)

This round read three more of the phone's files to port rather than invent, and
they belong here beside the rest.

- **`app/lib/calls.dart` — `_selfMirrored`.** The phone mirrors only its front
  lens; the web mirrored unconditionally, which is what the owner reported
  (*"video me jo video ban raha hai wo ulta ban raha hai aur phone me sahi hai"*).
  The web's `src/features/calls/engine.ts` now carries the same rule: a `Facing`
  read off the track (`track.getSettings().facingMode`, in `openCamera()` and
  `openDevice()`) and a `mirrored` flag that answers a person's own choice when
  there is one and `facing !== "environment"` otherwise, with a **Mirror** pill on
  the call's picture and on a room's own tile. The file was read, not written to.
- **`app/lib/screens/drops.dart` — the card heights and the card's door.** A card's
  media box took the
  card's whole width and derived its height from the server's `ratio` with no
  ceiling, so a portrait post spilled off the screen. The web now uses the phone's
  own number for a clip — `tallClipShare = 0.62`, capped in height and cropped —
  and the phone's `0.78` is not used as written: there a photograph answers the
  ceiling by *narrowing* its box, which costs about a tenth of a 390-point card
  and so is invisible on a phone, but costs two thirds of a wide, short browser
  window's card and left a strip of photograph with empty card either side — the
  owner's report and screenshot of 2026-11-06. The web fills the card's width and
  crops instead, at the poster's shape up to four-to-five. The comment beside
  those constants is the owner's earlier report of 2026-10-27.
  The same file's tap rule is carried over too: `DropVideo.onOpen` is
  `drop.isVibe ? openVibe : _openFrame`, `_openFrame` is `openClip`, and
  `openClip` is `openVibe` (the 2026-10-19 report, *"agar drop sirf single video
  hai to click karne pe single screen pe ja raha, hata kar vibe pe play hona
  chahiye"*), so a **plain video** in the feed opens the walk exactly where a Vibe
  does. A still is left alone — `_media`'s single tap opens tags/people only when
  the post names somebody, which is a separate door this client already has. The
  file was read, not written to.
- **`app/lib/drops.dart` — `mixedFeed` and its shelf.** The server states a
  `vibe_share` and the phone lays the clips out; the web ignored the field and had
  no weave. The web's
  `src/features/drops/mix.ts` is a whole port of `mixedFeed` / `_mixSlots` /
  `shelfOrder` / `shelfKey` — `shelfKey` an FNV-1a hash, `mixSlots` a partial
  Fisher–Yates over ten slots, `RAIL_CLIPS = 10` — and the port uses `Math.imul`
  for the hash multiply, which is the one place it could have gone quietly wrong:
  the phone's `int` holds the whole product before masking and a JavaScript number
  does not. The phone's own cases (`app/test/drops_mix_test.dart`) are carried
  over as `mix.test.ts`, thirteen of them, and the strip's own rule
  (`Drops.rail`) is carried over as `railClips` with its exclusion bounded to the
  feed's first block: the app asks its question of the whole feed it holds, and a
  browser holds every page the reader has scrolled to, so the app's reading
  emptied the strip and took the section off the page (reported 2026-11-06).
  `Drops.it.carry` is carried over as `walkOf`: a clip the shelf has never held —
  a single video is not a Vibe — is put in front of the shelf so the walk opens
  on the clip that was pressed and still has somewhere to swipe. The
  file was read, not written to.

**Still not ported, and named rather than implied:** the Vibe's `recipe` — the
voiceover, the music lanes, each clip's trim and speed, the overlays, the filter
and the chosen frame shape — and the addresses of the uploads it names
(`clip_urls`). Both are sent by the server and read by nothing here, so a Vibe
plays as its first clip alone. There is no Vibe editor on the web either, play
counts never move (`POST /drops/<id>/play/` is uncalled), and
`GET /drops/mine/` and `GET /drops/interests/` are unused. All `NOT IMPLEMENTED`.

**Read-only project check.** Read and not written to this round:
`app/lib/calls.dart`, `app/lib/screens/drops.dart`, `app/lib/drops.dart` and
`app/test/drops_mix_test.dart`, as well as the backend's
`apps/drops/services.py` for `feed_vibe_share`. Nothing outside `xelvic-web/` was
created, edited or deleted.

## 14. Round 20 — the phone has no Mirror button, and now the web's means the same thing (2026-11-06)

Read to settle a report rather than to port a feature, and it settled it the other
way round: *"jo video call me mirror par click karne par jo flip ho raha hai wo mere
video card me raha hai jabki reciever user video card me hona chahiye"*.

- **`app/lib/screens/call.dart` — `_mine` and `_feed`.** There is no Mirror button
  on the phone at all. `_mine` draws this tab's own tile through
  `mirror: calls.selfMirrored`, and every remote tile is drawn by
  `_feed(person, mirror = false)` — the received picture is never turned over. That
  is the whole of the phone's rule, and it is the opposite shape to Round 19's
  button, which overruled the self-view instead.
- **`app/lib/screens/room.dart`.** The same rule for a room, in one line:
  `mirror: person.id == mine && Stage.it.selfMirrored`. Nothing arriving is flipped.
- **`app/lib/calls.dart` — `selfMirrored`.** Still the lens's answer and only the
  lens's, which is what the web's `mirrored()` is again now that the hand-overrule
  is gone.

**What the web does that the phone does not.** `toggleRemoteMirror()` — a button
that turns over the pictures *arriving* here, kept for the call it was pressed in
and cleared by the next. The phone has no such control; it was added because the
owner asked for it, and it is a display only: `VideoSurface`'s `-scale-x-100` on a
`<video>` element, with no track ever transformed, so nothing reaches another
person's screen. It is a stated divergence, not a port. The two files were read, not
written to.
## 15. Round 21 — the phone's call has three sizes; the web's had one (2026-11-06)

Read to answer *"video call karne par main video hata kar chat par aa raha hu aur
call chal hi rahi hai to phir main video call par nahi aa raha pa raha hu"* and to
give the screen-share fix a reference.

- **`app/lib/screens/call_window.dart` — the three sizes.** `CallWindow` is drawn
  in one of three ways: a page that fills the screen, a small window that can be
  dragged and docks to an edge, and a hidden mark — a line of chrome that says the
  call is still running and can be pressed to bring it back. Leaving the call screen
  on the phone is therefore never a one-way door. This is the phone equivalent the
  web lacked: `CallOverlay` was `fixed inset-0` above the router with no control
  that put it aside, so going to chat meant the call screen was gone for good even
  though the call itself kept running.
- **`app/lib/screens/call.dart` and `app/lib/screens/room.dart` — no screen
  sharing.** `screenShare` does not appear in either file, and there is no
  `getDisplayMedia` call anywhere under `app/lib/`. The fault the owner reported —
  a shared laptop screen cropped to its middle on a phone — is therefore entirely on
  the web's side: the share was added here in Round 18, and the crop was the
  viewer's own **Fill** choice surviving from an earlier call because `fit` was
  component state that lived as long as the tab. There is no phone behaviour to
  match, only a sane default.

**What the web does now.** `CallOverlay.tsx` gains a **Minimize** pill and a bar
that carries the call over another page — the picture or a phone glyph, the name and
clock, mute, camera, hang up, with the sound played by its own `AudioSurface`s —
and both it and the Fit/Fill choice are reset when the call ends. This is
**partially** the phone's window: the bar is fixed to the bottom where the phone's
window can be dragged and docked, and the phone's third size — a mark and nothing
else — has no counterpart. `NOT VERIFIED`; nothing was run on a device.

**Read-only project check.** `app/lib/screens/call_window.dart`, `app/lib/screens/call.dart`
and `app/lib/screens/room.dart` were read and not written to. Nothing outside
`xelvic-web/` was created, edited or deleted.

## 16. Round 22 — the phone's window can be moved, and so can the web's now (2026-11-06)

Read again to answer *"abhi video call minimize karne par use drag aur drop nahi kar
pa raha hoon chat screen me"*, and this time the answer was to port the behaviour
rather than to note its absence.

- **`app/lib/screens/call_window.dart` — the drag.** `_spot` is where the window has
  been dragged to, kept in `State` and not in the engine, with the phone's own reason:
  where somebody parked a window is not a fact about the call, it is sent nowhere, and
  it is forgotten when the call ends. `onPanUpdate` adds every drag to where the
  window is *now* rather than to where the last build saw it, because two pointer
  moves can arrive inside one frame. `onPanEnd` calls `_settle`, and `_place` clamps
  on every build — a rotation or a keyboard can leave a corner off the screen.
- **`_gutter = 12` and `_settle`.** "Into an edge, not merely near it": while the
  window floats it is held the gutter clear, so the only way its own edge can be
  inside that gutter is if somebody pushed it there — and the file argues the point
  itself, that at a snap of 64 on a phone where the window is half the width, all but
  48pt of it would count as "near".
- **`_Edge` and `_tab`.** Docked, it is one small tab at the edge, and it comes back
  with a **tap** rather than a drag, because Android's gesture navigation claims
  horizontal swipes that begin in the edge strip. `CallView.hidden` — the third size,
  a single pill — lives in `_pill` and has no counterpart on the web.

**What the web does now.** All of the above, in `src/features/calls/minibar.ts` and
`CallOverlay.tsx`: the same gutter, the same clamping on every draw, the same
"into not near" rule measured on the raw spot, the same press-to-open tab, and the
same placement kept outside the call's own state. One divergence is honest and
tested: a web bar is wider than a phone's window, so on a phone it rests already one
gutter from both edges and folds away from the smallest push. `NOT VERIFIED` —
nothing was dragged on a real screen.

**Read-only project check.** `app/lib/screens/call_window.dart` was read and not
written to. Nothing outside `xelvic-web/` was created, edited or deleted.

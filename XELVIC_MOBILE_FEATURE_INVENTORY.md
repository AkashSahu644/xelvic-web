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
| Five-destination shell | `main.dart`, `nav.dart`, `home.dart` | Drops, Moments, Convo, Audio, Live |
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
and text moments, polls, track moments, sparks, together mode, viewers and
reactors, memories list/editor.

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


## 5. Convo (messaging) — highest priority

List and shell: `convo.dart`, `screens/convo.dart`, `group.dart`,
`chat_profile.dart`, `request` states, search, saved/vault.

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

Calls: `call.dart`, `calls_list.dart`, `call_window.dart`, `call_platform.dart`
— WebRTC call signalling through the chat socket.

## 6. Audio

`audio.dart`, `audio_section.dart`, `audio_window.dart`, `audio_deck.dart`,
`audio_prefs.dart`, `player.dart`, `track_list.dart`, `artist.dart`,
`music_sheet.dart`, `share_track.dart`, playlist screens, audio studio
(`audio_studio.dart`, separate product surface).

## 7. Live rooms

`live_now.dart`, `room.dart`, `room_talk.dart`, `room_bits.dart`,
`room_boards.dart`, `room_game.dart`, `games.dart`, `live_socket.dart`.

## 8. Rewards and Sparks

`sparks.dart`, `sparks_leaderboard.dart`, `reward.dart`, `wallet_view.dart`,
`logo_shop.dart`, `logo_provider.dart`, `catalogue.dart`, `theme_shop.dart`.

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
- Circles: `circles.dart`, `screens/circles.dart`
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
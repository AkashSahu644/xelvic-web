# Screen-by-screen audit

The audit is organised by web route. Each entry names the Android reference, what the web screen does, and what is still absent. "Wired" means the screen calls a real endpoint; it does not claim the endpoint was reachable during this pass.

## Public routes

| Route | Android reference | State | Audit |
| --- | --- | --- | --- |
| `APK-SCREEN-001` `/` | auth entry | Implemented, browser-rendered; successful auth unverified | Root now opens `SignInPage` directly. Authenticated sessions restore and redirect to `/app/drops`; the separate marketing landing page and component were removed. |
| `APK-SCREEN-002` `/signin` | `auth.dart`, `qr.dart` | Partial, browser error state verified | Compatibility route renders the same `SignInPage`; QR start/poll/rotate/collect and dev password form. Browser rendered the CORS/server-error state; successful authentication is blocked by missing local QR routes/backend and production CORS. |
| `APK-SCREEN-003` `/s/:token` | shared playlist link | Implemented, unverified | `PublicPlaylistPage`; public playlist fetch, track list and local audio player. No account shell; no live API test. |
| `APK-SCREEN-004` `*` | none | Implemented, unverified | `NotFoundPage`; route back is present by source inspection. |

## Shell routes

| Route | Android reference | State | Audit |
| --- | --- | --- | --- |
| `APK-SCREEN-005` `/app` | `home.dart` | Redirect, not a screen | Protected shell redirects to Drops. Android starts at Convo; this remains a documented navigation discrepancy. |
| `APK-SCREEN-006` `/app/drops` | `drops.dart`, `drop_grid.dart` | Implemented, API-unverified | `DropsPage`; cursor feed, composer, refresh, saved/like actions, comments. Vibes are played, not authored. |
| `APK-SCREEN-007` `/app/drops/:dropId` | `drop_post.dart` | Partial | `DropPage`; detail, comments, poll, share, hide/delete. No audience/stats panels. |
| `APK-SCREEN-008` `/app/moments` | `moments.dart`, `moment_view.dart` | Partial | `MomentsPage`; tray, viewer, seen, reactions, replies, composer, memories. No together-mode, stickers or drawings. |
| `APK-SCREEN-009` `/app/convo` | `convo.dart` | Implemented, API-unverified | `ConvoPage`; thread list, search, unread, requests, new DM/group. Rewards are accessible from the global mobile header, not as a thread-list entry. |
| `APK-SCREEN-010` `/app/convo/:threadId` | `chat.dart` | Partial | `ChatPage`; history, socket, send, upload, voice, polls, reactions, edit/delete, info, flags. Vault and calls absent; some chat sheets absent. |
| `APK-SCREEN-011` `/app/audio` | `audio.dart` | Partial | `AudioPage`; hero, recent, playlists, podcasts, artists, search, create playlist. No artist route. |
| `APK-SCREEN-012` `/app/audio/:playlistId` | playlist screens | Implemented, API-unverified | `PlaylistPage`; detail, edit, add/remove/reorder, share/revoke, delete. |
| `APK-SCREEN-013` `/app/live` | `live.dart` | Implemented, API-unverified | `LivePage`; shelf, socket refresh, create room. |
| `APK-SCREEN-014` `/app/live/:roomId` | `room.dart`, `room_talk.dart`, `room_game.dart` | Partial | `RoomPage`; join/leave, stage, hands, host controls, chat, throws, line game, share/end. Game action subroutes unverified; codepad absent. |
| `APK-SCREEN-015` `/app/u/:username` | `profile.dart`, `person.dart` | Partial | `ProfilePage`; own/other profile, follow/withdraw, block, mute posts, report, message, share, infinite drop grid, private wall. Crew list and refine profile absent. |
| `APK-SCREEN-016` `/app/search` | `search.dart` | Partial | `SearchPage`; people and audio tabs, recent searches, suggestions. Drops/places scopes absent. |
| `APK-SCREEN-017` `/app/alerts` | `requests.dart` | Partial, API-unverified | `AlertsPage`; follow/chat requests and count. General notification feed is absent. |
| `APK-SCREEN-018` `/app/saved` | saved shelf | Implemented, API-unverified | `SavedPage`; saved drops, remove on unsave/delete, server truncation note. |
| `APK-SCREEN-019` `/app/sparks` | `reward.dart`, `wallet_view.dart`, `theme_shop_view.dart`, `theme_preview.dart`, `spark.dart` | Partial, purchase runtime-unverified | `SparksPage`; theme preview/purchase, wallet, streaks, ladder and medals. Backend tier/slot enforcement exists in the external backend source, but this task left it read-only and did not run Django tests. |
| `APK-SCREEN-020` `/app/settings` | `settings.dart` | Partial | `SettingsPage`; profile, privacy, appearance, account/password/devices/contacts view/deny/sign-out. Allowing contact upload is Android-only. Deactivation, notification settings and own QR absent. |

There are 21 route declarations in `src/App.tsx` including `/app`, its index redirect and the catch-all; this table records 20 route outcomes (19 page destinations plus the `/app` redirect). These are web routes, not a complete count of APK screens. A complete Android navigation/overlay inventory is still outstanding.

## Android screens with no web route

| Android screen | Why it matters | Current status |
| --- | --- | --- |
| `call.dart`, `calls_list.dart`, `call_window.dart`, `call_banner.dart`, `call_bits.dart` | Audio/video calls | Out of scope; needs a separate WebRTC build |
| `vault.dart` | Code-locked conversations | Missing |
| `crew.dart` | Followers/following list | Missing |
| `contacts.dart` | Address-book matches | Native-only; settings records the choice |
| `refine_profile.dart` | Advanced profile editing | Missing |
| `games.dart` | Standalone games hub | Partial only inside a room |
| `codepad.dart` | Shared code pad in a room | Missing |
| `artist.dart` | Artist page | Missing |
| `qr_code.dart` | Own account QR | Missing |
| `moment_together.dart` | Collaborative moment | Missing |
| `chat_drop.dart`, `chat_live.dart`, `chat_playlist.dart`, `chat_track.dart`, `chat_collab.dart` | Rich chat attachments and collab sheets | Missing or partial |
| `music_sheet.dart`, `share_track.dart`, `track_moment.dart` | Track sharing surfaces | Partial |
| `story_card.dart`, `wall_frame.dart`, `notice_banner.dart` | Presentation surfaces | Partial or absent |
| `shelf.dart`, `shelf_sheets.dart` | Library/shelf management | Not ported as separate screens |
| `share_who.dart`, `mention_sheet.dart` | Share and mention pickers | Mention handling exists in composers; dedicated sheets absent |
| `theme_shop_view.dart`, `theme_preview.dart`, `theme_bar_preview.dart` | Theme purchase and preview | Partial: the web shop now provides catalogue, preview, purchase and wear; backend source enforces tier/slot rules, but Django tests and the live flow remain unverified |
| `reward.dart` shape | Themes + Wallet | Themes is the default web tab, with wallet and additional Sparks/ladder/medals tabs |
| `wallet_view.dart` detail | Three-number explanation and per-person ledger | Partial; numbers and ledger exist, explanatory copy is thinner |
| `spark.dart` detail | One spark's detail and controls | Partial; list card only |

## Interaction audit per screen

### Drops

- Present: cursor pagination, composer, image upload, poll create/vote, like, save, comments, share, hide, delete, media playback.
- Absent: camera capture, vibe studio, audience/stats, notes, tag/trending surfaces where the API is missing.
- Risk: optimistic like/save counters settle from the server; a failed request reverts.

### Moments

- Present: tray, viewer, timed advance, tap and keyboard navigation, seen, react, reply, create from image, memories.
- Absent: together-mode, stickers, drawings, viewer/reactor lists.
- Risk: sound playback depends on browser autoplay policy; the UI does not pretend otherwise.

### Convo and chat

- Present: thread list, filters, requests, new DM/group, history, socket updates, typing/read/presence, text and media send, voice recording where supported, polls, reactions, replies, edit/delete/copy, info, flags.
- Absent: vault, calls, several rich sheets, full offline cache.
- Risk: per-thread socket falls back to polling; attachment upload depends on `/chat/assets/`.

### Audio

- Present: home shelves, search, persistent player, playlist CRUD, public playlist, share/revoke.
- Absent: artist page, track share sheet, music sheet, offline downloads.
- Risk: media uses authenticated blob URLs; a revoked session stops playback rather than exposing a token.

### Live and rooms

- Present: shelves, create, join/leave, stage, hands, host controls, chat, throws, line game, share, end.
- Absent: codepad, calls, full game catalogue, exact game subroute verification.
- Risk: the room payload and socket frames are consumed tolerantly; unknown fields are ignored.

### Profile and social

- Present: own/other profile, follow/withdraw, block/unblock, mute posts, report, message, share, private wall, infinite grid.
- Absent: crew list, refine profile, own QR.
- Risk: `/auth/users/<username>/` does not include a gate; the message button is enabled by default and the server's gate response is shown when it refuses.

### Sparks and settings

- Present: spark list, wallet, medals, ladder, theme shop and preview, purchase and wear actions, profile/privacy/password/devices/contacts/sign-out.
- Absent: deactivation, notification settings, own QR.
- Risk: the web Sparks page is not the Android Reward page shape. This is a recorded divergence, not a silent claim of parity.
- Risk: Django tests for the new server-side tier/slot checks could not run because the configured PostgreSQL test database rejected credentials.

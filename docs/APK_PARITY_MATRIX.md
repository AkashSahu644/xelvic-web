# APK parity matrix

Legacy disposition labels in the tables describe feature coverage. Stable requirement records use `DISCOVERED`, `NOT_IMPLEMENTED`, `PARTIALLY_IMPLEMENTED`, `IMPLEMENTED_UNVERIFIED`, `VERIFIED`, `BLOCKED` or `NOT_APPLICABLE`; see `MASTER_GOALS.md`.

This matrix records the current build, not the ambition. A row is only **Implemented** when the web route exists and its main interactions are wired. "Implemented" does not mean live-verified; see `TEST_AND_REGRESSION_MATRIX.md`.

## Shell and identity

| Area | Android evidence | Web | Notes |
| --- | --- | --- | --- |
| Five-destination shell | `screens/home.dart`, bottom bar | **Implemented** | Drops, Moments, Convo, Audio, Live; desktop rail and mobile glass nav |
| Branding and splash | APK assets, `Brand` | **Implemented** | Xelvic marks and favicon from the APK |
| QR sign-in | `qr.dart`, `WEB-LOGIN.md` | **Partial** | Full documented start/poll/rotate/collect flow; local routes absent, so unverified |
| Development password login | `/auth/login/` | **Implemented** | Visible only when the build allows dev login |
| Session restore and refresh | JWT endpoints | **Implemented, unverified** | Single-flight refresh, session storage fallback |
| Signup and OTP | `signup.dart` | **Out of scope** | Account is created on the phone |
| Password reset | phone flow | **Out of scope** | Not present in the web API contract |
| Own QR code | `qr_code.dart` | **Missing** | No web route for displaying the account QR |
| Account deactivation | `/auth/deactivate/` | **Missing** | Not wired in settings |

## Drops

| Area | Android evidence | Web | Notes |
| --- | --- | --- | --- |
| Feed | `drops.dart`, `drop_grid.dart` | **Implemented** | Cursor feed, refresh, composer |
| Drop detail | `drop_post.dart` | **Implemented** | Likes, saves, comments, poll, share, hide, delete |
| Composer | `drop_post.dart`, `drop_sheets.dart` | **Partial** | Text, image, poll, place, tag; no camera or vibe studio |
| Vibes / short video | `vibes.dart`, `video.dart` | **Partial** | Playback where the API returns a vibe; no studio or audience tooling |
| Notes | drop API | **Missing** | API exists; web focuses on comments |
| Tags / trending | documented API | **Partial** | Endpoint absent locally; UI degrades honestly |
| Saved drops | `/drops/saved/` | **Implemented** | Removes unsaved rows immediately |
| Memories | `memories.dart` | **Partial** | Read surface; no full editor |

## Moments

| Area | Android evidence | Web | Notes |
| --- | --- | --- | --- |
| Tray and unseen state | `moments.dart` | **Implemented** | Mine, unseen, seen |
| Viewer | `moment_view.dart` | **Implemented** | Timed advance, tap/keyboard navigation, seen |
| Reactions and replies | `moment_view.dart` | **Implemented** | Real endpoints, no fake rows |
| Composer | `moment_composer.dart`, `moment_post.dart` | **Partial** | Image upload and body; no stickers, drawings or together-mode |
| Moment together | `moment_together.dart` | **Missing** | Collaborative moment flow |
| Memories | `memories.dart` | **Partial** | List and reactions where returned |
| Viewers / reactors | API | **Missing** | Not exposed in the web viewer |

## Convo and chat

| Area | Android evidence | Web | Notes |
| --- | --- | --- | --- |
| Thread list | `convo.dart` | **Implemented** | Search, unread, requests, socket invalidation |
| New DM / group | `convo.dart`, `group.dart` | **Implemented** | Direct and group creation |
| Message history | `chat.dart` | **Implemented** | Cursor history, send, edit, delete, copy |
| Attachments | `chat_media.dart` | **Implemented** | Image, video, voice, audio, document via `/chat/assets/` |
| Voice recording | `chat_audio.dart` | **Partial** | Browser `MediaRecorder` when available; file fallback |
| Reactions and polls | `chat.dart` | **Implemented** | Message reactions and poll create/vote |
| Replies, forwarding, info | `chat.dart`, `chat_collab.dart` | **Partial** | Reply and info; forwarding surface limited |
| Typing, read, presence | socket | **Implemented** | Per-thread socket with polling fallback |
| Group members and channels | `group.dart` | **Partial** | Member/invite basics; some channel admin gestures absent |
| Vault | `vault.dart` | **Missing** | Code-locked chat surface not ported |
| Calls | `call.dart`, `calls_list.dart`, `call_window.dart` | **Out of scope** | Separate WebRTC build required |
| Chat drop / live / playlist sheets | `chat_drop.dart`, `chat_live.dart`, `chat_playlist.dart`, `chat_track.dart` | **Missing** | Not ported |
| Offline sync | `/chat/sync/` | **Partial** | Refresh-on-reconnect; no local message cache |

## Audio

| Area | Android evidence | Web | Notes |
| --- | --- | --- | --- |
| Home | `audio.dart` | **Implemented** | Hero, recent, playlists, podcasts, artists |
| Track search | `audio.dart`, `track_list.dart` | **Implemented** | `/audio/tracks/?q=` |
| Persistent player | `player.dart` | **Implemented** | One audio element, queue in memory |
| Playlist detail and editing | playlist API | **Implemented** | Create, rename, cover, add, remove, reorder, share, revoke |
| Shared playlist landing | `/s/:token` | **Implemented** | Public route with local player |
| Artist page | `artist.dart` | **Missing** | No artist route |
| Music sheet / share track | `music_sheet.dart`, `share_track.dart` | **Partial** | Playlist share exists; track share sheet absent |
| Audio studio | separate product | **Out of scope** | Not part of the account client |

## Live and rooms

| Area | Android evidence | Web | Notes |
| --- | --- | --- | --- |
| Shelf | `live.dart` | **Implemented** | Live, upcoming, ended, mine |
| Room detail | `room.dart`, `room_bits.dart` | **Implemented** | Stage, audience, hands, host controls |
| Room talk | `room_talk.dart` | **Implemented** | Socket chat, reactions, five confirmed throws |
| Games | `room_game.dart`, `room_boards.dart`, `games.dart` | **Partial** | Open/join/play/again/close and line board; exact game subroutes unverified |
| Codepad | `codepad.dart` | **Missing** | Shared code pad not ported |
| Calls inside rooms | `call_*` | **Out of scope** | WebRTC not built |

## Profile and social

| Area | Android evidence | Web | Notes |
| --- | --- | --- | --- |
| Own profile | `profile.dart` | **Implemented** | Stats, grid, saved link, settings |
| Other profile | `person.dart` | **Implemented** | Follow/withdraw, block, mute posts, report, message, share |
| Private wall | profile API | **Implemented** | 403 from user drops renders a wall |
| Crew list | `crew.dart` | **Missing** | Count is shown; list is not |
| Refine profile | `refine_profile.dart` | **Missing** | Advanced profile editor absent |
| Contacts | `contacts.dart` | **Native-only / Partial** | Browser cannot read the address book; settings shows matches and can deny, but allowing uploads stays in Android |
| Requests | `requests.dart` | **Implemented** | Incoming/sent tabs and actions |
| Search | `search.dart` | **Partial** | People and audio; drops/places scopes absent |
| Alerts | notification surfaces | **Implemented, unverified** | `/social/requests/` and count; no general alerts feed |
| Saved | saved shelf | **Implemented** | `/drops/saved/` |

## Sparks, reward and themes

| Area | Android evidence | Web | Notes |
| --- | --- | --- | --- |
| Spark list and streak state | `spark.dart` | **Implemented** | `/sparks/` data, live/best/shields |
| Wallet | `wallet_view.dart` | **Implemented** | Balance, earned, spent, people, ledger |
| Medals | spark medals API | **Implemented** | `/sparks/medals/` |
| Tier ladder | `theme_shop_view.dart`, `sparks.dart` | **Partial** | Earned thresholds and slot limits are displayed; backend enforces them, but its tests could not run against the unavailable local PostgreSQL test DB |
| Theme shop | `theme_shop_view.dart` | **Implemented, runtime-unverified** | Catalogue, earned tiers, slot limits, wallet checks, previews and purchase are wired; live API and backend tests remain unverified |
| Theme preview | `theme_preview.dart` | **Implemented** | Preview temporarily applies the palette; dismissal restores the selected theme |
| Buy theme | `/sparks/wallet/buy/` | **Implemented, unverified** | Posts `{key}`, reports server price/charge, then refreshes wallet; backend integration unavailable |
| Wear an opened theme | `theme_preview.dart` | **Implemented, unverified** | Separate action syncs through `/auth/me/theme/` |
| Reward page shape | `reward.dart` | **Partial** | Themes is now the default tab and Wallet remains available; Sparks, ladder and medals are retained as extra tabs |
| Theme sync and mode | theme provider | **Implemented** | `/auth/me/theme/`, light/dark/system |

## Settings

| Area | Android evidence | Web | Notes |
| --- | --- | --- | --- |
| Profile edit | `settings.dart`, `refine_profile.dart` | **Implemented** | Name, username, bio |
| Avatar and cover | `/auth/me/avatar|cover/` | **Implemented** | Upload and remove |
| Privacy switches | `/auth/me/privacy/` | **Implemented** | Private, crew count, birthday |
| Appearance | theme provider | **Implemented** | Mode and theme swatches |
| Devices | `/auth/devices/` | **Implemented, unverified** | List and revoke |
| Contacts choice | `/auth/me/contacts/` | **Partial** | Browser limitation stated |
| Password change | `/auth/password/change/` | **Implemented, unverified** | Current + new, min 8 |
| Sign out | auth provider | **Implemented** | Revokes refresh and clears state |
| Notification settings | Android settings | **Missing** | No push in the browser |
| Deactivate account | `/auth/deactivate/` | **Missing** | Not wired |

## Native-only and out of scope

- Camera capture, native photo library nuances, address book, push tokens, OS background audio services beyond browser Media Session support, and phone calls.
- Website-side QR scanning.
- Staff console, ML developer API, deals, circles, drip and catalogue.
- Audio/video calling and room media.

## Known missing Android screens and surfaces

The source screen names below were present in the earlier source-level inventory. This is not a claim that every APK destination, conditional route, dialog or overlay has been discovered.

| Requirement ID | Android screen/surface | Web status | Evidence / remaining work |
| --- | --- | --- | --- |
| `APK-SCREEN-021` | Vault (`vault.dart`) | `NOT_IMPLEMENTED` | No vault screen/flow; chat flag support is not equivalent |
| `APK-SCREEN-022` | Crew (`crew.dart`) | `NOT_IMPLEMENTED` | Counts may be shown; followers/following lists are absent |
| `APK-SCREEN-023` | Codepad (`codepad.dart`) | `NOT_IMPLEMENTED` | No shared room codepad |
| `APK-SCREEN-024` | Artist page (`artist.dart`) | `NOT_IMPLEMENTED` | Audio artist route absent |
| `APK-SCREEN-025` | Own QR (`qr_code.dart`) | `NOT_IMPLEMENTED` | No own-account QR destination |
| `APK-SCREEN-026` | Refine profile (`refine_profile.dart`) | `PARTIALLY_IMPLEMENTED` | Basic fields are editable; advanced refinement UI is absent |
| `APK-SCREEN-027` | Standalone games hub (`games.dart`) | `PARTIALLY_IMPLEMENTED` | Room game board exists; standalone catalogue/hub is not ported |
| `APK-SCREEN-028` | Moment together (`moment_together.dart`) | `NOT_IMPLEMENTED` | Collaborative moment flow absent |
| `APK-SCREEN-029` | Rich chat attachment sheets | `PARTIALLY_IMPLEMENTED` | Some attachment types/actions exist; dedicated drop/live/playlist/track/collab sheets absent |
| `APK-SCREEN-030` | Account deactivation | `NOT_IMPLEMENTED` | Endpoint is documented/source-listed; no UI; destructive behavior needs a separately reviewed flow |
| `APK-SCREEN-031` | Calls and call surfaces | `NOT_APPLICABLE` | Native/WebRTC media requires a separately scoped web calling product |
| `APK-SCREEN-032` | Address book and native contacts | `NOT_APPLICABLE` | Browser cannot read the native address book; web preserves view/deny behavior where available |

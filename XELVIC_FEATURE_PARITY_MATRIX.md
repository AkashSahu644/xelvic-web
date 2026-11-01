# Xelvic Feature Parity Matrix

Date: 2026-11-01
Mobile reference: `xelvic/app` (151 screens, 255,946 lines)
Web target: `xelvic-web/src` (20 pages, 83 files, ~31k lines)
Backend: `xelvic/backend` (read-only, shared contract)

Status keys (per the project brief):

- **COMPLETE** — web surface exists and its main interactions are wired to real endpoints.
- **PARTIALLY COMPLETE** — some workflows exist; named sub-features are absent.
- **UI ONLY** — surface renders but no backend interaction.
- **API MISSING (web)** — endpoint exists but the web client does not call it.
- **MISSING** — no web surface.
- **BROKEN** — wired incorrectly (wrong path/shape/state).
- **BACKEND UNAVAILABLE** — no server capability; web cannot honestly implement.
- **PLATFORM-SPECIFIC** — mobile-only or requires native/browser capability not present.

`COMPLETE` is a code-and-contract judgement, not a live-backend verification.
See `XELVIC_TESTING_REPORT.md` for what was actually executed.

## Shell and identity

| Feature | Mobile | Web status | Evidence / gaps |
| --- | --- | --- | --- |
| Five-destination shell | `home.dart` | COMPLETE | `AppShell.tsx`; desktop rail, mobile glass nav |
| Branding/splash | APK assets | COMPLETE | `Brand`, `Splash`, local assets |
| Theme sync (light/dark + themes) | `theme_provider.dart` | COMPLETE | `ThemeProvider`, `/auth/me/theme/` |
| A theme repaints every screen | `theme_provider.dart`, `backdrop.dart` | COMPLETE (NOT VERIFIED) | Colours reach every screen as CSS variables on `documentElement`. The theme's *picture* now reaches the places the app draws one: the shell (`AppShell`), the marketplace and its preview (`Backdrop` inside `SettingsShell` / `ThemePreviewPage`) and the inside of a chat (`ChatPage`). Previewing a design moves the whole web, not a box in it |
| Pushed routes stand on a ground | `X.pageGround`, `backdrop.dart` | COMPLETE | `X.pageGround` is clear on any theme with art, so its bars are glass over the picture. Settings' own views copy the app's flat `Scaffold(backgroundColor: X.ink)`; only the Marketplace, which is a pushed screen in the app, takes a backdrop |
| Language selection | `language_screen.dart` | COMPLETE | `features/settings/LanguageView.tsx`, reached from the Language row; the row reads the same preference the page writes |
| QR web sign-in | `qr.dart`, `qr_approve.dart` | COMPLETE* | Full start/poll/rotate/collect; runtime unverified |
| Dev password sign-in | local only | COMPLETE | Gated by `VITE_ENABLE_DEV_LOGIN` |
| Token refresh / restore | `session.dart` | COMPLETE | Single-flight refresh in `api.ts` |
| Logout | `session.dart` | COMPLETE | `/auth/logout/` |
| Own QR code | `qr_code.dart` | COMPLETE | `/app/qr` |
| Account switching | `switch_account.dart` | MISSING | Requires a second credential store |
| Devices / sessions | `sessions.dart` | COMPLETE (NOT VERIFIED live) | `features/settings/DevicesView.tsx` — `GET /auth/devices/`, revoke with the password the app asks for |
| Signup / OTP / reset | phone wizard | BACKEND UNAVAILABLE | Account is created on the phone (documented) |
| Deactivation | `/auth/deactivate/` | COMPLETE | `deactivateAccount()` in `SettingsPage`, behind a password confirmation |
| Profile view/edit | `profile.dart` | COMPLETE | `MyProfile` under `ProfilePage`, `/auth/me/`; the head, the four counts with their taps, the privacy pill, the Insights row, Memories and the shelf, the three floating discs and the ⋮ sheet. |
| Somebody else's profile | `person.dart` | COMPLETE (NOT VERIFIED live) | `PersonProfile`: cover band, the trade, the name and tick, `@handle · private/public`, the birthday line, the professional block, the counts the payload allows, the mutual strip, the bio, Memories and their shelf, the gate card, and the floating discs in the app's own order (⋮, convo / keep / let go / ask, their QR). |
| The day behind the face | `person.dart` `Ring`, `MomentViewScreen` | COMPLETE (NOT VERIFIED live) | `FaceButton` draws the app's flat 2.5px ring (accent while their day is unwatched, text-16% once it is) off the `["moments-tray"]` row for that person; a tap opens their day in `MomentViewer` over the page, exactly as `_openLive` does. |
| The face, as large as it goes | `showFace`, `_showPhoto` | COMPLETE | `FaceDialog` — a 240 square, rounded 22, their name under it; a tap on my own face, a hold on theirs. |
| Birthday fall | `birthday.dart` | COMPLETE | `BirthdayFall` on both profile pages on the day only: 13 balloons rolled from the fixed seed, six 11s crossings then rest, flat tones with no gradient, no pointer, nothing at all under reduced motion. |
| Avatar/cover upload | `cover_frame.dart` | COMPLETE | Multipart endpoints |
| Profile privacy switches | settings | COMPLETE | `/auth/me/privacy/` |
| Verification request | `get_verified.dart` | COMPLETE (NOT VERIFIED live) | `features/verify/VerifyView.tsx` — `GET /verify/status/`, `POST /verify/requests/` as a multipart form, the app's own field lengths |
| Contacts sync | `contacts.dart` | PARTIALLY COMPLETE | Matches shown; allow/upload phone-only |
| Professional profile | `professional_details.dart` | COMPLETE (NOT VERIFIED live) | `features/professional/ProfessionalView.tsx` writes `PATCH /auth/me/professional/`; the trade and the contact pills draw on both profile pages |

## Social graph

| Feature | Web status | Notes |
| --- | --- | --- |
| Follow / unfollow / withdraw | COMPLETE | `/social/users/{id}/*` |
| Follow requests accept/decline | COMPLETE | `/social/requests/` |
| Block / unblock | COMPLETE | |
| Report | COMPLETE | `/social/report/` |
| Mutuals | COMPLETE | `/social/users/{id}/mutuals/` behind `MutualStrip` → `MutualsModal` (port of `mutuals.dart`): the faces and the count come off the profile payload, and the list is read only when the strip is opened. |
| Crew | API MISSING (web) | Endpoint exists |
| Gate / insights | MISSING | Read-only where returned |
| Mentions | PARTIALLY COMPLETE | Mentionable search in composers |
| Circles | MISSING | `circles.dart` |
| Collabs | MISSING | `collab_sheets.dart` |
| Deals / creator directory | MISSING | `deals/*` |
| Marketplace (Drip / Themes / Logos) | COMPLETE | `MarketplaceView` + `DripView` / `ThemeShopView` / `LogoShopView`, ported from `marketplace.dart`, `drip.dart`, `theme_shop_view.dart`, `logo_shop_view.dart`; one page, three aisles, one purse, reached from the single Settings row. Runtime NOT VERIFIED |
| Codepad | MISSING | `codepad.dart` |

## Drops (posts / feed)

| Feature | Web status | Notes |
| --- | --- | --- |
| Cursor feed | COMPLETE | `/drops/` infinite cursor |
| Mine / user's drops | COMPLETE | `/drops/mine/`, profile |
| Saved drops | COMPLETE | `/drops/saved/` fallback |
| Text / image / poll / place / tag creation | COMPLETE | `DropComposer` |
| Likes, saves, shares, hide, delete | COMPLETE | |
| Comments + replies | COMPLETE | `CommentsModal` |
| Poll voting | COMPLETE | |
| Notes | API MISSING (web) | API supports; web focuses comments |
| Vibes | COMPLETE (NOT VERIFIED live) | The shelf (`/drops/vibes/`) and the walk (`VibeViewer`: real player, its own end behaviour per `vibeEnd.ts`, mute, the player sheet, the next-clip hint), plus the studio (`VibeStudioPage` + `features/drops/VibeStudio.tsx`, reached from a Vibe's own top bar and from the composer's `mode=vibe`). See the Drops/Vibes pass of 2026-11-01 |
| Hashtags / trending | PARTIALLY COMPLETE | Degrades honestly when route absent |
| Media gallery / memories | PARTIALLY COMPLETE | Read surfaces |
| Camera / photo editor | PARTIALLY COMPLETE | `CameraCapture` + `PhotoEditor`; browser-only |
| Vibe / video editor | MISSING | `screens/editor/*` |
| Send/respond media sheets | PARTIALLY COMPLETE | Attachment flow exists; share targeting limited |

## Moments

| Feature | Web status | Notes |
| --- | --- | --- |
| Tray (mine/unseen/seen) | COMPLETE | `/moments/tray/`; rail order is the server's — answered (always empty), unseen, seen, silenced |
| Viewer + timed advance | COMPLETE (NOT VERIFIED live) | `MomentViewer` is a port of `MomentViewScreen`: a 60ms ticker, the per-item hold (`MomentItem.hold` — clip window, sound window up to 60s, a carried picture's own life, else 5s), a video read off the element's own clock, and a step at the end of each. Tap steps (left third back, else forward); a hold pauses at 480ms and, where the item carries something, arms leaving at 1230ms |
| Mark seen | COMPLETE | Per item (`/moments/items/{id}/seen/`) as each comes up, and the moment once its last item is reached |
| React / reply | COMPLETE (NOT VERIFIED live) | The heart is `/moments/{id}/react/` (blank emoji takes it back, the server's answer is what is drawn); a long press on the button opens the five faces; the line written back is `/moments/{id}/reply/` and lands in a convo. Drawn on somebody else's moment only |
| Create image moment | COMPLETE | `CameraCapture` → `ShareMoment` (reach + audience) |
| Text/poll/track/spark moments | COMPLETE (NOT VERIFIED live) | `TextMoment` (note), `PollMoment`, `ComposeMoment` (`?compose=1`, the "Moment" row on a drop), `ShareMoment` |
| The tally, and who watched | COMPLETE (NOT VERIFIED live) | `_reactions` sends a reader no number, so the answers row is drawn on my own day only and is the way into the who sheet: `/moments/{id}/viewers/`, `/moments/{id}/reactors/`, and `/moments/items/{id}/voters/` for the poll, each read when the sheet is opened |
| Carried: a way out of the item | COMPLETE (NOT VERIFIED live) | `_carried` order — a Vibe on the item, then `made_from` (vibe → the Vibes walk at that clip, drop → the drop), then a sound (→ Audio), then `source_id` (→ that moment, opened as a walk of its own). The line at the foot of the picture names where the hold leads, and switches to "Let go to open X" past the leave threshold |
| Carry on, when the moment names me | COMPLETE (NOT VERIFIED live) | `POST /moments/{id}/carry/`, offered only on the item that names me. **PARTIAL against the app:** the app opens a picture in its Image editor first and carries the edit; the web carries the moment as it stands, because `CameraCapture` has no "seed with an existing file" door |
| Share | COMPLETE (NOT VERIFIED live) | `POST /moments/{id}/share/` is the gate (a private account refuses with a reason instead of a sheet whose Send would fail); `{thread}` makes it the deed, one convo at a time, and the count said afterwards is the number that arrived |
| Add to Memories | COMPLETE (NOT VERIFIED live) | `AddToMemories` — pick what has run out its day (`/moments/awaiting/`), then an old shelf (`PATCH /moments/memories/{id}/`) or a new one (`POST /moments/memories/`, name + cover from the kept pictures or an upload). Reached from the three dots on my own moment and from "New Memory" on my profile (`/app/moments?memories=1`) |
| Audience / reach on a moment | COMPLETE | `AudienceSheet`, the same reach the composer writes |
| Together mode | MISSING | |
| Stickers/drawings | MISSING | |
| Viewing a Memory | PARTIALLY COMPLETE | The shelf and its add flow are wired; the walk over a Memory's own items is drawn by the profile's shelf, and `MomentViewer` is built for moments (a Memory is not one — the app's `isMemory` branches are not ported) |

## Convo (messaging)

| Feature | Web status | Notes |
| --- | --- | --- |
| Two-pane desktop layout | COMPLETE | `ConvoLayout` persistent sidebar |
| Mobile full-screen chat | COMPLETE | sidebar hides under `:threadId` |
| Chat screen design / theme fidelity | COMPLETE (static) | heading is name/face/verified tick only; no clock above text bubbles (only on bare media/cards); day pills; 4/10/2 run spacing; sender name only at a run head (11.5 w700); receipt under every own bubble; edited marker inside cards; bubble 14/10/14/8 radius 18/6 max 76%; composer 12/8/8/8 with 22px field, 46px send |
| Conversation search | COMPLETE | local list filter |
| New DM / new group | COMPLETE | `ConvoSheet`, `/chat/groups/` |
| Thread list + unread + ordering | COMPLETE | real preview, numeric badge, pinned-first sort; fixed 2026-11-01 |
| Live list update on arrival | COMPLETE (after goal 4.7) | patches card from `thread.update` |
| Cursor message history | COMPLETE | `useInfiniteQuery`, newest-first pages |
| Send text / image / video / audio / doc | COMPLETE | HTTP send + `/chat/assets/` |
| Voice recording | PARTIALLY COMPLETE | `MediaRecorder` + file fallback |
| Reply | COMPLETE | |
| Edit | COMPLETE | text only, as backend permits |
| Delete for me / everyone | COMPLETE | `?scope=all` |
| Copy text | COMPLETE | |
| React | COMPLETE | |
| Poll create/vote | COMPLETE | |
| Forward | COMPLETE (after goal 4.5) | `/forward/` |
| Message info (group) | COMPLETE (after goal 4.6) | `/info/` |
| Attachments sheet / media index | COMPLETE | `/media/` |
| Optimistic send + reconciliation | COMPLETE (after goal 4.2) | `pending`/`failed`, `client_id` |
| Typing indicators | PARTIALLY COMPLETE | socket `typing`/`thread.typing` still sent and received; web shows a small dot line above the composer. The app shows the other side's character pose instead (no character catalogue on web), and the header no longer repeats it as text. |
| Online presence | NOT IMPLEMENTED | the app conveys presence through the other side's character pose / gaze; the web has no character surface, and the header's old `online` text was removed to match the app's heading (name, face, verified tick only). |
| Read / delivered receipts | COMPLETE (after goal 4.3) | server `status` + member watermarks |
| Spark / view-once send (camera → editor → send) | COMPLETE / NOT VERIFIED | app's own `CameraCapture`; sends `kind: image|video` + `payload: {view_once: true}` (the invalid `kind: "spark"` is gone) |
| Spark bubble (sent / opened / gone) | COMPLETE | recipient tile "A Spark for you / Tap to open · once only"; otherwise "Spark · sent / opened / gone" from `payload.opened_at` |
| Spark viewer + run | COMPLETE / NOT VERIFIED | full-screen black viewer, run of unopened incoming Sparks in ordinal order, tap to advance/close, reply bar, screenshot line from server `shot_at` |
| Spark sound band | COMPLETE / NOT VERIFIED | asset id in `payload.sound` → `/chat/assets/{id}/content/`, play/pause, start/end window, `sound_title` or "Sound attached" |
| Spark / view-once open | COMPLETE (after goal 4.4) | `open-once` path fixed; bytes fetched before the spend |
| Disappearing messages | PARTIALLY COMPLETE | mode shown; consent flow limited |
| Vault | PARTIALLY COMPLETE | `VaultModal`; code lock |
| Group members / roles | PARTIALLY COMPLETE | list + basic management |
| Group rooms / channels | PARTIALLY COMPLETE | room bar + send channel |
| Group invites | PARTIALLY COMPLETE | |
| Group avatar | PARTIALLY COMPLETE | |
| Wallpaper / tint | COMPLETE | `skin.ts` |
| Theme's own picture inside a chat | COMPLETE (NOT VERIFIED) | `ChatPage` draws `theme.chatWall` behind the thread when no wallpaper was picked, washed with the page's own ink at `WALL_SCRIM` and framed by `chatFrame` — the app's last-answer ordering (a picked wallpaper and a taken photo both outrank it) |
| Chat accent on an uncoloured convo | PARTIALLY COMPLETE | `tintOf` on the phone is `theme.chatTint ?? kChatTint` (`#E31B66`), *not* the app accent. The web has `--convo-accent` computed by that same rule but the chat still falls back to `--accent`; see the gap report |
| Clear / flags (pin, mute) | COMPLETE | `ConvoSheet` |
| Links / stickers / drop / live / playlist shares | PARTIALLY COMPLETE | renderers exist; some share sheets absent |
| Keep / collab / vanish consent sheets | MISSING | |
| Offline outbox / durable sync | PARTIALLY COMPLETE | refetch on reconnect; no outbox |
| Calls (audio/video) | PLATFORM-SPECIFIC | Needs WebRTC product build; web says so |
| Message search | COMPLETE | `/chat/search/` rendered under the Convo search field |

## Audio

| Feature | Web status | Notes |
| --- | --- | --- |
| Home, recent, playlists, podcasts | COMPLETE | |
| Track search | COMPLETE | |
| Persistent player | COMPLETE | one audio element |
| Playlist CRUD + cover + reorder | COMPLETE | |
| Shared playlist landing | COMPLETE | `/s/:token` |
| Artist page | COMPLETE | `/app/audio/artist/:slug` |
| Music sheet / share track | PARTIALLY COMPLETE | playlist share only |
| Audio studio | PLATFORM-SPECIFIC | Separate product surface |

## Live

| Feature | Web status | Notes |
| --- | --- | --- |
| Live shelf | COMPLETE | `/spaces/` |
| Room join / talk | COMPLETE | `/live/:roomId` |
| Room chat / reactions | COMPLETE | |
| Room games / boards | API MISSING (web) | |
| Room bits | API MISSING (web) | |

## Rewards / Sparks

| Feature | Web status | Notes |
| --- | --- | --- |
| Theme catalogue / preview / purchase | COMPLETE (NOT VERIFIED) | Themes aisle of the marketplace: `/catalogue/` shelf, per-design preview that moves the whole web, `/sparks/wallet/buy/`, `/auth/me/theme/`, `/catalogue/figure-pick/`, theme face/cover upload. The web-only duplicate on the Sparks page was removed — the app's `reward.dart` mounts only `WalletView` |
| Wallet / ledger / contributors | COMPLETE | `/sparks/wallet/`; the marketplace header's purse reads this same query |
| Medals / ladder | COMPLETE | |
| Logo shop | COMPLETE (NOT VERIFIED) | Logos aisle: `/catalogue/logos` shelf, `/sparks/wallet/buy-logo/`, `/auth/me/logo/`. The web-only "App logo" Settings row was removed — the app has exactly one Marketplace row |
| Drip (figures) | COMPLETE (NOT VERIFIED) | `/drip/` shelf, `/drip/buy/`, `/drip/wear/`, `/drip/profile/` |
| Sparks leaderboard | PARTIALLY COMPLETE | |
| Rewards screen | PARTIALLY COMPLETE | folded into Sparks |

## Notifications

| Feature | Web status | Notes |
| --- | --- | --- |
| Alerts list | COMPLETE | `/alerts/`; row geometry ported from `screens/alerts.dart` — 16pt card, 48pt face square, 44pt avatar or self-spoken glyph, 20pt tone badge ringed in the card's ground, the 28pt door that shares its corner, a 58×76 tile with its word *under* it, side-by-side keep answers, and a 9pt dot in a 48pt-high column |
| Mark read / read all | COMPLETE | `/alerts/read/` |
| Alert navigation | COMPLETE | one table, `alertPath`: a `route` for studio news, the target for everything else, and the one honest refusal — a Memory says it has no reader on the web yet |
| Real-time alerts | COMPLETE (NOT VERIFIED live) | socket `alert.new` / `alert.read` applied to the `["alerts"]` cache |
| In-app notice strip | COMPLETE | `features/notices`, a port of `notices.dart` + `notice_banner.dart`: 4s hold, queue of 5, same-conversation replacement, per-conversation ordinal dedupe, muted and the conversation being read skipped, chime only while the tab is in front, dismiss by tap, close or horizontal swipe |
| System notification while the site is open in another tab | COMPLETE (NOT VERIFIED live) | the browser's `Notification`, permission-gated; a hidden tab's strip is handed over to it, and a click focuses the tab and opens the row's destination |
| Notification after the site is closed | BLOCKED | the server's only push road is Firebase, to the tokens the phone app registers (`Device.push_token`). This build has no Firebase project config, no VAPID key and no service worker, and the backend is read-only, so nothing can be wired without work outside this project |
| Server-backed notification preferences | BLOCKED | the backend has no preference endpoint; the switch and the two sounds are local, and the page says so |

## Media

| Feature | Web status | Notes |
| --- | --- | --- |
| Image upload + thumbnail | COMPLETE | client-side thumbnail, `upload.ts` |
| Video upload + poster | PARTIALLY COMPLETE | metadata; no poster generation |
| Audio / voice upload | COMPLETE | |
| Preview before send | COMPLETE | composer attachment chip |
| Upload progress | COMPLETE | XHR `upload.onprogress` → `Uploading n%` on the bubble |
| Authed media fetch | COMPLETE | `useMediaUrl` / `AuthedImage` |

## Summary

- Mobile module families inventoried: 11.
- Web surfaces considered: 20 pages, 13 feature folders.
- Fully wired families: shell, drops core, vibes, moments, audio core, live core,
  sparks core, notifications core, messaging core.
- Largest remaining families: calls, deals, circles, collabs, creator tooling,
  editors, offline outbox, group/admin sheets, together mode and stickers on a
  moment, and the walk over a Memory's own items.
- Highest-value gaps addressed in this pass: conversation preview correctness,
  optimistic send/reconciliation, honest receipts, forward/info, view-once,
  live list updates, cross-conversation message search, upload progress, the
  whole marketplace (Drip / Themes / Logos) with the theme's picture reaching
  the shell, the shop, the preview and the inside of a chat, the Drops/Vibes
  pass of 2026-11-01, and the Moments viewer rebuilt as a port of
  `MomentViewScreen`.
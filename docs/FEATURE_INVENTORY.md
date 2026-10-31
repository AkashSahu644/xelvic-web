# Feature inventory

Sources: `WEB-API.md` route index, `WEB-LOGIN.md`, local DRF URL maps, Flutter screens (`xelvic/app/lib/screens`), and APK theme assets.

Status keys:

- **Core**: built as a complete web vertical slice.
- **Supported**: implemented against the documented API, with honest server-capability handling.
- **Read**: list/detail surfaces without every write gesture.
- **Out of scope**: staff or bot surfaces, or work that is itself a separate product.

## Identity and access

| Feature | Mobile evidence | Web |
| --- | --- | --- |
| QR scan sign-in | `lib/qr.dart`, `WEB-LOGIN.md` | **Core** (documented flow, polling, rotation, collect, 404 capability screen) |
| Dev password login | local `/auth/login/` | **Core**, dev-only |
| Token refresh and session restore | JWT endpoints | **Core**, single-flight refresh |
| Logout | `/auth/logout/` | **Core** |
| Profile view / edit | `MeSerializer`, `/auth/me/` | **Core** |
| Avatar / cover upload | `/auth/me/avatar|cover/` | **Core** |
| Privacy switches | `/auth/me/privacy/` | **Core** |
| Theme sync | `/auth/me/theme/` | **Core** |
| Devices and revoke | `/auth/devices/` | **Core** |
| Contacts sync | `/auth/me/contacts/` | **Partial** (matches shown; denial recorded; allowing uploads is Android-only) |
| Signup / OTP / password reset | mobile wizard | Out of scope (docs: account is made on the phone) |
| Deactivation | `/auth/deactivate/` | **Missing** in settings |

## Rewards and themes

| Feature | Android behavior | Web |
| --- | --- | --- |
| Theme catalogue and preview | Reward opens on Themes; preview temporarily applies the design and restores the previous design when dismissed | **Supported**; preview is temporary and dismissal restores the selected design |
| Included themes | Pink, Unicorn and Cat Girl are included without spending a tier slot | **Supported**; marked Included and can be worn without a purchase |
| Paid theme purchase | Tier depends on lifetime earned sparks; each rung has a slot limit; purchase and wearing are separate actions | **Implemented, runtime-unverified**; client and backend enforce earned/slot/balance rules; purchase posts `{key}` and wearing is a separate owned-theme action |
| Wallet | Balance, live total, ever-earned, spent, contributors and ledger | **Supported**; wallet balances, contributors, ledger and opened themes |
| Sparks / medals / ladder | Sparks, awards, streak ladder and wallet | **Core** for existing web surfaces; Themes is now the default tab and mobile header has a Rewards shortcut |

## Social graph

| Feature | Web |
| --- | --- |
| Follow / unfollow / withdraw | **Core** |
| Follow requests, accept, decline | **Core** |
| Block / unblock | **Core** |
| Report | **Supported** |
| Mutuals, crew, gate, insights | **Missing**; relation and gate are read where returned |
| Mentionable people | **Supported** in composers |

## Drops (feed)

| Feature | Web |
| --- | --- |
| Cursor-paged feed | **Core** |
| Mine / a user's drops | **Core** |
| Saved drops | **Core** (falls back to `/drops/saved/` when `/saved/` is not mounted) |
| Text, image, poll creation | **Core** |
| Like, save, share, hide, play signal | **Core** |
| Comments list and create | **Core** |
| Poll voting | **Core** |
| Notes | **Read** (API supports; web focuses on comments) |
| Vibes (short video) | **Read**, playable detail |
| Vibe studio/audience/stats | Out of scope |
| Tags / trending | **Supported** (documented endpoint; 404 becomes "not on this server") |

## Moments

| Feature | Web |
| --- | --- |
| Tray (mine, unseen, seen) | **Core** |
| Story viewer with timed advance | **Core** |
| Mark seen | **Core** |
| React / reply / share | **Core** (react/reply) |
| Create moment from an uploaded image | **Core** |
| My moments, a user's moments | **Core** |
| Viewers / reactors | **Read** |
| Memories | **Read** (list + reactions where available) |
| Sound on a moment | **Core** playback in viewer |

## Convo (chat)

| Feature | Web |
| --- | --- |
| Thread list, unread, pinned/muted/vault flags | **Core** |
| Thread detail and message history | **Core** |
| Send text, image, video, voice/audio/doc | **Core** |
| Reply, edit, delete, forward | **Supported** |
| Reactions, polls | **Core** / **Supported** |
| Read receipts, typing | **Core** |
| Direct thread start from profile | **Core** |
| Groups: create, members, channels, invite, leave | **Core** |
| Realtime per-thread socket | **Core** |
| Vault (code lock) | **Missing** as a vault screen; thread flags are exposed where available |
| Offline sync | **Supported** via `/chat/sync/` on reconnect |
| Calls (audio/video) | Out of scope for this release (separate WebRTC build; docs recommend later) |

## Audio

| Feature | Web |
| --- | --- |
| Home (hero, recent, playlists, podcasts, artists) | **Core** |
| Track list, detail, stream | **Core** |
| Global persistent player | **Core** |
| Like, play signal | **Core** |
| Playlists list/detail/create, items, order | **Core** |
| Shared playlist links | **Read** public landing |
| Audio studio | Out of scope |

## Live (Spaces)

| Feature | Web |
| --- | --- |
| Room shelf | **Core** |
| Room detail, stage, audience | **Core** |
| Join / leave / raise hand / mute / stage | **Core** |
| Room chat and reactions | **Core** over socket |
| Create room, start, end | **Core** |
| Games | **Read** (open/join/play actions wired where documented) |

## Adjacent surfaces

| Feature | Web |
| --- | --- |
| Search (all, people, drops, places) | **Partial**; people and audio are wired, other scopes are absent |
| Alerts / notifications | **Partial**; follow/chat requests only, envelope unverified |
| Saved shelf | **Supported** (`/drops/saved/`) |
| Sparks, medals, wallet, theme shop | **Partial overall**; the theme shop/preview/buy flow is implemented, while Sparks, ladder and medals remain additional web tabs; backend tests and live purchase are unverified |
| Verify badge | **Missing** |
| Collabs | **Supported** (read badge + accept/decline) |
| Deals | Out of scope |
| Circles, Drip, Catalogue | Out of scope |
| Links unfurl | **Supported** in composers |
| Reco signals | **Supported** (play/view signals) |
| ML developer API, Console | Out of scope (staff/API products) |

## Native-only abilities not reproduced

Camera capture, device contacts, native push, QR scanning by the website (the phone scans), phone calls, background playback with OS controls. The website uploads files from the picker and uses the browser's MediaRecorder for voice notes where available.

The Android app does have an SQLite-backed offline store and queued sync work. The web client currently only performs reconnect synchronization; it does not provide equivalent durable offline messaging or action queues.

# Xelvic API Compatibility Report

Date: 2026-11-01
Backend (read-only): `xelvic/backend` — Django + DRF + Channels
Web client: `xelvic-web/src/config/axios.ts` (the one HTTP client) and the
`xelvic-web/src/services/` modules that call it

The mobile app and the web app share one backend. No endpoint, serializer,
migration, setting or contract was changed. This report records what the web
calls, the shape it expects, and any mismatch found.

## Conventions (verified in source)

- Base: `VITE_API_URL` + `/api/v1/` (`src/config/env.ts`), dialled through the
  shared axios instance in `src/config/axios.ts`.
- Auth: `Authorization: Bearer <access>` on everything except the anonymous QR
  doors and the public playlist route.
- Errors: `{"error": {"code", "message", "fields?"}}`.
- Lists: `{"results": [...], "next": "...", "previous": "..."}`; messages use
  `MessagePage`, 40 per page, newest first.
- IDs are UUID strings. Timestamps are ISO-8601 with timezone.
- Uploads: `POST /chat/assets/` multipart (`file`, client `upload_id`, `kind`,
  optional `thumb`, `width`, `height`, `duration_ms`), response `{asset}`.
- Sockets: `wss://<api-host>/ws/?token=<access>`; frames are `{event, data}`;
  actions are sent as `{action, ...}`.

## Chat contract used by the web

| Purpose | Method + path | Web caller | Status |
| --- | --- | --- | --- |
| Thread list | `GET /chat/threads/` | `ConvoPage` | MATCH |
| Thread detail | `GET /chat/threads/{id}/` | `ChatPage` | MATCH |
| New group | `POST /chat/groups/` | `ConvoPage` | MATCH |
| New DM | `POST /chat/threads/` `{user}` | `NewConvoPanel` | MATCH |
| Message page | `GET /chat/threads/{id}/messages/` | `ChatPage` | MATCH (newest first) |
| Send | `POST /chat/threads/{id}/messages/send/` | `ChatPage` | MATCH |
| Edit | `PATCH /chat/threads/{id}/messages/{mid}/` | `MessageOptions` | MATCH |
| Delete | `DELETE ...?scope=all` | `MessageOptions` | MATCH |
| React | `POST .../react/` | `ChatPage` | MATCH |
| Vote | `POST .../vote/` | `ChatPage` | MATCH |
| Forward | `POST .../forward/` `{threads:[ids]}` | added goal 4.5 | MATCH |
| Message info | `GET .../info/` (groups) | added goal 4.6 | MATCH |
| Media index | `GET /chat/threads/{id}/media/?kinds=` | `MediaSheet` | MATCH |
| Read | `POST /chat/threads/{id}/read/` `{ordinal}` | `ChatPage` | MATCH |
| Read all | `POST /chat/threads/read/` | `ConvoPage` | MATCH |
| Spark send | `POST .../messages/send/` `{kind: image|video, payload:{view_once:true}}` | `CameraCapture`, `ChatPage` | **FIXED** — `kind:"spark"` was sent before; the backend has no such kind, so every Spark from the web was refused. A Spark is an ordinary photo/clip with `payload.view_once`. |
| View-once open | `POST .../open-once/` | `ChatPage` `SparkViewer` | **FIXED** — was POSTing `/open/` (404, swallowed); now fetched bytes are loaded first, then `open-once/` is spent exactly once |
| View-once shot | `POST .../shot/` | rendered, not posted | The server mark (`payload.shot_at`) is rendered as the mobile shot line. A browser cannot detect a screenshot, so the web does not fabricate one and does not POST it. |
| Start direct | `POST /chat/threads/` `{user}` | `NewConvoPanel` | MATCH |
| Vault | `GET /chat/vault/`, `/unlock/`, `/reset/` | `ConvoPage`, `VaultModal` | MATCH |
| Thread flags/skin/clear/vanish | `/threads/{id}/flags|skin|clear|vanish/` | `ConvoSheet` | MATCH |
| Members / leave / invite | `/threads/{id}/members/...` | `ConvoSheet` | PARTIAL |
| Channels | `/threads/{id}/channels/` | `ChatPage` room bar | PARTIAL |
| Search | `GET /chat/search/?q=` | `ConvoPage` search field | MATCH (added) |
| Durable sync | `GET /chat/sync/?cursor=` | not used | MISSING (web) |

The direct-chat start route is `POST /chat/threads/` with `{user}`; it returns
`{thread, gate}` and may return `thread: null` when the gate is not open.

## Serializer shapes relied on

`Message` (verified in `chat/serializers.py`):

```
id, thread, channel, ordinal, kind, body, sender (UserCard), mine,
reply_to {id,kind,body,sender{id,name},deleted_for_all}, asset, payload,
poll, reactions [{emoji,count,users}], my_reaction, can_copy, held,
deleted_for_all, client_id, revision, edited_at, expires_at,
created_at, updated_at
```

`ThreadCard` (verified): `id, kind, title, avatar, other, preview {kind,text,at,
mine,held}, status, unread_count, unread_other_count, pinned, muted, vaulted,
spark_off, vanish_mode/at, wallpaper, tint, last_message_at, channels, locked,
invites_on, my_role, state_versions, member_count, self, sparks_count`.

Web type gaps found and addressed:

- `Message.pending` / `Message.failed` existed in `types/api.ts` but nothing
  ever set them. Goal 4.2 now uses them for optimistic sends.
- `client_id` is now used to reconcile the optimistic row with the server row
  (the backend deduplicates by `(sender, client_id)` and returns the same row).

`status` is authoritative: `Waiting | Sent | Delivered | Opened`, produced by
`services.outgoing_status`. The web previously defaulted to "Delivered" when
the field was absent, which was a fabricated receipt. Goal 4.3 fixes this.

## Socket events

Verified in `chat/events.py`, `chat/consumers.py`, `chat/services.py`:

| Event | Payload | Web handling |
| --- | --- | --- |
| `message.new` | `{thread_id, message}` | insert/dedupe by id; reconcile pending |
| `message.edit` | `{thread_id, message}` | replace |
| `message.gone` | `{thread_id, message_ids[]}` | remove |
| `message.react` | `{thread_id, message_id, emoji, reactions, user_id}` | patch |
| `message.poll` | `{thread_id, message_id, poll}` | patch |
| `thread.typing` | `{thread_id, user_id, typing, ttl}` | indicator |
| `thread.read` | seat watermarks | receipt word |
| `thread.update` | `{thread_id, unread, unread_other_count, preview?, at, notice?}` | **patched live (goal 4.7)**; `notice` feeds the in-app strip (goal 6.2) |
| `thread.members` / `thread.channels` | change notice | refetch detail |
| `alert.new` | `{alert: Alert}` | list cache patched; a hidden tab gets a system row (goal 6.3) |
| `alert.read` | `{unread}` | list cache patched |
| `presence` | `{user_id, online}` | header dot |

The `thread.update` notice is verified in `apps/chat/notices.py`: `thread,
title, group, room, from {id, username, name, verified, avatar, character,
theme, dp}, preview, row, kind, card, media {kind, thumb, content, ratio,
duration_ms, name, asset}, mention, by, ordinal, at, muted`. It is built for
every member except the sender, and is absent for a system note. The web reads
those fields and nothing else — there is no `link` or `account` on the socket
road, so the strip does not draw one.

**Push is not used by this build, and cannot be.** `apps/accounts/push.py` sends
through Firebase v1 to `Device.push_token`, and `POST /auth/devices/` accepts a
token — but registering one requires a Firebase web app config and a service
worker, neither of which exists here, and the backend is read-only. Goal 6.6 is
therefore recorded as BLOCKED rather than implemented behind a switch.

Client actions verified: `ping`, `presence`, `subscribe`, `unsubscribe`,
`away`, `typing`, `focus`, `read`, `delivered`, `send`, `react`.

The web uses HTTP for sending and the socket for receipt/typing/presence
acceleration. This is supported: `POST .../send/` returns the canonical
`Message`, and the socket echo is deduplicated by id.

## Endpoints used elsewhere (spot-checked)

Auth (`/auth/qr/*`, `/auth/me/*`, `/auth/devices/*`, `/auth/token/refresh/`,
`/auth/logout/`, `/auth/deactivate/`), social (`/social/*`), drops
(`/drops/*`), moments (`/moments/*`), audio (`/audio/*`), spaces (`/spaces/*`),
alerts (`/alerts/*`), sparks (`/sparks/*`), verify (`/verify/*`).

### Marketplace (route-by-route, checked 2026-11-01)

The marketplace is the one place where the web calls six endpoints that nothing
else on the web called before, so each is confirmed against the read-only
backend rather than assumed. Mounting prefixes are from `config/urls.py`:

| Web call | Backend route | Source |
| --- | --- | --- |
| `GET /catalogue/` | `path("api/v1/catalogue/", include("apps.studio.urls"))` → `path("", CatalogueView.as_view())` | `config/urls.py:198`, `apps/studio/urls.py:15` |
| `POST /catalogue/figure-pick/` | `path("figure-pick/", FigurePickView.as_view())` | `apps/studio/urls.py:16` |
| `GET /drip/`, `POST /drip/buy/`, `POST /drip/wear/`, `POST /drip/profile/` | `path("api/v1/drip/", include("apps.drip.urls"))` + the four routes | `config/urls.py:194`, `apps/drip/urls.py:8-11` |
| `POST /sparks/wallet/buy/` | `path("wallet/buy/", BuyThemeView.as_view())` | `apps/sparks/urls.py:16` |
| `POST /sparks/wallet/buy-logo/` | `path("wallet/buy-logo/", BuyLogoView.as_view())` | `apps/sparks/urls.py:17` |
| `PATCH /auth/me/logo/` | `path("me/logo/", me.LogoView.as_view())` | `apps/accounts/urls.py:68` |

`GET /sparks/wallet/` and `PATCH /auth/me/theme/` were already in use by the
Sparks page and the theme provider. **No endpoint was added, renamed or
extended for the marketplace, and no backend file was modified.** Every write is
followed by a read of the shelf (the purchase answers with a price and a
balance, never with the new shelf), so nothing is optimistic and nothing is
claimed before the server agrees.

### Moments (route-by-route, checked 2026-11-01)

Moments is the second place where the web calls routes nothing else called, so
each is confirmed against the read-only backend. Everything is under
`path("api/v1/moments/", include("apps.moments.urls"))`
(`config/urls.py:175`), so the paths below are relative to
`backend/apps/moments/urls.py`.

| Web call | Backend route | Source |
| --- | --- | --- |
| `GET /moments/tray/` | `path("tray/", TrayView)` | `urls.py:8`, `views.py:140` |
| `GET /moments/mine/` | `path("mine/", MomentListView)` | `urls.py:12`, `views.py:283` |
| `GET /moments/users/{username}/` | `path("users/<str:username>/", UserMomentsView)` | `urls.py:13`, `views.py:249` |
| `POST /moments/silence/` | `path("silence/", MomentSilenceView)` | `urls.py:11`, `views.py:485` |
| `POST /moments/` (post a day) | `path("", MomentListView)` | `urls.py:40`, `views.py:283` |
| `GET /moments/{id}/` | `path("<uuid:pk>/", MomentDetailView)` | `urls.py:41`, `views.py:457` |
| `DELETE /moments/{id}/` (Take down) | same route, `delete` | `urls.py:41`, `views.py:457` |
| `POST /moments/{id}/seen/` | `path("<uuid:pk>/seen/", MomentSeenView)` | `urls.py:42`, `views.py:476` |
| `POST /moments/items/{id}/seen/` | `path("items/<uuid:pk>/seen/", MomentItemSeenView)` | `urls.py:70`, `views.py:511` |
| `GET /moments/{id}/viewers/` | `path("<uuid:pk>/viewers/", MomentViewersView)` | `urls.py:43`, `views.py:531` |
| `POST /moments/{id}/reply/` | `path("<uuid:pk>/reply/", MomentReplyView)` | `urls.py:44`, `views.py:558` |
| `POST /moments/{id}/react/` | `path("<uuid:pk>/react/", MomentReactView)` | `urls.py:50`, `views.py:571` |
| `GET /moments/{id}/reactors/` | `path("<uuid:pk>/reactors/", MomentReactorsView)` | `urls.py:51`, `views.py:595` |
| `POST /moments/{id}/share/` (gate, then deed) | `path("<uuid:pk>/share/", MomentShareView)` | `urls.py:53`, `views.py:631` |
| `POST /moments/{id}/carry/` | `path("<uuid:pk>/carry/", MomentCarryView)` | `urls.py:55`, `views.py:652` |
| `POST /moments/items/{id}/vote/` | `path("items/<uuid:pk>/vote/", MomentItemVoteView)` | `urls.py:75`, `views.py:717` |
| `GET /moments/items/{id}/voters/` | `path("items/<uuid:pk>/voters/", MomentItemVotersView)` | `urls.py:79`, `views.py:738` |
| `GET /moments/awaiting/` | `path("awaiting/", AwaitingView)` | `urls.py:28`, `views.py:862` |
| `GET /moments/memories/` | `path("memories/", MemoryListView)` | `urls.py:15`, `views.py:835` |
| `POST /moments/memories/` | same route, `post` | `urls.py:15`, `views.py:835` |
| `PATCH /moments/memories/{id}/` | `path("memories/<uuid:pk>/", MemoryDetailView)` | `urls.py:16`, `views.py:889` |
| `DELETE /moments/memories/{id}/` (Remove) | same route, `delete` | `urls.py:16`, `views.py:889` |
| `GET /moments/memories/users/{username}/` | `path("memories/users/<str:username>/", UserMemoryView)` | `urls.py:29`, `views.py:1049` |
| `POST /moments/memories/{id}/reply/` | `path("memories/<uuid:pk>/reply/", MemoryReplyView)` | `urls.py:31`, `views.py:963` |
| `POST /moments/memories/{id}/react/` | `path("memories/<uuid:pk>/react/", MemoryReactView)` | `urls.py:33`, `views.py:983` |
| `GET /moments/memories/{id}/reactors/` | `path("memories/<uuid:pk>/reactors/", MemoryReactorsView)` | `urls.py:35`, `views.py:1001` |
| `POST /moments/memories/{id}/share/` (gate, then deed) | `path("memories/<uuid:pk>/share/", MemoryShareView)` | `urls.py:37`, `views.py:1032` |

Three contract points were checked rather than assumed, because each one is a
rule the viewer would otherwise get wrong:

1. **The tally is the author's.** `services._reactions` sends a non-owner
   `{count: 0, counts: {}, mine}`. The web therefore draws the answers row and
   opens every sheet behind it (viewers, reactors, voters) on my own day only —
   it does not invent a number for somebody else's story, and it does not draw
   the "Who chose what" section to a reader the server refuses to name them for.
2. **Share is a question and then a deed.** `POST /moments/{id}/share/` with no
   body returns whether the account may share it at all; `{thread}` is the send.
   A private account's refusal arrives as the server's own refusal, so the web
   never opens a picker whose Send would fail.
3. **Marking watched is per item, and the day is marked on its last one.**
   `items/{id}/seen/` is called as each item comes up (which is what lets the
   next open of the same person resume), and `{id}/seen/` on the item that ends
   the day.

**No endpoint was added, renamed or extended for this pass, and no backend file
was modified.** Reads performed: `apps/moments/urls.py`, `apps/moments/views.py`,
`apps/moments/services.py`, `config/urls.py`.

Routes that exist and the web still does not call (recorded, not used):
`items/{id}/content/` + `thumbnail/` + `sound/` (the web plays moment media
through the media pipeline it already has), `options/{id}/content/` +
`thumbnail/` (a poll option's picture), and `memories/{id}/cover/` +
`cover/thumbnail/` (the Memory serializer already sends absolute signed
`content_url` / `thumbnail_url` on `cover_upload`, so the web draws the cover
straight from the payload and never asks for the bytes separately).

The Memory write contract was read rather than assumed: `MemoryEditSerializer`
takes `title`, `items` (the ones to **add**, not the whole list), `cover` and
`cover_upload`, every key optional, and absent means "leave it". The web's
`editMemory(id, patch)` builds its body key by key for exactly that reason, and
`AddToMemories` with `into` set sends only `{items}`.

### Circles (route-by-route, checked 2026-11-01)

Circles is the third place where the web calls routes nothing else called.
Everything is under `path("api/v1/circles/", include("apps.circles.urls"))`
(`config/urls.py:191`), so the paths below are relative to
`backend/apps/circles/urls.py`.

| Web call | Backend route | Source |
| --- | --- | --- |
| `GET /circles/fields/` | `path("fields/", FieldsView)` | `urls.py:15`, `views.py:96` |
| `POST /circles/pick/` | `path("pick/", PickView)` | `urls.py:16`, `views.py:113` |
| `GET /circles/mine/` | `path("mine/", MineView)` | `urls.py:21`, `views.py:131` |
| `GET /circles/{id}/` | `path("<uuid:pk>/", CircleView)` | `urls.py:23`, `views.py:142` |
| `POST /circles/{id}/` (a take) | same route, `post` | `urls.py:23`, `views.py:149` |

Three contract points were checked rather than assumed:

1. **A take is an ordinary drop.** `CircleView.post` (`views.py:149-160`) runs
   `apps.drops.views.write_fields` on the body and then `services.post`, so the
   web sends its normal drop payload and nothing circles-only. The one line in
   that mapping that is a permission — which upload may be named — is the
   server's, and `services/circles.service.ts` deliberately does not restate it.
2. **The board is the feed's card.** `_day` (`views.py:56-88`) serialises
   `services.board(...)` through the feed's own `DropSerializer` and already
   ranked (likes, then whoever got there first), so `CirclePage` draws
   `DropCard` and does not re-sort. `read={false}` follows the app's own
   `DropCard(read: false)` — a board nobody opened counts no looks.
3. **A sealed day has no task, and `open` cannot say why.** `task` is null until
   `opens_in` reaches zero (`views.py:85-86`), and `open` is false both before
   the window and after it; the web reads `opens_in` to tell the two apart
   rather than guessing from `open` alone (`parts.tsx` — `StatusLine`,
   `opensAt`).

**No endpoint was added, renamed or extended for this pass, and no backend file
was modified.** Reads performed: `apps/circles/urls.py`,
`apps/circles/views.py`, `apps/circles/serializers.py`, `apps/circles/services.py`,
`apps/drops/views.py` (`write_fields`), `config/urls.py`.

## Audio shelves, the studio and rooms (route-by-route, checked 2026-11-01)

The Audio and Live pass added calls to routes nothing else on the web called, so
each is confirmed against the read-only backend. Mounting prefixes are from
`config/urls.py:181-182`: `api/v1/audio/` → `apps.audio.urls`, `api/v1/spaces/`
→ `apps.spaces.urls`.

| Web call | Backend route | Source |
| --- | --- | --- |
| `GET /audio/board/` | `path("board/", BoardView)` | `apps/audio/urls.py:10`, `views.py:185` |
| `GET /audio/categories/<key>/` | `path("categories/<str:key>/", CategoryShelfView)` | `urls.py:18`, `views.py:889` |
| `GET /audio/feed/` | `path("feed/", AudioFeedView)` | `urls.py:22`, `views.py:858` |
| `GET /audio/studio/` | `path("studio/", StudioListView)` | `urls.py:24`, `views.py:1001` |
| `GET /audio/studio/<uuid>/` | `path("studio/<uuid:pk>/", StudioDetailView)` | `urls.py:25`, `views.py:1011` |
| `GET /audio/studio/<uuid>/audience/?days=` | `path("studio/<uuid:pk>/audience/", StudioAudienceView)` | `urls.py:27`, `views.py:1024` |
| `GET /spaces/?shelf=kept` | `path("", RoomListView)`; the shelf map names `live`, `kept`, `upcoming`, `mine` | `apps/spaces/urls.py:13`, `views.py:29-55` |
| `POST /spaces/` (open or announce) | same route, `post` | `urls.py:13` |
| `POST /spaces/<id>/start|end|leave|hand|stage|dismiss|mute|camera/` | the named act routes | `urls.py:21-30` |
| `POST /spaces/<id>/share/` `{thread}` | `path("<uuid:pk>/share/", RoomShareView)` | `urls.py:31` |
| `POST /spaces/<id>/game/{open,join,play,again,close}/` | the five board routes | `urls.py:32-40` |
| `GET /spaces/games/` | `path("games/", GamesView)` | `urls.py:17` |

Studio shapes relied on (`apps/audio/studio.py`): sums over
`impressions, starts, qualified, completes, skips, replays, saves, shares, uses,
listen_ms`; every rate is `null` when its denominator was zero; `used_by.countries`
is `null` for an uploaded sound (not recorded) and `[]` when the read found none;
rights are `{playable, promotable, savable, shareable}`; somebody else's id is a
404. The web draws each of those as absence — "Not measured", "Not recorded." —
and never as a zero or an empty list.

**No endpoint was added, renamed or extended for this pass, and no backend file
was modified.** Reads performed: `apps/audio/urls.py`, `apps/audio/views.py`,
`apps/audio/studio.py`, `apps/spaces/urls.py`, `apps/spaces/views.py`,
`config/urls.py`.

## Known backend capabilities the web does not use yet

These are real server features without a web caller. They are **not** contract
mismatches; they are implementation gaps tracked in the parity matrix.

- `/chat/sync/?cursor=` — durable replay after a long disconnect.
- `/chat/sparked/`, `/threads/{id}/sparks/` — Spark runs.
- Group invites preview/join by code.
- `/audio/trending/` and `/audio/tracks/` are called, but the app's full-screen
  swipe deck over the reco rows and its downloads door are not drawn here.
- Room media: the app's stage audio and video travel over the `call.signal`
  relay (`stage.dart`). The web now has a WebRTC client — the one the calls are
  drawn on (2026-11-06) — but the room page is not wired to it, so this build
  still uses everything on the room except the media itself.
- `call.add` and `DELETE /calls/<id>/`: both are real and both are unused here.
  A call the web joins can be drawn with more than two seats (the server's own
  party frame is followed as it arrives), but nothing on this client starts a
  group call or adds a third person, and the history rows have no "remove".
- `POST /drops/<id>/play/` — the play signal the phone sends
  (`app/lib/audio.dart:1975`). Nothing under `src/` calls it (2026-11-06), so a
  sound played in the browser does not advance `plays` and the poster's own
  numbers do not include it. `NOT IMPLEMENTED`, and a silent omission rather than
  a claim on screen.
- `GET /drops/mine/` and `GET /drops/interests/` — an own-posts shelf and the
  interests a post carries. Neither is called (2026-11-06), so there is no "my own
  posts" shelf and a post made here carries no interests and cannot be filed.
  `NOT IMPLEMENTED`.
- A Vibe's `recipe` and `clip_urls` — the edit document (the clips it names, the
  voiceover and music lanes, each clip's trim and speed, the overlays, the filter
  and the frame shape) and the addresses of the uploads it names. Both are sent by
  the server and read by **nothing** here (2026-11-06), so a Vibe edited on the
  phone plays on the web as its first clip alone. `NOT IMPLEMENTED`, and recorded
  in `XELVIC_FEATURE_PARITY_MATRIX.md` rather than left implied.
- Deals, collabs modules. (Circles and the marketplace's routes are now used —
  see the tables above.)

## Contract mismatches fixed in this pass

1. `POST /messages/{id}/open/` → `POST /messages/{id}/open-once/`.
2. Conversation rows discarded the last-message preview and rendered
   "Nothing new"; now render the real preview and unread count.
3. Receipt label defaulted to "Delivered" without server evidence; now uses
   `thread.status` / member watermarks, otherwise "Sent".
4. `thread.update` frames triggered a full list refetch and lost the carried
   preview; now the card is patched and re-sorted in place.
5. Spark send used `kind: "spark"`, which the backend does not define; now an
   ordinary `image`/`video` send with `payload.view_once: true`.
6. Spark detection read invented payload flags and browser-local opened state;
   now reads `payload.view_once` (the server's flag) and `payload.opened_at`
   (the server's mark) only. `Spark · sent / opened / gone` and the shot line
   come from those two fields.

## Contract mismatch fixed on 2026-11-06 (drops round)

1. `POST /reco/signals/` was told `kind: "vibe"` for **every** row a walk drew.
   The app writes `'kind': row.isVibe ? 'vibe' : 'drop'` (`lib/reco.dart`, both
   for `served` and for a view), and the server resolves an id against the table
   its `kind` names: `_KINDS = {"drop": Drop, "vibe": Vibe, "track": Track}` in
   `apps/reco/services.py`, with `_existing` dropping any id that table does not
   hold. Nothing noticed while only a shelf was reported — every row a shelf
   holds *is* a Vibe. It became reachable when a plain video in the feed began
   opening in the walk, which is a `Drop` and not a `Vibe`: sent as a `vibe` its
   impression and its view would have been dropped in silence, and the creator's
   studio would have drawn a clip that was watched as never watched. `reco.ts`
   now sends each row's own `kind`. No backend change: the contract was always
   this, and the client was the half that was wrong.

## Contract mismatches fixed on 2026-11-02 (fifth round)

1. `Sticker.keywords` was typed `string[]`. The column is a `CharField` and
   `StickerSerializer` sends it as the comma-separated string it is stored as, so
   the type described something this server never sends. It is `string` now.
   Nothing read it until the sticker shelf's own search did.
2. The editor's audio sheet asked `/audio/tracks/` for `limit=100&page_size=100`
   and then walked `count` / `next` / `next_page`. `TrackListView`
   (`apps/audio/views.py:503`) has no cursor: it answers `{tracks, query}` and
   slices to `min(limit, 500)`, default 200. The walk therefore stopped after one
   page and the picker held 100 songs where the phone's holds 200. One ask for
   the server's own ceiling, and no paging.
3. `payload.sticker` was read as a string and drawn as text, so a real sticker
   from the phone rendered `"[object Object]"`. The phone sends an ordinary
   `text` line whose payload carries `{id, url, name}` (`_sendSticker`,
   `chat.dart`), and that is what this client now sends and draws. The invented
   `kind === "sticker"` was dropped: the app never sends that kind, and the web
   was using it to mark a row bare and then draw nothing in it.

## A third-party host this client now reads

`https://sticker.gaongram.in/api/stickers` is the shelf `app/lib/editor/stickers.dart`
reads first, before our own `/api/v1/stickers/`. It is **not** a Xelvic backend
route and it is not reached through our API:

- Public and token-free by design — no `Authorization` header is sent, and
  nothing of the session goes with the request.
- It answers `access-control-allow-origin: *` (measured 2026-11-02), so a browser
  can call it directly without a proxy, and its pictures are Cloudinary URLs that
  answer the same header, so the editor's canvas stays untainted.
- It is the *fallback* that matters if it ever goes away: a refusal is remembered
  for the session and every picker then reads our own `/api/v1/stickers/`, which
  is what the phone does too.

## Verification limits

No authenticated session against a running backend was executed in this
environment (no credentials and no local Postgres/Redis stack started). All
shapes above were verified statically against the read-only backend source;
runtime behaviour is marked unverified where applicable in
`XELVIC_TESTING_REPORT.md`.
## Contract mismatches fixed on 2026-11-02 (sixth round)

1. **The editor's sound sheet asked the wrong shelf.** It called
   `GET /audio/tracks/` with no `source`, and `TrackListView.get` keeps the
   catalogue on that path — its own docstring says so: "Omitting it keeps the
   catalogue, which is what this route has always answered." The catalogue is the
   songs and episodes the app shipped with; the sheet is for sounds somebody
   posted, which is the `source=drop` branch above it. Then, when that read came
   back empty, the sheet fell back to the Audio tab's `recent`/`podcasts`/`hero`,
   which is a third list again. The catalogue is small — `seed_audio.py` ships
   four songs and two episodes — so that path draws a short list of exactly the
   shape that was reported; which of the two lists a given short list came from
   cannot be told without the live database, but neither is the uploads shelf.
   The
   sheet now asks `source=drop`, in `src/features/audio/audioShelf.ts` (it was
   `src/features/camera/audioShelf.ts` until the sound code was lifted out of the
   camera on 2026-11-05), with
   `limit=60` — the phone's own `kPickerRows`
   (`app/lib/screens/audio_picker.dart`) — and there is no fallback.

   The two branches do not even cap the same way, which is the other half of why
   the lists differed in length:

   ```text
   source=drop      limit = max(1, min(<limit> or 60,  100))   sound_row(drop)
   no source        limit = max(1, min(<limit> or 200, 500))   services.rows(...)
   ```

2. **The bookmark on a sound posted to a route that does not exist.**
   `PhotoEditor.tsx` filed an uploaded sound with
   `POST /api/v1/drops/{id}/save/`, and there is **no `save` route anywhere under
   `apps/drops/`** — `apps/drops/urls.py` has none, and neither has any other
   urlconf. Every Save on an upload was a 404 wearing a success toast. The one
   write that puts anything on the shelf is `POST /saved/` with `{kind, id, on}`
   (`apps/saved/views.py`, id parsed as a UUID), which the web already had a store
   for — `src/store/saved.ts` and `hooks/useSaved.ts` — and which this file simply
   was not using. It uses it now. The catalogue-row path went to
   `/audio/tracks/{id}/like/`, which is the *heart* and not the shelf, and that
   whole dance (`likeCandidates`, `streamTrackId`, `streamDropId`, the candidate
   404-walking) is gone. So is `dropsService.save` itself, and the
   `DropSaveResponse` type it answered, with a comment left in their place: the
   editor was the last caller, and a `save` shaped exactly like `like` and `hide`
   is how the wrong address gets written twice.

3. **`Track` was missing three fields every row carries.** `TrackListView` and
   the weekly board put `source`, `artist_id` and `artist_avatar` on every row
   (`services.sound_row`, `services.rows`), and `src/types/api.ts` declared none of
   them. Without `source` the client cannot tell an upload from a catalogue track,
   which is exactly the question the bookmark has to answer: the app's
   `AudioTrack.savedKind` is `fromDrop ? 'drop' : 'track'`, and a row filed under
   the wrong one is a row the shelf's own read never finds.

**No endpoint was added, renamed or extended for this pass, and no backend file
was modified.** Reads performed: `apps/audio/urls.py`, `apps/audio/views.py`
(`TrackListView`, `AudioHomeView`, `TrendingView`, `BoardView`),
`apps/audio/services.py` (`sound_row`, `_board_row`, `uploads`, `catalogue`,
`home`, `trending`), `apps/saved/views.py`, `apps/drops/urls.py`.

## No contract change on 2026-11-02 (eighth round)

The eighth round fixed two client-side faults — the drops feed's two query
options objects drifting apart (the prefetcher's copy had no
`getNextPageParam`), and four overlays save/restoring `body.style.overflow`
instead of holding one counted lock. Neither touches an address, a field or a
response shape: the round read no backend file, added no endpoint and changed no
type in `src/types/api.ts`. The endpoint this pass does lean on —
`/drops/?seen=strict`, whose `next` cursor the page rule turns back into a
path — is the one recorded above.

## No contract change on 2026-11-02 (ninth round)

The ninth round repainted the camera's editor: every tool panel, every control on
one and the sticker sheet now draw on the theme's card and ink instead of a
hardcoded charcoal (`PANEL`/`CHIP`/`CHIP_OFF`/`CHIP_ON` in
`src/features/camera/PhotoEditor.tsx`), and `inkOn()` in `editorTypes.ts` picks
the ink for the pills painted in the colour they choose.

No address, field or response shape moved. The round **read no backend file**,
added no endpoint, and changed no type in `src/types/api.ts`. It did read one
mobile file for the comparison — `app/lib/screens/editor/image_editor.dart`, whose
`_chrome` makes every tool's sheet charcoal in every theme — and wrote nothing to
it. The divergence that comparison exposes is recorded in
`XELVIC_FEATURE_PARITY_MATRIX.md` and not here, because it is a design difference
between the two clients and not a difference in what either asks the server for.

## No contract change on 2026-11-03 (tenth round) — three routes newly read

The tenth round rebuilt the convo row's line, its unread count and the Spark a row
opens. No address, field or response shape moved: the backend is read-only and
was **written to nowhere**.

What the web began reading, all of it pre-existing and in use by the phone:

| Route | Used for | Shape taken |
| --- | --- | --- |
| `GET /api/v1/sparks/threads/<id>/` | the Spark sheet's fresh read | `spark` |
| `POST /api/v1/sparks/threads/<id>/off/` | the hide switch | `{off}` → `{spark_off, spark}` |
| `POST /api/v1/sparks/threads/<id>/restore/` | buying a broken run back | → `{spark, wallet: {balance, earned, spent, owned}}`; a 400 carries the server's own sentence |

Confirmed in `backend/apps/sparks/urls.py` and matched against the phone's own
requests in `app/lib/sparks.dart`. The client's axios `baseURL` is `/api/v1`, so
the paths above are the ones on the wire.

Two card fields the web already typed but had not used are now read, and one that
it did not type was added:

- `ThreadCard.unread_other_count` — the part of the count that is not an unread
  Spark; the Unread lane's membership reads it (`inUnreadLane`). Confirmed in
  `ThreadCardSerializer`'s `fields`.
- `ThreadCard.pinned` — the row's pin mark.
- `UserCard.birthday` — `MM-DD` on **every** user card, not only the convo row,
  from `UserCardSerializer.get_birthday` (which routes through
  `services.birthday_month_day`, and therefore through the owner's `show_dob`).
  The type in `src/types/api.ts` was missing it; nothing about the server
  changed.

`Spark`'s type gained the fields the sheet reads (`broken`, `offer`, `ladder`,
`hold_until`, `mine_last`, `theirs_last`, `mine_left`, `theirs_left`,
`timer_mine`, `timer_theirs`). Each is on the payload the phone already consumes
in `app/lib/sparks.dart`; none was invented here, and a payload without any of
them draws from what it does carry rather than guessing.

## No contract change on 2026-11-04 (eleventh round) — `POST /moments/` newly used by this path

The eleventh round drew the Spark sheet's "Add to Moments" pill and the composer
behind it. No address, field or response shape moved: the backend is read-only
and was **written to nowhere**.

The composer ends at two routes that both already existed and are both in use by
the phone's `postMomentNow`:

| Route | Used for | Shape taken |
| --- | --- | --- |
| `POST /api/v1/chat/assets/` (multipart) | the painted card, uploaded as an image asset | `{asset: {id, …}}`; the client sends `file`, `upload_id`, `kind`, and for an image the `width`/`height`/`thumb` it measured — `uploadAsset` in `utils/upload.ts`, unchanged by this round |
| `POST /api/v1/moments/` | the moment itself | `{items, audience, audience_users?}` — one item `{kind: "image", asset, mentions?: [id]}`, with `mentions` present only when the phone's two-step rule names somebody (the run's own `other`, else the one live run's `other`; nobody when two are alive, when the only run is hidden, or when the answer would be me) |

`PostItemSerializer` in `backend/apps/moments/serializers.py` also accepts
`sound`, `sound_start_ms` and `sound_end_ms` on an item — the three fields the
phone's sound row fills. **As of 2026-11-05 this client sends all three**, on the
same rules the phone's own write uses: `sound` is the asset id of the chosen
sound (a shelf row already carries one, and a row off the person's own device is
uploaded with `POST /api/v1/chat/assets/` first, exactly as `CameraCapture.postMoment`
does), `sound_start_ms` is where the part begins and `sound_end_ms` where it ends.
The two integers are computed by `features/audio/audioWindow.ts` and every path
out of the part chooser holds them inside the file's measured length — the
server bounds the start at `MAX_SOUND_START_MS` but does not check it against the
track's own length, on its own stated reasoning that a position is not a
duration, so keeping the window inside the file is this side's job. An item with
no sound chosen sends none of the three, which is the shape the phone sends when
no sound was chosen.

Nothing else was read from the backend this round: `serializers.py` was read for
those confirmations and written to nowhere.

## No contract change on 2026-11-04 (twelfth round) — and no request changed either

The twelfth round fixed the composer's card not being drawn: it awaited the app's
font and the two faces with no bound, so a media read that never answered held the
paint for ever. Both waits are now bounded (`FACE_PATIENCE_MS`, the phone's
`Faces.patience`; `FONT_PATIENCE_MS`).

The bound is on **waiting**, never on the request. The shared read is left
running — `utils/mediaCache.ts` keeps fetching for every other avatar on the
screen — so this round added no request, removed none, cancelled none, and
changed no header, timeout or body. `within()` is deliberately not
`AbortSignal.timeout`: aborting one card's read would have failed the same avatar
everywhere else in the app, and the whole point of the media cache is that one
tab asks once.

## No contract change on 2026-11-04 (thirteenth round) — and one request gained a header

The thirteenth round fixed what the twelfth left: the page said it could not draw
the card. A public avatar address comes back from `mediaCache.loadMedia`
**untouched** (it is not a path this API serves), so the painter drew a
cross-origin picture into its canvas without `crossOrigin`, the canvas was
tainted, and `toBlob` threw `SecurityError`.

The only request this changes is the browser's own `<img>` fetch for a face:
`faceImage` now sets `crossOrigin = "anonymous"` on any `http(s)` address. That
is an attribute on the element, not a change to a client request — no address,
body, response shape, timeout or header set by this code moved, and nothing was
written to the backend.

It does have a server-side consequence worth recording honestly: a host that
serves a picture **without** `access-control-allow-origin` will now fail to load
it as a face, where before it loaded and poisoned the canvas. The card treats
that as a face that did not come and draws initials, which is the only outcome
that still posts. Measured on a browser here: plain draw → tainted, `toBlob`
throws; the same URL with the attribute at a host sending
`access-control-allow-origin: *` → 588 clean bytes. Whether this API's avatar
hosts send the header could not be checked from here, and is the one open
question this round leaves — see the testing report's runtime status.

The one HTTP fact worth recording from it is not a change but a bound that
already existed and was relied on: a stalled media read in the app ends on the
axios client's own 120-second timeout (`REQUEST_TIMEOUT_MS`), doubled once by the
401 renewal in `config/axios.ts` — a minute-long window in which the card used to
show nothing at all.

## No contract change on 2026-11-05 (fourteenth round) — the four card looks

The fourteenth round redrew the four alternate Spark card styles to a design
sheet. It touched one file, `src/features/sparks/card.ts`, and its test.

**No request, address, body, header, timeout or response shape moved.** The card
is painted locally into a canvas and encoded to a `File`; the only network the
path touches is the same one it touched before — the media cache's own reads for
the two faces, and `uploadAsset` → `POST /moments/` when the composer posts. The
four looks change what is drawn into the canvas and nothing about how the bytes
leave it.

Four looks the phone does not have is a **client-side divergence, not a contract
divergence**: the backend has no notion of a card style, and nothing in this
round asks it to. `POST /moments/` receives the same PNG it always did.

## Calls on 2026-11-06 — three routes and seven socket actions newly used

The round that drew real audio and video calling on the web. No address, field
or response shape moved: the backend is read-only and was **written to nowhere**.

The relay's own address and the two call reads, all pre-existing and all in use
by the phone (`app/lib/calls.dart`, the state machine this port follows):

| Web call | Backend route | Source | Shape taken |
| --- | --- | --- | --- |
| `GET /api/v1/calls/ice/` | `path("ice/", IceConfigView)` | `apps/calls/urls.py:10`, `views.py:21` | `{iceServers: [...]}` — handed to `RTCPeerConnection` as it arrives. A missing or non-array value reads as `[]` rather than throwing: the browser's own default is then used, which is a call that may fail to connect, not a call that throws on the way in |
| `GET /api/v1/calls/history/` | `path("history/", CallHistoryView)` | `urls.py:12`, `views.py:64` | `CursorPage` of `services.log_row` rows — the convo tab's call lanes, unchanged by this round |
| `GET /api/v1/calls/<uuid>/` | `path("<uuid:pk>/", CallDetailView)` | `urls.py:13`, `views.py:37` | `{call: party, me: id}` — asked when a live call's socket comes back, so a page that slept through `call.joined` finds out who is here instead of guessing |

Confirmed against the consumer's own branches (`apps/chat/consumers.py:887-939`),
which is where a call actually lives. Every action the web sends is one of them,
and each takes exactly the keys the web sends:

| Socket action the web sends | Keys | Why |
| --- | --- | --- |
| `call.ring` | `{user, kind}` | a fresh call, or `kind: "video"` for one that starts with cameras on |
| `call.accept` | `{call}` | picking up |
| `call.decline` | `{call}` | turning a ring down |
| `call.leave` | `{call}` | hanging up, and the goodbye after a call ends elsewhere |
| `call.video` | `{call}` | the first camera goes on, which makes the call a video call |
| `call.signal` | `{call, to, data}` | every offer, answer and candidate |
| `call.pending` | — | asked the moment the socket comes up and on every return to the front |

`call.signal` is the one that matters most and the one with a bound worth
recording: `_call_relay` is fire-and-forget by the consumer's own comment — no
`call.ok`, because an offer is already on its way to the other phone — so the
web sends it with a bare `send` and **never waits for an ack it will not get**.
The only other thing that travels this way is `call.pending`, which is answered
by the ring frame itself or by silence, and is likewise sent without a `ref`.

Confirmations on the shapes the engine leans on:

- The refusal shape is the socket's ordinary one — `{"event": "error",
  "data": {"code", "message", "ref"}}` — and the web matches it by `ref` and
  turns `message` into the line under the title, so a refusal from the server is
  what the person reads rather than an invented one.
- `ring_seconds` rides on the party frame (`services.party`), and the web times
  the ring from it rather than from a constant of its own: both ends then give
  up on the same clock, which is the only way "No answer" can be true on both
  phones at once. `DEFAULT_RING_SECONDS = 45` is used only when the field is
  absent.
- `party.members[].name` / `.username` / `.avatar` are always present —
  `seat.user.name or seat.user.username` on the server — so the web types them
  as required and never draws a seat from a guessed name.
- `call.incoming` carries `from` and `added`, and both are read: `added` is what
  tells a fresh ring apart from a person being pulled into a call already
  running, which is drawn as a different line.

**Not used by this client:** `call.add` (nothing here starts a group call or
adds a third person) and `DELETE /calls/<id>/` (the history rows have no
remove). Both are recorded in the gaps list above rather than left implied.

**No endpoint was added, renamed or extended for this pass, and no backend file
was modified.** Reads performed: `apps/calls/urls.py`, `apps/calls/views.py`,
`apps/calls/services.py`, `apps/chat/consumers.py` (`call.*` branches),
`apps/chat/events.py` (`CALL_*`), `config/urls.py`.

## No contract change on 2026-11-06 (Round 18) — one server constant newly read

The round that added a ring, a call notice, camera quality, a new call layout and a
live room's sound. **No request, address, body, header, timeout or response shape
moved, and no endpoint was added, renamed or extended.** The backend is read-only
and was written to nowhere.

Four of the five additions never touch the network at all. The ring
(`src/features/calls/ring.ts`) plays a recording this build serves itself and, when
that will not play, writes a tone through the Web Audio API — no request. The
notice (`src/features/calls/notice.ts`, `public/call-sw.js`) uses the browser's own
`Notification` surface and a service worker that deliberately has no fetch handler
— no request. Camera quality (`src/features/calls/quality.ts`) reaches only
`getUserMedia`, `RTCPeerConnection.getStats` and `enumerateDevices` — no request.
The layout is `CallOverlay.tsx` alone — no request.

The room's sound is the one that could have been a contract change, and is not. A
room's stage is a `calls.Call` on the server, so it travels over the same relay an
ordinary call uses: the same socket actions, the same `call.signal` carry and the
same `GET /calls/ice/` for the relay's address. No room-specific route was needed,
and `spaces/urls.py` did not grow one.

One server constant is now relied on from the client rather than read:

| Client | Value | Source read | Note |
| --- | --- | --- | --- |
| `src/features/rooms/RoomSoundView.tsx` | `MEDIA_LISTENERS = 8` | `backend/apps/spaces/services.py` | the number of listeners the relay carries beside the stage. No route reports it, so this is a **client-side copy of a server constant** and will drift silently if the server's value moves — recorded here rather than left implied |

Confirmed by reading `backend/apps/spaces/services.py`, and nothing else: the
`room_row(..., media=True)` shape is the row the room page already asks for and
carries the stage's call; `_hears` is the membership rule the page's own limit line
mirrors; `_go_live` and `_sync_call` are the two writes that put the stage on the
relay. **Reads performed: `backend/apps/spaces/services.py`.** No backend file was
modified.

## No contract change on 2026-11-06 (Round 19) — one feed field newly read, two Vibe fields known but unread

The round that added a mirror control to a call's picture and a room's tile, made
a card's picture fit the screen, and wove Vibes into the feed. **No request,
address, body, header, timeout or response shape moved, and no endpoint was added,
renamed or extended.** The backend is read-only and was written to nowhere.

One field this client now reads that it did not before:

| Field | Where | What the web does with it |
| --- | --- | --- |
| `vibe_share` | the `GET /drops/` page (`apps/drops/services.py:feed_vibe_share`; 0.20 for a reader it knows, 0.40 for a cold start) | the share of a page of ten that the client weaves a Vibe into (`src/features/drops/mix.ts`, `src/pages/DropsPage.tsx`). Until this round the field was sent and ignored, so the feed never carried a Vibe. The client falls back to the app's 0.20 only until the first page carrying the field arrives |

Two fields a Vibe's own payload carries and this client still does **not** read,
both `NOT IMPLEMENTED` and both recorded under "Known backend capabilities the web
does not use yet" above:

- `recipe` — the edit document: the clips the Vibe names, the voiceover and music
  lanes, each clip's trim and speed, the overlays, the filter and the chosen frame
  shape. Sent by the server, read by nothing here, so a Vibe edited on the phone
  plays on the web as its **first clip alone**.
- `clip_urls` — the addresses of the uploads the `recipe` names. Sent and unread
  for the same reason: the walk draws the Vibe's own `asset` and nothing else.

The composer's own body is unchanged and still sends `{asset, caption, music,
mentions, sensitive}` to `POST /drops/vibes/`; `recipe`, `category`, `interests`
and `track_id` are accepted by the server and are never sent.

**Reads performed: `apps/drops/services.py` (`feed_vibe_share`).** No backend file
was modified.

## No contract change on 2026-11-06 (Round 20) — the Mirror button moved, and it touches no frame

The round that turned the Mirror button round — it now flips the pictures
*arriving* rather than this tab's own (`CallEngine.toggleRemoteMirror()`,
`Stage.toggleRemoteMirror()`), so `mirrored()` is the lens's answer alone.
**No request, address, body, header, timeout or response shape moved, and no
endpoint was added, renamed or extended.** The backend is read-only and was written
to nowhere, and nothing in the round reads a field it did not read before.

Worth stating in this report because it is the reason the button is safe to add:
the mirror is applied by `src/features/media/surfaces.tsx`'s `VideoSurface` as the
`-scale-x-100` class on a `<video>` element. **No `MediaStreamTrack` is ever
transformed and nothing is sent differently** — the SDP, the ICE traffic and the
media frames are exactly what they were. A mirror, therefore, is a per-tab display
choice with no protocol surface at all, which is also why one end cannot see
another end's setting and why the far end's camera-versus-screen distinction (a word
the call frames do not carry) is the one thing the button cannot respect.

**Reads performed: none beyond the round's own client code.** No backend file was
modified.

## No contract change on 2026-11-06 (Round 21) — a picture is measured on this side, not asked for

The round that fixed a shared screen cropped to its middle on a phone viewer and a
call with no way back from chat. **No request, address, body, header, timeout or
response shape moved, and no endpoint was added, renamed or extended.** The backend
is read-only and was written to nowhere.

It is worth recording *why* the client measures rather than asks. The clean answer
to "is this arriving stream a camera or a screen?" is a word in the call frame, and
there is none to read: `apps/calls/services.py`'s `check_signal` accepts only
`SIGNAL_TYPES` — `offer`, `answer` and `candidate` — so anything else is refused by
the relay, and no `calls/` route exposes a stream's kind either (`urls.py` carries
only `ice/`, `history/` and `<uuid:pk>/`). The fix therefore infers, in
`src/features/calls/model.ts`'s `sourceChanged(before, after)`: the video element's
own `resize` event reports the picture's height over width, and a shift of more
than 12 % is treated as a new source and returns the view to **Fit**. A camera and a
screen that are both 16:9 look identical to this rule, which is named where the rule
lives and again in `XELVIC_FEATURE_PARITY_MATRIX.md`.

The **Minimize** bar is likewise local: it renders the streams the engine already
holds and sends nothing. A reload still loses a live call, because rejoining would
need a route that lists an account's running calls and `call.pending` answers only
for rings; that is `NOT IMPLEMENTED`, not a protocol gap this round invented.

**Reads performed:** none beyond the round's own client code. No backend file was
modified.

### Round 22, same day — still nothing on the wire

The follow-up that let the minimized call window be dragged and docked
(`src/features/calls/minibar.ts`, `CallOverlay.tsx`) **moved no request, address,
body, header, timeout or response shape, and added, renamed and extended no
endpoint.** Where somebody parks a small window is a fact about one person's page:
it is sent nowhere, it reaches no server, and no other participant can observe it —
which is also why it is held in the component rather than in the engine.

**Reads performed:** none. No backend file was read or modified this round.

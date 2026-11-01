# Xelvic API Compatibility Report

Date: 2026-11-01
Backend (read-only): `xelvic/backend` — Django + DRF + Channels
Web client: `xelvic-web/src/lib/api.ts` and call sites

The mobile app and the web app share one backend. No endpoint, serializer,
migration, setting or contract was changed. This report records what the web
calls, the shape it expects, and any mismatch found.

## Conventions (verified in source)

- Base: `VITE_API_URL` + `/api/v1/` (`src/lib/env.ts`).
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
| `GET /moments/memories/users/{username}/` | `path("memories/users/<str:username>/", UserMemoryView)` | `urls.py:29`, `views.py:1049` |

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
`thumbnail/` (a poll option's picture), `memories/{id}/cover/` +
`cover/thumbnail/`, and the whole `memories/{id}/react|reactors|reply|share/`
family — the Memory walk behind `isMemory` is MISSING, so those four have no web
caller by design rather than by oversight.

## Known backend capabilities the web does not use yet

These are real server features without a web caller. They are **not** contract
mismatches; they are implementation gaps tracked in the parity matrix.

- `/chat/sync/?cursor=` — durable replay after a long disconnect.
- `/chat/sparked/`, `/threads/{id}/sparks/` — Spark runs.
- Group invites preview/join by code.
- Room games/bits endpoints.
- Deals, circles, collabs modules. (The marketplace's own routes are now used —
  see the table above.)
- Stripe-like purchase surfaces beyond sparks/logo shop (where applicable).

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

## Verification limits

No authenticated session against a running backend was executed in this
environment (no credentials and no local Postgres/Redis stack started). All
shapes above were verified statically against the read-only backend source;
runtime behaviour is marked unverified where applicable in
`XELVIC_TESTING_REPORT.md`.
# API inventory

Base: `VITE_API_URL`, default `http://127.0.0.1:8000`, path prefix `/api/v1/`.
Production per docs: `https://api.xelvic.com`.

## Conventions

- `Authorization: Bearer <access>` on everything except the anonymous auth doors.
- Errors: `{"error": {"code", "message", "fields?"}}`. Client switches on `code`.
- Lists: `{"results": [...], "next": "url|null", "previous": ...}`, cursor-based, default 30, messages 40.
- IDs are UUID strings. Timestamps are ISO-8601 with timezone.
- Counts are integers; render with `1k / 1.1k / 12k / 1m` and an em dash when missing.
- Media URLs are absolute and must be used verbatim; socket frames may carry paths.
- Uploads: `POST /chat/assets/` multipart with `file`, client-minted `upload_id`, optional `kind`, `thumb`, `quality`, `duration_ms`, `width`, `height`, `waveform`; response `{asset}`.
- Realtime: `ws(s)://<api-host>/ws/?token=...` and `/ws/threads/<id>/?token=...`; frames are `{event,data}` / `{action,...}`; heartbeat `ping`/`pong`; reconnect then `GET /chat/sync/?cursor=...`.

## Authentication

| Method | Path | Body / notes |
| --- | --- | --- |
| POST | `/auth/qr/start/` | `{}` -> `{session, secret, code, code_expires_in, match, expires_in, poll_after}` |
| GET | `/auth/qr/{id}/` | `X-Qr-Secret` header -> `{state, code?, code_expires_in?, poll_after?}` |
| POST | `/auth/qr/{id}/code/` | `X-Qr-Secret` -> new square |
| POST | `/auth/qr/{id}/collect/` | `X-Qr-Secret` -> `{user, access, refresh, sid}` |
| POST | `/auth/qr/scan/` | signed-in phone: `{code}` |
| POST | `/auth/qr/approve/` | signed-in phone: `{code}` -> `{ok, session, account}` |
| POST | `/auth/qr/deny/` | signed-in phone: `{code}` |
| POST | `/auth/login/` | local/dev only: `{target, password}` -> `{user, access, refresh}` |
| POST | `/auth/token/refresh/` | `{refresh}`; may also rely on HttpOnly cookie; accept rotated refresh |
| POST | `/auth/logout/` | `{refresh}` -> `{ok}` |
| GET/PATCH | `/auth/me/` | `MeSerializer`; profile edit |
| PATCH | `/auth/me/theme/` | `{theme: "<key>"}`; local backend allows included designs and requires ownership for paid themes |
| PATCH | `/auth/me/privacy/` | privacy switches |
| POST/DELETE | `/auth/me/avatar/`, `/auth/me/cover/` | multipart |
| GET/POST | `/auth/me/contacts/` | native contacts sync |
| GET | `/auth/devices/` | device list; `DELETE /auth/devices/{id}/`, `DELETE /auth/devices/others/` |
| GET | `/auth/users/search/?q=` | people search |
| GET | `/auth/users/{username}/` | bare `Profile`; no gate/cta |
| POST | `/auth/password/change/` | current/new password |
| POST | `/auth/deactivate/` | account deactivation |

### Key auth/profile shapes

`UserCard`: `id, username, name, avatar, cover, initials, online, is_private, last_seen, theme`.

`Me`: `id, username, name, phone, email, dob, verified_via, verified_target, avatar, cover, initials, bio, is_private, show_crew, show_dob, contacts_allowed, contacts_asked, posts_count, followers_count, following_count, is_staff, date_joined, theme`.

`Profile`: user card fields plus bio, counts, relation and theme. It does **not** include `gate`/`cta`; `following_count` is null for other users. The client renders unknown extra fields conservatively.

## Social

`POST|DELETE /social/users/{id}/follow/`, `POST /social/users/{id}/withdraw/`,
`POST /social/users/{id}/remove/`, `POST|DELETE /social/users/{id}/block/`,
`GET /social/users/{id}/gate/`, `GET /social/users/{id}/mutuals/`,
`GET /social/users/{id}/crew/{kind}/`, `GET /social/users/{id}/insights/`,
`GET /social/requests/`, `GET /social/requests/count/`,
`POST /social/users/{id}/accept/`, `POST /social/users/{id}/decline/`,
`GET /social/mentionable/`, `GET|POST /social/report/`,
`POST /social/users/{id}/view/`.

Response for relation actions includes `{user, relation, gate, cta}`.

## Drops

| Method | Path | Notes |
| --- | --- | --- |
| GET/POST | `/drops/` | feed / create drop `{body, asset?, place?, tag?, aspect?, poll?}` |
| GET | `/drops/mine/`, `/drops/mine/activity/` | own drops |
| GET | `/drops/users/{username}/` | profile grid |
| GET | `/drops/vibes/`, `/drops/vibes/{id}/` | short video |
| GET | `/drops/{id}/` | detail |
| POST | `/drops/{id}/like/`, `/save/`, `/share/`, `/hide/`, `/seen/`, `/play/` | actions |
| GET/POST | `/drops/{id}/comments/` | comment list/create |
| POST | `/drops/{id}/poll/vote/` | `{options: [uuid]}` |
| GET/POST | `/drops/{id}/notes/` | notes |
| GET | `/drops/{id}/audience/`, `/stats/` | insights |
| POST | `/drops/comments/{id}/like/` | comment like |
| GET | `/drops/saved/` | `{drops,total,shown}` |
| GET | `/drops/interests/` | onboarding/interests |
| GET | `/drops/users/{username}/vibes/` | user clips |

`Drop`: `id, author, kind, body, asset, ratio, place, tag, poll, created_at, likes, comments, shares, saves, liked, saved, mine, peek, collab`.

`Asset` (drop/chat/moment): `id, upload_id, kind, mime, size, original_name, width, height, duration_ms, waveform, checksum, quality, available, available_until, purged_at, content_url, thumbnail_url`.

`Comment`: `id, author, body, likes, liked, mine, created_at` plus reply/peek extras when present.

## Moments

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/moments/tray/` | `{mine, mine_count, unseen, seen, hours}` |
| GET/POST | `/moments/` | list / create `{items:[...]}` |
| GET | `/moments/mine/`, `/moments/users/{username}/` | own/user moments |
| GET | `/moments/{id}/` | detail |
| POST | `/moments/{id}/seen/`, `/reply/`, `/react/`, `/share/`, `/carry/` | actions |
| GET | `/moments/{id}/viewers/`, `/reactors/` | audience |
| POST | `/moments/items/{id}/seen/`, `/vote/` | item actions |
| GET | `/moments/items/{id}/content|thumbnail|sound/` | bytes |
| GET | `/moments/memories/`, `/moments/memories/users/{username}/` | memories |
| POST | `/moments/memories/{id}/react|reply|share/` | memory actions |

`MomentItem`: `id, ordinal, kind, body, asset, vibe, sound, sound_start_ms, clip_start_ms, clip_end_ms, muted, mentions, seen`.

`Moment`: `id, author, items, viewers, reactions, created_at, expires_at, seen, mine` (server returns the exact set; client tolerates additions).

## Chat

| Area | Paths |
| --- | --- |
| Threads | `GET/POST /chat/threads/`, `GET/DELETE /chat/threads/{id}/`, `POST /chat/threads/{id}/delete/` |
| Start DM | `POST /chat/threads/` `{user: uuid}` |
| Messages | `GET /chat/threads/{id}/messages/`, `POST .../send/`, `GET/PATCH/DELETE .../{mid}/` |
| Message actions | `.../react/`, `.../vote/`, `.../forward/`, `.../info/`, `.../shot/`, `.../open-once/` |
| Thread actions | `read/`, `typing/`, `flags/`, `skin/`, `vanish/`, `clear/`, `leave/`, `members/`, `channels/`, `invites/`, `room/`, `sparks/`, `media/` |
| Search/sync | `GET /chat/search/`, `GET /chat/sync/`, `GET /chat/catalog/`, `GET /chat/sparked/` |
| Assets | `POST /chat/assets/`, `GET/DELETE /chat/assets/{id}/`, `content/`, `thumbnail/`, multipart upload road |
| Vault | `GET/PUT/PATCH/DELETE /chat/vault/`, `POST /chat/vault/unlock/`, `POST /chat/vault/reset/` |
| Groups | `POST /chat/groups/`, invites: `GET /chat/invites/{code}/`, `POST .../join/` |

`Send`: `{kind, body?, reply_to?, asset?, payload?, client_id?, channel?}`; kinds include text, image, video, voice, audio, doc, poll, system (system refused).

`Message`: `id, thread, channel, ordinal, kind, body, sender, mine, reply_to, asset, payload, poll, reactions, my_reaction, can_copy, held, deleted_for_all, client_id, revision, edited_at, expires_at, created_at, updated_at`.

`ThreadCard`: id, kind, title, avatar, members, last message, unread, pinned, muted, vaulted, cleared ordinal, spark, timestamps. `ThreadDetail` adds `members, receipts, gate, vanish_days, cleared_ordinal, last_read_ordinal`.

## Audio

`GET /audio/` -> `{hero, hero_source, recent, recent_source, playlists, podcasts, artists}`.
`GET /audio/tracks/` (`?source=catalogue|drop&q=&kind=&artist=&limit=`), `/tracks/{id}/`, `/tracks/{id}/stream/`, `/related/`,
`POST /tracks/{id}/like/`, `/play/`, `GET /audio/board/`, `/audio/categories/`,
`/audio/felt/`, `/audio/trending/`, playlists CRUD + items + order + share.

`source` picks the shelf and there are two: `drop` is the uploads
(`sound_row` of a `Drop`, `limit` capped at 100, default 60) and **omitting it
keeps the shipped catalogue** (`limit` capped at 500, default 200). Asking for
neither picks the catalogue, which is what the picker that lays a sound under a
picture must not do — see `app/lib/screens/audio_picker.dart`.

`TrackRow`: `id, kind, title, artist, artist_slug, artist_id, artist_avatar, series, episode, seconds, plays, seed, liked, source` + stream/cover URLs where provided.

## Spaces

`GET/POST /spaces/`; `GET/PATCH /spaces/{id}/`; `join/`, `leave/`, `hand/`, `stage/`, `mute/`, `camera/`, `start/`, `end/`, `dismiss/`, `share/`; games: `games/`, `games/{kind}/`, `{id}/game/open|join|play|again|close/`.

Signal live updates over the global socket (`room.*`). Room detail includes stage, audience, hands, title, host, state, counts; client tolerates additions.

## Sparks

`GET /sparks/` (`{sparks,total,wallet,catalog}`), `/sparks/threads/{id}/`, `/sparks/medals/`, `/sparks/tiers/`,
`/sparks/wallet/`, `POST /sparks/wallet/buy/` (`{key}`), `/wallet/buy-logo/`,
`/sparks/threads/{id}/name|off|restore/`.

### Wallet and theme purchase (local backend source-confirmed)

| Method | Path | Purpose | Auth | Request / response | Validation and errors | Frontend |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/sparks/wallet/` | Read wallet, owned theme keys, contributors and ledger | Bearer access token | `{balance, earned, spent, owned: string[], people, entries}` | Runtime response not exercised; wallet is per authenticated user | Sparks wallet and theme shop |
| POST | `/sparks/wallet/buy/` | Claim or purchase a theme | Bearer access token | Request `{key}`; success `{key, price, charged, balance}` | HTTP 400 for `unknown_theme`, `not_enough_wallet`, `tier_not_reached`, or `tier_slots_exhausted`. Re-purchase is idempotent (`charged: false`). No client-supplied price. | Theme shop |

The backend now validates the server-known theme key, lifetime-earned tier, per-tier slot, and wallet balance, and records ownership/ledger changes atomically. `PATCH /auth/me/theme/` separately requires ownership before a paid theme can be worn. The backend source change and tests are present, but Django tests could not complete because the configured PostgreSQL test database rejected the local credentials; runtime enforcement remains unverified until that suite runs successfully.

## Alerts, saved, search, verify, collabs

- `GET /alerts/`, `PATCH /alerts/flags/`, `POST /alerts/read/`.
- `GET /saved/`, `POST /saved/`, `GET /saved/ids/`.
- `GET /search/`, `/search/drops/`, `/search/people/`, `/search/places/`, `/search/popular/`.
- `GET /verify/status/`, `POST /verify/requests/`, `POST /verify/requests/withdraw/`.
- `GET /collabs/on/{kind}/{id}/`, `/collabs/people/`, `/collabs/waiting/`, `POST /collabs/{id}/{act}/`.

## Known gaps handled by the client

| Documented but absent locally | Client behaviour |
| --- | --- |
| All `/auth/qr/*` | Full documented flow; a 404 shows an explicit "this server does not have scan sign-in" state. Dev login appears only in dev. |
| `/alerts/*` | Alerts screen shows unavailable state on 404. |
| `/search/*` | People search falls back to `/auth/users/search/`; other scopes show unavailable. |
| `/saved/*` | Saved screen falls back to `/drops/saved/`. |
| `/tags/*` | Tag rail hidden on 404. |
| `/verify/*`, `/deals/*`, `/circles/*`, `/drip/*`, `/catalogue/*` | Not linked in the primary UI except verify in settings. |

No request is silently mocked. A missing server capability is shown as missing.

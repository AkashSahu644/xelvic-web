# Backend API parity matrix

Source of truth: `xelvic/backend/apps/*/urls.py`, serializers and views. The backend was not running during this pass, so **source-confirmed** does not mean **runtime-verified**.

Status keys: **Source-confirmed**, **Used**, **Assumed**, **Absent locally**, **Mismatch fixed**, **Unverified**.

## Conventions

- Base path: `/api/v1/`.
- Auth: Bearer access token, refresh rotation accepted.
- Errors: `{"error":{"code","message","fields?"}}`.
- Lists: cursor page `{results,next,previous}` unless a screen endpoint returns a named collection.
- IDs are UUIDs. Timestamps are ISO-8601.
- Media URLs may be absolute; authenticated media is fetched as a blob.
- The client never sends a price for a purchase; the server owns prices.

## Authentication and account

| Endpoint | Client use | Status | Notes |
| --- | --- | --- | --- |
| `POST /auth/qr/start/` | Sign-in | **Absent locally** | Documented flow; 404 shows capability screen |
| `GET /auth/qr/{id}/` | Sign-in poll | **Absent locally** | Uses `X-Qr-Secret` |
| `POST /auth/qr/{id}/code/` | Rotate code | **Absent locally** | |
| `POST /auth/qr/{id}/collect/` | Exchange session | **Absent locally** | |
| `POST /auth/login/` | Dev password | **Source-confirmed** | Body `{target,password}` |
| `POST /auth/token/refresh/` | Refresh | **Source-confirmed** | Accepts body and cookie rotation |
| `POST /auth/logout/` | Sign out | **Source-confirmed** | Refresh revocation |
| `GET/PATCH /auth/me/` | Settings/profile | **Used** | `MeSerializer` |
| `PATCH /auth/me/privacy/` | Privacy | **Used** | Returns `Me` |
| `PATCH /auth/me/theme/` | Wear theme | **Used** | `{theme:key}`; local backend permits included themes and requires ownership for paid themes |
| `POST/DELETE /auth/me/avatar/` | Avatar | **Used** | Multipart field `avatar` |
| `POST/DELETE /auth/me/cover/` | Cover | **Used** | Multipart field `cover` |
| `GET/POST /auth/me/contacts/` | Contacts choice | **Used** | Browser limitation stated |
| `GET /auth/devices/` | Device list | **Used** | |
| `DELETE /auth/devices/{id}/` | Revoke device | **Used** | |
| `GET /auth/users/search/?q=` | People search | **Source-confirmed** | Cursor `SearchPage<UserCard>`, ordered by name |
| `GET /auth/users/{username}/` | Profile | **Mismatch fixed** | Returns bare `Profile`; **no gate/cta**; `following_count` is null for others |
| `POST /auth/password/change/` | Password | **Used** | `current_password`, `password` min 8 |
| `POST /auth/deactivate/` | Account deletion | **Not wired** | Exists in inventory; no UI |

### Profile and relation shapes

`relation_of` returns:

```text
self, follow_state, chat_state, following, follows_me,
blocked_by_me, blocked_me
```

It does **not** return `follows_you` or `muted`. The TypeScript `Relation` keeps legacy optional fields for tolerance, but the UI reads `follows_me`.

`PeopleView.state` (used by follow/block/accept/decline/gate) returns:

```text
{user, relation, gate, cta}
```

`gate` may be null. The profile endpoint does not include it, which is why the web message button is enabled by default and the gate is shown only after a social action or a chat refusal.

## Social

| Endpoint | Client use | Status | Notes |
| --- | --- | --- | --- |
| `POST/DELETE /social/users/{id}/follow/` | Follow/unfollow | **Used** | Returns state |
| `POST /social/users/{id}/withdraw/` | Withdraw request | **Used** | Returns state |
| `POST/DELETE /social/users/{id}/block/` | Block/unblock | **Used** | Returns state |
| `POST /social/users/{id}/accept/` | Accept request | **Used** | |
| `POST /social/users/{id}/decline/` | Decline request | **Used** | |
| `GET /social/users/{id}/gate/` | Gate | **Assumed** | Web relies on action/chat responses instead |
| `GET /social/requests/` | Alerts | **Used** | Envelope shape not runtime-checked |
| `GET /social/requests/count/` | Alerts badge | **Used, unverified** | Client reads `pending` |
| `POST /social/report/` | Report | **Used** | `target_user`, `reason` |
| `GET /social/users/{id}/mutuals/`, `crew/{kind}/`, `insights/` | Not used | **Not wired** | Crew list absent |
| `GET /social/mentionable/` | Composer mentions | **Partial** | Mention data where the composer supports it |

## Drops

| Endpoint | Client use | Status | Notes |
| --- | --- | --- | --- |
| `GET/POST /drops/` | Feed/create | **Used** | Cursor feed |
| `GET /drops/mine/` | Own grid fallback | **Used** | |
| `GET /drops/users/{username}/` | Profile grid | **Used** | 403 for private wall |
| `GET /drops/{id}/` | Detail | **Used** | |
| `POST /drops/{id}/like/` | Like | **Used** | `{on}` -> `{likes,liked}` |
| `POST /drops/{id}/save/` | Save | **Used** | `{on}` -> `{saves,saved}` |
| `POST /drops/{id}/share/` | Share | **Used** | Response link field assumed |
| `POST /drops/{id}/hide/` | Hide | **Used** | |
| `POST /drops/{id}/poll/vote/` | Poll | **Used** | |
| `GET/POST /drops/{id}/comments/` | Comments | **Used** | |
| `POST /drops/mute/{uuid}/` | Mute posts | **Used** | Body `{on}`, returns `{muted}` |
| `GET /drops/saved/` | Saved | **Used** | `{drops,total,shown}` |
| `/drops/{id}/notes/`, `/audience/`, `/stats/` | Not used | **Not wired** | |

## Chat

| Endpoint | Client use | Status | Notes |
| --- | --- | --- | --- |
| `GET/POST /chat/threads/` | List/start | **Used** | Start returns `{thread,gate}` or `{thread:null,gate,user}` |
| `GET/DELETE /chat/threads/{id}/` | Detail | **Used** | |
| `GET /chat/threads/{id}/messages/` | History | **Used** | Cursor page |
| `POST /chat/threads/{id}/send/` | Send | **Used** | Text and asset kinds |
| `PATCH/DELETE /chat/messages/{id}/` | Edit/delete | **Used** | |
| Message actions `react/vote/forward/info` | Actions | **Partial** | Reaction and poll are wired; forward/info limited |
| `POST /chat/threads/{id}/read/`, `typing/` | Presence | **Used** | Socket plus fallback |
| `POST /chat/threads/{id}/flags/` | Pin/mute/vault | **Partial** | Flag UI limited |
| `POST /chat/assets/` | Upload | **Used** | Multipart |
| `GET /chat/search/` | Search | **Partial** | Thread list search only |
| `GET /chat/sync/` | Reconnect | **Partial** | No local cache |
| `/chat/vault/*` | Vault | **Not wired** | Screen absent |
| `/chat/groups/`, `/chat/invites/*` | Groups | **Partial** | Create and basic membership |
| `POST /chat/threads/{id}/sparks/` | Spark off | **Used** | Thread UUID, not spark id |

## Audio

| Endpoint | Client use | Status | Notes |
| --- | --- | --- | --- |
| `GET /audio/` | Home | **Used** | `{hero,recent,playlists,podcasts,artists}` |
| `GET /audio/tracks/?q=` | Search | **Source-confirmed** | Returns `{tracks,query}`; a bare `?q=` also carries `playlists` and `people` |
| `GET /audio/tracks/?source=drop` | The uploads shelf — the sounds a clip can be laid on | **Used** | Returns `{tracks,query}`; the rows are `sound_row` of `Drop`, `limit` capped at 100 (default 60). **Omitting `source` answers the shipped catalogue instead**, capped at 500 (default 200) — a different list, and the one the editor's sound sheet used to draw by mistake |
| `GET /audio/tracks/{id}/` | Detail | **Used** | |
| `POST /audio/tracks/{id}/like/` | Like | **Used** | |
| `POST /audio/tracks/{id}/play/` | Play signal | **Used** | |
| Playlist CRUD and items/order | Playlist | **Used** | |
| `POST /audio/playlists/{id}/share/` | Share | **Used** | Token field assumed |
| `GET /audio/playlists/shared/{token}/` | Public playlist | **Assumed** | Public route handles 404 |
| `GET /audio/artists/...` | Artist page | **Not wired** | No route |

## Spaces

| Endpoint | Client use | Status | Notes |
| --- | --- | --- | --- |
| `GET/POST /spaces/` | Shelf/create | **Used** | `shelf` filter |
| `GET /spaces/{id}/` | Room | **Used** | |
| `POST /spaces/{id}/join/`, `leave/` | Presence | **Used** | |
| `POST /spaces/{id}/hand/` | Raise hand | **Used** | |
| `POST /spaces/{id}/stage/`, `dismiss/` | Stage | **Used** | Host |
| `POST /spaces/{id}/mute/`, `camera/` | Host media flags | **Used** | Browser does not publish media |
| `POST /spaces/{id}/start/`, `end/` | Lifecycle | **Used** | Host |
| `POST /spaces/{id}/share/` | Share | **Used** | |
| `POST /spaces/{id}/game/open|join|play|again|close/` | Game | **Assumed** | Exact subroutes not confirmed in this pass |
| `GET /spaces/games/`, `games/{kind}/` | Game catalogue | **Assumed** | Board data consumed tolerantly |

## Sparks

| Endpoint | Client use | Status | Notes |
| --- | --- | --- | --- |
| `GET /sparks/` | Sparks page | **Source-confirmed** | `{sparks,total,wallet,catalog}` |
| `GET /sparks/wallet/` | Wallet | **Source-confirmed** | `{balance,earned,spent,owned,people,entries}` |
| `GET /sparks/medals/` | Medals | **Source-confirmed** | `{medals}` |
| `GET /sparks/tiers/` | Ladder | **Source-confirmed** | Catalog |
| `POST /sparks/wallet/buy/` | Buy theme | **Implemented, runtime-unverified** | Body `{key}`; returns `{key,price,charged,balance}`. Backend now validates earned tier, slot, key and balance; test DB credentials blocked Django test execution. |
| `GET /sparks/threads/{id}/` | Detail | **Not wired** | |
| `POST /sparks/threads/{id}/off/` | Off | **Used elsewhere** | Thread UUID |
| `POST /sparks/threads/{id}/name/` | Century name | **Not wired** | |

## Alerts, saved, search and extras

| Endpoint group | Client use | Status |
| --- | --- | --- |
| `/alerts/*` | General alerts | **Absent locally / not wired** |
| `/saved/*` | Saved shelf | **Absent locally**; `/drops/saved/` used |
| `/search/*` | Search scopes | **Absent locally**; people search fallback |
| `/verify/*` | Verify badge | **Not wired** |
| `/collabs/*` | Collabs | **Partial** |
| `/tags/*` | Tags | **Absent locally** |
| `/deals/*`, `/circles/*`, `/drip/*`, `/catalogue/*` | Separate products | **Out of scope** |

## Mismatches and corrections made

1. `Relation` originally assumed `follows_you`; backend returns `follows_me`. The type keeps both for tolerance; the UI reads `follows_me`.
2. `Profile` was assumed to include `gate`/`cta`; it does not. The message button was fixed to enable when no gate is known and to show the server's gate on refusal.
3. `/sparks/wallet/buy/` takes `{key}`, not `{theme}`. The web shop now sends this shape; backend tier/slot checks are implemented, but Django tests and the live purchase flow remain unverified.
4. Spark off uses the **thread UUID**, not the spark row id.
5. `/sparks/` includes `catalog`; the type and page now expect it.
6. `/drops/saved/` returns `{drops,total,shown}`, not a cursor page.
7. `/audio/tracks/?q=` returns `{tracks,query}`, not a cursor page.
8. `/auth/users/search/` is cursor-paged and ordered by name.
9. `Profile.following_count` is intentionally null for other users; the UI shows a dash.
10. `/social/requests/count/` response field is still assumed to be `pending`; this needs a live check.

## Runtime verification status

- No endpoint was exercised against a running backend.
- Route presence is from source and documentation.
- Client error handling is implemented, but only source-reviewed.
- A future pass should run a disposable Postgres/Redis stack, seed two accounts and exercise the auth, social, drops, chat, spaces and sparks paths end to end.

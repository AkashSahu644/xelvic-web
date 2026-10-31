# Repository audit

Audited on 2026-10-24 from `C:\Users\HP\OneDrive\Desktop\Xelvic\Xelvic`.

## What is in the repository

| Path | What it is | Status |
| --- | --- | --- |
| `xelvic/app` | Flutter application (`pubspec.yaml` name `xellom`, version `1.0.0+1`) | Source of truth for mobile behaviour and many design decisions |
| `xelvic/backend` | Django 5.2 + DRF + Channels backend | Locally checked-out API, older than the written contract |
| `backend-api/WEB-API.md` | 47 KB generated route and convention reference (523 operations) | Authoritative web contract |
| `backend-api/WEB-LOGIN.md` | 79 KB design for QR scan sign-in | Authoritative auth design; not implemented locally |
| `backend-api/WEB-HANDOVER.md` | 21 KB repository/deployment handover | Authoritative boundary and access notes |
| `web/` | Existing Xelvic marketing site (React 18 + Vite 5 + Tailwind 3.4) | Separate product; left untouched |
| `apk_extract/` | Decompiled `app-release-2.apk` assets | Newest visual reference, including all theme art |
| `xelvic/themes`, `xelvic/app/assets` | Theme and media assets from an older checkout | Superseded by `apk_extract` for theme art |
| `extracted/` | Marketing images (`xelvic.png`, character art) | Reference only |

## Brand decision

The current app build, the API documentation and the new backend all say **Xelvic** (`xelvic://l/` login codes, `/api/v1/`, `Xelvic` domain). The older Flutter checkout says `xellom` internally and ships `assets/brand/xellom.png`. The APK ships `assets/brand/xelvic.png` (2561x759) and `xelvic_white.png`, and the decompiled build is newer than the checkout.

This website is therefore branded **Xelvic**, uses the APK wordmark assets, and keeps "Xellom" only where an older backend payload or route requires it. No user-facing "Xellom" copy is introduced.

## Toolchain verified

- Node `v24.22.0`, npm `11.6.4`
- Python `3.14.0` only; backend README asks for Python 3.12
- Docker CLI `29.7.2` is installed but the daemon is not running
- No local Postgres/Redis binaries found
- `xelvic/backend` has no `.env` and no `.venv`

## Backend reality vs documentation

The documented contract and the locally checked-out code are not the same vintage:

- QR sign-in (`/auth/qr/start|scan|approve|deny|collect|{id}/code`) is fully specified in `WEB-LOGIN.md` and listed in `WEB-API.md`, but **is absent from local `apps/accounts/urls.py` and `views_auth.py`**.
- Locally mounted routers are only `accounts`, `social`, `chat`, `moments`, `drops`, `sparks`, `stickers`, `calls`, `audio`, `spaces`, `collabs`, `console`.
- Documented routers with **no local implementation**: `tags`, `alerts`, `verify`, `deals`, `saved`, `circles`, `drip`, `catalogue`, `search`, `links`, `reco`, `ml`.
- `WEB-API.md` says refresh tokens are not rotated; local JWT settings may rotate them. The client must therefore accept both a rotated `refresh` in the response and a cookie-only refresh.
- Local `LoginSerializer` takes `{target, password}` (target is phone or email), not `{username, password}`.
- Local `DropWriteSerializer` matches the documented create shape. Local `PostMomentSerializer` takes `{items: [{kind, asset, body, ...}]}`.
- Local chat send shape is `{kind, body, reply_to, asset, payload, client_id, channel}`.

Consequences are recorded in `API_INVENTORY.md` and handled explicitly in code: QR is implemented to the documented contract, degrades to an honest server-capability screen on a 404, and dev password login is only available in development or when `VITE_ENABLE_DEV_LOGIN=1`.

### Source cross-checks

- The local backend is Django/DRF with Channels, PostgreSQL, Redis and Celery. Its README specifies Python 3.12, PostgreSQL 16 and Redis 7. The checked environment has Python 3.14 and no running Docker daemon, PostgreSQL or Redis, so live integration remains unverified.
- The backend enables JWT refresh rotation and blacklisting; this conflicts with the non-rotation statement in the web contract. The frontend accepts a rotated refresh token but the local API behavior must be verified before release.
- The API handover says schema/docs are staff-only, but the inspected URL wiring does not attach a staff-only permission to those views. Do not rely on the handover statement as proof of authorization.
- Theme wear is protected server-side: `/auth/me/theme/` permits included keys and checks ownership for paid keys. The theme purchase implementation now also checks Android tier/slot eligibility server-side; its Django tests are present but remain runtime-unverified because the local PostgreSQL test database rejected credentials.
- The Flutter shell starts on Convo, whereas the web app's `/app` route currently redirects to Drops. The web layout keeps the same five main destinations, but the landing tab is a documented parity difference.
- `xelvic/app/lib/offline/` contains a SQLite offline store (schema version 6), per-account runtime, queued messages/actions and sync state. `OFFLINE-PLAN.md` describes an earlier state and is stale on the claim that the app has no local database. The web client currently has reconnect synchronization but not an equivalent durable offline store/outbox.
- The beauty-camera document describes an Android-only prototype and says the Flutter bridge is unimplemented; it is not evidence that a beauty-camera feature exists in the released app.
- The APK extraction contains compiled Flutter assets rather than Dart source. It is useful as an asset reference, but source behavior is determined from the checked-in Flutter project.

## Cannot be verified locally

- End-to-end QR login (no endpoints and no phone session).
- Live API integration (backend cannot run without Postgres, Redis, and Python 3.12).
- Real WebSocket traffic and uploads.
- Server-side theme ownership checks against the newer theme keys.

Everything that depends on these is marked in the UI and in `IMPLEMENTATION_PLAN.md`, not simulated as if it succeeded.

## Existing site safety

`web/` is an independent repository and deployment with its own `package.json`, lockfile, assets and GitHub Pages workflow. This work creates a sibling `xelvic-web/` and does not edit, delete, or overwrite anything under `web/`.

The Git top level resolves to `C:/Users/HP` (the user's home), not this folder. An initial status query included unrelated home-directory entries; no commit or reset was performed. Treat repository status from this location as unreliable for the Xelvic workspace.

## Asset provenance

- Wordmark: `apk_extract/assets/flutter_assets/assets/brand/xelvic.png` and `xelvic_white.png`.
- Theme art: `apk_extract/assets/flutter_assets/assets/themes/**` (19 theme folders, 140 files, 9.8 MB).
- Theme palettes and shop rules: local `xelvic/app/lib/theme.dart` and `xelvic/app/lib/theme_shop.dart`.
- App icon: `xelvic/app/android/.../ic_launcher.png`.
- No font files are shipped; the web app bundles an open variable font instead of fetching from a third party at runtime.

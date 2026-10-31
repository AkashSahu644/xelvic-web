# Implementation plan

## Deliverable

A new standalone web application at `xelvic-web/` for the Xelvic account system. It is a separate app from `web/` and shares only the Django API.

Stack: React 19 + TypeScript + Vite, Tailwind CSS, TanStack Query, React Router, native WebSocket, QR rendering. No UI kit; components are built from the mobile design language.

## Verified project status and next implementation slice

This plan describes an existing, substantial client rather than an empty project. The repository, API and Android audits are recorded in this `docs/` directory. The web client already has routes for Drops, Moments, Convo, Audio, Live, profiles, search, alerts, saved items, Sparks and settings. Its documented feature gaps remain real; the audit does not treat a screen or route as complete without its backend behavior.

The Android Reward theme shop has been implemented: it previews themes, applies already-open themes, and purchases eligible themes through the wallet endpoint. It uses Android lifetime-earned thresholds and tier slots, sends only the theme key, reads the server's charged price/balance result, and refreshes wallet data after success. The backend now enforces tier and slot eligibility; Django tests and the live purchase flow remain unverified because the configured PostgreSQL credentials were rejected.

### Current checklist

- [x] Inspect the existing web project and its documented route/feature coverage.
- [x] Cross-check Android framework, shell, offline implementation and design references.
- [x] Cross-check backend route mounts, authentication behavior and documented API mismatches.
- [x] Record the audit and implementation direction before feature changes.
- [x] Verify exact theme shop purchase rules and API success/error response from source.
- [x] Implement theme preview, eligibility, purchase, equip and wallet refresh.
- [x] Enforce purchase tier/slot eligibility in the backend while preserving the existing success contract; add focused Django tests.
- [x] Add shop access on mobile and update feature/API/parity documentation.
- [x] Run frontend tests, typecheck, lint and production build; record backend test blockers separately.
- [x] Add focused regression coverage for the shop eligibility rules.

### Current verification blockers

- A live backend/API and authenticated end-to-end pass are unavailable in this environment.
- Server-side tier/slot checks were added to `POST /sparks/wallet/buy/` with stable errors and focused tests. The configured PostgreSQL test database rejected credentials, so the tests remain unverified at runtime. Paid-theme wearing also has an existing ownership check in `PATCH /auth/me/theme/`.
- The Android shell opens on Convo while the web root redirects to Drops. Preserve this as an explicit parity discrepancy unless a separately scoped navigation change is made.

## Architecture

```text
src/
  app/            route table, providers, error boundaries
  components/     brand, avatars, buttons, cards, sheets, stories, player
  features/       drops, moments, chat, audio, spaces, profile, sparks, search
  lib/            api client, auth tokens, socket, upload, formatting, errors
  theme/          palettes, CSS variables, theme provider, shop catalogue
  pages/          route-level screens
  types/          API contracts
public/themes/    covers and painting themes from the APK
docs/             this audit and plan
```

### Data flow

- TanStack Query owns server state. Keys are resource-shaped (`drops`, `drop:<id>`, `threads`, `thread:<id>:messages`, ...).
- Mutations use optimistic updates only where the server response is a simple counter/flag (like, save, follow, seen), and always settle from the response.
- The API client is the only place that knows about tokens, refresh, errors and URL joining.
- A single WebSocket provider owns connect/reconnect/heartbeat; feature hooks subscribe to events and invalidate or patch their query. Thread screens open the per-thread socket when available.
- Auth state lives in a provider with three states: loading, signed out, signed in. Protected routes wait for restoration.

### Auth decisions

- Access token is kept in memory and mirrored to `sessionStorage` so a reload does not drop the session. Refresh stays in `sessionStorage` only for the dev login fallback; QR collect uses the server's HttpOnly cookie first. This is documented rather than pretending the local backend sets production cookies.
- All fetches use `credentials: "include"`.
- Refresh is single-flight: concurrent 401s queue and retry once.
- QR flow follows `WEB-LOGIN.md`: start, render `xelvic://l/<code>`, poll at `poll_after`, rotate before expiry, stop on terminal state, collect once. A 404/405 on start shows a capability message and exposes dev login only when `DEV` or `VITE_ENABLE_DEV_LOGIN=1`.
- Dev login posts `{target, password}` to `/auth/login/`.
- Logout revokes the refresh token, clears local state and socket.

### Theme decisions

- CSS custom properties on `<html>`; the theme provider sets `--accent`, `--accent-pill`, scheme colours and paper.
- 19 server-known themes with local palettes; painting covers from the APK. Theme selection calls `/auth/me/theme/`; on 403/404 the UI explains the server rejected the theme rather than pretending it applied.
- Light/dark/system toggle. Custom hand-built themes are not created on web (the API stores a key, not arbitrary palettes).
- Painting themes paint only the five shell destinations, matching the mobile rule.

### Media decisions

- Uploads use `POST /chat/assets/` with a client UUID and optional generated thumbnail; `createImageBitmap`/canvas produce thumbnails and dimensions. Voice notes use `MediaRecorder` when supported, otherwise the file picker accepts audio.
- Images use `loading="lazy"`, `decoding="async"`, explicit aspect ratio from the payload to avoid layout shift.
- Audio player is a single `<audio>` element in a provider; the UI reads time/duration via events and persists the queue in memory. No autoplay.
- QR is drawn from the payload with a local QR library at error correction M, high contrast, four-module quiet zone.

### Error and empty states

Every page distinguishes:

1. Loading (skeleton)
2. Empty (illustration + action)
3. Unauthenticated (sign-in prompt)
4. Missing server capability (404/405, with an explicit sentence)
5. Network/offline (retry, cached data if available)
6. Validation errors (field-level from `error.fields`)

No fabricated data is shown as if it came from the API. The UI never silently falls back to demo content.

## Phases

1. **Foundation** — Vite/TS/Tailwind, fonts, theme tokens, brand and theme assets, router, API client, auth provider, toast, error boundary.
2. **Shell and sign-in** — desktop rail/mobile tab bar, landing, QR sign-in, dev login, guards, theme picker.
3. **Drops** — feed, card, composer/upload, likes/saves, comments, polls, detail, saved fallback.
4. **Moments** — tray, viewer, seen, reactions/replies, composer.
5. **Convo** — thread list, chat, send/upload, socket, typing/read, group basics.
6. **Audio and Live** — persistent player, playlists, room shelf/detail/actions.
7. **Profiles and satellites** — profile, edit, follow/requests, search, alerts, saved, sparks, settings/devices.
8. **Verification** — typecheck, lint, production build, route smoke test, accessibility pass, responsive pass.

## Verification

- `npm run typecheck` — strict TypeScript.
- `npm run lint` — ESLint, no unused code.
- `npm run build` — production bundle.
- Route smoke via a local static preview and a headless check of every top-level route.
- Keyboard/focus check on sign-in, story viewer, composer, chat, player and settings.
- Responsive check at 360, 768, 1024 and 1440 px.
- API integration is only claimed where a server is reachable; otherwise the report states exactly what was and was not exercised.

## Known blockers and how they are represented

| Blocker | Representation |
| --- | --- |
| No Postgres/Redis, Python 3.12 missing, Docker daemon down | Backend not started. Client shows real connection errors. Final report marks integration unverified. |
| QR endpoints absent from local checkout | Capability screen; full documented flow is coded. |
| Many documented routers absent locally | Per-screen 404 handling, with fallbacks where a real local route exists (people search, saved drops). |
| Git root is the user's home | No git operations performed. |
| Refresh rotation ambiguity | Client accepts both rotated body tokens and cookie-only refresh. |
| Modern theme keys may be unknown to older server | Selection fails visibly; theme art is still browsable. |

# Xelvic Web

A standalone React web client for the Xelvic account system. It shares the Django API with the Android app and uses the APK's brand and theme assets.

This is a parity build, not a redesign. The current status is recorded honestly in [`docs/FINAL_VERIFICATION_REPORT.md`](docs/FINAL_VERIFICATION_REPORT.md); the client is not yet full Android parity.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS
- TanStack Query
- React Router
- Native WebSocket
- `qrcode.react`
- Manrope variable font, shipped locally

No UI kit is used. Components are built from the mobile design language.

## Requirements

- Node.js 22.12.x or 24.x and newer (required by the current Vite/Vitest toolchain)
- npm
- A reachable Xelvic API for real data
- For local API work: the backend's documented Python/Postgres/Redis stack

The web client can build and run without a backend; data screens will show their real connection errors.

## Setup

```bash
cd xelvic-web
npm install
copy .env.example .env
npm run dev
```

The dev server prints its local URL (normally `http://localhost:5173`).

### Environment

```env
VITE_API_URL=http://127.0.0.1:8000
VITE_ENABLE_DEV_LOGIN=0
```

- `VITE_API_URL` is the API origin. The client appends `/api/v1/`.
- `VITE_ENABLE_DEV_LOGIN=1` shows the password door. It is intended for local development; the documented product signs in with a QR from the phone.

Do not commit `.env` or real credentials.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run typecheck` | Strict TypeScript build check |
| `npm run lint` | ESLint |
| `npm test` | Theme-shop eligibility regression tests |
| `npm run build` | Typecheck and production build into `dist/` |
| `npm run preview` | Serve the production build locally |

## Routes

### Public

- `/` - direct QR sign-in and optional dev login
- `/signin` - compatibility route for direct sign-in
- `/s/:token` - shared playlist landing
- `*` - not found

### Signed in

- `/app/drops` - feed
- `/app/drops/:dropId` - drop detail
- `/app/moments` - moments
- `/app/convo` - conversations
- `/app/convo/:threadId` - chat
- `/app/audio` - audio home
- `/app/audio/:playlistId` - playlist
- `/app/live` - live rooms
- `/app/live/:roomId` - room
- `/app/u/:username` - profile
- `/app/search` - people/audio search
- `/app/alerts` - requests
- `/app/saved` - saved drops
- `/app/sparks` - theme shop, wallet, sparks, medals
- `/app/settings` - account and appearance

## Architecture

```text
src/
  app/            routes, shell, guards, error boundary
  components/     shared UI primitives
  features/       drops, moments, chat, audio, spaces, auth
  lib/            API, session, media, upload, formatting, errors
  pages/          route screens
  providers/      auth, theme, socket, player, toast
  theme/          palettes, catalogue, assets mapping
  types/          API contracts
public/           brand, favicon, theme covers and paintings
docs/             audit, parity, remediation and verification records
```

- TanStack Query owns server state.
- The API client is the only place that knows about tokens, refresh and URL joining.
- One socket provider owns connect/reconnect/heartbeat; feature screens subscribe.
- Auth has loading, signed-out and signed-in states.
- Themes are CSS custom properties on `<html>`.
- One audio element is owned by the player provider. No autoplay.
- Authenticated media is fetched as a blob because `<img>`/`<audio>` cannot send Bearer headers.

## Verification

Last recorded results:

```text
npm test           PASS
npm run typecheck  PASS
npm run lint       PASS
npm run build      PASS
```

Production build output: 681.66 kB JavaScript and 59.39 kB CSS before gzip; Vite emits a chunk-size advisory. Production preview verified that `/` and `/signin` render the sign-in flow. No authenticated end-to-end pass was possible because the backend was not available.

See [`docs/TEST_AND_REGRESSION_MATRIX.md`](docs/TEST_AND_REGRESSION_MATRIX.md) for the full matrix and [`docs/FINAL_VERIFICATION_REPORT.md`](docs/FINAL_VERIFICATION_REPORT.md) for the release verdict.

## Known limitations

- Not full Android parity. Missing: calls, vault, crew list, codepad, artist pages, own QR, account deactivation and several rich chat sheets.
- Theme purchase now follows Android tier/slot rules in both the web UI and local API; paid theme wearing is ownership-checked. Backend tests were added but could not run because local PostgreSQL rejected the configured test credentials.
- The web Sparks page adds a Themes tab and mobile shortcut, while retaining streaks, ladder and medals tabs beyond Android's Themes/Wallet Reward shape.
- The browser cannot read the device address book, show native push or provide OS background audio controls. Settings can show matches and deny contact uploads; allowing uploads stays in Android.
- Media elements cannot send Bearer headers; the client uses blob URLs.
- Room games are wired against assumed subroutes and need a live check.
- The initial JS bundle is above Vite's 500 kB advisory threshold.
- No automated accessibility or visual-regression pass has been run.

## Documentation

- [`docs/MASTER_GOALS.md`](docs/MASTER_GOALS.md)
- [`docs/APK_PARITY_MATRIX.md`](docs/APK_PARITY_MATRIX.md)
- [`docs/SCREEN_BY_SCREEN_AUDIT.md`](docs/SCREEN_BY_SCREEN_AUDIT.md)
- [`docs/SECTION_AND_INTERACTION_AUDIT.md`](docs/SECTION_AND_INTERACTION_AUDIT.md)
- [`docs/BACKEND_API_PARITY_MATRIX.md`](docs/BACKEND_API_PARITY_MATRIX.md)
- [`docs/DESIGN_PARITY_AUDIT.md`](docs/DESIGN_PARITY_AUDIT.md)
- [`docs/TEST_AND_REGRESSION_MATRIX.md`](docs/TEST_AND_REGRESSION_MATRIX.md)
- [`docs/REMEDIATION_LOG.md`](docs/REMEDIATION_LOG.md)
- [`docs/FINAL_VERIFICATION_REPORT.md`](docs/FINAL_VERIFICATION_REPORT.md)

Earlier inventory documents are also kept in `docs/`.

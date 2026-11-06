# Test and regression matrix

Date: 2026-10-24

**Superseded as a snapshot, and kept as one.** The dates, counts and build sizes
below are what was run on 2026-10-24, when the suite was five theme tests and the
client was one `src/App.tsx`. Both have moved a long way since; the live record
is `XELVIC_TESTING_REPORT.md` (per-pass checks, most recently 80 cases over 12
files) and `XELVIC_PROGRESS_TRACKER.md`. Nothing in this file has been re-run to
match them, and a number here should not be quoted as current.

## Stable test and requirement trace

| Test ID | Requirement IDs | Verification | Result / status |
| --- | --- | --- | --- |
| `TEST-001` | Theme shop tier and slot rules | `npm test` | Pass: 5 deterministic theme eligibility/progress unit tests; no backend or mocked HTTP request |
| `TEST-002` | Strict frontend compile and lint | `npm run typecheck`, `npm run lint` | Pass after the final source edits |
| `TEST-003` | Sign-in failure handling | Integrated browser at `/signin` | Rendered connection failure; production QR-start request failed due CORS. Does not verify a successful login |
| `TEST-004` | Production direct-login routing | Production preview browser at `/` and `/signin` | Root rendered the sign-in experience directly; `/signin` remains compatible; QR request failed due production CORS |
| `TEST-008` | Root login and restored-session redirect | `PublicOnly` route guard | Source/typecheck verification: loading waits for session restore, authenticated status redirects to `/app/drops`; authenticated browser flow not exercised |
| `TEST-005` | `A11Y-SHELL-001`, `PLAYER-KEYBOARD-001`, `PLAYER-MEDIA-001` | Source review plus strict checks | Implemented; keyboard, touch, authenticated shell and Media Session device behavior not yet exercised |
| `TEST-006` | Backend theme purchase entitlement | Django focused test command | Blocked before tests began by PostgreSQL test-user authentication failure |
| `TEST-007` | `DESIGN-001` | APK and web visual comparison | Not run: no screenshot comparison/device harness |

These IDs track only tests performed or explicitly planned here. Existing static inspection tables below are not substitutes for behavior tests.

## Commands run

| Command | Working directory | Result | Evidence |
| --- | --- | --- | --- |
| `npm test` | `xelvic-web` | **Pass** | 5 theme shop eligibility and progress tests |
| `npm run typecheck` | `xelvic-web` | **Pass** | Rerun after Media Session and accessibility changes; `tsc -b --pretty false` |
| `npm run lint` | `xelvic-web` | **Pass** | Rerun after Media Session and accessibility changes; `eslint .` |
| `npm run build` | `xelvic-web` | **Pass** | 2039 modules; JS 681.66 kB, CSS 59.39 kB before gzip; chunk-size advisory warning |
| Local dev server smoke | `xelvic-web` | **Pass** | HTTP 200; browser rendered `/signin`; API-unavailable state shown |
| Production preview smoke | `xelvic-web` | **Pass** | Browser rendered sign-in directly on `/`; preview returned HTTP 200 for `/`, `/signin` and `/app/drops` |
| Sign-in anchor check | `xelvic-web` | **Pass** | Browser no longer reports nested links in the header |
| Sign-in navigation check | `xelvic-web` | **Pass with backend limitation** | `/` displayed the QR sign-in page; the QR request was blocked by production CORS |
| Backend integration | n/a | **Blocked** | Django tests could not start; PostgreSQL rejected the configured test-user password |
| Authenticated E2E | n/a | **Blocked** | No test accounts or backend |
| Visual comparison | n/a | **Not run** | No APK screenshot comparison harness or device lab |
| Accessibility audit | n/a | **Partial** | Added shell skip link and native range seek; reduced-motion rule exists; no axe/Pa11y or screen-reader pass |
| `npm audit` | `xelvic-web` | **3 moderate dev-only advisories** | Via Tailwind 3's `postcss-selector-parser`; production audit (`--omit=dev`) reports 0 |

## Static checks

| Check | Result | Notes |
| --- | --- | --- |
| Strict TypeScript | Pass | `noUnusedLocals` and `noUnusedParameters` are on |
| ESLint flat config | Pass | Rules of hooks, exhaustive deps, unused vars |
| Production bundle | Pass | 681.66 kB JS, 59.39 kB CSS before gzip |
| Theme shop rules | Pass | Five unit tests cover included themes, earned threshold, wallet balance, slot limits and final tier |
| SPA deep-link fallback | Pass | Vite preview served the shell for `/app/drops` |
| No demo data in pages | Pass by inspection | Pages use API queries and honest empty/error states |
| Secret scanning | Pass by inspection | No tokens or passwords in source; env example contains no secrets |

## Feature regression matrix

Statuses: **Wired**, **Partial**, **Unverified**, **Missing**, **Blocked**.

| Area | Code path | Typecheck | Lint | Runtime | Notes |
| --- | --- | --- | --- | --- | --- |
| Landing | `/` | Pass | Pass | Static 200 | Rendered DOM not captured |
| Sign-in | `/signin` | Pass | Pass | **Blocked** | Local QR routes are absent; production QR request was blocked by CORS; dev login needs backend |
| Session restore | `AuthProvider` | Pass | Pass | **Blocked** | No backend |
| Shell/nav | `AppShell` | Pass | Pass | Static 200 | Auth guard prevents full render without session |
| Drops feed | `/app/drops` | Pass | Pass | **Blocked** | Needs auth/API |
| Drop detail | `/app/drops/:id` | Pass | Pass | **Blocked** | Needs auth/API |
| Moments | `/app/moments` | Pass | Pass | **Blocked** | Needs auth/API |
| Convo list | `/app/convo` | Pass | Pass | **Blocked** | Needs auth/API |
| Chat | `/app/convo/:id` | Pass | Pass | **Blocked** | Needs auth/API/socket |
| Audio | `/app/audio` | Pass | Pass | **Blocked** | Needs auth/API |
| Playlist | `/app/audio/:id` | Pass | Pass | **Blocked** | Needs auth/API |
| Public playlist | `/s/:token` | Pass | Pass | **Blocked** | Needs API |
| Live shelf | `/app/live` | Pass | Pass | **Blocked** | Needs auth/API |
| Room | `/app/live/:id` | Pass | Pass | **Blocked** | Needs auth/API/socket |
| Profile | `/app/u/:username` | Pass | Pass | **Blocked** | Needs auth/API |
| Search | `/app/search` | Pass | Pass | **Blocked** | Needs auth/API |
| Alerts | `/app/alerts` | Pass | Pass | **Blocked** | Request envelope unverified |
| Saved | `/app/saved` | Pass | Pass | **Blocked** | Needs auth/API |
| Sparks | `/app/sparks` | Pass | Pass | **Blocked** | Needs auth/API |
| Theme shop | `src/features/sparks/ThemeShop.tsx` | Pass | Pass | **Blocked** | UI and purchase API wired; no authenticated backend pass |
| Settings | `/app/settings` | Pass | Pass | **Blocked** | Needs auth/API |
| Theme selection | `ThemeProvider` | Pass | Pass | **Blocked** | Needs auth for server sync |
| Theme preview | `ThemeProvider` / `ThemeShop` | Pass | Pass | **Pass by state inspection** | Preview does not persist; dismissal restores selected design |
| Media blobs | `useMediaUrl` | Pass | Pass | **Blocked** | Needs auth/media |
| Uploads | `upload.ts` | Pass | Pass | **Blocked** | Needs API |
| Socket | `SocketProvider` | Pass | Pass | **Blocked** | Needs auth/WebSocket |

## Interaction checks by inspection

| Check | Result |
| --- | --- |
| Protected route redirects signed-out users | Present |
| Signed-in user redirected from sign-in | Present |
| Modal closes on Escape | Present |
| Confirm dialog destructive action | Present |
| Chat Enter/Shift+Enter | Present |
| Moment arrow/Escape navigation | Present |
| Player does not autoplay | Present |
| Failed like/save reverts optimistic state | Present |
| Private profile wall on 403 | Present |
| Unsaved drop disappears from saved shelf | Present |
| Settings deep link opens appearance tab | Present |
| Sparks ladder picks highest staged spark | Present |
| Theme preview dismissal restores selected design | Present |
| Settings theme picker restricts paid choices to owned themes | Present |
| Purchase posts `{key}` and refreshes wallet queries | Present by inspection; API response not exercised |

## Known regression risks

1. **Profile message button**: the profile payload has no gate. The button is enabled by default and the server gate is shown only when chat refuses. This is deliberate, but it means a blocked state is not visible before the tap.
2. **Room game routes**: `game/play`, `game/again` and related paths are assumptions from the Android client. A wrong path becomes a toast, not a crash, but the game cannot be played.
3. **Request envelope**: `/social/requests/` and `/social/requests/count/` shapes were not live-checked. Alerts could show an empty list against a different envelope.
4. **Theme purchase**: frontend unit tests pass; backend tests could not start because PostgreSQL rejected the configured test credentials. Run the Django suite and live purchase flow before release.
5. **Media URLs**: authenticated blob fetching is correct for headers but can fail on expired sessions; the UI shows a failed media state.
6. **Settings contacts**: the browser cannot read the address book. The choice can be recorded, but matches depend on data supplied by the Android app.
7. **Chunk size**: the main JS bundle is 697.58 kB before gzip. No route-level code splitting is configured.

## What a live pass must cover

1. Start the backend with a disposable Postgres and Redis.
2. Seed two accounts and a private account.
3. Exercise QR sign-in or the documented dev login.
4. Follow, withdraw, accept, decline, block and unblock; confirm `relation` fields.
5. Create text/image/poll drops; like, save, comment, share, mute posts, delete.
6. Create moments; view, react, reply, see.
7. Start a DM and a group; send every supported kind; edit/delete/react/poll; reconnect socket.
8. Create a room; join from a second account; hand/stage/mute/start/end; open and play a game.
9. Create a playlist; add/reorder; share; open the public link.
10. Buy a theme, equip it, confirm the wallet and owned list.
11. Change password; revoke a device; sign out.
12. Check 360/768/1024/1440 px and run axe on every route.

# Xelvic Web — Final Gap Report

Date: 2026-11-01
Target: `xelvic-web/` only.
Reference (read-only): `xelvic/app` (Flutter, 151 screens, ~256k lines) and
`xelvic/backend` (Django, 24 apps).

## Honest headline

**Full mobile-to-web parity has not been reached.** The conversation system —
the stated highest priority — is implemented end to end at the code level and
passes typecheck, lint, unit tests and a production build. It has **not** been
verified against a live backend or a second device, because this environment
has neither.

The mobile app is 151 screens and ~256k lines; the web app is 20 pages and
~31k lines. Closing the rest is a multi-phase effort, not something this pass
completed.

## Status key

- **COMPLETE** — web surface exists, main interactions call real endpoints,
  static checks pass.
- **PARTIALLY COMPLETE** — some workflows exist; named sub-features are absent.
- **MISSING** — no web surface.
- **BLOCKED** — no honest web-only implementation exists.
- **NOT VERIFIED** — code exists but was not exercised live.

## Project integrity

- No file under `xelvic/` (mobile or backend) was created, edited or deleted by
  this work. Only reads were performed against the backend and mobile source.
- Checked again at the end of the Spark/chat pass:
  `git -C xelvic status --short -- app backend` shows only the same pre-existing
  `app/` Flutter/Gradle edits that were already there before this work
  (`analysis_options.yaml`, `android/*`, `pubspec.*`); `backend/` shows no
  changes. Nothing from this session appears in that list.
- Checked again at the end of the marketplace pass: the same result — only the
  pre-existing `app/` edits, and `backend/` clean. The marketplace work read
  `apps/studio/urls.py`, `apps/drip/urls.py`, `apps/sparks/urls.py`,
  `apps/accounts/urls.py` and `config/urls.py` to confirm the six endpoints it
  calls exist and are mounted where it calls them; it changed none of them.
- All edits and all seven documents live inside `xelvic-web/`.
- Checked again at the end of the Moments pass: the same result. The pass read
  `app/lib/screens/moment_view.dart`, `app/lib/moments.dart`,
  `app/lib/screens/drop_card.dart`, `app/lib/screens/memory_add.dart`,
  `app/lib/strings/en.dart`, `backend/apps/moments/urls.py`,
  `backend/apps/moments/views.py` and `backend/apps/moments/services.py` to
  confirm the ten routes the viewer calls (eleven calls — `{id}/` is both the
  read and the Take down) and the rules it keeps; it changed
  none of them. All 22 Moments routes the web uses are tabulated against
  `apps/moments/urls.py` and `config/urls.py:175` in
  `XELVIC_API_COMPATIBILITY_REPORT.md`. `git -C xelvic status --short -- app
  backend` still shows only the pre-existing `app/` Flutter/Gradle edits.

## Moments (ported from `MomentViewScreen`, 2026-11-01)

| Piece | Status | Note |
| --- | --- | --- |
| Walk, clock and per-item hold | COMPLETE / NOT VERIFIED live | 60ms ticker; `MomentItem.hold` ported exactly (clip window, sound window capped at `kSoundLongest`, a carried picture's own life, else `HOLD_FLOOR`); a video's bar read off the element's own clock |
| Tap / hold gestures | COMPLETE / NOT VERIFIED | tap steps (left 32% back, else forward); hold pauses at 480ms (`kHoldToPause`) and arms leaving at 1230ms (`kHoldToPause + kHoldToLeave`); the click the browser fires after a hold is swallowed by hand, because the web has no gesture arena to do it |
| Carried, and the line that names it | COMPLETE / NOT VERIFIED | `_carried` order and `_carriedTo` words ported; "Hold to open X" / "Let go to open X" drawn only when the item carries something |
| Seen | COMPLETE | per item as it comes up, and the moment on its last item |
| Answers tally + who sheet | COMPLETE / NOT VERIFIED | drawn on my own day only, exactly as `_reactions` gates it; the sheet reads viewers, reactors and (on a poll) voters when it is opened |
| Faces and the heart | COMPLETE / NOT VERIFIED | tap = `kStoryLike` or a take-back, hold = `kStoryFaces`; the server's answer is what is drawn |
| Reply | COMPLETE / NOT VERIFIED | `/reply/`, a message into a convo; holding the clock while the field is focused |
| Carry | PARTIALLY COMPLETE | `/carry/` on the item that names me. The app edits the picture in its Image editor first; the web carries it as it stands |
| Share | COMPLETE / NOT VERIFIED | gate then picker, one convo at a time, count reported from what actually arrived |
| Add to Memories | COMPLETE / NOT VERIFIED | `AddToMemories` from the three dots, and `/app/moments?memories=1` from "New Memory" on my own profile — which was a live dead button before this pass |
| Memory walk (`isMemory`) | MISSING | `MomentViewer` is built for moments; the app's Memory branches (a Memory's own header words, `/memories/{id}/react|share|reply`, Remove instead of Take down) are not ported |
| Together mode, stickers/drawings | MISSING | |
| The Morning Question | **removed** | A composite moment built around a `prompt` field that exists on neither the server nor the app. It was fabricated, so it is gone rather than hidden; `XELVIC_MOBILE_FEATURE_INVENTORY.md` records the correction |

## Conversation system (Phase 4)

| Area | Status | Note |
| --- | --- | --- |
| Two-pane layout, responsive | COMPLETE | desktop sidebar + pane; mobile full-screen |
| Optimistic send | COMPLETE / NOT VERIFIED | `client_id`, pending row, server reconciliation |
| Failed send + retry | COMPLETE / NOT VERIFIED | retry reuses `client_id`, no duplicate; asset not re-uploaded |
| Upload progress | COMPLETE / NOT VERIFIED | XHR `upload.onprogress`, `Uploading n%` + bar |
| Message types | COMPLETE | text, image, video, voice/audio, doc, poll, drop/live/playlist cards, location, collab, vanish-ask, system |
| Replies / edit / delete / copy / react / vote | COMPLETE | existing, preserved |
| Forward | COMPLETE / NOT VERIFIED | `ForwardSheet` → `/forward/` |
| Message info (group) | COMPLETE / NOT VERIFIED | `MessageInfoSheet` → `/info/` |
| Receipts | COMPLETE | server `status` + watermarks only; no fabricated "Delivered" |
| Typing + presence | COMPLETE / NOT VERIFIED | socket events |
| View-once / Spark | COMPLETE / NOT VERIFIED | correct send contract (`payload.view_once`), `open-once/`, recipient tile, sent/opened/gone pill, run viewer, sound band, reply, server shot line |
| Chat-screen design fidelity | COMPLETE (static) | app heading, bubble/composer metrics, run spacing, day pills, sender-at-run-head, receipt and edited placement |
| Theme's own picture inside a chat | COMPLETE / NOT VERIFIED | `theme.chatWall` behind the thread when no wallpaper was picked, at `chatVeil ?? WALL_SCRIM` of the page's own ink; the bar and composer go glass while the theme stands on a picture |
| Chat accent on an uncoloured convo | PARTIALLY COMPLETE | The phone's `tintOf('default')` is `theme.chatTint ?? kChatTint` (`#E31B66`) and deliberately **not** the app accent, so picking a colour never repaints conversations somebody left alone. The web computes that exact value into `--convo-accent` but does not read it: `ChatPage` still falls back to `--accent`, so an uncoloured convo follows the theme's accent instead of the app's pink. `TINT_HEX` also still carries the server's dark-scheme hexes (`#22d3ee`) where the phone carries its light-scheme readings (`#0E7C8C`), which changes both the tinted chat's accent and the picker's swatches. Both are named here rather than quietly changed, because they alter screens that were not the subject of this pass. |
| Typing / presence surface | PARTIALLY COMPLETE | typing events still real; web shows a dot line, the app shows the other side's character pose (no web character catalogue); header `online` text removed to match the app |
| Live thread card + reorder | COMPLETE / NOT VERIFIED | `thread.update` patched in place |
| Conversation list preview / unread | COMPLETE | real preview + numeric badge |
| Message search | COMPLETE / NOT VERIFIED | `/chat/search/` in the Convo search field |
| Drafts, emoji, attach menu, auto-grow | COMPLETE | |
| Scroll / pagination | VERIFIED (static) | anchor preserved when older pages load; optimistic rows sort last |
| Group admin (members/roles/invites/rooms) | PARTIALLY COMPLETE | list and basic management only |
| Vault / vanishing | PARTIALLY COMPLETE | mode shown; consent flow limited |
| Disappearing-message consent sheets | MISSING | |
| Sticker picker / Keep / collab consent sheets | MISSING | |
| Offline outbox / durable sync | MISSING | `/chat/sync/` unused; needs design |
| Calls (audio/video) | BLOCKED | needs a WebRTC product build; buttons state this honestly |

## Other module families

| Family | Status | Remaining gap |
| --- | --- | --- |
| Shell, theme, navigation | COMPLETE | account switching missing (needs a second credential store); language preference now has its page |
| Auth (QR, dev, refresh, logout) | COMPLETE / NOT VERIFIED live | deactivation is surfaced behind its password; signup remains phone-only (backend unavailable concept) |
| Profile, privacy, devices | COMPLETE (NOT VERIFIED live) | both profile pages, the day behind the face, the face dialog, the birthday fall, mutuals, their QR; professional profile and verification each have their page; devices list and revoke. Named gaps below. |
| Social graph | PARTIALLY COMPLETE | mutuals and the crew lists are surfaced, and Insights has its page; circles, collabs and deals remain missing |
| Drops / feed | COMPLETE core | notes and the full media sheets still partial; the Vibes shelf, walk and studio are now in |
| Moments | PARTIALLY COMPLETE | the viewer is a port of `MomentViewScreen` (hold, carried, faces, who sheet, carry, share gate, Add to Memories), but together mode, stickers/drawings and the walk over a Memory's own items are missing, and a carry lands the moment unedited because the web's `CameraCapture` has no "seed with an existing file" door |
| Audio | COMPLETE core | music sheet share partial; audio studio out of scope |
| Live rooms | COMPLETE core | games, boards, bits missing |
| Sparks / rewards | PARTIALLY COMPLETE | leaderboard and reward screen partial |
| Marketplace (Drip / Themes / Logos) | COMPLETE / NOT VERIFIED | one page, three aisles, one purse, ported aisle by aisle from `marketplace.dart`, `drip.dart`, `theme_shop_view.dart`, `logo_shop_view.dart`; every write goes to an existing endpoint |
| Themes, logos and drip in the shell | COMPLETE / NOT VERIFIED | a theme's picture now reaches the shell, the marketplace, the preview and the inside of a chat; the preview moves the whole web rather than a box in it |
| Notifications | COMPLETE on the app's own rules (NOT VERIFIED live) | list, in-app strip, hidden-tab rows and one routing table; a row after the site is **closed** is BLOCKED (FCM-only push), and server-backed preferences do not exist |
| Media pipeline | PARTIALLY COMPLETE | video poster generation missing; upload progress now done |
| Deals / circles / collabs / codepad | MISSING | large separate modules |
| Studio / editors (image, video, vibe) | PARTIALLY COMPLETE / MISSING | browser-constrained |

## Profile: what is still not the app's

The two profile pages are ports, not redrawings, and the list below is what a
careful reading of `profile.dart` and `person.dart` still finds missing.

| Item | Status | Why |
| --- | --- | --- |
| The theme-bundled figure behind a bio | PARTIALLY COMPLETE | `PosedBio` draws the pose and the character's name, but the web's theme catalogue does not carry the figure's *pictures*, so the figure itself is absent. The name is real; the art is not on this build. |
| The ⋮ sheet's convo section on somebody else's page | MISSING | `person.dart` folds that convo's own settings into the sheet (rename, mute, wallpaper, vanish). The web has no convo-settings sheet on a profile, so the web's ⋮ holds mute and report only — it does not draw rows it cannot honour. |
| Live-moment ring on the *drops* feed and in search | NOT STARTED | `drops.dart` and `home.dart` ring an author's face the same way the profile does. The profile and the convo row now ring; the feed still draws a bare face. Named rather than quietly half-done. |
| The face's hold on a touch screen | COMPLETE, NOT VERIFIED | The hold is a 480ms pointer hold with the follow-up click swallowed. It has not been tried on a real touch device here. |

## Notifications: what stands, and what cannot

The third phase of the ask — *notifications exactly as the app has them, real
time, and a popup when the site is closed* — is two thirds done and one third
impossible from inside this project.

| Piece | Status | Why |
| --- | --- | --- |
| Alerts list, to the app's geometry | COMPLETE (static) | card, face, badge, mark door, tile, keep answers, unread dot and scroll-for-more all read off `screens/alerts.dart` |
| Alert kinds the row did not know | COMPLETE | `friend_moment` and `studio` now have a sentence, a tone, a glyph and a route |
| Live alerts | COMPLETE (NOT VERIFIED live) | `alert.new` / `alert.read` patch the list; a hidden tab also gets a system row |
| In-app strip | COMPLETE (NOT VERIFIED live) | `features/notices`, the phone's `Notices` rules: 4s hold, five deep, same-conversation replacement, ordinal dedupe, muted and watching skipped, chime only in front |
| The tab's own row while the site is open in the background | COMPLETE (NOT VERIFIED live) | the browser's `Notification`; a strip that is up when the tab goes away is handed over to it |
| A row after the site is **closed** | **BLOCKED** | the server's only push road is Firebase, to `Device.push_token`. A web push endpoint needs a Firebase project config, a VAPID key and a service worker — none exist in this build, and the backend may not be changed. Nothing was faked: the Notifications page says the sound stops when the site closes |

This is a limit of the address, not of the code: the same server, asked by the
phone, rings a pocket. A browser has no such address yet.

## What is deliberately not claimed

- **No 100% parity claim.** Large product families above remain unimplemented.
- **No live real-time claim.** The socket wiring is implemented and matches the
  backend frames, but no live two-client run happened here. Cross-device sync
  is `NOT VERIFIED`.
- **No fabricated state.** Receipts, unread counts, previews and forward counts
  come from server responses. Where a capability is absent (calls, signup,
  sync replay), the UI says so instead of simulating it. The marketplace keeps
  this rule as tightly as the chat does: nothing is bought optimistically, a
  purchase that the server refuses leaves the shelf exactly as it was and says
  so, and no button in the three aisles is a button that does nothing.
- **No live marketplace run.** Not one purchase, wear or figure pick was
  executed against a running backend. The aisles are wired to endpoints that
  were confirmed to exist by reading the backend's URL conf, and that is all
  that was confirmed.

## Recommended next steps, in priority order

1. Run the live pass in `XELVIC_TESTING_REPORT.md` §5 with a real device pair.
2. Group admin surfaces (members, roles, invites, rooms) — the largest
   remaining conversation gap.
2. `MomentViewer`'s two named gaps: the Memory walk (`isMemory` — a Memory's own
   header words, Remove in place of Take down, and the four
   `memories/{id}/react|reply|share|reactors/` routes the backend already
   serves) and together mode with stickers/drawings.
3. Carry with an edit: the app opens the picture in its Image editor before it
   lands. The web needs a seed-with-an-existing-file door in `CameraCapture`
   first, so a carry here lands the moment as it stands.
4. Web push, if the backend ever grows a browser address: a Firebase web app, a
   service worker and a `Device` row are the three missing pieces, and none of
   them can be added from `xelvic-web/` alone.
5. Offline outbox design (this is where the mobile app's `offline/*` store has
   no web equivalent yet).
6. The chat's accent on an uncoloured convo (read `--convo-accent`, and settle
   `TINT_HEX` against the phone's `kTints`) — a small change that alters
   existing chat screens, so it wants its own pass.
7. Then the large independent modules (circles, collabs, deals, editors), one at
   a time, each with its own tracker entry.
# Section and interaction audit

This document covers the shell and the cross-screen gestures, not individual routes. Route coverage lives in `SCREEN_BY_SCREEN_AUDIT.md`.

## Shell sections

| Section | Web behaviour | Mobile reference | Gap |
| --- | --- | --- | --- |
| Desktop rail | 88 px icon rail, 240 px expanded rail with labels | Android navigation | Close in intent, not pixel-identical |
| Mobile top bar | Brand, search, alerts, Rewards, avatar | Android app bars | No notification badge yet |
| Mobile bottom navigation | Five glass destinations | Android bottom bar | Reward is accessible from the top-bar shortcut, not a sixth tab |
| Profile menu | Profile, settings, sign out | Android drawer/menu | No theme shortcut in the menu; rail has one |
| Player | Persistent bar above navigation | `player.dart` | Media Session controls are wired where supported; OS integration is unverified and no background service exists |
| Theme backdrop | Five shell destinations only | Android painting rule | Correctly limited to shell pages |
| Toasts | Top/bottom notifications with tone | Android snackbars | No action button inside a toast |

## Navigation rules

- Primary destinations are Drops, Moments, Convo, Audio and Live.
- Search, Alerts, Saved, Sparks and Settings are secondary.
- A protected route waits for session restoration before rendering.
- Signed-in users are redirected away from `/signin`.
- A missing route renders the not-found page, not a blank shell.
- The desktop theme button links to `/app/settings?section=appearance`; the settings page reads `section` and opens that tab.
- A profile link uses the username, not the UUID, so it is shareable.

Known navigation gaps:

- No own-QR route.
- No crew list route.
- No artist route.
- No calls route.

## Interaction inventory

### Feed and drops

| Interaction | Implemented | Notes |
| --- | --- | --- |
| Pull/refresh | Yes | Query invalidation and button |
| Infinite scroll | Yes | Cursor pages; explicit load-more |
| Like | Yes | Optimistic counter, server settle |
| Save | Yes | Optimistic counter, server settle |
| Comment | Yes | Modal, list and create |
| Poll vote | Yes | Server response replaces local poll |
| Share | Yes | Server link copied when clipboard permits |
| Hide/delete | Yes | Confirmation for delete |
| Long-press menu | Partial | Explicit menu button instead |
| Swipe gestures | No | Not part of the web interaction model |

### Moments viewer

| Interaction | Implemented | Notes |
| --- | --- | --- |
| Tap left/right | Yes | Previous/next |
| Keyboard arrows/Escape | Yes | Desktop path |
| Timed advance | Yes | Per-item duration |
| Pause on hold | Partial | Tap/hold behaviour is limited |
| Seen | Yes | On view |
| React/reply | Yes | Real endpoints |
| Sound | Yes | Browser autoplay policy applies |
| Swipe down to close | No | Close button and Escape |

### Chat

| Interaction | Implemented | Notes |
| --- | --- | --- |
| Send on Enter | Yes | Shift+Enter for a newline |
| Reply | Yes | Quoted reply |
| Edit/delete/copy | Yes | Own messages and permissions |
| React | Yes | Server-backed |
| Poll create/vote | Yes | Server-backed |
| Attach image/video/audio/doc | Yes | `/chat/assets/` |
| Record voice | Partial | `MediaRecorder` or file fallback |
| Typing indicator | Yes | Socket with throttle |
| Read receipts | Yes | Socket/endpoint |
| Search in thread | Partial | Thread list search; in-thread search not a full screen |
| Pin/mute/vault | Partial | Flags where exposed; vault screen absent |
| Forward | Partial | API path limited |
| Long-press actions | Partial | Explicit action menu |

### Audio player

| Interaction | Implemented | Notes |
| --- | --- | --- |
| Play/pause | Yes | One audio element |
| Seek | Yes | Native labelled range input supports keyboard and touch; behavior is not yet browser-tested with active audio |
| Next/previous | Yes | Queue |
| Shuffle/repeat | Partial | Queue modes limited |
| Background playback | No | Browser tab must stay alive |
| OS media keys | Partial | Media Session metadata, playback state, track actions and seek actions are wired; support varies and was not device-tested |
| Add to playlist | Yes | Playlist detail flow |
| Share playlist | Yes | Link and revoke |

### Live room

| Interaction | Implemented | Notes |
| --- | --- | --- |
| Join/leave | Yes | Auto-join once when live |
| Raise hand | Yes | Server action |
| Stage/dismiss | Yes | Host controls |
| Mute/camera | Yes | Host controls; browser media not published |
| Chat | Yes | Socket with polling fallback |
| Reactions | Yes | Five confirmed throws |
| Game open/join/play | Yes | Exact subroutes unverified |
| Share room | Yes | Share-to-convo modal |
| Start/end | Yes | Host only |
| Codepad | No | Missing |
| Calls | No | Out of scope |

### Profile and social

| Interaction | Implemented | Notes |
| --- | --- | --- |
| Follow/withdraw | Yes | Relation response applied |
| Follow back | Yes | Label derived from `follows_me` |
| Block/unblock | Yes | Confirmation |
| Mute posts | Yes | `/drops/mute/<id>/` |
| Report | Yes | Reason picker |
| Message | Yes | `/chat/threads/`; gate shown on refusal |
| Share profile | Yes | Clipboard with fallback message |
| Edit own profile | Yes | Settings link |
| Infinite grid | Yes | Cursor pages |
| Private wall | Yes | 403 handled |

### Settings

| Interaction | Implemented | Notes |
| --- | --- | --- |
| Edit name/username/bio | Yes | `PATCH /auth/me/` |
| Avatar/cover upload | Yes | Upload and remove |
| Privacy switches | Yes | Server response updates session user |
| Theme and mode | Yes | Local persistence plus server theme |
| Password change | Yes | Current/new, min 8 |
| Device list/revoke | Yes | Unverified against a live server |
| Contacts choice | Partial | Browser cannot read contacts; matches are shown and denial is recorded, allowing is Android-only |
| Sign out | Yes | Refresh revocation and redirect |
| Deactivate | No | Missing |
| Own QR | No | Missing |

## State handling

Every data screen is expected to distinguish:

1. Loading: skeleton or inline wait.
2. Empty: explanation and a next action.
3. Error: message, retry, and no stale fake data.
4. Unauthorised: protected-route redirect or sign-in prompt.
5. Missing capability: 404/405 rendered as a sentence, not an empty list.
6. Offline: the query layer surfaces the failure; cached data may remain visible.

This pass found no screen that renders demo rows as if they came from the server.

## Keyboard and focus

- Modal and confirm dialog close on Escape and restore focus through the shared `Modal`.
- Chat composer supports Enter/Shift+Enter.
- Moment viewer supports arrows and Escape.
- Form controls use native labels and focus rings.
- The signed-in shell now includes a skip link to its main content; its keyboard behavior has not been exercised in an authenticated session.
- Remaining gaps: no full focus-trap audit and no screen-reader pass with real assistive technology.

## Responsive behaviour

- Mobile: single column, glass bottom navigation, safe-area padding.
- Tablet/desktop: left rail, wider grids, max-width content columns.
- The layout was written for 360 px upward but was not visually exercised at 360/768/1024/1440 in this pass.
- No horizontal overflow was observed in source review; this is not a substitute for a browser check.

## Motion and media

- Transitions are short and CSS-based.
- Theme art is fixed and non-parallax.
- No autoplay audio; playback requires a gesture.
- `src/styles.css` has a global `prefers-reduced-motion: reduce` rule; behavior has not been tested with the preference enabled.

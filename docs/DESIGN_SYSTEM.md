# Design system

## Source

The palette, radii, typography intent and shell layout come from `xelvic/app/lib/theme.dart` and `theme_shop.dart`. Art comes from the decompiled release APK because it is newer than the checkout and matches the Xelvic brand.

The mobile app is a flat, tonal interface: no decorative gradients, depth from single-tone alpha fades, a dark glass navigation pill, white cards on a pale page, and one accent chosen by the account. The web adapts that language to a wide canvas: the five app destinations become a left rail on desktop and a floating glass tab bar on mobile.

## Brand

- Name: **Xelvic**
- Wordmark: white or black PNG at 2561x759 (ratio 3.373), never stretched.
- Voice: direct, warm, lower-case in product copy, no exclamation marks.
- Logo clear space: at least the height of the "X" on all sides.
- The Xelvic wordmark is used on sign-in and email/social share cards. The root URL opens sign-in directly; no marketing landing page is included in this client. The app shell uses the mark plus a text label only on small screens.

## Colour tokens

The app accent is dynamic. Every theme defines:

| Token | Meaning | Default |
| --- | --- | --- |
| `--accent` | Accent readable as text on white | `#E31B66` |
| `--accent-pill` | Accent readable on the dark pill | `#E31B66` |
| `--accent-soft` | Accent at 8% for paper/unread | color-mix |
| `--page` | Page ground | `#F7F7FB` |
| `--card` | Raised surface | `#FFFFFF` |
| `--line` | Hairline | `#E3E3EC` |
| `--ink` | Primary text | `#13131A` |
| `--dim` | Secondary text | `#6B6B7B` |
| `--on-accent` | Text on a filled accent | `#FFFFFF` |
| `--paper` | Convo paper (accent at 8% over card) | `#FCEDF3` |
| `--solid` | Fixed near-black for QR/scrims | `#13131A` |

Status: `--good #0B7A44`, `--bad #D92B2B`. Award colours: amber `#C07A12`, rose `#CE3F62`, magenta `#B02E9B`, violet `#6C46D6`, cyan `#1B87AC`, mint `#11836A`, gold `#A8870F`.

Dark scheme: page `#12121A`, card `#1C1C26`, line `#2C2C38`, ink `#F2F2F7`, dim `#A9A9BC`.

Every text/background pairing must meet WCAG AA (4.5:1 normal, 3:1 large). The accent is chosen for contrast on the page; the pill colour is a separate, brighter reading for dark chrome.

## Available themes

The shop ships these designs, with art in `public/themes`:

| Key | Name | Price (sparks) |
| --- | --- | --- |
| `pink` | Pink | 0 |
| `unicorn` | Unicorn | 0 |
| `catgirl` | Cat Girl | 0 |
| `monsoon` | Monsoon | 60 |
| `chai` | Chai | 60 |
| `neon` | Neon | 60 |
| `orchid` | Orchid | 200 |
| `tidepool` | Tidepool | 200 |
| `ember` | Ember | 200 |
| `cosmos` | Cosmos | 450 |
| `sakura` | Sakura | 450 |
| `marigold` | Marigold | 450 |
| `aurora` | Aurora | 1500 |
| `obsidian` | Obsidian | 1500 |
| `peacock` | Peacock | 1500 |
| `solaris` | Solaris | 4000 |
| `nebula` | Nebula | 4000 |
| `eclipse` | Eclipse | 4000 |

The APK additionally contains paintings for `astro`, `bubblegum`, `cutlass`, `dino`, `idol`, `kitsune`, `mecha`, `ronin`, `shinobi`, `shojo`, `teddy`, `toon`, `windup`; these are included as browsable art but are only selectable when the server recognises the key, so the client never invents entitlements the backend does not know. Persona themes without a local palette use the theme named by their cover as a visual preview and keep the account's current palette until the server confirms.

Each theme can be used light or dark. A painting theme shows its page art behind the shell on the five main tabs, and only there; opened pages sit on the theme's ground.

## Typography

- UI: Manrope Variable (bundled), fallback `ui-sans-serif, -apple-system, "Segoe UI", Roboto`.
- Numerals: tabular for counts, timers, prices and timestamps.
- Scale: 12 / 13 / 14 / 16 / 18 / 22 / 28 / 40 / 56 px.
- Weights: 400 body, 600 labels, 700 headings, 800 display.
- Headings tighter (`-0.035em`), body normal. Display uses `clamp()`.
- Mono: `ui-monospace, "Cascadia Mono", "SFMono-Regular"` for QR codes, match digits and invite codes.

## Spacing, radius, elevation

- 4 px base; common steps 4, 8, 12, 16, 20, 24, 32, 48, 64.
- Radius: 10 small, 14 controls/cards, 20 sheets, 28 panels, 999 pills.
- Page width: 1240 px content, 720 px reading column, 420 px side sheets.
- Shadow: `0 1px 2px rgb(19 19 26 / .04), 0 12px 32px rgb(19 19 26 / .08)` for raised cards; no shadow on flush rows.
- Glass nav: dark `#13131A` at 62% over the page with a 1 px `#E3E3EC` hairline at 24% and backdrop blur 20 px.

## Layout

### Desktop (≥ 1024 px)

- 88 px icon rail (expanded 248 px on hover/focus) on the left.
- Main content centred; 340 px context column on Drops/Convo when room allows.
- Composer opens as a centred 640 px dialog.
- Chat uses list + conversation + optional details, each independently scrollable.

### Tablet (640–1023 px)

- Compact rail with icons and labels, no context column.
- Two panes maximum.

### Mobile (< 640 px)

- One pane; bottom glass tab bar with five destinations.
- Header 56 px, safe-area aware.
- Sheets slide from the bottom with a drag handle; dialogs become full-screen pages for composers and settings.
- Tap targets minimum 44x44 px.

## Components

- **Wordmark** — image with alt "Xelvic"; optional white variant.
- **Avatar** — image or initials; ring in accent for unseen moments; online dot bottom-right.
- **Button** — primary (accent fill, 52 px min height, radius 14), secondary (card + line), ghost, destructive; loading spinner replaces label, width preserved.
- **Icon button** — 40 px, 14 px radius, tooltip via aria-label and title.
- **Input** — filled card, 1 px line, 14 px radius, accent 1.5 px when focused; label above, hint below, error in `--bad`.
- **Card** — white surface, 1 px line, 14 px radius; feed cards are borderless until hover, then line + shadow.
- **Drop card** — author row, body, media (aspect from server), action rail (respond, share, save, like), optional poll, first respond strip.
- **Story tray** — horizontal snap rail of 96 px circles, "Your moment" first with add badge.
- **Story viewer** — full-screen dialog, segmented progress, author header, sound, reactions, reply field.
- **Convo row** — avatar, name, last line, time, unread badge; panes in glass themes.
- **Message bubble** — mine right/accent fill/white text, theirs left/card; radius 18 with one 6 px corner; replies show a quoted strip; reactions below.
- **Audio player** — fixed bottom bar above tab bar on mobile, bottom of rail on desktop; artwork, title, scrubber, play/pause, skip, volume; mini/full states.
- **Live room card** — stage collage, title, host, listener count, live pulse.
- **QR panel** — near-black modules on white card, four-module quiet zone, error correction M, rotation ring/countdown, match digits large, states (loading/waiting/scanned/approved/denied/expired/unavailable).
- **Theme tile** — cover art, name, mood, price/lock; selected ring in accent. Reward previews temporarily apply the palette, then offer a separate Open or Wear action; paid tiers show earned progress and remaining picks.
- **Toast** — dark solid slab, white text, bottom centre; error variant with icon.
- **Empty state** — line illustration in accent soft, one sentence, one action.
- **Skeleton** — card-shaped shimmer using `--line` at two opacities; never a spinner for first paint.

## Motion

- 150 ms for hover/focus, 220 ms for sheets, 300 ms for page content.
- Respect `prefers-reduced-motion`: no transforms, only opacity.
- Stories advance with a linear progress bar; pause on pointer down.
- No looping decorative animation except the live pulse and the QR rotation countdown.

## Accessibility

- Focus ring: 2 px accent with 2 px offset; visible on all interactive elements.
- Every icon-only control has an accessible name.
- Story viewer and modals trap focus, close on Escape, restore focus.
- Colour is never the only signal: unread also has weight/dot, liked also changes the icon fill, live also says "Live".
- Video/audio controls are keyboard reachable; captions shown when the API supplies them.
- Contrast is verified for the default pink and dark schemes; custom palette themes carry the same constraints.

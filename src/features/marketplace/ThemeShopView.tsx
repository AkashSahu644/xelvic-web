// The Themes aisle of the marketplace: where the colour the whole web is read
// in is chosen.
//
// Ported from `screens/theme_shop_view.dart` and `screens/theme_preview.dart`.
// A theme is not one screen's business — it reaches every screen through the CSS
// variables `ThemeProvider` writes on `<html>`, which is why nothing below ever
// names a colour of its own. What each theme *is* lives in `theme/catalog.ts`,
// which ones the shop draws is `theme/shop.ts`'s ladder, and which one is on is
// the provider's; this file is the hand that picks.
//
// Three things sit here, top to bottom:
//
//   1. **the mode row** — light by default, dark one tap away from the same
//      place, exactly as the app's `_modeRow` cycles Light → Dark → System;
//   2. **the designed themes, as posters** — a tap opens the preview, and the
//      preview is where a theme is worn. Nothing buys on a tap: buying is the
//      one decision that spends somebody's sparks, and it is made on a page that
//      has already shown what is being bought;
//   3. **Mix your own** — the eight colours, which are free and always have
//      been. They are nobody's rung on the ladder and nobody's price.
//
// The posters are the panel's shelf in the panel's order: every design the
// catalogue has a live row for, and the short shelf this build ships when no
// catalogue has landed. See `shelfDesigns`.

import { useEffect, useState, type ReactNode } from "react";
import { Check, Moon, RefreshCw, Sun, SunMoon, Zap } from "lucide-react";
import { Backdrop } from "@/components/layout/Backdrop";
import { cn } from "@/utils/cn";
import { inkOn } from "@/features/convo/skin";
import { useToast } from "@/hooks/useToast";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { TONES, type ThemeDesign, type ThemePalette, type Tone } from "@/theme/catalog";
import { mixedDesign, paletteOf, TONES_MOST, toneNamed, tonesOf } from "@/theme/shelf";
import { canOpen, count, isOpen } from "@/theme/shop";
import { characterFor, CharacterMark, markSizeFor, Pose, ThemeCover } from "./marks";
import { figurePreviewPose, hasFigure, isLive, rowForKey } from "./model";
import { themePrice } from "./parts";
import { fetchAsFile } from "@/utils/fetchAsFile";
import { useCatalogue, useMarket, useMarketWallet } from "@/hooks/useMarketplace";
import type { CatalogueTheme, FigurePick } from "./types";

/** The colours a design leads with, matched by name and never by index. */
function toneList(names: string[] | undefined): Tone[] {
  if (!names) return [];
  return names.map((name) => toneNamed(name)).filter((tone): tone is Tone => Boolean(tone));
}

/** Whether this design paints a picture, and so is judged by it rather than by a swatch. */
function hasPicture(design: ThemeDesign): boolean {
  return Boolean(design.art || design.profileWall || design.chatWall);
}

// ---------------------------------------------------------------------------
// The aisle
// ---------------------------------------------------------------------------

export function ThemeShopView() {
  const { design, selectedDesign, palette, styled, mode, setMode, resolvedDark, shelf, setDesign } = useTheme();
  const { data: catalogue } = useCatalogue();
  const wallet = useMarketWallet();
  const rows = catalogue?.themes ?? [];
  const opened = new Set(wallet.data?.owned ?? []);
  const earned = wallet.data?.earned ?? 0;
  const balance = wallet.data?.balance ?? 0;
  const [preview, setPreview] = useState<ThemeDesign | null>(null);

  // Whether the picker is mixing several colours rather than choosing one,
  // opened on whichever the web is already wearing so it never starts by
  // describing a setting the app does not have.
  const [mix, setMix] = useState(() => toneList(palette.tones).length > 1);

  // Nothing is picked while a designed theme is on, and that is deliberate:
  // Teddy is not a selection of Teddy's pink, and a swatch lit up under it would
  // be this page claiming the web is wearing something it is not. A theme that
  // paints a picture is judged by the picture.
  const painting = Object.keys(styled.art).length > 0 || hasPicture(design);
  const picked = painting ? [] : toneList(palette.tones);

  /**
   * Take a colour, one way or the other.
   *
   * In one-colour mode this is the whole theme and every other colour leaves
   * with it. In mix mode it joins the ones already there, under the three rules
   * a person would guess: tapping a colour already in takes it out again, a full
   * theme makes room by dropping its *last* — never its first, which is the
   * colour the whole web leads with — and the last one standing cannot be tapped
   * away, because a theme of no colours is not a theme.
   *
   * Either way this is what leaves a designed theme behind: the theme it builds
   * carries no picture, which is one tap from Teddy back to a colour.
   */
  async function chooseTone(tone: Tone) {
    if (!mix) {
      await setDesign(mixedDesign(tonesOf([tone])).key);
      return;
    }
    const next = picked.slice();
    const at = next.findIndex((had) => had.name === tone.name);
    if (at >= 0) {
      if (next.length === 1) return;
      next.splice(at, 1);
    } else if (next.length < TONES_MOST) {
      next.push(tone);
    } else {
      next[next.length - 1] = tone;
    }
    await setDesign(mixedDesign(next).key);
  }

  return (
    <div>
      <ModeRow mode={mode} onMode={setMode} />

      <div className="mt-4 grid grid-cols-3 gap-3">
        {shelf.map((entry) => (
          <ThemeCard
            key={entry.key}
            design={entry}
            row={rowForKey(rows, entry.key)}
            worn={selectedDesign.key === entry.key}
            opened={opened}
            dark={resolvedDark}
            onOpen={() => setPreview(entry)}
          />
        ))}
      </div>

      {/* 15 at w800, the app's `_sectionHead`, which brings its own top padding
          so a section can be dropped in without the caller counting pixels. */}
      <h2 className="mt-5 text-[15px] font-extrabold text-ink">Mix your own</h2>
      <div className="mt-2">
        <MixCard mix={mix} onMix={setMix} picked={picked} onChoose={(tone) => void chooseTone(tone)} />
      </div>

      {preview ? (
        <ThemePreviewPage
          design={preview}
          row={rowForKey(rows, preview.key)}
          opened={opened}
          earned={earned}
          balance={balance}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * Light or dark, as one button.
 *
 * It shows what is on — an icon and the word — and each press moves to the next,
 * Light → Dark → System → Light. Light is where it starts, because that is where
 * the app starts. The icon, the word and the small sync arrow all change, so the
 * button always says what pressing it just chose.
 */
function ModeRow({ mode, onMode }: { mode: ThemeMode; onMode: (mode: ThemeMode) => void }) {
  const order: ThemeMode[] = ["light", "dark", "system"];
  const next = order[(order.indexOf(mode) + 1) % order.length];
  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : SunMoon;
  return (
    <div className="flex items-center justify-between gap-2.5">
      <span className="text-[13px] font-bold text-ink">Mode</span>
      <button
        type="button"
        onClick={() => onMode(next)}
        className="flex h-[34px] items-center gap-2 rounded-[11px] border border-line bg-card px-3 shadow-sm transition"
      >
        <Icon className="size-[17px] text-[var(--accent)]" aria-hidden />
        <span className="text-[13px] font-bold text-ink">
          {mode === "light" ? "Light" : mode === "dark" ? "Dark" : "System"}
        </span>
        <RefreshCw className="size-[13px] text-dim" aria-hidden />
      </button>
    </div>
  );
}

/**
 * One theme on the shelf: its poster, its name, and a ring if it is the one on.
 *
 * A tap always opens the preview — the preview is where a theme is worn, and
 * looking before choosing is the whole of it. A tile that bought on tap would be
 * a shop that spent somebody's sparks before showing them what they were buying.
 */
function ThemeCard({
  design,
  row,
  worn,
  opened,
  dark,
  onOpen,
}: {
  design: ThemeDesign;
  row: CatalogueTheme | null;
  worn: boolean;
  opened: Set<string>;
  dark: boolean;
  onOpen: () => void;
}) {
  const facts = row ? { price: row.price, owned: row.owned } : undefined;
  const open = isOpen(design, opened, facts);
  const price = themePrice(design, row);
  const figure = row ? figurePreviewPose(row) : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={open ? design.name : `${design.name}, ${count(price)} sparks`}
      className="relative block aspect-[0.72] w-full overflow-hidden rounded-[18px] bg-[color-mix(in_srgb,var(--ink)_10%,var(--card))] text-left"
    >
      <ThemeCover design={design} dark={dark} className="absolute inset-0 size-full object-cover" />
      {/* A single-tone fade up from the foot, so a white name reads over a bright
          poster. One tone and an alpha — never a two-colour ramp. */}
      <span
        className="absolute inset-x-0 bottom-0 h-[78px]"
        style={{ background: "linear-gradient(to bottom, rgb(var(--solid-rgb) / 0), rgb(var(--solid-rgb) / 0.72))" }}
        aria-hidden
      />
      {/* The theme's own face, small, top-left — the same mark it wears in a
          convo, drawn in the reading the poster is being shown in. */}
      <span className="absolute left-2 top-2 block">
        <CharacterMark design={design} row={row} palette={paletteOf(design, dark)} size={markSizeFor(row, true)} />
      </span>
      {figure ? (
        <span className="absolute bottom-7 right-1.5 block">
          <Pose src={figure} size={46} />
        </span>
      ) : null}
      {open ? null : (
        <span
          className="absolute right-[7px] top-[7px] flex items-center gap-0.5 rounded-[8px] px-[7px] py-[3px] text-[10px] font-extrabold text-white"
          style={{ background: "rgb(var(--solid-rgb) / 0.55)" }}
        >
          <Zap className="size-[11px]" aria-hidden />
          {count(price)}
        </span>
      )}
      <span className="absolute inset-x-2.5 bottom-[9px] truncate text-[13px] font-extrabold text-white">
        {design.name}
      </span>
      {worn ? (
        <>
          <span
            className="pointer-events-none absolute inset-0 rounded-[18px] border-[2.5px] border-[var(--accent)]"
            aria-hidden
          />
          <span className="absolute right-[7px] top-[7px] rounded-[8px] bg-[var(--accent)] px-[7px] py-[3px] text-[9px] font-extrabold text-[var(--on-accent)]">
            Wearing
          </span>
        </>
      ) : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// The eight colours, which are not for sale
// ---------------------------------------------------------------------------

/**
 * The colour picker as one designed panel, so it sits beside the posters as
 * something made rather than as a loose grid of dots: a soft card, the toggle
 * along its top, the eight colours under it.
 */
function MixCard({
  mix,
  onMix,
  picked,
  onChoose,
}: {
  mix: boolean;
  onMix: (mix: boolean) => void;
  picked: Tone[];
  onChoose: (tone: Tone) => void;
}) {
  return (
    <div className="rounded-[20px] border border-line bg-card px-3 pb-1.5 pt-3">
      <div className="flex gap-0 rounded-[11px] p-[3px]" style={{ background: "rgb(var(--ink-rgb) / 0.05)" }}>
        <Toggle label="One colour" on={!mix} onClick={() => onMix(false)} />
        <Toggle label={`Mix up to ${TONES_MOST}`} on={mix} onClick={() => onMix(true)} />
      </div>
      <div className="mt-1.5 grid grid-cols-4">
        {TONES.map((tone) => {
          const at = picked.findIndex((had) => had.name === tone.name);
          const on = at >= 0;
          return (
            <button
              key={tone.name}
              type="button"
              onClick={() => onChoose(tone)}
              aria-pressed={on}
              aria-label={tone.name}
              className="flex flex-col items-center py-2"
            >
              {/* A ring that sits *around* the colour with a gap of the card, so
                  a chosen swatch lifts off the panel rather than only gaining a
                  heavier edge. The glow is one tone of the colour at an alpha. */}
              <span
                className="flex size-[46px] items-center justify-center rounded-full p-[3px] transition-[border-color,box-shadow] duration-150"
                style={{
                  background: on ? "var(--card)" : undefined,
                  borderStyle: "solid",
                  borderWidth: on ? 2.5 : 1,
                  borderColor: on ? tone.on : "var(--line)",
                  boxShadow: on ? `0 0 9px 0.5px rgb(${channels(tone.on)} / 0.38)` : undefined,
                }}
              >
                <span className="flex size-full items-center justify-center rounded-full" style={{ background: tone.on }}>
                  {on ? (
                    mix ? (
                      <span className="text-[13px] font-extrabold" style={{ color: inkOn(tone.on) }}>
                        {at + 1}
                      </span>
                    ) : (
                      <Check className="size-[17px]" style={{ color: inkOn(tone.on) }} aria-hidden />
                    )
                  ) : null}
                </span>
              </span>
              <span className={cn("mt-1.5 truncate text-[11px]", on ? "font-bold text-ink" : "font-medium text-dim")}>
                {tone.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "h-[34px] flex-1 rounded-[9px] text-[13px] transition",
        on ? "bg-card font-bold text-ink shadow-sm" : "font-semibold text-dim",
      )}
    >
      {label}
    </button>
  );
}

/** The three channels of a colour, for `rgb(<channels> / <alpha>)`. */
function channels(hex: string): string {
  const value = hex.replace("#", "");
  const six =
    value.length === 3
      ? value
          .split("")
          .map((part) => part + part)
          .join("")
      : value.slice(0, 6);
  const number = Number.parseInt(six, 16);
  if (!Number.isFinite(number)) return "19 19 26";
  return `${(number >> 16) & 255} ${(number >> 8) & 255} ${number & 255}`;
}

// ---------------------------------------------------------------------------
// The preview
// ---------------------------------------------------------------------------

/**
 * The preview: a theme, worn for a minute before it is chosen.
 *
 * A row of swatches would be a preview of the wrong thing. A theme is what the
 * whole app looks like, so this page is a poster of the theme, three small
 * phones drawn in its colours — a home, a chat and a menu — and the one
 * decision: wear it.
 *
 * It is a **real** look rather than a drawing of one. The palette goes on the
 * whole web before the page opens, through `previewDesign`, which writes nothing
 * to the account, and the Light / Dark segments move it again — so every token
 * on this page is the theme's own and both readings can be flipped through on
 * the real thing. Leaving puts the old theme back; the button in the same bar is
 * what keeps it.
 */
function ThemePreviewPage({
  design,
  row,
  opened,
  earned,
  balance,
  onClose,
}: {
  design: ThemeDesign;
  row: CatalogueTheme | null;
  opened: Set<string>;
  earned: number;
  balance: number;
  onClose: () => void;
}) {
  const { previewDesign, clearPreview, setPreviewDark, equip, setMode, resolvedDark, selectedDesign, backdropFor } =
    useTheme();
  const market = useMarket();
  const { toast } = useToast();
  const [useThemeImage, setUseThemeImage] = useState(false);
  const [useThemeCover, setUseThemeCover] = useState(false);
  const [applying, setApplying] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);

  const both = Boolean(row && hasFigure(row, "boy") && hasFigure(row, "girl"));
  const [figurePick, setFigurePick] = useState<FigurePick>(() =>
    both ? (row?.figure_pick === "girl" ? "girl" : "boy") : "",
  );

  // The palette goes on before the page is drawn and comes back off when the
  // page is left without choosing it, which is the only way "see what this looks
  // like" can mean the whole web rather than a box in the middle of it.
  useEffect(() => {
    previewDesign(design);
    return () => clearPreview();
  }, [design, previewDesign, clearPreview]);

  const facts = row ? { price: row.price, owned: row.owned } : undefined;
  const open = isOpen(design, opened, facts) && (!row || isLive(row));
  const price = themePrice(design, row);
  const able = canOpen(design, opened, earned, balance, facts);
  const left = price - balance;
  const wearing = selectedDesign.key === design.key;

  /**
   * The character whose pictures are on screen.
   *
   * A row may bring only one of the two, in which case that one is the figure
   * whatever the account picked — there is nothing to choose between. Only a row
   * that brings *both* is a question, and that is when the two chips are drawn.
   */
  const gender: "boy" | "girl" | "" = !row
    ? ""
    : !hasFigure(row, "boy")
      ? hasFigure(row, "girl")
        ? "girl"
        : ""
      : !hasFigure(row, "girl")
        ? "boy"
        : figurePick === "girl"
          ? "girl"
          : "boy";
  const figure = row && gender ? figurePreviewPose(row) : null;

  /**
   * Put it on.
   *
   * The reading being looked at becomes the web's mode, because what somebody
   * just saw is what they are agreeing to. The character pick goes first and
   * best-effort: it is remembered per theme, so the same person may be the girl
   * in one theme and the boy in another, and a wire that will not answer leaves
   * the theme on with the figure the server had already resolved.
   */
  async function applyTheme() {
    if (!open) {
      setTrouble("This theme is not open to wear.");
      return;
    }
    setApplying(true);
    setTrouble(null);
    setMode(resolvedDark ? "dark" : "light");
    if (both && figurePick) {
      try {
        await market.pickFigure(design.key, figurePick);
      } catch {
        // The theme still goes on; the pick is the thing that did not.
      }
    }
    const on = await equip(design);
    if (!on) {
      setApplying(false);
      return;
    }
    // A failure here does not undo the theme — the look is on and the picture is
    // the one thing that did not follow — so it is reported, not thrown.
    if (useThemeImage && design.profile) {
      try {
        await market.useThemeFace(await fetchAsFile(design.profile, `theme-face-${design.key}.jpg`));
      } catch {
        setTrouble("Could not set the theme photo.");
      }
    }
    if (useThemeCover && design.profileCover) {
      try {
        await market.useThemeCover(await fetchAsFile(design.profileCover, `theme-cover-${design.key}.jpg`));
      } catch {
        setTrouble("Could not set the theme cover.");
      }
    }
    setApplying(false);
    toast({ title: `${design.name} is on.` });
    onClose();
  }

  /** Buy the theme being looked at, then put it on. The tap spends, so it says so. */
  async function keepTheme() {
    if (applying) return;
    setApplying(true);
    setTrouble(null);
    try {
      await market.buyTheme(design.key);
    } catch (error) {
      setTrouble(error instanceof Error ? error.message : "That theme is not open to buy just now.");
      setApplying(false);
      return;
    }
    setApplying(false);
    await applyTheme();
  }

  const label = wearing
    ? "Wearing this theme"
    : open
      ? "Apply Theme"
      : able
        ? `Buy for ${count(price)}`
        : left > 0
          ? `Need ${count(left)} more`
          : "Not open yet";
  const ready = !wearing && !applying && (open || able);
  const reading = paletteOf(design, resolvedDark);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-page text-ink">
      {/* The preview is a page of the theme it is previewing, so it stands on
          that theme's own picture — the app's `theme_preview.dart` is a
          `ThemeBackdrop` for exactly this reason, and a preview that showed the
          colour but not the painting would be showing half of what is being
          bought. The design being previewed is the one `useTheme` is drawing
          right now, so `backdropFor` already answers for it. */}
      <Backdrop backdrop={backdropFor("convo")} position="absolute" />
      <div className="shrink-0 px-3 pb-1.5 pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink transition hover:bg-[rgb(var(--ink-rgb)/0.06)]"
          >
            <span className="text-[22px] leading-none" aria-hidden>
              ×
            </span>
          </button>
          <h2 className="min-w-0 flex-1 truncate text-[20px] font-extrabold">{design.name} Theme</h2>
          <button
            type="button"
            onClick={() => void (open ? applyTheme() : keepTheme())}
            disabled={!ready}
            className="flex min-h-10 min-w-[104px] shrink-0 items-center justify-center rounded-[13px] bg-[var(--accent)] px-3.5 text-[14px] font-bold text-[var(--on-accent)] transition disabled:opacity-45"
          >
            {applying ? <RefreshCw className="size-[18px] animate-spin" aria-hidden /> : label}
          </button>
        </div>
        <div className="mt-1.5 flex px-2">
          <div className="flex rounded-[11px] p-[3px]" style={{ background: "rgb(var(--ink-rgb) / 0.06)" }}>
            <Segment label="Light" on={!resolvedDark} onClick={() => setPreviewDark(false)} />
            <Segment label="Dark" on={resolvedDark} onClick={() => setPreviewDark(true)} />
          </div>
        </div>
        {trouble ? <p className="px-2 pt-1.5 text-[11.5px] text-[var(--bad)]">{trouble}</p> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
        {/* The poster, big, with its name and its character read off it. */}
        <div className="relative aspect-video overflow-hidden rounded-[20px]">
          <ThemeCover design={design} dark={resolvedDark} className="absolute inset-0 size-full object-cover" />
          <span
            className="absolute inset-x-0 bottom-0 h-24"
            style={{
              background: "linear-gradient(to bottom, rgb(var(--solid-rgb) / 0), rgb(var(--solid-rgb) / 0.66))",
            }}
            aria-hidden
          />
          <div className="absolute inset-x-3.5 bottom-3 flex items-center gap-2.5">
            <CharacterMark design={design} row={row} palette={reading} size={markSizeFor(row)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[20px] font-extrabold tracking-[-0.3px] text-white">{design.name}</p>
              <p className="truncate text-[12px] font-semibold text-white/80">{characterFor(design, row).name}</p>
            </div>
          </div>
        </div>

        {figure ? (
          <div className="mt-3.5 flex items-center gap-3 rounded-[16px] border border-line bg-card p-3">
            <span className="flex h-[76px] w-[64px] shrink-0 items-center justify-center">
              <Pose src={figure} fill />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-extrabold text-ink">The character</p>
              <p className="mt-0.5 text-[12px] leading-[1.3] text-dim">
                {both ? "Who stands with this theme?" : characterFor(design, row).name}
              </p>
              {both ? (
                <div className="mt-2 flex gap-2">
                  {(["boy", "girl"] as const).map((pick) => {
                    const on = gender === pick;
                    return (
                      <button
                        key={pick}
                        type="button"
                        onClick={() => setFigurePick(pick)}
                        aria-pressed={on}
                        className={cn(
                          "rounded-[9px] px-3.5 py-[7px] text-[12px] font-bold transition",
                          on ? "bg-[var(--accent)] text-[var(--on-accent)]" : "text-ink",
                        )}
                        style={on ? undefined : { background: "rgb(var(--ink-rgb) / 0.06)" }}
                      >
                        {pick === "boy" ? "Boy" : "Girl"}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {design.profile || design.profileCover ? (
          <div className="mt-3.5 overflow-hidden rounded-[16px] border border-line bg-card">
            {design.profile ? (
              <PictureSwitch
                on={useThemeImage}
                label="Use theme picture"
                leading={<Thumb src={design.profile} round />}
                onChanged={setUseThemeImage}
              />
            ) : null}
            {design.profile && design.profileCover ? <div className="ml-3.5 h-px bg-line" /> : null}
            {design.profileCover ? (
              <PictureSwitch
                on={useThemeCover}
                label="Use theme cover"
                leading={<Thumb src={design.profileCover} />}
                onChanged={setUseThemeCover}
              />
            ) : null}
          </div>
        ) : null}

        <h3 className="mt-5 text-[17px] font-extrabold text-ink">Preview</h3>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          <Phone label="Home Screen" page={reading} kind="home" />
          <Phone label="Chat Screen" page={reading} kind="chat" />
          <Phone label="Menu Screen" page={reading} kind="menu" />
        </div>
      </div>
    </div>
  );
}

function Segment({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "h-[30px] rounded-[9px] px-4 text-[12.5px] transition",
        on ? "bg-card font-bold text-ink shadow-sm" : "font-semibold text-dim",
      )}
    >
      {label}
    </button>
  );
}

/** The little picture the two switches offer, at the shape each is drawn in. */
function Thumb({ src, round = false }: { src: string; round?: boolean }) {
  return (
    <span className={cn("block shrink-0 overflow-hidden", round ? "size-10 rounded-full" : "h-10 w-14 rounded-[8px]")}>
      <img src={src} alt="" className="size-full object-cover" draggable={false} />
    </span>
  );
}

/**
 * One picture the theme offers, and the switch that says whether wearing the
 * theme also wears it.
 *
 * The whole row is the tap target, not just the switch: the picture and the
 * words are the thing being decided about, and a thumb that lands on "Use theme
 * picture" means exactly what one that lands on the switch means.
 */
function PictureSwitch({
  on,
  label,
  leading,
  onChanged,
}: {
  on: boolean;
  label: string;
  leading: ReactNode;
  onChanged: (on: boolean) => void;
}) {
  return (
    <div
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onClick={() => onChanged(!on)}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          onChanged(!on);
        }
      }}
      className="flex cursor-pointer items-center gap-3 px-3 py-[7px]"
    >
      {leading}
      <span className="min-w-0 flex-1 text-[14px] font-bold text-ink">{label}</span>
      <span
        className={cn(
          "relative h-[24px] w-[42px] shrink-0 rounded-full border transition",
          on ? "border-[var(--accent)] bg-[var(--accent)]" : "border-line bg-[rgb(var(--ink-rgb)/0.1)]",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "absolute top-[2.5px] size-[17px] rounded-full bg-white transition-[left]",
            on ? "left-[21px]" : "left-[2.5px]",
          )}
        />
      </span>
    </div>
  );
}

/**
 * A phone-shaped card holding a mock page, with its name under it.
 *
 * The three of them are the whole of the preview's second half: a theme is a
 * colour read across screens, and one poster cannot show how it reads on a list,
 * in a bubble and in a menu. Nothing here is live — the colours are the theme's
 * own, so what the three draw is what the real screens would draw, but the rows
 * inside them are a made-up person's.
 */
function Phone({
  label,
  page,
  kind,
}: {
  label: string;
  page: ThemePalette;
  kind: "home" | "chat" | "menu";
}) {
  return (
    <div>
      <div
        className="aspect-[0.56] overflow-hidden rounded-[16px] border border-line"
        style={{ background: page.page }}
      >
        <div className="flex size-full flex-col p-2">
          {kind === "home" ? (
            <MockHome page={page} />
          ) : kind === "chat" ? (
            <MockChat page={page} />
          ) : (
            <MockMenu page={page} />
          )}
        </div>
      </div>
      <p className="mt-1.5 truncate text-center text-[11px] font-semibold text-dim">{label}</p>
    </div>
  );
}

/** The convo list, in miniature. */
function MockHome({ page }: { page: ThemePalette }) {
  const rows: [string, string][] = [
    ["Bestie", "Heyy!"],
    ["Family", "Photo"],
    ["Umar", "Let's go!"],
  ];
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-[11px] font-extrabold" style={{ color: page.ink }}>
          Home
        </span>
        <span
          className="flex size-[14px] items-center justify-center rounded-full text-[9px] leading-none"
          style={{ background: page.accent, color: page.onAccent }}
        >
          +
        </span>
      </div>
      <div className="mt-2 space-y-[7px]">
        {rows.map(([name, line]) => (
          <div key={name} className="flex items-center gap-1.5">
            <span
              className="size-[18px] shrink-0 rounded-full"
              style={{ background: `rgb(${channels(page.accent)} / 0.3)` }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[8px] font-bold" style={{ color: page.ink }}>
                {name}
              </span>
              <span className="block truncate text-[7px]" style={{ color: page.dim }}>
                {line}
              </span>
            </span>
          </div>
        ))}
      </div>
      <div
        className="mt-auto flex items-center justify-evenly rounded-[9px] border py-1.5"
        style={{ background: page.card, borderColor: page.line }}
      >
        {[0, 1, 2, 3].map((dot) => (
          <span
            key={dot}
            className="size-[11px] rounded-[3px]"
            style={{ background: dot === 0 ? page.accent : page.dim }}
          />
        ))}
      </div>
    </>
  );
}

/** One conversation, in miniature. */
function MockChat({ page }: { page: ThemePalette }) {
  const bubbles: [string, boolean][] = [
    ["How are you?", false],
    ["Doing well!", true],
    ["See you then?", false],
  ];
  return (
    <>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] leading-none" style={{ color: page.ink }}>
          ‹
        </span>
        <span
          className="size-[15px] shrink-0 rounded-full"
          style={{ background: `rgb(${channels(page.accent)} / 0.3)` }}
        />
        <span className="min-w-0 flex-1 truncate text-[9px] font-bold" style={{ color: page.ink }}>
          Bestie
        </span>
      </div>
      <div className="mt-2 space-y-[5px]">
        {bubbles.map(([text, mine]) => (
          <div key={text} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <span
              className="rounded-[9px] border px-[7px] py-[5px] text-[7.5px]"
              style={{
                background: mine ? page.accent : page.card,
                color: mine ? page.onAccent : page.ink,
                borderColor: mine ? "transparent" : page.line,
              }}
            >
              {text}
            </span>
          </div>
        ))}
      </div>
      <div
        className="mt-auto flex items-center gap-2 rounded-full border px-2 py-1.5"
        style={{ background: page.card, borderColor: page.line }}
      >
        <span className="min-w-0 flex-1 text-[7px]" style={{ color: page.dim }}>
          Say something
        </span>
        <span className="text-[9px] leading-none" style={{ color: page.accent }}>
          ↑
        </span>
      </div>
    </>
  );
}

/** The account menu, in miniature. */
function MockMenu({ page }: { page: ThemePalette }) {
  const rows = ["Account", "Privacy", "Pings", "Appearance"];
  return (
    <>
      <span
        className="mx-auto mt-0.5 block size-[30px] rounded-full"
        style={{ background: `rgb(${channels(page.accent)} / 0.3)` }}
      />
      <span className="mt-1 block text-center text-[9px] font-extrabold" style={{ color: page.ink }}>
        Umar
      </span>
      <div className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <div key={row} className="flex items-center gap-1.5">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: page.accent }} />
            <span className="min-w-0 flex-1 truncate text-[8px]" style={{ color: page.ink }}>
              {row}
            </span>
            <span className="text-[9px] leading-none" style={{ color: page.dim }}>
              ›
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

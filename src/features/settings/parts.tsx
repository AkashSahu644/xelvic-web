import { type ReactNode } from "react";
import { ArrowLeft, ChevronRight, Music2, Phone, Volume2 } from "lucide-react";
import { Backdrop } from "@/components/layout/Backdrop";
import { Modal } from "@/components/overlays/Modal";
import { cn } from "@/utils/cn";
import type { ScreenBackdrop } from "@/hooks/useTheme";

/**
 * The settings furniture: the page frame and the two row shapes every settings
 * screen is built from.
 *
 * Ported from `app/lib/screens/settings_tiles.dart`, which is the file the app
 * itself shares this way — `SettingsPage` (the frame plus its 17pt w800 title
 * bar), `SettingsSectionTitle`, `SettingsRow` and `SettingsSwitch`. The web kept
 * its own copies inline in `pages/SettingsPage.tsx` while Settings was one file;
 * now that each view is a file of its own they live here, so a row drawn on the
 * language page and a row drawn on the permissions page cannot drift apart.
 *
 * The measurements are the app's: rows pad 18/14/16/14 (the web's own gutter is
 * 16px, which is what `px-4 py-3.5` gives), a 21px icon in the accent, a 14.5pt
 * w600 label, a 12pt dim note, a 13pt w600 dim value on the right, and a chevron
 * only when the row goes somewhere *and* has nothing drawn after it — a row with
 * a switch or a result mark is already showing its own answer, and a chevron
 * beside it would promise a third state that does not exist.
 */

/**
 * The frame every settings view sits in.
 *
 * `backdrop` is for the one view that is a page of its own rather than a list of
 * rows. The app's Marketplace is a pushed screen — `Scaffold(backgroundColor:
 * X.pageGround, body: ThemeBackdrop(...))` — so a theme that paints shows its
 * picture behind the shop exactly as it does behind a shell page, and the view
 * that chooses a colour is the view that shows it. The rest of the settings are
 * read on the theme's own ink, which is what the app does too: its
 * `SettingsPage` is `Scaffold(backgroundColor: X.ink)` and stands on no picture
 * at all.
 */
export function SettingsShell({
  title,
  onBack,
  action,
  backdrop,
  children,
}: {
  title: string;
  onBack: () => void;
  action?: ReactNode;
  backdrop?: ScreenBackdrop | null;
  children: ReactNode;
}) {
  return (
    <div className={cn("relative isolate min-h-dvh text-ink", !backdrop && "bg-page")}>
      {/* Inside this shell's own box rather than pinned to the viewport: this
          shell sits inside the app shell's own box, and a layer pinned to the
          viewport from here would travel over the app shell's bar. */}
      <Backdrop backdrop={backdrop ?? null} position="absolute" />
      <header className="sticky top-0 z-30 flex h-[64px] items-center gap-2 border-b border-line bg-[color-mix(in_srgb,var(--page)_92%,transparent)] px-2 backdrop-blur-xl">
        <button type="button" onClick={onBack} className="icon-btn" aria-label="Back">
          <ArrowLeft className="size-6" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-extrabold">{title}</h1>
        {action}
      </header>
      <main className="mx-auto w-full max-w-[760px] pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-16">
        {children}
      </main>
    </div>
  );
}

/**
 * A named block of rows.
 *
 * `SettingsSectionTitle` in the app: 18/18/18/8 padding over an 11pt w800
 * uppercase dim heading, with the rows under it on the card. The web draws the
 * card as `bg-card` with hairlines between rows rather than as a floating
 * rounded block, which is how the rest of this app's lists are drawn.
 */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <h2 className="px-4 pb-2 pt-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-dim">
        {title}
      </h2>
      <div className="divide-y divide-line border-y border-line bg-card">{children}</div>
    </section>
  );
}

/** A bare card of rows, for a page that has no group headings of its own. */
export function SettingsRows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-line border-y border-line bg-card">{children}</div>;
}

export function SettingsRow({
  icon,
  title,
  note,
  value,
  trailing,
  onClick,
  danger,
}: {
  icon: ReactNode;
  title: string;
  note?: string;
  value?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  /**
   * No uniform gap on this row, on purpose: the app spaces each piece by hand —
   * 14px after the icon and nothing between the value, whatever is drawn after
   * it, and the chevron's own 6px — which is why a switch sits flush against the
   * right edge rather than 14px shy of it. Everything on the line is centred
   * against the tallest child, which is the app's `CrossAxisAlignment.center`
   * default, so a 21px icon sits level with a two-line label rather than with
   * its first line.
   */
  const body = (
    <>
      <span
        className={cn(
          "ml-3.5 shrink-0",
          danger ? "text-[var(--bad)]" : "text-accent",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[14.5px] font-semibold leading-5", danger && "text-[var(--bad)]")}>
          {title}
        </span>
        {note ? (
          <span className="mt-0.5 block max-w-[620px] text-[12px] leading-[1.35] text-dim">
            {note}
          </span>
        ) : null}
      </span>
      {value ? (
        <span className="ml-2 max-w-[46%] shrink-0 truncate text-[13px] font-semibold text-dim">
          {value}
        </span>
      ) : null}
      {trailing ? <span className="ml-1.5 shrink-0">{trailing}</span> : null}
      {onClick && !trailing ? (
        <ChevronRight className="ml-1.5 size-[19px] shrink-0 text-dim" aria-hidden />
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center px-4 py-3.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]"
      >
        {body}
      </button>
    );
  }

  return <div className="flex w-full items-center px-4 py-3.5">{body}</div>;
}

/** The app's `SettingsSwitch`: an accent track with a white thumb when on. */
export function SettingsSwitch({
  on,
  onChange,
  disabled,
  label,
  tone,
}: {
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
  tone?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange();
      }}
      style={
        on && tone
          ? {
              backgroundColor: tone,
              boxShadow: `inset 0 1px 1px rgb(255 255 255 / 0.18), 0 0 0 3px color-mix(in srgb, ${tone} 12%, transparent)`,
            }
          : undefined
      }
      className={cn(
        "relative h-6 w-12 shrink-0 rounded-full transition-[background-color,box-shadow,opacity] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent)_45%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--page)] disabled:opacity-45",
        on
          ? "bg-accent shadow-[inset_0_1px_1px_rgb(255_255_255_/_0.18),0_0_0_3px_color-mix(in_srgb,var(--accent)_12%,transparent)]"
          : "bg-[color-mix(in_srgb,var(--ink)_14%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_8%,transparent)]",
      )}
    >
      <span
        className={cn(
          "absolute left-[3px] top-1/2 size-[18px] -translate-y-1/2 rounded-full bg-white shadow-[0_1px_3px_rgb(8_8_12_/_0.22)] transition-transform duration-300 ease-out",
          on ? "translate-x-[24px]" : "translate-x-0",
        )}
      />
    </button>
  );
}

/**
 * The bottom sheet that picks one of a few sounds.
 *
 * `SheetHead`/`SheetRow` in the app's `screens/sheets.dart`: a heading, an
 * optional line under it, then a row per choice with the chosen one marked "On".
 * The mark is the app's `Str.notificationOn` — a word rather than a tick, so the
 * row reads as a state rather than as a button.
 */
export function ChoiceModal<T extends string>({
  open,
  title,
  note,
  options,
  value,
  onSelect,
  onClose,
}: {
  open: boolean;
  title: string;
  note?: string;
  options: { key: T; name: string; kind?: "silent" | "ring" | "note" }[];
  value: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} size="sm" hideClose>
      <div className="px-5 pb-2 pt-5">
        <h2 className="text-[18px] font-extrabold">{title}</h2>
        {note ? <p className="mt-1 text-[11px] leading-4 text-dim">{note}</p> : null}
      </div>
      <div className="pb-3">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => {
              onSelect(option.key);
              onClose();
            }}
            className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
          >
            <span className="flex size-6 items-center justify-center text-ink">
              {option.kind === "silent" ? (
                <Volume2 className="size-4 text-dim" />
              ) : option.kind === "ring" ? (
                <Phone className="size-4 text-dim" />
              ) : (
                <Music2 className="size-4 text-dim" />
              )}
            </span>
            <span className="min-w-0 flex-1 text-[15px] font-semibold">{option.name}</span>
            {value === option.key ? <span className="text-[12px] font-semibold text-dim">On</span> : null}
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-semibold text-dim">
      {children}
    </span>
  );
}

/**
 * The app's small round dot used as a bullet in a block of prose.
 *
 * `_Line` in `screens/lock_chat.dart`: a 4x4 dim circle, 12px from the text,
 * with the text top-aligned against it so a wrapped line still reads as one
 * point under its own dot.
 */
export function DotLine({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start pb-3">
      <span className="mt-[6px] size-1 shrink-0 rounded-full bg-[var(--dim)]" aria-hidden />
      <p className="ml-3 min-w-0 flex-1 text-[13px] leading-[1.4]">{children}</p>
    </div>
  );
}

import { useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Button";
import { Modal } from "@/components/overlays/Modal";
import { ApiError } from "@/utils/errors";
import { cn } from "@/utils/cn";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { useToast } from "@/hooks/useToast";
import { authService } from "@/services/auth.service";
import {
  LINK_SHORTCUTS,
  MAX_LINKS,
  TRADES,
  linkIcon,
  linkLabel,
  tradeIcon,
  tradeWord,
} from "./model";
import { ProfessionalLead, ProfessionalPill } from "./parts";
import { SettingsShell } from "@/features/settings/parts";

/**
 * Professional details — the extra a professional profile puts under its name:
 * what it does, where it is, a public email, and the row of links it points
 * people at.
 *
 * Ported from `app/lib/screens/professional_details.dart`. Only reachable while
 * the account wears the professional hat (the Settings row that opens this is
 * drawn only then), and the server refuses every write here for an ordinary
 * account anyway — see `ProfessionalView` in `apps/accounts/views_me.py` and
 * `services.require_professional`. So this screen assumes the hat is on and
 * spends its care on two things: not losing what was typed, and showing what the
 * profile will look like before it is saved.
 *
 * That preview is the reason this form is shaped the way it is. Everything
 * below the card is a field; the card is the profile. The trade leads the name,
 * and the place, the email and the links are one icon row under the handle, all
 * drawn by the same components the real profile uses, from the same values, so
 * the person editing is looking at the thing other people will see rather than
 * at a form that claims to describe it.
 *
 * The whole block saves in one PATCH. The text fields are a partial write and
 * the links replace the stored rows in the order they sit here, which is why the
 * list is edited as a list — add, remove, reorder — rather than each link on its
 * own round trip.
 *
 * The four field names are the server's and not a guess: `category`, `address`,
 * `contact_email` and `links` are the columns `MeSerializer` reads and
 * `services.set_professional_details` / `services.set_links` write, and a link
 * row is `{label, url}`. The page this replaces sent `work`, `place`, `email`,
 * `enabled` and a list of bare strings, and caught its own failure to retry a
 * second, differently-shaped body — two payloads the server never asked for, and
 * a catch that would have swallowed a real refusal.
 */

/** One link as it is edited: a label over a URL, and the row that holds them. */
interface LinkRow {
  id: number;
  label: string;
  url: string;
}

export function ProfessionalView({ onBack }: { onBack: () => void }) {
  const { t } = usePreferences();
  const { toast } = useToast();
  const { user, updateUser } = useAuth();

  /**
   * The trade as a whole string, which is what the server stores and what the
   * badge draws. It is a preset's label or somebody's own words; which of the
   * two it is stopped mattering the moment the picker closed, because both come
   * back through `tradeIcon` the same way.
   */
  const [trade, setTrade] = useState(() => String(user?.category ?? "").trim());
  const [address, setAddress] = useState(() => String(user?.address ?? ""));
  const [email, setEmail] = useState(() => String(user?.contact_email ?? ""));
  const [links, setLinks] = useState<LinkRow[]>(() =>
    (Array.isArray(user?.links) ? user.links : [])
      .filter((raw) => typeof raw === "object" && raw !== null)
      .map((raw, index) => ({
        id: index,
        label: String(raw.label ?? ""), // l10n-free: the account's own label
        url: String(raw.url ?? ""),
      })),
  );
  const nextId = useRef(0);
  const [picking, setPicking] = useState(false);
  /** The email check's sentence, held under the field the way a form does. */
  const [emailTrouble, setEmailTrouble] = useState("");
  const [saving, setSaving] = useState(false);

  const addLink = (label = "") => {
    if (links.length >= MAX_LINKS) return;
    setLinks((current) => [...current, { id: nextId.current++, label, url: "" }]);
  };

  const removeLink = (id: number) => setLinks((current) => current.filter((row) => row.id !== id));

  /**
   * Move a link one place up or down the list.
   *
   * The order here is the order the buttons come back in on the profile, and it
   * is the server's own order too — the rows are stored with a position and
   * rewritten whole — so this is not a display sort. Arrows rather than a drag
   * handle: eight rows of text fields is the one list in this app where a
   * long-press drag fights the field it started on.
   */
  const moveLink = (id: number, by: number) => {
    setLinks((current) => {
      const from = current.findIndex((row) => row.id === id);
      const to = from + by;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });
  };

  const save = async () => {
    if (saving) return;
    const mail = email.trim();
    // A soft check only — the server holds the real one and its refusal lands
    // under Save. This catches the obvious slip before a round trip.
    if (mail && (!mail.includes("@") || !mail.includes("."))) {
      setEmailTrouble(t("That does not look like an email address."));
      return;
    }
    setEmailTrouble("");
    setSaving(true);
    try {
      // Only the links that actually carry a URL are sent — a row somebody
      // opened and left blank is not a link, and the server would drop it
      // anyway. The label rides along even when empty; the server and the
      // profile both fall back to the host when there is no label.
      const rows = links
        .filter((row) => row.url.trim())
        .map((row) => ({ label: row.label.trim(), url: row.url.trim() }));
      // The answer is the fresh "me" payload, so nothing is re-read to find out
      // what was stored: the account held by the app becomes the server's own
      // answer, exactly as `Session.it.applyUser(user)` does on the phone.
      const me = await authService.setProfessional({
        category: trade.trim(),
        address: address.trim(),
        contact_email: mail,
        links: rows,
      });
      updateUser(me);
      toast({ title: t("Professional details saved."), tone: "success" });
      onBack();
    } catch (error) {
      // The server's own sentence — a bad email is the one it names — lands
      // here rather than a generic line, so the person is told what to fix.
      toast({
        title: error instanceof ApiError ? error.message : t("That did not work."),
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const shownLinks = links.filter((row) => row.url.trim());
  const restFilled = Boolean(address.trim() || email.trim() || shownLinks.length);

  return (
    <SettingsShell
      title={t("Professional profile")}
      onBack={onBack}
      action={
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-extrabold text-accent disabled:opacity-40"
        >
          {saving ? (
            <Spinner className="size-[15px] text-accent" />
          ) : (
            <Check className="size-[18px]" />
          )}
          {t("Save")}
        </button>
      }
    >
      <div className="px-[18px] pb-11 pt-3.5">
        {/* ------------------------------------------------------ preview -- */}
        <div className="rounded-[20px] border border-line bg-[color-mix(in_srgb,var(--card)_70%,transparent)] px-4 pb-3.5 pt-4">
          <div className="flex items-center">
            <Avatar name={String(user?.name ?? "")} src={user?.avatar ?? null} size={44} />
            <div className="ml-3 min-w-0 flex-1">
              {/* The trade stands above the name, exactly as the real page draws
                  it — see `ProfessionalLead` for why it moved there. */}
              {trade.trim() ? (
                <>
                  <ProfessionalLead trade={trade} t={t} className="justify-start" />
                  <span className="mt-0.5 block" />
                </>
              ) : null}
              <p className="truncate text-[16px] font-extrabold">
                {String(user?.name ?? t("You"))}
              </p>
              <p className="truncate text-[12.5px] text-dim">@{String(user?.username ?? "")}</p>
            </div>
          </div>

          <div className="mt-3.5">
            {!restFilled ? (
              <p className="text-[12.5px] text-dim">
                {t("Fill the rest in and it shows up right here.")}
              </p>
            ) : (
              /* One icon row under the username, the same as the profile: the
                 place, the public email and the links, each a bare mark whose
                 word is read on a hover. The trade is on the name above, not in
                 here. */
              <div className="flex flex-wrap gap-[7px]">
                {address.trim() ? (
                  <ProfessionalPill
                    bare
                    icon={<MapPin className="size-4 text-accent" aria-hidden />}
                    label={address.trim()}
                  />
                ) : null}
                {email.trim() ? (
                  <ProfessionalPill
                    bare
                    icon={<Mail className="size-4 text-accent" aria-hidden />}
                    label={email.trim()}
                  />
                ) : null}
                {shownLinks.map((row) => {
                  const word = linkLabel(row, t("Link"));
                  const Icon = linkIcon({ label: row.label, url: row.url });
                  return (
                    <ProfessionalPill
                      key={row.id}
                      bare
                      icon={<Icon className="size-4 text-accent" aria-hidden />}
                      label={word}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-start">
            <Eye className="mt-px size-[13px] shrink-0 text-dim" aria-hidden />
            <p className="ml-1.5 text-[11.5px] leading-[1.4] text-dim">
              {t(
                "Live preview — this is what sits under your name. It stays yours even if you turn the professional profile off; it just stops showing.",
              )}
            </p>
          </div>
        </div>

        {/* -------------------------------------------------------- trade -- */}
        <div className="mt-[22px]">
          <Label>{t("What you do")}</Label>
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="flex w-full items-center rounded-[16px] border border-line bg-[color-mix(in_srgb,var(--card)_70%,transparent)] px-3.5 py-3 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]"
            >
              <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[11px] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]">
                {(() => {
                  const Icon = tradeIcon(trade);
                  return <Icon className="size-[17px] text-accent" aria-hidden />;
                })()}
              </span>
              <span
                className={cn(
                  "ml-3 min-w-0 flex-1 truncate text-[14.5px]",
                  trade.trim() ? "font-bold" : "font-medium text-dim",
                )}
              >
                {trade.trim() ? tradeWord(trade, t) : t("Choose what you do")}
              </span>
              <span className="shrink-0 text-[13px] font-bold text-accent">
                {trade.trim() ? t("Change") : t("Pick")}
              </span>
              <ChevronRight className="ml-0.5 size-[18px] shrink-0 text-accent" aria-hidden />
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------- address -- */}
        <div className="mt-[22px]">
          <Label>{t("Where you are")}</Label>
          <div className="relative mt-2">
            <MapPin
              className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-dim"
              aria-hidden
            />
            <textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              maxLength={200}
              rows={2}
              placeholder={t("Where people can find you")}
              aria-label={t("Where you are")}
              className="field w-full resize-none pl-10"
            />
          </div>
        </div>

        {/* --------------------------------------------------------- email -- */}
        <div className="mt-3.5">
          <Label>{t("Public email")}</Label>
          <div className="relative mt-2">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-dim"
              aria-hidden
            />
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoCorrect="off"
              placeholder={t("The address people may write to")}
              aria-label={t("Public email")}
              className={cn("field w-full pl-10", emailTrouble && "border-[var(--bad)]")}
            />
          </div>
          {emailTrouble ? (
            <p className="mt-1.5 text-[12px] leading-[1.35] text-[var(--bad)]">{emailTrouble}</p>
          ) : null}
        </div>

        {/* --------------------------------------------------------- links -- */}
        <div className="mt-6">
          <div className="flex items-center">
            <h2 className="text-[15px] font-bold">{t("Links")}</h2>
            <span className="ml-2 text-[12.5px] text-dim">
              {links.length}/{MAX_LINKS}
            </span>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-[1.4] text-dim">
            {t("Your site, your booking page, wherever you want people to go. The order here is the order they show.")}
          </p>

          {/* The quick-add row: the places people actually send people to. It
              exists because the empty state of a link list is a blank label over
              a blank URL, and the label is the half people stall on. */}
          <div className="mt-2.5 flex gap-[7px] overflow-x-auto pb-1">
            {LINK_SHORTCUTS.map((mark) => {
              const word = t(mark.label);
              const off = links.length >= MAX_LINKS;
              const Icon = mark.icon;
              return (
                <button
                  key={mark.label}
                  type="button"
                  disabled={off}
                  onClick={() => addLink(word)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-[11px] py-[7px] text-[12.5px] font-semibold text-accent transition",
                    off && "opacity-40",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {word}
                </button>
              );
            })}
          </div>

          <div className="mt-3 space-y-2.5">
            {links.map((row, index) => {
              const Icon = linkIcon({ label: row.label, url: row.url });
              return (
                <div
                  key={row.id}
                  className="flex items-start rounded-[16px] border border-line bg-[color-mix(in_srgb,var(--card)_60%,transparent)] px-2.5 pb-3 pt-2.5"
                >
                  {/* The glyph follows the address as it is typed: "instagram.com"
                      is a bare link until the moment the row says so, and the
                      mark is how this row says so. */}
                  <span className="mt-1 flex size-[34px] shrink-0 items-center justify-center rounded-[11px] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]">
                    <Icon className="size-4 text-accent" aria-hidden />
                  </span>
                  <div className="ml-2.5 min-w-0 flex-1 space-y-1.5">
                    <input
                      value={row.label}
                      maxLength={30}
                      onChange={(event) =>
                        setLinks((current) =>
                          current.map((item) =>
                            item.id === row.id ? { ...item, label: event.target.value } : item,
                          ),
                        )
                      }
                      placeholder={t("What this link is (optional)")}
                      aria-label={t("Label")}
                      className="field w-full py-1.5 text-[13px]"
                    />
                    <input
                      value={row.url}
                      autoCorrect="off"
                      onChange={(event) =>
                        setLinks((current) =>
                          current.map((item) =>
                            item.id === row.id ? { ...item, url: event.target.value } : item,
                          ),
                        )
                      }
                      placeholder="example.com/you"
                      aria-label={t("Link")}
                      className="field w-full py-1.5 text-[13px]"
                    />
                  </div>
                  <div className="ml-1 flex shrink-0 flex-col">
                    <RowButton
                      icon={ArrowUp}
                      label={t("Move up")}
                      disabled={index === 0}
                      onClick={() => moveLink(row.id, -1)}
                    />
                    <RowButton
                      icon={ArrowDown}
                      label={t("Move down")}
                      disabled={index === links.length - 1}
                      onClick={() => moveLink(row.id, 1)}
                    />
                    <RowButton
                      icon={Trash2}
                      label={t("Remove link")}
                      onClick={() => removeLink(row.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3">
            <button
              type="button"
              disabled={links.length >= MAX_LINKS}
              onClick={() => addLink()}
              className="flex items-center gap-1.5 text-[13px] font-bold text-accent disabled:opacity-40"
            >
              <Plus className="size-[18px]" aria-hidden />
              {links.length >= MAX_LINKS
                ? t(`That is all ${MAX_LINKS}`)
                : links.length === 0
                  ? t("Add a link")
                  : t("Add another")}
            </button>
          </div>
        </div>
      </div>

      <TradePicker
        open={picking}
        initial={trade}
        onClose={() => setPicking(false)}
        onPick={(chosen) => {
          setTrade(chosen.trim());
          setPicking(false);
        }}
      />
    </SettingsShell>
  );
}

/** The small uppercase heading over a field. `_label` on the phone. */
function Label({ children }: { children: ReactNode }) {
  return (
    <span className="block text-[11px] font-bold uppercase tracking-[0.11em] text-dim">
      {children}
    </span>
  );
}

/** One of the three things that can be done to a link row. `_arrow`. */
function RowButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: typeof ArrowUp;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-[30px] items-center justify-center rounded-lg text-dim transition hover:text-ink",
        disabled && "text-[color-mix(in_srgb,var(--dim)_35%,transparent)] hover:text-[color-mix(in_srgb,var(--dim)_35%,transparent)]",
      )}
    >
      <Icon className="size-[19px]" aria-hidden />
    </button>
  );
}

/**
 * The picker: everything a trade can be, and a box that takes one it is not.
 *
 * The phone pushes a whole route here rather than opening a sheet, because a
 * bottom sheet on that phone is capped at nine sixteenths of the screen and this
 * list is twenty-two tiles with a keyboard that would cover half of them. A
 * modal on the web has the same problem in the same proportions, so it is given
 * the tall size and the list scrolls inside it.
 *
 * The box is the search box and the "write your own" box at once, so a query
 * that matches nothing is not a dead end: it is a trade nobody has named yet,
 * one tap away from being chosen.
 */
function TradePicker({
  open,
  initial,
  onPick,
  onClose,
}: {
  open: boolean;
  initial: string;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const { t } = usePreferences();
  const [typed, setTyped] = useState("");
  const query = typed.trim().toLowerCase();

  const shown = TRADES.filter(
    (trade) =>
      !query ||
      trade.label.toLowerCase().includes(query) ||
      t(trade.label).toLowerCase().includes(query),
  );
  const offerTyped =
    Boolean(typed.trim()) &&
    !TRADES.some(
      (trade) =>
        trade.label.toLowerCase() === query || t(trade.label).toLowerCase() === query,
    );

  return (
    <Modal open={open} onClose={onClose} title={t("What you do")} size="lg">
      <div className="px-[18px] pb-2.5 pt-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-dim"
            aria-hidden
          />
          <input
            value={typed}
            autoCorrect="off"
            onChange={(event) => setTyped(event.target.value)}
            placeholder={t("Search, or write your own")}
            aria-label={t("What you do")}
            className="field w-full pl-10 pr-10"
          />
          {typed ? (
            <button
              type="button"
              onClick={() => setTyped("")}
              aria-label={t("Clear")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-dim transition hover:text-ink"
            >
              <X className="size-[17px]" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 px-[18px] pb-[30px]">
        {offerTyped ? (
          <TradeTile
            icon={Pencil}
            label={t(`Use “${typed.trim()}”`)}
            selected={initial.toLowerCase() === typed.trim().toLowerCase()}
            onClick={() => onPick(typed.trim())}
          />
        ) : null}
        {shown.map((trade) => (
          <TradeTile
            key={trade.label}
            icon={trade.icon}
            label={t(trade.label)}
            selected={initial.toLowerCase() === trade.label.toLowerCase()}
            onClick={() => onPick(trade.label)}
          />
        ))}
        {shown.length === 0 && !offerTyped ? (
          <p className="pt-10 text-center text-[13px] text-dim">{t("Nothing matches that.")}</p>
        ) : null}
      </div>
    </Modal>
  );
}

/** One trade in the picker: a mark, a word, and a tick when it is the one. */
function TradeTile({
  icon: Icon,
  label,
  selected,
  onClick,
}: {
  icon: typeof Pencil;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center rounded-[16px] border px-3 py-[11px] text-left transition",
        selected
          ? "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
          : "border-line bg-[color-mix(in_srgb,var(--card)_70%,transparent)] hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-[10px]",
          selected
            ? "bg-[color-mix(in_srgb,var(--accent)_20%,transparent)]"
            : "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]",
        )}
      >
        <Icon className="size-4 text-accent" aria-hidden />
      </span>
      <span
        className={cn(
          "ml-3 min-w-0 flex-1 truncate text-[14.5px]",
          selected ? "font-extrabold" : "font-semibold",
        )}
      >
        {label}
      </span>
      {selected ? <CheckCircle2 className="size-[18px] shrink-0 text-accent" aria-hidden /> : null}
    </button>
  );
}

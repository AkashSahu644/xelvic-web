import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarClock,
  FileText,
  Gavel,
  Hourglass,
  IdCard,
  ImagePlus,
  Info,
  Plus,
  Paperclip,
  ShieldCheck,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import { Button, Spinner } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { VerifiedTick } from "@/components/Tick";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/errors";
import { usePreferences } from "@/providers/PreferencesProvider";
import { useToast } from "@/providers/ToastProvider";
import type { VerifyStatus } from "@/types/api";

/**
 * Get verified — the one settings page that asks a person of the staff rather
 * than the server, and waits on an answer a human writes.
 *
 * Ported from `app/lib/screens/get_verified.dart`. It is four screens folded into
 * one, because which one it is is not this page's to decide: the server holds the
 * request and its verdict, and `GET /verify/status/` says which of them is true
 * right now. A person who has never asked sees the form; a person waiting sees
 * that they are waiting, and a way to take it back; a person who was turned down
 * sees the staff's own words and the form again under them; a person who is
 * verified sees that they are, and until when.
 *
 * The form is the one part that writes, and it writes multipart — the same shape
 * the avatar upload uses, but several files rather than one, a label beside each,
 * and the links folded into a single JSON field. That last part is a contract and
 * not a preference: `_links_from` in `apps/verify/views.py` decodes a JSON array
 * *string*, so the links go up as `JSON.stringify(...)` under one `links` key
 * rather than as repeated keys, and the files go up under `documents` with one
 * `labels` entry each, aligned by index, because the server pairs the two lists
 * position by position and an empty label still has to hold its place in the
 * line.
 *
 * Every sentence is assembled *before* it is handed to `t()`. The web's `t()` is
 * a lookup and not a formatter — it has no `{1}` — so a templated app sentence
 * has to be finished here and translated whole, or the placeholder would be
 * looked up and drawn. English's one/other pair stands in for the app's Arabic
 * one/two/few/many/other selection, which is the best this dictionary can say.
 */

/**
 * The four kinds a request can be, in the order the chips lay them out.
 *
 * `value` is what the server is told (`VerificationRequest.Kind`), `word` is
 * what the person reads. They are kept apart for the reason the app keeps them
 * apart: the value is a contract with a database column and the word is a
 * sentence, and a page that drew the value would be showing somebody
 * `business` where the app says "Business or brand".
 */
const KINDS: { value: string; word: string }[] = [
  { value: "creator", word: "Creator" },
  { value: "business", word: "Business or brand" },
  { value: "public", word: "Public figure" },
  { value: "other", word: "Something else" },
];

/** The month names, in the order a date needs them. */
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * The ceiling the server puts on one request, mirrored so nothing is typed into
 * a box that can only be refused.
 *
 * `reason` is `CharField(max_length=2000)` and each link is
 * `CharField(max_length=300)` (`apps/verify/serializers.py`). Both are
 * `maxLength` on the input rather than a validator, because the point is the
 * same one the app's own fields make: a browser stops the typing, and the round
 * trip that would only ever answer "ensure this field has no more than N
 * characters" is never made.
 *
 * The *counts* are deliberately not capped here, though the server caps both at
 * five (`ApplySerializer.links`, `services.MAX_DOCUMENTS`). The app adds rows
 * freely and lets the server say no, and its refusal is a sentence worth reading
 * — the link ceiling arrives as a field error and the document ceiling as
 * "Up to 5 documents, please." — so a client-side cap would be this page
 * answering a question in place of the server, and answering it less clearly.
 */
const REASON_MAX = 2000;
const LINK_MAX = 300;

/**
 * What the server accepted for a proof, as the browser's accept list.
 *
 * Not invented here: it is `services.DOCUMENT_TYPES` — the server checks the
 * announced type *and* the file's first bytes, because a document announced as
 * `image/png` and containing a script is still a script, and this is the one
 * upload in the app that lands somewhere staff open. A filter that offered more
 * than the server takes would be a picker that leads to a refusal.
 */
const PHOTO_TYPES = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const FILE_TYPES = `${PHOTO_TYPES},application/pdf`;

/** One row in the link list. Keyed, so removing a middle row does not re-key the rest. */
interface LinkRow {
  id: number;
  value: string;
}

/** One picked document: the file, and the label the person may give it. */
interface DocRow {
  id: number;
  file: File;
  label: string;
}

export function VerifyView() {
  const { t } = usePreferences();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const status = useQuery({
    queryKey: ["verify-status"],
    queryFn: () => api.get<VerifyStatus>("/verify/status/"),
  });

  // The form.
  const [reason, setReason] = useState("");
  const [kind, setKind] = useState(KINDS[0].value);
  const [links, setLinks] = useState<LinkRow[]>([{ id: 1, value: "" }]);
  const [docs, setDocs] = useState<DocRow[]>([]);

  /** A submit is in the air. Only one at a time — a second is a second request for the same thing. */
  const [submitting, setSubmitting] = useState(false);
  /** A withdraw is in the air. */
  const [withdrawing, setWithdrawing] = useState(false);
  /**
   * The request has just been sent from this page.
   *
   * The server now holds a pending one whether or not the status has been read
   * again, so the waiting state is drawn from this as well as from what was
   * fetched — otherwise the refetch's round trip would show the finished form
   * one more time, under a toast saying it had gone.
   */
  const [sent, setSent] = useState(false);

  /** The proof picker sheet, and which of its two doors is being asked for. */
  const [pickerOpen, setPickerOpen] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const nextId = useRef(2);

  const fresh = () => queryClient.invalidateQueries({ queryKey: ["verify-status"] });

  /**
   * The server's own sentence for a refusal, wherever it decided to put it.
   *
   * Three shapes arrive on this route and they are worth telling apart. A rule
   * the *service* refuses comes back as a bare `{"detail": "..."}` — "Up to 5
   * documents, please." — which `errors.ts` now reads as the message. A rule
   * *DRF's serializer* refuses comes back as `fields`, with the real sentence
   * inside and the envelope's own message set to the generic "Please check the
   * highlighted fields." — which points at highlights this page does not draw,
   * so the field's own words are preferred when there are any. Anything else
   * falls back, and the app's own fallback sentence is what it falls back to.
   */
  function refusalOf(error: unknown): string {
    if (error instanceof ApiError) {
      for (const value of Object.values(error.fields)) {
        const said = Array.isArray(value) ? value[0] : value;
        if (typeof said === "string" && said) return said;
      }
      return error.message;
    }
    return t("Something went wrong. Try again.");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const text = reason.trim();
    if (!text) {
      toast({ title: t("Say why you should be verified."), tone: "error" });
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("reason", text);
      form.append("kind", kind);
      // A JSON-array string, not a repeated field: the server reads one string
      // and decodes it. Blank rows are dropped here rather than sent as empty
      // links, which is what the app does too — an empty box is a row somebody
      // did not use, not a link they meant to give.
      form.append(
        "links",
        JSON.stringify(links.map((row) => row.value.trim()).filter(Boolean)),
      );
      for (const doc of docs) {
        // One label per document, in the same order, so the two lists stay
        // aligned; an empty one is still a place held in the line.
        form.append("documents", doc.file);
        form.append("labels", doc.label.trim());
      }
      await api.form("/verify/requests/", form);
      setSent(true);
      await fresh();
    } catch (error) {
      toast({ title: refusalOf(error), tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function withdraw() {
    if (withdrawing) return;
    setWithdrawing(true);
    try {
      await api.post("/verify/requests/withdraw/");
      setSent(false);
      await fresh();
    } catch (error) {
      toast({ title: refusalOf(error), tone: "error" });
    } finally {
      setWithdrawing(false);
    }
  }

  function addLink() {
    setLinks((current) => [...current, { id: nextId.current++, value: "" }]);
  }

  function removeLink(id: number) {
    setLinks((current) => {
      // The last row is cleared rather than removed, which is the app's own
      // rule: a list that can reach zero rows has no way back to one, and the
      // links are optional — an empty single box is how "I have none" is said.
      if (current.length === 1) return current.map((row) => ({ ...row, value: "" }));
      return current.filter((row) => row.id !== id);
    });
  }

  function picked(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length) {
      setDocs((current) => [
        ...current,
        ...files.map((file) => ({ id: nextId.current++, file, label: "" })),
      ]);
    }
    // Cleared so the same file can be picked twice in a row: the input fires no
    // change event when its value has not changed, so a document removed and
    // added back would otherwise silently do nothing.
    event.target.value = "";
  }

  if (status.isLoading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Spinner className="size-7 text-accent" />
      </div>
    );
  }

  if (status.isError) {
    return (
      <Panel
        icon={<WifiOff className="size-12" />}
        title={t("Could not load")}
        body={t("We could not reach the server. Try again in a moment.")}
        action={t("Try again")}
        onAction={() => void status.refetch()}
      />
    );
  }

  const data = status.data;
  const request = data?.request ?? null;
  const state = request?.status ?? "";

  /*
   * The order of these four is the app's, and it is load-bearing.
   *
   * Waiting is asked first because it is true of a person who is *not* verified
   * as well as of one who is: a badge that has lapsed with a new request in the
   * queue is somebody waiting, and drawing them the form because `verified` was
   * false would offer a second ask the server would refuse. `can_apply` is then
   * the server's own arithmetic rather than a rule repeated here.
   */
  if (sent || state === "pending") {
    return (
      <Reviewing
        withdrawing={withdrawing}
        onWithdraw={() => void withdraw()}
        t={t}
      />
    );
  }

  if (data?.verified) {
    return <Verified until={data.verified_until} t={t} />;
  }

  if (data?.can_apply) {
    return (
      <>
        <Form
          request={request}
          state={state}
          reason={reason}
          onReason={setReason}
          kind={kind}
          onKind={setKind}
          links={links}
          onLink={(id, value) =>
            setLinks((current) => current.map((row) => (row.id === id ? { ...row, value } : row)))
          }
          onAddLink={addLink}
          onRemoveLink={removeLink}
          docs={docs}
          onDocLabel={(id, label) =>
            setDocs((current) => current.map((row) => (row.id === id ? { ...row, label } : row)))
          }
          onRemoveDoc={(id) => setDocs((current) => current.filter((row) => row.id !== id))}
          onAddDoc={() => setPickerOpen(true)}
          submitting={submitting}
          onSubmit={submit}
          t={t}
        />
        {/* Two files inputs rather than one with a changing `accept`, because a
            changing attribute on a mounted input is a change the browser may not
            have read by the time the dialog opens. Each is hidden and clicked
            from the sheet, exactly as the app's two sheet rows lead to two
            sources. */}
        <input
          ref={photoInput}
          type="file"
          accept={PHOTO_TYPES}
          multiple
          className="hidden"
          onChange={picked}
        />
        <input
          ref={fileInput}
          type="file"
          accept={FILE_TYPES}
          multiple
          className="hidden"
          onChange={picked}
        />
        <Modal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          title={t("Add a document")}
          size="sm"
        >
          <div className="space-y-2 pb-2">
            <PickRow
              icon={<ImagePlus className="size-5" />}
              label={t("Choose a photo")}
              line={t("A picture that shows who you are.")}
              onClick={() => {
                setPickerOpen(false);
                photoInput.current?.click();
              }}
            />
            <PickRow
              icon={<FileText className="size-5" />}
              label={t("Choose a file")}
              line={t("A document — a registration, a press page.")}
              onClick={() => {
                setPickerOpen(false);
                fileInput.current?.click();
              }}
            />
          </div>
        </Modal>
      </>
    );
  }

  // Anything else — an approved request whose window has closed with nothing new
  // allowed yet, say — is a standing the person cannot act on from here.
  return (
    <Panel
      icon={<BadgeCheck className="size-12" />}
      title={t("Nothing to do right now")}
      body={t("There is no request you can make at the moment. Check back later.")}
    />
  );
}

/* ------------------------------------------------------------------ states -- */

/**
 * A centred message: the shape every state but the form takes.
 *
 * `_Panel` in the app. The icon is a size larger than the app's here because the
 * app's 48 logical pixels are drawn on a phone screen that is the whole window,
 * while this page sits inside a browser's much wider one.
 */
function Panel({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-8 py-10">
      <div className="max-w-[420px] text-center">
        <div className="mx-auto text-accent">{icon}</div>
        <h2 className="mt-4 text-[20px] font-extrabold leading-tight">{title}</h2>
        <p className="mt-2.5 text-[14px] leading-[1.45] text-dim">{body}</p>
        {action ? (
          <Button className="mt-5" onClick={onAction}>
            {action}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Waiting on a human — the one state with a way back out of it. */
function Reviewing({
  withdrawing,
  onWithdraw,
  t,
}: {
  withdrawing: boolean;
  onWithdraw: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="mx-auto w-full max-w-[560px] px-5 pb-10 pt-7">
      <div className="text-center">
        <Hourglass className="mx-auto size-8 text-accent" aria-hidden />
        <h2 className="mt-3.5 text-[18px] font-extrabold">{t("We're reviewing your request")}</h2>
        <p className="mt-2 text-[13.5px] leading-[1.45] text-dim">
          {t("Someone will look at what you sent and decide. You will see the answer here.")}
        </p>
      </div>
      {/* A quiet way out, not a slab: withdrawing is the secondary action on a
          page whose point is the waiting. */}
      <div className="mt-[18px] flex justify-center">
        <button
          type="button"
          onClick={onWithdraw}
          disabled={withdrawing}
          className="min-h-11 rounded-full px-4 text-[13.5px] font-semibold text-dim transition hover:text-ink disabled:opacity-50"
        >
          {withdrawing ? <Spinner className="text-accent" /> : t("Withdraw request")}
        </button>
      </div>
    </div>
  );
}

/** The badge, and until when. */
function Verified({ until, t }: { until: string | null; t: (key: string) => string }) {
  const when = dayOf(until, t);
  return (
    <Panel
      icon={<BadgeCheck className="size-12 text-[#1D9BF0]" />}
      title={t("You're verified")}
      body={
        when
          ? t(`Your account carries the mark until ${when}.`)
          : t("Your account carries the mark.")
      }
    />
  );
}

/* -------------------------------------------------------------------- form -- */

function Form({
  request,
  state,
  reason,
  onReason,
  kind,
  onKind,
  links,
  onLink,
  onAddLink,
  onRemoveLink,
  docs,
  onDocLabel,
  onRemoveDoc,
  onAddDoc,
  submitting,
  onSubmit,
  t,
}: {
  request: VerifyStatus["request"];
  state: string;
  reason: string;
  onReason: (value: string) => void;
  kind: string;
  onKind: (value: string) => void;
  links: LinkRow[];
  onLink: (id: number, value: string) => void;
  onAddLink: () => void;
  onRemoveLink: (id: number) => void;
  docs: DocRow[];
  onDocLabel: (id: number, label: string) => void;
  onRemoveDoc: (id: number) => void;
  onAddDoc: () => void;
  submitting: boolean;
  onSubmit: (event: FormEvent) => void;
  t: (key: string) => string;
}) {
  /*
   * Shown to a person who has never asked, and to one who was turned down or had
   * the mark taken away — in which case the staff's reason is drawn above the
   * form, so it is read before it is answered.
   *
   * The page leads with what the mark is — what it gives and what it asks —
   * because a request is better made by somebody who knows what they are asking
   * for. The form itself is the last thing on the page.
   */
  const turnedDown = state === "rejected" || state === "revoked";
  const note = request?.note ?? "";

  return (
    <form className="mx-auto w-full max-w-[560px] px-5 pb-10 pt-3" onSubmit={(event) => void onSubmit(event)}>
      {turnedDown && note ? (
        <>
          <NoteBanner
            title={state === "revoked" ? t("Your mark was taken away") : t("Your last request was turned down")}
            note={note}
          />
          <div className="h-[22px]" />
        </>
      ) : null}

      <div className="flex flex-col items-start">
        <VerifiedTick size={40} />
        <h2 className="mt-3.5 text-[21px] font-extrabold">{t("The blue mark")}</h2>
        <p className="mt-1.5 text-[14px] leading-[1.45] text-dim">
          {t("It tells everyone an account is who it says it is. Here is what it gives you, and what it asks of you.")}
        </p>
      </div>

      <div className="h-[26px]" />
      <Section>{t("What the mark gives you")}</Section>
      <div className="h-3" />
      <InfoCard
        rows={[
          // The one row that is the mark itself wears the mark's own blue, not
          // the accent — it is the same tick the profile will show.
          { icon: <BadgeCheck className="size-5 text-[#1D9BF0]" />, text: t("A blue check on your profile, and beside your name everywhere it shows — comments, moments, chat.") },
          { icon: <ShieldCheck className="size-5 text-accent" />, text: t("It says the account is really you, so no one else can pass themselves off as you.") },
          { icon: <Users className="size-5 text-accent" />, text: t("People who find you know at a glance they've found the real one.") },
        ]}
      />

      <div className="h-6" />
      <Section>{t("What it asks of you")}</Section>
      <div className="h-3" />
      <InfoCard
        rows={[
          { icon: <IdCard className="size-5 text-accent" />, text: t("Real proof of who you are — a document or a page that backs it up.") },
          { icon: <CalendarClock className="size-5 text-accent" />, text: t("It lasts a set stretch of time, and has to be renewed when that runs out.") },
          { icon: <Gavel className="size-5 text-accent" />, text: t("It can be taken back if the account stops being what it was verified as.") },
          { icon: <Hourglass className="size-5 text-accent" />, text: t("A person reads every request, so an answer takes a little while.") },
        ]}
      />

      <div className="h-[30px]" />
      <Section>{turnedDown ? t("Apply again") : t("Your request")}</Section>

      <div className="mt-3.5">
        <Label>{t("Why should you be verified?")}</Label>
        <textarea
          value={reason}
          onChange={(event) => onReason(event.target.value)}
          rows={4}
          maxLength={REASON_MAX}
          placeholder={t("Who you are, and why the mark belongs on your account.")}
          className="field mt-2 resize-none"
        />
      </div>

      <div className="mt-5">
        <Label>{t("What kind of account is this?")}</Label>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {KINDS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onKind(option.value)}
              aria-pressed={kind === option.value}
              className={cn(
                "rounded-full border px-4 py-2.5 text-[13.5px] transition",
                kind === option.value
                  ? "border-accent bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] font-bold text-accent"
                  : "border-line bg-card font-semibold text-ink",
              )}
            >
              {t(option.word)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <Label>{t("Links")}</Label>
        <p className="mt-1 text-[12.5px] leading-[1.4] text-dim">
          {t("A site, a profile, a page — anywhere that shows this is you.")}
        </p>
        <div className="mt-2.5 space-y-2.5">
          {links.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <input
                value={row.value}
                onChange={(event) => onLink(row.id, event.target.value)}
                inputMode="url"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={LINK_MAX}
                // A hint that is the shape of a link and not a word, so it is
                // written the same in every language — the app marks its own
                // copy l10n-free for that reason.
                placeholder="https://"
                className="field min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={() => onRemoveLink(row.id)}
                className="icon-btn shrink-0"
                aria-label={t("Remove")}
                title={t("Remove")}
              >
                <X className="size-5" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onAddLink}
          className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-bold text-accent"
        >
          <Plus className="size-4" aria-hidden /> {t("Add another link")}
        </button>
      </div>

      <div className="mt-4">
        <Label>{t("Proof")}</Label>
        <p className="mt-1 text-[12.5px] leading-[1.4] text-dim">
          {t("A photo or a file that backs up who you are. Optional, but it helps.")}
        </p>
        <div className="mt-2.5 space-y-2.5">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-[14px] border border-line bg-card py-3 pl-3.5 pr-2"
            >
              <FileText className="size-5 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold">{doc.file.name}</p>
                <input
                  value={doc.label}
                  onChange={(event) => onDocLabel(doc.id, event.target.value)}
                  maxLength={80}
                  placeholder={t("Add a label (optional)")}
                  className="mt-0.5 w-full bg-transparent text-[13px] outline-none placeholder:text-dim"
                />
              </div>
              <button
                type="button"
                onClick={() => onRemoveDoc(doc.id)}
                className="icon-btn shrink-0"
                aria-label={t("Remove")}
                title={t("Remove")}
              >
                <X className="size-5" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onAddDoc}
          disabled={submitting}
          className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-bold text-accent disabled:opacity-45"
        >
          <Paperclip className="size-4" aria-hidden /> {t("Add a document")}
        </button>
      </div>

      <Button type="submit" loading={submitting} full className="mt-[26px]">
        {t("Submit request")}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ pieces -- */

/**
 * The staff's reason, in a card that reads as a warning without a colour
 * gradient — a single-tone wash of the bad tone under a hairline of it.
 */
function NoteBanner({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--bad)_35%,transparent)] bg-[color-mix(in_srgb,var(--bad)_8%,var(--card))] px-4 pb-4 pt-3.5">
      <div className="flex items-center gap-2">
        <Info className="size-[18px] shrink-0 text-[var(--bad)]" aria-hidden />
        <p className="min-w-0 flex-1 text-[14px] font-extrabold text-[var(--bad)]">{title}</p>
      </div>
      <p className="mt-2 text-[13.5px] leading-[1.45]">{note}</p>
    </div>
  );
}

/** A field's own heading. */
function Label({ children }: { children: ReactNode }) {
  return <span className="block text-[15px] font-bold">{children}</span>;
}

/** A quiet heading between the stretches of the page. */
function Section({ children }: { children: ReactNode }) {
  return <h3 className="text-[16px] font-extrabold">{children}</h3>;
}

/** One line in an `InfoCard`: a small icon and a short piece of text. */
interface InfoLine {
  icon: ReactNode;
  text: string;
}

/**
 * The benefits and the asks, each a short list inside one card so the two sit as
 * a pair. No gradient — the card is a flat fill under a hairline, and the rows
 * are drawn by the card so they share their spacing.
 */
function InfoCard({ rows }: { rows: InfoLine[] }) {
  return (
    <div className="rounded-[14px] border border-line bg-card px-4 py-1.5">
      {rows.map((row, index) => (
        <div key={index} className="flex items-start gap-3.5 py-3">
          <span className="mt-px shrink-0">{row.icon}</span>
          <p className="min-w-0 flex-1 text-[13.5px] leading-[1.45]">{row.text}</p>
        </div>
      ))}
    </div>
  );
}

/** One of the two doors in the proof sheet. */
function PickRow({
  icon,
  label,
  line,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  line: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3.5 rounded-[14px] border border-line px-4 py-3.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]"
    >
      <span className="mt-0.5 shrink-0 text-accent">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold">{label}</span>
        <span className="mt-0.5 block text-[12px] leading-[1.35] text-dim">{line}</span>
      </span>
    </button>
  );
}

/**
 * The day part of an ISO timestamp, or null when there is none to read.
 *
 * Assembled and *then* translated, because `t()` is a lookup with no `{1}` in
 * it: "Your account carries the mark until Sep 25, 2026." is one finished
 * sentence, and the month name is itself looked up so the twelve short names are
 * the only part a translator has to supply.
 *
 * Not `shortDay()` from `lib/format.ts`, though that also draws a month: it is
 * day-first ('25 Sep'), it is untranslated, and it has no year — three things
 * the app's own date line has, in the app's order (`Str.otpDate`, '{1} {2}, {3}').
 */
function dayOf(iso: string | null, t: (key: string) => string): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return `${t(MONTHS[at.getMonth()])} ${at.getDate()}, ${at.getFullYear()}`;
}

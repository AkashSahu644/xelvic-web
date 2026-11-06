import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUp,
  AtSign,
  LoaderCircle,
  Music2,
  Plus,
  X,
} from "lucide-react";
import { Modal } from "@/components/overlays/Modal";
import { cn } from "@/utils/cn";
import { SettingsSwitch } from "@/features/settings/parts";
import { useAuth } from "@/hooks/useAuth";
import { usePlayer } from "@/hooks/usePlayer";
import { useToast } from "@/hooks/useToast";
import type { SparksData } from "@/services/sparks.service";
import { momentsService } from "@/services/moments.service";
import { errorMessage } from "@/utils/errors";
import { uploadAsset } from "@/utils/upload";
import { PartChooser } from "@/features/audio/PartChooser";
import { SoundPicker, type PickedSound } from "@/features/audio/SoundPicker";
import {
  hasWindow,
  momentSoundSpan,
  soundWindowLabel,
  type SoundWindow,
} from "@/features/audio/audioWindow";
import { fetchAudioFile } from "@/features/audio/soundBits";
import {
  audienceIds,
  audienceLabel,
  AudienceMenu,
  EVERYONE,
  type Audience,
} from "@/features/moments/AudienceSheet";
import {
  CARD_DIM,
  CARD_HEIGHT,
  CARD_INK,
  CARD_WIDTH,
  renderSparkCard,
  randomSparkCardStyle,
  sparkCardAward,
  sparkCardPaper,
  type SparkCardStyle,
  type CardFace,
} from "./card";
import { momentMention } from "./moment";
import type { Spark } from "@/types/api";

export function SparkMoment({
  open,
  spark,
  them,
  onClose,
  onPosted,
  variant = "modal",
}: {
  open: boolean;
  spark: Spark;
  them: CardFace | null;
  onClose: () => void;
  onPosted: () => void;
  variant?: "modal" | "panel";
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const player = usePlayer();
  const closePlayer = player.close;
  const auditioningRef = useRef(false);
  const [card, setCard] = useState<{ file: File; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [failure, setFailure] = useState("");
  const [sending, setSending] = useState(false);
  const [audience, setAudience] = useState<Audience>(EVERYONE);
  const [mention, setMention] = useState(true);
  const [cardStyle, setCardStyle] = useState<SparkCardStyle>("classic");
  const [sound, setSound] = useState<{
    track: PickedSound;
    startMs: number;
    endMs: number;
  } | null>(null);
  const [soundOpen, setSoundOpen] = useState(false);
  const [partOpen, setPartOpen] = useState(false);
  const [partTrack, setPartTrack] = useState<PickedSound | null>(null);
  const [partFrom, setPartFrom] = useState<SoundWindow>({
    startMs: 0,
    endMs: 0,
  });

  const setBarHidden = player.setBarHidden;
  useEffect(() => {
    if (variant !== "panel") return;
    setBarHidden(soundOpen || partOpen);
    return () => setBarHidden(false);
  }, [variant, soundOpen, partOpen, setBarHidden]);

  const award = sparkCardAward(spark);
  const modalInk = CARD_INK;

  const opening = useRef({ spark, them, me: user });
  opening.current = { spark, them, me: user };

  useEffect(() => {
    if (!open) return;
    const { spark: run, them: other, me } = opening.current;
    let cancelled = false;
    let made: string | null = null;
    setCard(null);
    setFailed(false);
    setFailure("");
    setSending(false);
    setAudience(EVERYONE);
    setMention(true);
    setSound(null);
    setSoundOpen(false);
    setPartOpen(false);
    setPartTrack(null);
    setPartFrom({ startMs: 0, endMs: 0 });
    const chosenStyle = randomSparkCardStyle();
    setCardStyle(chosenStyle);

    void renderSparkCard({ spark: run, me, them: other, style: chosenStyle })
      .then((file) => {
        if (cancelled) return;
        made = URL.createObjectURL(file);
        setCard({ file, url: made });
      })
      .catch((error: unknown) => {
        console.error("The spark card would not paint:", error);
        if (!cancelled) {
          setFailure(errorMessage(error));
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [open]);

  useEffect(
    () => () => {
      if (auditioningRef.current) {
        auditioningRef.current = false;
        closePlayer();
      }
    },
    [closePlayer],
  );

  const named = momentMention(
    spark,
    queryClient.getQueryData<SparksData>(["sparks"]),
    user?.id,
  );
  const theirName = named ? (named.name ?? "").trim() || named.username : "";

  function openSound() {
    setPartTrack(null);
    setPartFrom({ startMs: 0, endMs: 0 });
    setSoundOpen(true);
  }

  function pickedSound(track: PickedSound) {
    setSoundOpen(false);
    setPartTrack(track);
    setPartFrom({ startMs: 0, endMs: 0 });
    setPartOpen(true);
  }

  function reopenPart() {
    if (!sound) return;
    setPartTrack(sound.track);
    setPartFrom({ startMs: sound.startMs, endMs: sound.endMs });
    setPartOpen(true);
  }

  function applyPart(window: SoundWindow) {
    if (!partTrack) return;
    setSound({
      track: partTrack,
      startMs: window.startMs,
      endMs: window.endMs,
    });
    setPartOpen(false);
    setPartTrack(null);
    auditioningRef.current = true;
  }

  function closePart() {
    setPartOpen(false);
    setPartTrack(null);
  }

  function takeSoundOff() {
    if (auditioningRef.current) {
      auditioningRef.current = false;
      closePlayer();
    }
    setSound(null);
  }

  const partSpan =
    partFrom.endMs > partFrom.startMs
      ? partFrom.endMs - partFrom.startMs
      : momentSoundSpan();

  async function soundForItem() {
    const chosen = sound;
    if (!chosen) return null;
    const id =
      chosen.track.assetId ??
      String(
        (
          await uploadAsset(await fetchAudioFile(chosen.track), {
            kind: "audio",
          })
        ).id,
      );
    return { id, startMs: chosen.startMs, endMs: chosen.endMs };
  }

  async function share() {
    const ready = card;
    if (!ready || sending) return;
    setSending(true);
    try {
      const asset = await uploadAsset(ready.file);
      const music = await soundForItem();
      await momentsService.post({
        items: [
          {
            kind: "image",
            asset: asset.id,
            ...(named && mention ? { mentions: [String(named.id)] } : {}),
            ...(music
              ? {
                  sound: music.id,
                  sound_start_ms: music.startMs,
                  sound_end_ms: music.endMs,
                }
              : {}),
          },
        ],
        audience: audience.mode,
        ...(audience.mode === "everyone"
          ? {}
          : { audience_users: audienceIds(audience) }),
      });
      toast({ title: "Your moment is up", tone: "success" });
      onPosted();
      onClose();
    } catch (error) {
      toast({
        title: "Could not put that up.",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setSending(false);
    }
  }

  const body = (
    <div
      className={cn(
        "flex h-full flex-col",
        variant === "modal" && "min-h-[100dvh]",
      )}
      style={{
        backgroundColor: sparkCardPaper(award, cardStyle),
        color: modalInk,
      }}
    >
      {variant === "panel" ? (
        <header className="flex shrink-0 items-center gap-1.5 border-b border-[color-mix(in_srgb,currentColor_10%,transparent)] px-2 py-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="flex size-9 shrink-0 items-center justify-center rounded-full transition bg-[color-mix(in_srgb,currentColor_10%,transparent)] hover:bg-[color-mix(in_srgb,currentColor_25%,transparent)] disabled:opacity-40"
            style={{ color: modalInk }}
            aria-label="Back to Spark"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-extrabold">
              Add to Moments
            </p>
            <p className="truncate text-[10.5px]" style={{ color: CARD_DIM }}>
              {award.name} &middot; Spark card
            </p>
          </div>
          <AudienceMenu
            value={audience}
            onPick={setAudience}
            disabled={sending}
            compact
          />
        </header>
      ) : (
        <div className="flex items-center gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="flex size-10 shrink-0 items-center justify-center rounded-full transition hover:bg-[color-mix(in_srgb,currentColor_10%,transparent)] disabled:opacity-40"
            style={{ color: modalInk }}
            aria-label="Back"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[20px] font-extrabold">Moments</p>
            <p className="text-[12.5px]" style={{ color: CARD_DIM }}>
              Sparks you&rsquo;re keeping alive
            </p>
          </div>
          <AudienceMenu
            value={audience}
            onPick={setAudience}
            disabled={sending}
          />
        </div>
      )}

      <div
        className={cn(
          "flex min-h-0 flex-1 items-center justify-center",
          variant === "panel" ? "overflow-hidden p-0" : "px-5 py-2",
        )}
      >
        {failed ? (
          <div className="max-w-[320px] text-center">
            <p className="text-[14px]" style={{ color: CARD_DIM }}>
              Could not draw that card just now.
            </p>
            {/* The reason, on a build somebody is developing against: the
                shipped page keeps the short sentence. */}
            {import.meta.env.DEV && failure ? (
              <p
                className="mt-2 text-[11.5px] leading-snug"
                style={{ color: CARD_DIM }}
              >
                {failure}
              </p>
            ) : null}
          </div>
        ) : card ? (
          <img
            src={card.url}
            alt={`Spark card for ${award.name}`}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            className={cn(
              variant === "panel"
                ? "h-full w-full object-contain"
                : "max-h-full max-w-full object-contain",
            )}
            style={{ aspectRatio: `${CARD_WIDTH} / ${CARD_HEIGHT}` }}
          />
        ) : (
          <LoaderCircle
            className="size-6 animate-spin"
            style={{ color: CARD_DIM }}
            aria-label="Painting the card"
          />
        )}
      </div>

      <div className="border-t border-[color-mix(in_srgb,currentColor_10%,transparent)] px-3 pb-[max(1.125rem,env(safe-area-inset-bottom))] pt-3">
        <div className="flex items-center justify-between gap-3">
          <p
            className="text-[10.5px] font-extrabold uppercase tracking-[0.08em]"
            style={{ color: CARD_DIM }}
          >
            Share options
          </p>
          <p
            className="text-[10.5px] font-semibold"
            style={{ color: CARD_DIM }}
          >
            {audienceLabel(audience)} &middot; 24 hours
          </p>
        </div>

        <div className="mt-1">
          {/* The sound, on the phone's `_soundRow`: a note and "Add audio" until
            there is one, and then the file, the part of it that plays, the way
            back into the part chooser and the way to take it off. The card is
            one picture, so the part offered is the one-picture thirty seconds. */}
          {sound ? (
            <div
              className="flex min-h-[50px] items-center gap-3 rounded-lg px-2"
              style={{
                backgroundColor: `color-mix(in srgb, ${award.colour} 10%, transparent)`,
              }}
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-lg"
                style={{
                  backgroundColor: `color-mix(in srgb, ${award.colour} 12%, transparent)`,
                  color: award.colour,
                }}
              >
                <Music2 className="size-[17px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 py-1.5">
                <p className="truncate text-[13px] font-semibold">
                  {sound.track.title}
                </p>
                {/* Only when there is a window to print: a sound that plays all of
                  itself should not say `0:00 – 0:00` under its own name. */}
                {hasWindow(sound.startMs, sound.endMs) ? (
                  <p
                    className="truncate text-[11px]"
                    style={{ color: CARD_DIM }}
                  >
                    {soundWindowLabel(sound.startMs, sound.endMs)}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={reopenPart}
                disabled={sending}
                className="shrink-0 rounded-full px-2 py-1.5 text-[12.5px] font-bold transition hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] disabled:opacity-40"
                style={{ color: award.colour }}
              >
                Choose a part
              </button>
              <button
                type="button"
                onClick={takeSoundOff}
                disabled={sending}
                className="flex size-9 shrink-0 items-center justify-center rounded-full transition hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] disabled:opacity-40"
                style={{ color: CARD_DIM }}
                aria-label="Take the audio off"
                title="Take the audio off"
              >
                <X className="size-[18px]" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openSound}
              disabled={sending}
              className="flex min-h-[50px] w-full items-center gap-3 rounded-lg px-2 text-left transition hover:bg-[color-mix(in_srgb,currentColor_6%,transparent)] disabled:opacity-40"
              style={{ color: modalInk }}
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-lg"
                style={{
                  backgroundColor: `color-mix(in srgb, ${award.colour} 12%, transparent)`,
                  color: award.colour,
                }}
              >
                <Music2 className="size-[17px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold">
                  Add audio
                </span>
                <span className="block text-[11px]" style={{ color: CARD_DIM }}>
                  {Math.round(momentSoundSpan() / 1000)} seconds under the card
                </span>
              </span>
              <span
                className="grid size-8 shrink-0 place-items-center rounded-full"
                style={{
                  backgroundColor: `color-mix(in srgb, ${award.colour} 12%, transparent)`,
                  color: award.colour,
                }}
              >
                <Plus className="size-4" aria-hidden />
              </span>
            </button>
          )}

          {/* The one question this page asks before the share. Above the button
            rather than in a sheet behind it: the page already knows the person,
            so naming them is one switch and not a second sheet. */}
          {named ? (
            <div className="flex min-h-[50px] items-center gap-3 px-2">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-lg"
                style={{
                  backgroundColor: `color-mix(in srgb, ${award.colour} 12%, transparent)`,
                  color: award.colour,
                }}
              >
                <AtSign className="size-[17px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold">
                  {`Mention ${theirName}`}
                </p>
                <p className="truncate text-[11px]" style={{ color: CARD_DIM }}>
                  {mention
                    ? "They'll be mentioned in this moment"
                    : "They won't be mentioned"}
                </p>
              </div>
              <SettingsSwitch
                on={mention}
                disabled={sending}
                label={`Mention ${theirName}`}
                onChange={() => setMention((on) => !on)}
                tone={award.colour}
              />
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void share()}
          disabled={!card || sending}
          className="mt-2 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg text-[15.5px] font-bold text-white transition-[filter,transform,opacity] duration-200 hover:brightness-[1.06] active:scale-[0.99] disabled:opacity-45"
          style={{
            backgroundColor: award.colour,
            boxShadow: `0 10px 24px color-mix(in srgb, ${award.colour} 24%, transparent)`,
          }}
        >
          {sending ? (
            <LoaderCircle className="size-[19px] animate-spin" aria-hidden />
          ) : (
            <ArrowUp className="size-[19px]" aria-hidden />
          )}
          Share Moment
        </button>
      </div>
    </div>
  );

  return (
    <>
      {variant === "panel" ? (
        body
      ) : (
        <Modal
          open={open}
          onClose={sending ? () => undefined : onClose}
          size="full"
          hideClose
          className="bg-[var(--card)]"
        >
          {body}
        </Modal>
      )}

      {/* Both sheets ride above this page rather than inside it, so the card
          stays painted behind them and closing one puts the person back on the
          page exactly as it was. */}
      <SoundPicker
        open={soundOpen}
        selectedId={sound ? String(sound.track.id) : null}
        onClose={() => setSoundOpen(false)}
        onPick={pickedSound}
        contained={variant === "panel"}
      />
      <PartChooser
        open={partOpen}
        track={partTrack}
        spanMs={partSpan}
        initialStartMs={partFrom.startMs}
        initialEndMs={partFrom.endMs}
        onApply={applyPart}
        onClose={closePart}
        contained={variant === "panel"}
      />
    </>
  );
}

export default SparkMoment;

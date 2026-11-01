import type { ReactNode } from "react";
import {
  AudioLines,
  Bolt,
  Globe,
  Grid2x2,
  Info,
  Lock,
  LockOpen,
  PlayCircle,
  PlusCircle,
  UserPlus,
} from "lucide-react";

/**
 * The private-profile question, in the app's own two halves.
 *
 * Going private is the one switch that changes what other people can see of
 * everything *already* posted rather than of the next thing, so it names the
 * shelves that drop out of sight one by one — drops, Vibes, audio and moments —
 * and then the note underneath that says what does not change. Coming back is
 * the same dialog the other way round, naming what opens again. A no, or a tap
 * on the backdrop, sends nothing at all.
 *
 * Ported from `confirmPrivate` in `app/lib/screens/sheets.dart`, and shared
 * rather than copied: the app opens this same dialog from the Controls switch
 * and from the pill under a name on one's own profile, "so the two doors say
 * the same things about what leaves the shelves, and the same write". A second
 * copy on the web would be the same chance to drift.
 */
export function PrivacyConfirm({
  going,
  onStay,
  onGo,
}: {
  /** Which direction is being gone. */
  going: boolean;
  onStay: () => void;
  onGo: () => void;
}) {
  const shelves: { icon: ReactNode; label: string; text: string }[] = [
    { icon: <Grid2x2 className="size-[17px]" />, label: "Drops", text: "Leave the feed, search and hashtags." },
    { icon: <PlayCircle className="size-[17px]" />, label: "Vibes", text: "Leave the shelf and stop playing for new people." },
    { icon: <AudioLines className="size-[17px]" />, label: "Audio", text: "Leave the sound boards and any playlist drawn from them." },
    { icon: <Bolt className="size-[17px]" />, label: "Moments", text: "Only people you have accepted can open them." },
  ];
  const opening: { icon: ReactNode; label: string; text: string }[] = [
    { icon: <Globe className="size-[17px]" />, label: "Anyone can see", text: "Drops, vibes and audio go back on every shelf." },
    { icon: <UserPlus className="size-[17px]" />, label: "Anyone can keep you", text: "New people follow straight away, with no request." },
    { icon: <PlusCircle className="size-[17px]" />, label: "Posting opens again", text: "You can put up new drops, vibes and audio." },
  ];
  return (
    <div className="px-5 pb-4 pt-6">
      <div className="mx-auto flex size-[60px] items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]">
        {going ? (
          <Lock className="size-7 text-accent" />
        ) : (
          <LockOpen className="size-7 text-accent" />
        )}
      </div>
      <h2 className="mt-4 text-center text-[19px] font-extrabold tracking-[-0.3px]">
        {going ? "Go private?" : "Go public again?"}
      </h2>
      <p className="mt-2 text-center text-[14px] leading-[1.45] text-dim">
        {going
          ? "Your profile stays yours, and only the people you accept keep what they were already shown."
          : "Everything you have put up becomes visible to everyone again."}
      </p>

      {going ? (
        <div className="mt-5">
          {shelves.map((row) => (
            <PrivacyLine key={row.label} {...row} />
          ))}
          <div className="my-[13px] h-px bg-line" />
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 size-[15px] shrink-0 text-[color-mix(in_srgb,var(--ink)_45%,transparent)]" />
            <p className="text-[12px] leading-[1.5] text-[color-mix(in_srgb,var(--ink)_45%,transparent)]">
              While private you cannot post new drops, vibes or audio. Your profile, name and photo stay
              visible, and new people can ask to keep you.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-[18px]">
          {opening.map((row) => (
            <PrivacyLine key={row.label} {...row} />
          ))}
        </div>
      )}

      <div className="mt-[22px] flex gap-2.5">
        <button type="button" onClick={onStay} className="flex-1 rounded-[16px] py-3.5 text-[14px] font-semibold text-dim">
          {going ? "Stay public" : "Cancel"}
        </button>
        <button
          type="button"
          onClick={onGo}
          className="flex-1 rounded-[16px] bg-accent py-3.5 text-[14px] font-bold text-on-accent"
        >
          {going ? "Go private" : "Go public"}
        </button>
      </div>
    </div>
  );
}

/** One shelf in the private-profile dialog: a tile, a name, and what changes. */
function PrivacyLine({ icon, label, text }: { icon: ReactNode; label: string; text: string }) {
  return (
    <div className="flex items-start gap-3 pb-[13px]">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-accent">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold">{label}</span>
        <span className="mt-0.5 block text-[12.5px] leading-[1.35] text-dim">{text}</span>
      </span>
    </div>
  );
}

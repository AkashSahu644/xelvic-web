import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellOff,
  Bookmark,
  ChartColumn,
  EyeOff,
  Flag,
  ImageDown,
  ListPlus,
  MessageSquareOff,
  MessagesSquare,
  Pencil,
  ThumbsDown,
  Trash,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Modal, ConfirmDialog } from "@/components/overlays/Modal";
import { SheetRow } from "@/features/profile/parts";
import { ReportSheet } from "@/features/report/ReportSheet";
import { errorMessage } from "@/utils/errors";
import { mediaBlob } from "@/utils/mediaCache";
import { useSaved } from "@/hooks/useSaved";
import { savedKindOf } from "@/store/saved";
import { useToast } from "@/hooks/useToast";
import { dropsService } from "@/services/drops.service";
import type { Drop } from "@/types/api";
import { dropBase, dropIsSound, dropIsVibe } from "./model";

/**
 * The ⋮ on a card, ported from `showDropMenu` in `screens/drop_sheets.dart`.
 *
 * The app's menu is two lists sharing one head: a reader's rows, and — on my
 * own post — the back of the card instead. Both are here in the app's own order
 * with the app's own words, and every row is a real call.
 *
 * The two rows that cannot mean on a web page exactly what they mean on a phone
 * say what they do instead, and are drawn only where they can do it:
 *
 * - *Save to gallery* writes to the photo roll, which no web page may touch. The
 *   row is here on a single picture and brings the bytes down through this
 *   account's own credentials into the browser's downloads. Its second line says
 *   that, so nobody presses it expecting their phone's album.
 * - *Add to a playlist* opens the app's folder picker for a sound. The web's
 *   shelf lives at the sound's own page, so the row hands the drop to whoever
 *   draws the page and that page opens the shelf list — see `onPlaylist`.
 *
 * A row the app has that this does not is named in the gap report rather than
 * drawn dead: the app's *Not interested* also carries a "show me fewer of these
 * for a while" that the endpoint here does not take.
 */
export function DropMenu({
  drop,
  open,
  onClose,
  onRemoved,
  onEdit,
  onStats,
  onPlaylist,
  onChanged,
}: {
  drop: Drop;
  open: boolean;
  onClose: () => void;
  /** It is gone from this reader's feed — hidden, or taken down by its author. */
  onRemoved?: () => void;
  /** Open this post in the composer. Drawn only where the caller can do it. */
  onEdit?: () => void;
  /** Open the statistics sheet. Own posts only, as the app draws it. */
  onStats?: () => void;
  /** Open the shelf picker for this sound. Drawn only where a caller has one. */
  onPlaylist?: () => void;
  /** Something about this row changed — the card should ask again. */
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { has, toggle: toggleSaved } = useSaved();
  const [report, setReport] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const saved = has(savedKindOf(drop), drop.id);
  const base = dropBase(drop);
  const name = drop.author.name || drop.author.username;

  /** Shut the sheet, say what happened, and let the card ask again. */
  function done(message: string) {
    onClose();
    toast({ title: message, tone: "success" });
    onChanged?.();
  }

  function failed(error: unknown) {
    toast({ title: "That did not work", description: errorMessage(error), tone: "error" });
  }

  const hide = useMutation({
    mutationFn: () => dropsService.hide(base, drop.id, true),
    onSuccess: () => {
      onRemoved?.();
      done("You will not be shown that again.");
    },
    onError: failed,
  });

  const mute = useMutation({
    mutationFn: () => dropsService.muteAuthor(drop.author.id),
    onSuccess: () => done(`Nothing more from ${name}.`),
    onError: failed,
  });

  const less = useMutation({
    mutationFn: () => dropsService.muteFormat(drop.format ?? ""),
    onSuccess: () => done(`Fewer ${drop.format_label} from now on.`),
    onError: failed,
  });

  const trash = useMutation({
    mutationFn: () => dropsService.remove(base, drop.id),
    onSuccess: () => {
      onRemoved?.();
      done("Taken down.");
    },
    onError: failed,
  });

  /**
   * My own post's two doors, turned and reported.
   *
   * One `PATCH` for both, because that is the shape the edit route takes — and
   * because a post has other fields that a door press has no business touching.
   * The answer is the whole fresh row, so the invalidated read draws the card
   * from the server's own copy rather than from a guess about what the server
   * did with it.
   */
  async function toggleDoor(field: "comments_off" | "likes_off") {
    if (busy) return;
    const next = !drop[field];
    setBusy(field);
    try {
      await dropsService.edit(base, drop.id, { [field]: next });
      void queryClient.invalidateQueries({ queryKey: ["drops"] });
      void queryClient.invalidateQueries({ queryKey: ["drop", drop.id] });
      onChanged?.();
      onClose();
      toast({
        title:
          field === "comments_off"
            ? next
              ? "Comments are off."
              : "Comments are on."
            : next
              ? "Felt count hidden."
              : "Felt count shown.",
        tone: "success",
      });
    } catch (error) {
      failed(error);
    } finally {
      setBusy(null);
    }
  }

  /**
   * Bring a picture down to this computer.
   *
   * The web's answer to the app's *Save to gallery*, and the same two steps in
   * the same order: the bytes come down through this account's own credentials,
   * and then the browser's own download puts them where this machine keeps its
   * files. The picture's own name is used when the server kept one.
   */
  async function keepPicture() {
    if (busy) return;
    const url = drop.asset?.content_url;
    if (!url) {
      toast({ title: "There is no picture to save.", tone: "error" });
      return;
    }
    setBusy("keep");
    try {
      const blob = await mediaBlob(url);
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = drop.asset?.original_name || `xelvic-${drop.id}`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      onClose();
      toast({ title: "Saved.", description: "It is in this computer's downloads.", tone: "success" });
    } catch (error) {
      toast({ title: "Could not bring the picture down.", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={name}
        description={`@${drop.author.username}`}
        size="sm"
      >
        <div className="pb-2">
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar user={drop.author} size={40} />
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-extrabold">{name}</span>
              <span className="block truncate text-[11.5px] text-dim">@{drop.author.username}</span>
            </span>
          </div>

          {/* One row on anybody's post as on my own: a save is not a reaction
              and reaches nobody, so there is nothing about saving my own that
              differs from saving somebody else's. */}
          <SheetRow
            icon={
              <Bookmark className={saved ? "size-[18px] fill-current" : "size-[18px]"} />
            }
            label={saved ? "Saved" : "Save"}
            onClick={() => {
              void toggleSaved(savedKindOf(drop), drop.id, !saved);
              onChanged?.();
            }}
          />

          {dropIsSound(drop) && onPlaylist ? (
            <SheetRow
              icon={<ListPlus className="size-[18px]" />}
              label="Add to a playlist"
              onClick={() => {
                onClose();
                onPlaylist();
              }}
            />
          ) : null}

          {/* Only a single picture: a gallery is several files and one "save"
              row over it would not say which, and a clip is a different kind of
              file with its own answer on a page. */}
          {drop.kind === "image" && drop.asset?.content_url ? (
            <SheetRow
              icon={<ImageDown className="size-[18px]" />}
              label="Save to gallery"
              line="Keeps a copy in this computer's downloads."
              onClick={() => void keepPicture()}
            />
          ) : null}

          {drop.mine ? (
            <>
              {onStats ? (
                <SheetRow
                  icon={<ChartColumn className="size-[18px]" />}
                  label="See statistics"
                  onClick={() => {
                    onClose();
                    onStats();
                  }}
                />
              ) : null}
              <SheetRow
                icon={
                  drop.comments_off ? (
                    <MessagesSquare className="size-[18px]" />
                  ) : (
                    <MessageSquareOff className="size-[18px]" />
                  )
                }
                label={drop.comments_off ? "Turn on comments" : "Turn off comments"}
                onClick={() => void toggleDoor("comments_off")}
              />
              <SheetRow
                icon={drop.likes_off ? <Bell className="size-[18px]" /> : <BellOff className="size-[18px]" />}
                label={drop.likes_off ? "Show felt count" : "Hide felt count"}
                line={drop.likes_off ? undefined : "Only you will see it."}
                onClick={() => void toggleDoor("likes_off")}
              />
              {onEdit ? (
                <SheetRow
                  icon={<Pencil className="size-[18px]" />}
                  label="Update"
                  onClick={() => {
                    onClose();
                    onEdit();
                  }}
                />
              ) : null}
              <SheetRow
                icon={<Trash className="size-[18px]" />}
                label="Take it down"
                onClick={() => {
                  onClose();
                  setConfirmTrash(true);
                }}
              />
            </>
          ) : (
            <>
              <SheetRow
                icon={<UserRound className="size-[18px]" />}
                label="About this account"
                onClick={() => {
                  onClose();
                  navigate(`/app/u/${drop.author.username}`);
                }}
              />
              <SheetRow
                icon={<EyeOff className="size-[18px]" />}
                label="Not interested"
                line="You will not be shown that again."
                onClick={() => hide.mutate()}
              />
              {/* Only on a post the content read filed under a kind, because
                  there is nothing to say no to on an unfiled one — and the row
                  names the kind with the server's own word for it, so the menu
                  never offers to mute a string nobody can see. */}
              {drop.format && drop.format_label ? (
                <SheetRow
                  icon={<ThumbsDown className="size-[18px]" />}
                  label={`Less ${drop.format_label}`}
                  line="You will see fewer of these. Nothing else changes."
                  onClick={() => less.mutate()}
                />
              ) : null}
              <SheetRow icon={<BellOff className="size-[18px]" />} label="Mute" onClick={() => mute.mutate()} />
              <SheetRow
                icon={<Flag className="size-[18px]" />}
                label="Report"
                line={`A moderator looks at it. ${name} is not told.`}
                onClick={() => {
                  onClose();
                  setReport(true);
                }}
              />
            </>
          )}
        </div>
      </Modal>

      <ReportSheet
        open={report}
        onClose={() => setReport(false)}
        kind={dropIsVibe(drop) ? "vibe" : "drop"}
        id={drop.id}
        who={name}
        handle={drop.author.username}
        avatar={drop.author.avatar}
        preview={drop.body}
      />

      <ConfirmDialog
        open={confirmTrash}
        onClose={() => setConfirmTrash(false)}
        onConfirm={() => trash.mutate()}
        title="Take it down?"
        body="It comes off everybody's feed, and off your profile."
        note="This cannot be undone."
        confirmLabel="Take it down"
        destructive
        loading={trash.isPending}
        icon={<Trash className="size-4" />}
      />
    </>
  );
}

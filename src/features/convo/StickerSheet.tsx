import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Modal } from "@/components/overlays/Modal";
import { Spinner } from "@/components/ui/Button";
import {
  siftShelf,
  stickersService,
  type ShelfSticker,
} from "@/services/stickers.service";

export function StickerSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (sticker: ShelfSticker) => void;
}) {
  const [rows, setRows] = useState<ShelfSticker[]>([]);
  const [find, setFind] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    void stickersService
      .shelf()
      .then((shelf) => {
        if (!cancelled) setRows(shelf);
      })
      .catch(() => {
        // A shelf that could not be read is said out loud rather than shown as
        // an empty grid, which reads as a shelf with nothing on it.
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // The box is emptied each time the shelf is opened, which is what the phone
  // does: a search that survived a close would hide the shelf the next time
  // somebody looked at it.
  useEffect(() => {
    if (!open) setFind("");
  }, [open]);

  const shown = useMemo(() => siftShelf(rows, find), [rows, find]);

  return (
    <Modal open={open} onClose={onClose} title="Stickers" size="lg">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-[14px] border border-line bg-paper px-3">
          <Search className="size-4 shrink-0 text-dim" aria-hidden />
          <input
            value={find}
            onChange={(event) => setFind(event.target.value)}
            placeholder="Search stickers"
            aria-label="Search stickers"
            className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-dim"
          />
          {find ? (
            <button
              type="button"
              onClick={() => setFind("")}
              className="flex size-7 items-center justify-center rounded-full text-dim transition hover:text-ink"
              aria-label="Clear the search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="size-6" />
          </div>
        ) : null}

        {!loading && failed ? (
          <p className="py-10 text-center text-[13px] text-dim">
            The stickers did not come down. Try again in a moment.
          </p>
        ) : null}

        {!loading && !failed && rows.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-dim">
            No stickers came down.
          </p>
        ) : null}

        {!loading && !failed && rows.length > 0 && shown.length === 0 ? (
          // The word is said back rather than an empty grid being left, which
          // reads as a sheet that has stopped working. The app's own wording for
          // this case, from its editor's sheet.
          <p className="py-10 text-center text-[13px] text-dim">
            {`Nothing for "${find.trim()}"`}
          </p>
        ) : null}

        {shown.length ? (
          <div className="grid max-h-[52vh] grid-cols-4 gap-2 overflow-y-auto">
            {shown.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => onPick(row)}
                className="flex aspect-square items-center justify-center rounded-[12px] bg-[var(--accent-soft)] p-2 transition hover:brightness-[0.97]"
                aria-label={row.name || "Sticker"}
                title={row.packName || row.name || undefined}
              >
                <img
                  src={row.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-contain"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

export default StickerSheet;

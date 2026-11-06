/**
 * The list of part lengths, as a menu under the seconds pill in the editor's
 * "Choose a part" sheet.
 *
 * The phone opens a modal sheet here (`_WindowViewState._pickDuration`) and the
 * web did the same, with a grid of six values. Two things were wrong with that
 * and one is why this is a menu now:
 *
 * - the grid held ten to thirty-five seconds, where the phone offers ten to
 *   sixty — see `partLength.ts`, which is where the list and the placement
 *   arithmetic live.
 * - a sheet for eleven short words is a screenful of chrome over the thing the
 *   person is looking at, and the pill that opens it is already at the foot of
 *   a sheet. A menu anchored to the pill says the same thing without the second
 *   layer — the ask this replaces.
 *
 * It is measured against the window rather than the sheet, and it follows the
 * pill when the sheet behind it scrolls, because a menu laid out inside a
 * scrolling box is clipped by it.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { cn } from "@/utils/cn";
import {
  PART_LENGTHS_MS,
  PART_MENU_PADDING,
  PART_ROW_HEIGHT,
  placePartMenu,
  type PartMenuPlacement,
} from "./partLength";

interface PartLengthMenuProps {
  /** The pill the menu hangs off. Its rect is re-read as the sheet scrolls. */
  anchor: HTMLElement | null;
  /** The part's current length, in milliseconds. */
  value: number;
  onPick: (ms: number) => void;
  onClose: () => void;
}

export function PartLengthMenu({
  anchor,
  value,
  onPick,
  onClose,
}: PartLengthMenuProps) {
  const [placement, setPlacement] = useState<PartMenuPlacement | null>(null);
  const rowsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);
  const selected = PART_LENGTHS_MS.indexOf(value);

  // Before the first paint, so the menu is never drawn at the wrong edge.
  useLayoutEffect(() => {
    if (!anchor) return;
    const measure = () => {
      setPlacement(
        placePartMenu(anchor.getBoundingClientRect(), {
          width: window.innerWidth,
          height: window.innerHeight,
        }),
      );
    };
    measure();
    window.addEventListener("resize", measure);
    // Capture, so the sheet's own scrolling counts and not just the window's.
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [anchor]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Caught on the way down and stopped there, so nothing under the menu —
      // the sheet this pill is in, or anything a later pass hangs Escape on —
      // takes the same key for a second meaning.
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  // The part's own length is where a keyboard lands, the first time only — a
  // pick closes the menu, so there is no later time to land again at.
  useEffect(() => {
    if (focusedRef.current || !placement) return;
    focusedRef.current = true;
    rowsRef.current[selected >= 0 ? selected : 0]?.focus();
  }, [placement, selected]);

  // And it goes back to the pill it came off, rather than to the body — which
  // is where a removed element leaves the focus, and a keyboard then has to
  // walk the whole sheet again to reach the length it was just at.
  useEffect(() => {
    const menu = menuRef.current;
    return () => {
      if (menu && menu.contains(document.activeElement)) anchor?.focus();
    };
  }, [anchor]);

  function move(delta: number) {
    const count = PART_LENGTHS_MS.length;
    const at = rowsRef.current.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const next = (((at < 0 ? 0 : at) + delta) % count + count) % count;
    rowsRef.current[next]?.focus();
  }

  if (!placement || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[210]" onClick={onClose} />
      <div
        ref={menuRef}
        role="menu"
        aria-label="How many seconds"
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            move(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            move(-1);
          } else if (event.key === "Home") {
            event.preventDefault();
            rowsRef.current[0]?.focus();
          } else if (event.key === "End") {
            event.preventDefault();
            rowsRef.current[PART_LENGTHS_MS.length - 1]?.focus();
          }
        }}
        style={{
          left: placement.left,
          width: placement.width,
          maxHeight: placement.maxHeight,
          top: placement.top,
          bottom: placement.bottom,
          padding: PART_MENU_PADDING,
        }}
        className="fixed z-[211] overflow-y-auto overscroll-contain rounded-lg border border-line bg-card text-ink shadow-xl hide-scrollbar"
      >
        {PART_LENGTHS_MS.map((ms, index) => {
          const on = ms === value;
          return (
            <button
              key={ms}
              ref={(node) => {
                rowsRef.current[index] = node;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={on}
              onClick={() => onPick(ms)}
              style={{ height: PART_ROW_HEIGHT }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-2 text-[13px] font-black transition",
                on ? "bg-accent-chip text-accent" : "text-ink hover:bg-surface-2",
              )}
            >
              {ms / 1000}s
              {on ? <Check className="size-4" /> : null}
            </button>
          );
        })}
      </div>
    </>,
    document.body,
  );
}

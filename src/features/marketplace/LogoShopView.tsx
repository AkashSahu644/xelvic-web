// The Logos aisle of the marketplace: which of the app's own marks is on.
//
// Ported from `screens/logo_shop_view.dart`. The smallest of the three shelves
// and the least mysterious: Drip sells a figure that stands in somebody else's
// convo and Themes sells the colour the whole web is read in; this sells the
// mark in the corner. Twelve plates — the pink one, which is the app's and free,
// and eleven that are bought with sparks — until the Style Studio speaks, and
// then it is whatever the server's overlay says it is. The shelf below is
// `logoPlateShelf`, never the bundled constant, so a plate somebody added in the
// panel is one this shop sells too.
//
// Two things shape the whole view, and both are consequences of what a logo is:
//
//   * **The tile is the preview.** A theme needs a page of its own to be looked
//     at — it is a palette and a set of pages, and a swatch cannot show that —
//     but a logo *is* the picture on the tile. So a tap on one that is open puts
//     it on and there is nowhere else to go, and a tap on one that is not opens
//     the price. Buying it puts it on in the same breath: a purchase that left
//     the web looking exactly as it did would be a shop that took the sparks and
//     showed nothing for them.
//   * **It changes everywhere at once, and nothing here does that.** The worn
//     plate lives in `PreferencesProvider`, and every mark on the web reads it
//     from there — so the same tap that changes this shelf changes the corner of
//     every screen. This view is only the hand that picks.
//
// It is a *body* rather than a page — no title, no back button, no scaffold —
// the way `DripView` and `ThemeShopView` are, which is what makes the three of
// them three shelves of one shop with one purse above them.

import { useState } from "react";
import { Zap } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Button";
import { cn } from "@/lib/cn";
import { usePreferences } from "@/providers/PreferencesProvider";
import { useToast } from "@/providers/ToastProvider";
import { count } from "@/theme/shop";
import { logoPlateShelf, plateCanOpen, plateIsOpen, type LogoPlate } from "./model";
import { useCatalogue, useMarket, useMarketWallet } from "./queries";

export function LogoShopView() {
  const { data: catalogue } = useCatalogue();
  const wallet = useMarketWallet();
  const market = useMarket();
  const preferences = usePreferences();
  const { toast } = useToast();
  const [sheet, setSheet] = useState<LogoPlate | null>(null);

  const shelf = logoPlateShelf(catalogue?.logos ?? []);
  const opened = wallet.data?.owned_logos ?? [];
  const balance = wallet.data?.balance ?? 0;
  const worn = preferences.logo || "pink";

  /**
   * Put a plate on.
   *
   * The disk is written first and the account after, exactly as the theme shop
   * does it: the plate is drawn from the disk, so a request that never lands
   * still leaves the web looking like the thing that was tapped, and a refusal
   * rolls the disk back rather than leaving a mark that only this tab believes.
   */
  async function wear(plate: LogoPlate) {
    const previous = preferences.logo;
    preferences.setLogo(plate.key);
    try {
      await market.wearLogo(plate.key);
      toast({ title: `${plate.name} is on`, tone: "success" });
    } catch (error) {
      preferences.setLogo(previous);
      toast({
        title: "That logo did not save",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    }
  }

  /** What a tap on a plate does. Three states, and two of them are the same answer. */
  async function tap(plate: LogoPlate) {
    // Already on: there is no second thing a tap could mean, so it does nothing
    // rather than paying to wear what is already being worn.
    if (worn === plate.key) return;
    if (plateIsOpen(plate, opened)) {
      await wear(plate);
      return;
    }
    setSheet(plate);
  }

  return (
    <div>
      {/* Three to a row, as wide as the page allows. A wrap rather than a grid
          because the shelf is twelve plates on a build that has read nothing and
          whatever the server says otherwise — and a count that is not a multiple
          of three would leave the last row's tiles stretched across the page,
          which is not a shelf. The three numbers are the app's: `side` is what
          is left after the page's own gutters, held between 64 and 132. */}
      <div className="flex flex-wrap gap-x-3 gap-y-4">
        {shelf.map((plate) => {
          const wearing = worn === plate.key;
          const open = plateIsOpen(plate, opened);
          return (
            <button
              key={plate.key}
              type="button"
              onClick={() => void tap(plate)}
              aria-label={open ? plate.name : `${plate.name}, locked`}
              aria-pressed={wearing}
              style={{ width: "calc((100% - 24px) / 3)" }}
              className="min-w-[64px] max-w-[132px] text-left"
            >
              <span
                className="relative block aspect-square overflow-hidden border-2"
                style={{ borderRadius: "22%" }}
              >
                <Plate plate={plate} />
                {/* A plate that has not been paid for says so with its price, so
                    the shelf is a shop and not a row of twelve pictures that all
                    look equally available. The ring is the other state and the
                    two can never both show: a worn plate is an open one. */}
                {open ? null : (
                  <span
                    className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-[8px] px-1.5 py-[3px] text-[10px] font-extrabold text-white"
                    style={{ background: "rgb(var(--solid-rgb) / 0.55)" }}
                  >
                    <Zap className="size-[11px]" aria-hidden />
                    {count(plate.price)}
                  </span>
                )}
                {wearing ? (
                  <span
                    className="pointer-events-none absolute inset-0 border-[2.5px] border-[var(--accent)]"
                    style={{ borderRadius: "22%" }}
                    aria-hidden
                  />
                ) : null}
              </span>
              <span
                className={cn(
                  "mt-[5px] block truncate text-[12.5px]",
                  wearing ? "font-extrabold text-[var(--accent)]" : "font-semibold text-ink",
                )}
              >
                {wearing ? `${plate.name} · on` : plate.name}
              </span>
            </button>
          );
        })}
      </div>

      <BuySheet
        plate={sheet}
        balance={balance}
        opened={opened}
        busy={false}
        onClose={() => setSheet(null)}
        onBought={async (plate) => {
          setSheet(null);
          await wear(plate);
        }}
        onBuy={async (plate) => {
          await market.buyLogo(plate.key);
          return true;
        }}
      />
    </div>
  );
}

/**
 * The plate itself, and the fallback under it.
 *
 * A row may name a picture this build cannot reach, and the bundled file for the
 * key is the second thing to try: the shop's own twelve always have one, so a
 * broken upload shows the plate as it was drawn rather than a hole in the shelf.
 */
function Plate({ plate, className }: { plate: LogoPlate; className?: string }) {
  const [broken, setBroken] = useState(false);
  const src = broken && plate.fallback ? plate.fallback : plate.picture;
  if (!src) {
    return (
      <span
        className={cn("flex size-full items-center justify-center bg-[var(--accent-soft)]", className)}
        aria-hidden
      />
    );
  }
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onError={() => setBroken(true)}
      className={cn("size-full object-cover", className)}
    />
  );
}

/**
 * The one decision on a locked plate: spend the sparks, or back out.
 *
 * A short sheet rather than a page — the shape the theme shop's own decision has
 * and for the same reason: the price, the balance and one button, so the whole
 * thing fits above the fold.
 */
function BuySheet({
  plate,
  balance,
  opened,
  busy,
  onClose,
  onBuy,
  onBought,
}: {
  plate: LogoPlate | null;
  balance: number;
  opened: string[];
  busy: boolean;
  onClose: () => void;
  onBuy: (plate: LogoPlate) => Promise<boolean>;
  onBought: (plate: LogoPlate) => Promise<void>;
}) {
  const [working, setWorking] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);

  if (!plate) return null;
  const can = plateCanOpen(plate, opened, balance);
  const left = plate.price - balance;

  async function keep() {
    if (!plate || working) return;
    setWorking(true);
    setTrouble(null);
    try {
      const done = await onBuy(plate);
      if (!done) {
        setWorking(false);
        setTrouble("That logo is not open to buy just now.");
        return;
      }
      setWorking(false);
      await onBought(plate);
    } catch (error) {
      setWorking(false);
      setTrouble(error instanceof Error ? error.message : "That logo is not open to buy just now.");
    }
  }

  return (
    <Modal
      open
      onClose={() => {
        setTrouble(null);
        onClose();
      }}
      title={plate.name}
      description={`${count(plate.price)} ${plate.price === 1 ? "spark" : "sparks"} · you have ${count(balance)}`}
      footer={
        <button
          type="button"
          onClick={() => void keep()}
          disabled={!can || working || busy}
          className="flex min-h-11 w-full items-center justify-center rounded-[13px] bg-[var(--button)] text-[14.5px] font-bold text-[var(--button-text)] transition disabled:opacity-45"
        >
          {working ? (
            <Spinner className="size-[18px] text-[var(--button-text)]" />
          ) : can ? (
            `Buy for ${count(plate.price)}`
          ) : (
            `Need ${count(left)} more`
          )}
        </button>
      }
    >
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="block size-11 shrink-0 overflow-hidden rounded-[22%]">
          <Plate plate={plate} />
        </span>
        <p className="min-w-0 flex-1 text-[12.5px] leading-5 text-dim">
          A logo is worn in the corner of every screen, and changes the moment it is bought.
        </p>
      </div>
      {trouble ? <p className="px-5 pb-4 text-[12px] text-[var(--bad)]">{trouble}</p> : null}
    </Modal>
  );
}

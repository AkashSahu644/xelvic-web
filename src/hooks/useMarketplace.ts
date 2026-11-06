// The marketplace's two reads and its eight writes.
//
// Every door here is one the backend already has — `apps/studio` for the
// catalogue and the figure pick, `apps/drip` for the shelf's own reading, and
// `apps/sparks` for the wallet and the two purchases. Nothing new was added for
// the web and nothing needs to be: the app's marketplace is exactly these calls,
// which is why the web's can be exactly the same calls.
//
// Two rules the app keeps and this file keeps with it:
//
//   * **A write is followed by a read.** Nothing here is optimistic. A purchase
//     answers with a price and a balance and *not* with the new shelf, and a
//     tile that showed itself as bought before the server agreed would be the
//     web claiming a purchase that may have been refused.
//   * **The purse is one reading.** `/sparks/wallet/` is asked once and shared
//     — it decides what is affordable, which rungs are reached and which logos
//     are open — so the whole marketplace is a single number that cannot
//     disagree with itself.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth.service";
import { marketplaceService } from "@/services/marketplace.service";
import { sparksService } from "@/services/sparks.service";
import { marketKeys, refreshShelves } from "@/store/marketplace";
import type { Me } from "@/types/api";
import type { FigurePick, PurchaseAnswer } from "@/features/marketplace/types";

export { marketKeys } from "@/store/marketplace";

/** Whether there is somebody to ask about — the shelf is nobody's when nobody is in. */
function useSignedIn(): boolean {
  const { status } = useAuth();
  return status === "authenticated";
}

/**
 * The whole public read: every theme, logo, character and occasion the shelf is
 * carrying for this account right now.
 *
 * One request, because it is one answer: the row that says what a theme costs
 * also says whether this person owns it, and asking twice would be two chances
 * to disagree. `staleTime` is short rather than zero — three shelves read this
 * on one screen, and a tab switch is not a reason to ask again.
 */
export function useCatalogue() {
  const enabled = useSignedIn();
  return useQuery({
    queryKey: marketKeys.catalogue,
    queryFn: () => marketplaceService.catalogue(),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * The Drip shelf's own reading: the figures, the balance, which one is worn and
 * whether it stands on the profile.
 *
 * A second request rather than a slice of the catalogue, because it is a second
 * question. The catalogue knows a character's *price and window*; this knows
 * which one this account is wearing, which is a fact about the account and not
 * about the shelf.
 */
export function useDripShelf() {
  const enabled = useSignedIn();
  return useQuery({
    queryKey: marketKeys.drip,
    queryFn: () => marketplaceService.drip(),
    enabled,
    staleTime: 15_000,
  });
}

/** What is in the wallet. See `services.wallet`. */
export function useMarketWallet(enabled = true) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: marketKeys.wallet,
    queryFn: () => sparksService.wallet(),
    enabled: enabled && signedIn,
    staleTime: 15_000,
  });
}

/** The writes, in one place so a card never has to know a URL. */
export interface MarketActions {
  /** Buy a theme and put it on. The buy answers with the price; the wear is the next call. */
  buyTheme: (key: string) => Promise<PurchaseAnswer>;
  /** Put a theme that is already open on. Answers with the account. */
  wearTheme: (key: string) => Promise<Me>;
  /** Buy a logo and put it on, in that order — the purchase is what earns the wearing. */
  buyLogo: (key: string) => Promise<PurchaseAnswer>;
  /** Put a logo that is already open on. */
  wearLogo: (key: string) => Promise<Me>;
  /** Buy a figure. */
  buyFigure: (key: string) => Promise<PurchaseAnswer>;
  /** Wear a figure, or nothing at all — an empty key is a real answer. */
  wearFigure: (key: string) => Promise<{ worn: string }>;
  /** Whether the figure stands beside the bio. */
  showFigure: (show: boolean) => Promise<{ show_character: boolean }>;
  /** Remember which of a theme's two characters this account is drawn as. */
  pickFigure: (theme: string, pick: FigurePick) => Promise<{ theme: string; pick: FigurePick }>;
  /** Make the theme's own face this account's avatar. */
  useThemeFace: (file: Blob) => Promise<Me>;
  /** And its scene the cover. */
  useThemeCover: (file: Blob) => Promise<Me>;
  /** Re-read all three shelves after a write. */
  refresh: () => Promise<void>;
}

/** The writes, bound to this screen's query client. */
export function useMarket(): MarketActions {
  const client = useQueryClient();
  return {
    buyTheme: async (key) => {
      const answer = await sparksService.buy(key);
      await refreshShelves(client);
      return answer;
    },
    wearTheme: async (key) => {
      const me = await authService.setTheme(key);
      await refreshShelves(client);
      return me;
    },
    buyLogo: async (key) => {
      const answer = await sparksService.buyLogo(key);
      await refreshShelves(client);
      return answer;
    },
    wearLogo: async (key) => {
      const me = await authService.setLogo(key);
      await refreshShelves(client);
      return me;
    },
    buyFigure: async (key) => {
      const answer = await marketplaceService.buyFigure(key);
      await refreshShelves(client);
      return answer;
    },
    wearFigure: async (key) => {
      const answer = await marketplaceService.wearFigure(key);
      await refreshShelves(client);
      return answer;
    },
    showFigure: async (show) => {
      const answer = await marketplaceService.showFigure(show);
      await refreshShelves(client);
      return answer;
    },
    pickFigure: async (theme, pick) => {
      const answer = await marketplaceService.pickFigure(theme, pick);
      await refreshShelves(client);
      return answer;
    },
    useThemeFace: async (file) => {
      const form = new FormData();
      form.append("avatar", file, "avatar.jpg");
      const me = await authService.uploadImage("avatar", form);
      await refreshShelves(client);
      return me;
    },
    useThemeCover: async (file) => {
      const form = new FormData();
      form.append("cover", file, "cover.jpg");
      const me = await authService.uploadImage("cover", form);
      await refreshShelves(client);
      return me;
    },
    refresh: () => refreshShelves(client),
  };
}
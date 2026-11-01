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

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import type { WalletData } from "@/features/sparks/types";
import type { Me } from "@/types/api";
import type { Catalogue, DripReading, FigurePick, PurchaseAnswer } from "./types";

/** The four query keys the marketplace reads and refreshes. */
export const marketKeys = {
  catalogue: ["catalogue"] as const,
  drip: ["drip"] as const,
  wallet: ["sparks-wallet"] as const,
  figurePick: ["catalogue-figure-pick"] as const,
};

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
    queryFn: () => api.get<Catalogue>("/catalogue/"),
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
    queryFn: () => api.get<DripReading>("/drip/"),
    enabled,
    staleTime: 15_000,
  });
}

/** What is in the wallet. See `services.wallet`. */
export function useMarketWallet(enabled = true) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: marketKeys.wallet,
    queryFn: () => api.get<WalletData>("/sparks/wallet/"),
    enabled: enabled && signedIn,
    staleTime: 15_000,
  });
}

/** Everything the three shelves change when one of them moves. */
async function refreshShelves(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: marketKeys.catalogue }),
    client.invalidateQueries({ queryKey: marketKeys.drip }),
    client.invalidateQueries({ queryKey: marketKeys.wallet }),
  ]);
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
      const answer = await api.post<PurchaseAnswer>("/sparks/wallet/buy/", { key });
      await refreshShelves(client);
      return answer;
    },
    wearTheme: async (key) => {
      const me = await api.patch<Me>("/auth/me/theme/", { theme: key });
      await refreshShelves(client);
      return me;
    },
    buyLogo: async (key) => {
      const answer = await api.post<PurchaseAnswer>("/sparks/wallet/buy-logo/", { key });
      await refreshShelves(client);
      return answer;
    },
    wearLogo: async (key) => {
      const me = await api.patch<Me>("/auth/me/logo/", { logo: key });
      await refreshShelves(client);
      return me;
    },
    buyFigure: async (key) => {
      const answer = await api.post<PurchaseAnswer>("/drip/buy/", { key });
      await refreshShelves(client);
      return answer;
    },
    wearFigure: async (key) => {
      const answer = await api.post<{ worn: string }>("/drip/wear/", { key });
      await refreshShelves(client);
      return answer;
    },
    showFigure: async (show) => {
      const answer = await api.post<{ show_character: boolean }>("/drip/profile/", { show });
      await refreshShelves(client);
      return answer;
    },
    pickFigure: async (theme, pick) => {
      const answer = await api.post<{ theme: string; pick: FigurePick }>("/catalogue/figure-pick/", {
        theme,
        pick,
      });
      await refreshShelves(client);
      return answer;
    },
    useThemeFace: async (file) => {
      const form = new FormData();
      form.append("avatar", file, "avatar.jpg");
      const me = await api.form<Me>("/auth/me/avatar/", form);
      await refreshShelves(client);
      return me;
    },
    useThemeCover: async (file) => {
      const form = new FormData();
      form.append("cover", file, "cover.jpg");
      const me = await api.form<Me>("/auth/me/cover/", form);
      await refreshShelves(client);
      return me;
    },
    refresh: () => refreshShelves(client),
  };
}

/**
 * Fetch a picture the server sent as an absolute URL and hand it back as a file,
 * so it can be uploaded as this account's avatar or cover.
 *
 * The theme's face and scene are pictures the server already holds, and the app
 * makes them the account's own by uploading a copy rather than by pointing the
 * account at them — the two are separate files with separate lives, and the row
 * may be repainted under somebody who has already chosen it. A cross-origin
 * picture without CORS headers cannot be read this way, and that is reported as
 * a failure rather than papered over: the theme goes on and the photo does not,
 * which is a thing the person is told.
 */
export async function fetchAsFile(url: string, name: string): Promise<Blob> {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(`The picture could not be read (${response.status}).`);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

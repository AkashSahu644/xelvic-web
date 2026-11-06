import api from "@/config/axios";
import type { Catalogue, DripReading, FigurePick, PurchaseAnswer } from "@/features/marketplace/types";

/**
 * The marketplace.
 *
 * One method per road, and every method answers with the server's own body —
 * `response.data` and nothing reshaped. That is the rule for every service in
 * this folder: a service decides *where* a request goes and *what shape* goes
 * with it, and never invents a value the server did not send.
 *
 * The wallet's three roads (`/sparks/wallet/`, its two buys) are not repeated
 * here: they belong to `sparks.service`, which owns that purse. This file is the
 * shelf — catalogue, Drip, and the figure on the profile.
 *
 * Nothing here re-reads the shelves after a write. A purchase answers with the
 * price charged and the balance left and *not* with the shelf it changed, so
 * the screen that acted is the one that asks again — the service stays the
 * single call it is.
 */

export const marketplaceService = {
  /** Every theme, logo, character and occasion the shelf is carrying right now. */
  catalogue: async (): Promise<Catalogue> => {
    const response = await api.get<Catalogue>("/catalogue/");
    return response.data;
  },

  /** The Drip shelf's own reading: the figures, the balance and what is worn. */
  drip: async (): Promise<DripReading> => {
    const response = await api.get<DripReading>("/drip/");
    return response.data;
  },

  /** Buys a figure off the Drip shelf. */
  buyFigure: async (key: string): Promise<PurchaseAnswer> => {
    const response = await api.post<PurchaseAnswer>("/drip/buy/", { key });
    return response.data;
  },

  /** Wears a figure, or none at all — an empty key is a real answer. */
  wearFigure: async (key: string): Promise<{ worn: string }> => {
    const response = await api.post<{ worn: string }>("/drip/wear/", { key });
    return response.data;
  },

  /** Whether the figure stands beside the bio. */
  showFigure: async (show: boolean): Promise<{ show_character: boolean }> => {
    const response = await api.post<{ show_character: boolean }>("/drip/profile/", { show });
    return response.data;
  },

  /** Remembers which of a theme's two characters this account is drawn as. */
  pickFigure: async (theme: string, pick: FigurePick): Promise<{ theme: string; pick: FigurePick }> => {
    const response = await api.post<{ theme: string; pick: FigurePick }>("/catalogue/figure-pick/", {
      theme,
      pick,
    });
    return response.data;
  },
};

export default marketplaceService;

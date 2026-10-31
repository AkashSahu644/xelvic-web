import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Coins, LockKeyhole, Palette, Sparkles } from "lucide-react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { count } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useTheme } from "@/providers/ThemeProvider";
import { useToast } from "@/providers/ToastProvider";
import { designedThemes, type ThemeDesign } from "@/theme/catalog";
import type { ThemeMark } from "@/theme/ThemeMarkArt";
import {
  canOpen,
  isOpen,
  openedIn,
  progress,
  reached,
  shopAll,
  slotsLeft,
  THEME_TIERS,
  toGo,
  tierOf,
} from "@/theme/shop";

export interface ThemePurchaseResponse {
  key: string;
  price: number;
  charged: boolean;
  balance: number;
}

export interface ThemeShopProps {
  wallet: {
    balance: number;
    earned: number;
    owned: string[];
  };
}

function availability(
  theme: ThemeDesign,
  opened: Set<string>,
  earned: number,
  balance: number,
): string {
  if (isOpen(theme, opened)) {
    return theme.price === 0 ? "Included with Xelvic" : "Opened · wear it any time";
  }

  const tier = tierOf(theme);
  if (!reached(tier, earned)) return `${count(toGo(theme, earned))} more earned sparks to reach this tier`;
  if (slotsLeft(tier, opened) === 0) return "All theme picks at this tier are used";
  if (balance < theme.price) return `Need ${count(theme.price - balance)} more sparks in your wallet`;
  return "Ready to open";
}

export function ThemeShop({ wallet }: ThemeShopProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedDesign, previewDesign, clearPreview, setDesign, themes } = useTheme();
  const [preview, setPreview] = useState<ThemeDesign | null>(null);
  const [buyingKey, setBuyingKey] = useState<string | null>(null);
  const opened = new Set(wallet.owned);
  const shopThemes = shopAll(themes);
  const paidOpenedCount = shopThemes.filter((theme) => theme.price > 0 && opened.has(theme.key)).length;

  useEffect(() => () => clearPreview(), [clearPreview]);

  function showPreview(theme: ThemeDesign) {
    setPreview(theme);
    previewDesign(theme.key);
  }

  function closePreview() {
    clearPreview();
    setPreview(null);
  }

  async function wear(theme: ThemeDesign) {
    if (await setDesign(theme.key)) closePreview();
  }

  async function buy(theme: ThemeDesign) {
    if (!canOpen(theme, opened, wallet.earned, wallet.balance)) return;
    setBuyingKey(theme.key);
    try {
      const result = await api.post<ThemePurchaseResponse>("/sparks/wallet/buy/", { key: theme.key });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sparks-wallet"] }),
        queryClient.invalidateQueries({ queryKey: ["sparks"] }),
      ]);
      toast({
        title: result.charged ? `${theme.name} is open` : `${theme.name} was already open`,
        description: result.charged
          ? `${count(result.price)} sparks spent · ${count(result.balance)} left in your wallet.`
          : "You can wear it whenever you like.",
        tone: "success",
      });
    } catch (error) {
      toast({
        title: `Could not open ${theme.name}`,
        description: error instanceof Error ? error.message : "The purchase was not completed.",
        tone: "error",
      });
    } finally {
      setBuyingKey(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 rounded-[18px] border border-line bg-card px-4 py-3">
        <div>
          <p className="text-[12px] font-extrabold">Your theme wallet</p>
          <p className="mt-0.5 text-[10px] text-dim">
            {count(wallet.earned)} earned · {paidOpenedCount} paid themes opened
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[12px] font-extrabold tabular-nums text-accent">
          <Coins className="size-3.5" aria-hidden />
          {count(wallet.balance)}
        </span>
      </div>

      {THEME_TIERS.map((tier, index) => {
        const designs = shopThemes.filter((theme) => tier.keys.includes(theme.key));
        const isReached = reached(tier, wallet.earned);
        const openedCount = openedIn(tier, opened);
        const remaining = slotsLeft(tier, opened);

        return (
          <section key={tier.at} aria-labelledby={`theme-tier-${tier.at}`}>
            <header className="mb-2.5 flex items-end justify-between gap-3">
              <div>
                <h2 id={`theme-tier-${tier.at}`} className="text-[13px] font-extrabold">
                  {tier.at === 0 ? "Included designs" : `Tier ${index} · ${count(tier.at)} earned`}
                </h2>
                <p className="mt-0.5 text-[10px] text-dim">
                  {tier.at === 0
                    ? "Three designs, always open."
                    : `${openedCount} of ${tier.opens} ${tier.opens === 1 ? "pick" : "picks"} opened`}
                </p>
              </div>
              {tier.at > 0 && !isReached ? (
                <span className="shrink-0 text-[10px] font-bold text-dim">
                  {count(toGo(designs[0] ?? designedThemes[0], wallet.earned))} to go
                </span>
              ) : tier.at > 0 ? (
                <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[9px] font-extrabold text-accent">
                  {remaining} {remaining === 1 ? "pick" : "picks"} left
                </span>
              ) : null}
            </header>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {designs.map((theme) => {
                const openedTheme = isOpen(theme, opened);
                const eligible = canOpen(theme, opened, wallet.earned, wallet.balance);
                const wearing = selectedDesign.key === theme.key;
                const pct = progress(tier, wallet.earned);

                return (
                  <article
                    key={theme.key}
                    className={cn(
                      "overflow-hidden rounded-[17px] border bg-card transition",
                      wearing ? "border-accent ring-2 ring-accent/15" : "border-line",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => showPreview(theme)}
                      className="group block w-full text-left focus-visible:outline-none"
                      aria-label={`Preview ${theme.name} theme`}
                    >
                      <div className="relative aspect-[1.55] overflow-hidden bg-[color-mix(in_srgb,var(--ink)_8%,var(--card))]">
                        <img
                          src={theme.cover}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                        {wearing ? (
                          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-card/90 px-2 py-1 text-[9px] font-extrabold text-accent backdrop-blur">
                            <Check className="size-3" aria-hidden /> Wearing
                          </span>
                        ) : null}
                        {!openedTheme && !eligible ? (
                          <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur">
                            <LockKeyhole className="size-3.5" aria-hidden />
                          </span>
                        ) : null}
                      </div>
                      <div className="p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[11px] font-extrabold">{theme.name}</p>
                          <span className="shrink-0 text-[9px] font-bold text-dim">
                            {theme.price ? `${count(theme.price)} sparks` : "Included"}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 min-h-7 text-[9px] leading-3.5 text-dim">{theme.mood}</p>
                        {tier.at > 0 && !isReached ? (
                          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${pct * 100}%` }} />
                          </div>
                        ) : null}
                      </div>
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      <p className="flex items-start gap-2 rounded-[14px] bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] px-3 py-2.5 text-[10px] leading-4 text-dim">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
        Lifetime sparks reach a tier; your current wallet pays for a pick. Opening a theme does not wear it.
      </p>

      {preview ? (
        <>
          <Modal
            open
            onClose={closePreview}
            title={preview.name}
            description={preview.mood}
            size="md"
            footer={
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={closePreview}>Close preview</Button>
                {isOpen(preview, opened) ? (
                  <Button
                    onClick={() => void wear(preview)}
                    disabled={selectedDesign.key === preview.key}
                    icon={selectedDesign.key === preview.key ? <Check className="size-4" /> : <Palette className="size-4" />}
                  >
                    {selectedDesign.key === preview.key ? "Wearing" : "Wear theme"}
                  </Button>
                ) : (
                  <Button
                    onClick={() => void buy(preview)}
                    disabled={!canOpen(preview, opened, wallet.earned, wallet.balance)}
                    loading={buyingKey === preview.key}
                    icon={<LockKeyhole className="size-4" />}
                  >
                    Open for {count(preview.price)} sparks
                  </Button>
                )}
              </div>
            }
          >
            <div className="space-y-4 p-4 sm:p-5">
              <img
                src={preview.cover}
                alt={`${preview.name} theme artwork`}
                className="max-h-[48dvh] w-full rounded-[16px] object-cover"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-extrabold">{preview.character}</p>
                  <p className="text-[10px] text-dim">{availability(preview, opened, wallet.earned, wallet.balance)}</p>
                </div>
                <div className="flex gap-1.5" aria-label="Theme color preview">
                  {[preview.light.accent, preview.light.page, preview.light.ink].map((color) => (
                    <span
                      key={color}
                      className="size-6 rounded-full border border-line"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                  ))}
                </div>
              </div>
            </div>
          </Modal>
        </>
      ) : null}
    </div>
  );
}

const CHECK_ICON_PATH = "/icons/check.svg";

export function ThemeMarkSVG({ mark, size = 44 }: { mark: ThemeMark; size?: number }) {
  const u = size;
  return (
    <svg
      viewBox={`0 0 ${u} ${u}`}
      width={u}
      height={u}
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flexShrink: 0 }}
    >
      <use href={`${CHECK_ICON_PATH}#mark-${mark}`} />
    </svg>
  );
}


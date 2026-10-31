import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { designedThemes, type ShellPage, type ThemeDesign, type ThemePalette } from "@/theme/catalog";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import type { Me } from "@/types/api";
import { convoColors } from "@/features/convo/skin";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  design: ThemeDesign;
  selectedDesign: ThemeDesign;
  palette: ThemePalette;
  mode: ThemeMode;
  resolvedDark: boolean;
  setDesign: (key: string, options?: { sync?: boolean; silent?: boolean }) => Promise<boolean>;
  previewDesign: (key: string) => void;
  clearPreview: () => void;
  setMode: (mode: ThemeMode) => void;
  artFor: (page: ShellPage | null) => string | null;
  themes: ThemeDesign[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY = "xelvic.theme";
const MODE_KEY = "xelvic.mode";

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function readMode(): ThemeMode {
  try {
    const value = localStorage.getItem(MODE_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    // fall through
  }
  return "system";
}

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A private window can refuse storage.
  }
}

function rgbChannels(hex: string) {
  const value = hex.replace("#", "");
  const six = value.length === 3
    ? value.split("").map((part) => part + part).join("")
    : value.slice(0, 6);
  const number = Number.parseInt(six, 16);
  if (!Number.isFinite(number)) return "19 19 26";
  return `${(number >> 16) & 255} ${(number >> 8) & 255} ${number & 255}`;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { status, user, updateUser } = useAuth();
  const { toast } = useToast();
  const initialKey = readTheme();
  const [designKey, setDesignKey] = useState(
    () => designedThemes.find((theme) => theme.key === initialKey)?.key ?? "pink",
  );
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [mode, setModeState] = useState<ThemeMode>(readMode);
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    const key = (user.theme || "").trim().toLowerCase();
    if (!key) {
      setDesignKey("pink");
      persist(THEME_KEY, "pink");
      return;
    }
    if (designedThemes.some((theme) => theme.key === key)) {
      setDesignKey(key);
      persist(THEME_KEY, key);
    }
  }, [status, user]);

  const selectedDesign = useMemo(
    () => designedThemes.find((theme) => theme.key === designKey) ?? designedThemes[0],
    [designKey],
  );
  const design = useMemo(
    () => designedThemes.find((theme) => theme.key === previewKey) ?? selectedDesign,
    [previewKey, selectedDesign],
  );
  const resolvedDark = mode === "dark" || (mode === "system" && systemDark);
  const palette = resolvedDark ? design.dark : design.light;

  useEffect(() => {
    const root = document.documentElement;
    const glass = Boolean(design.art);
    const nav = glass
      ? { ground: "#FFFFFF", fill: 0.46, ink: "#3A2430", quiet: "#74535F", edge: "#99FFFFFF" }
      : { ground: "#13131A", fill: 0.62, ink: "#FFFFFF", quiet: "#DCDCE4", edge: "#E3E3EC" };
    const pane =
      design.key === "catgirl"
        ? "color-mix(in srgb, #FFFFFF 22%, transparent)"
        : design.key === "unicorn"
          ? "color-mix(in srgb, #FFFFFF 46%, transparent)"
          : palette.card;
    const convo = convoColors(palette.accent, {
      page: palette.page,
      card: palette.card,
      line: palette.line,
      ink: palette.ink,
      dim: palette.dim,
    });
    const vars: Record<string, string> = {
      "--accent": palette.accent,
      "--accent-rgb": rgbChannels(palette.accent),
      "--accent-pill": palette.accentPill,
      "--accent-pill-rgb": rgbChannels(palette.accentPill),
      "--accent-ink": palette.onAccent,
      "--page": palette.page,
      "--page-rgb": rgbChannels(palette.page),
      "--card": palette.card,
      "--card-rgb": rgbChannels(palette.card),
      "--line": palette.line,
      "--line-rgb": rgbChannels(palette.line),
      "--ink": palette.ink,
      "--ink-rgb": rgbChannels(palette.ink),
      "--dim": palette.dim,
      "--dim-rgb": rgbChannels(palette.dim),
      "--on-accent": palette.onAccent,
      "--on-accent-rgb": rgbChannels(palette.onAccent),
      "--accent-soft": `color-mix(in srgb, ${palette.accent} 12%, transparent)`,
      "--accent-chip": `color-mix(in srgb, ${palette.accent} 12%, ${palette.card})`,
      "--accent-strong": `color-mix(in srgb, ${palette.accent} 18%, ${palette.card})`,
      "--surface-2": `color-mix(in srgb, ${palette.ink} 6%, ${palette.card})`,
      "--surface-3": `color-mix(in srgb, ${palette.ink} 3.5%, ${palette.card})`,
      "--pane": pane,
      "--pane-edge": glass ? "#73FFFFFF" : palette.line,
      "--nav": rgbChannels(nav.ground),
      "--nav-fill": String(nav.fill),
      "--nav-ink": nav.ink,
      "--nav-quiet": nav.quiet,
      "--nav-edge": nav.edge,
      // Conversation bubble colors
      "--convo-bubble-wash": convo.convoBubbleWash,
      "--convo-bubble-edge": convo.convoBubbleEdge,
      "--convo-bubble-run": convo.convoBubbleRun,
      "--convo-out-ink": convo.convoOutInk,
      "--convo-out-dim": convo.convoOutDim,
      "--convo-in-wash": convo.convoInWash,
      "--convo-in-edge": convo.convoInEdge,
      "--convo-in-ink": convo.convoInInk,
      "--convo-in-dim": convo.convoInDim,
    };
    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
    root.style.colorScheme = palette.isDark ? "dark" : "light";
    root.dataset.theme = design.key;
    root.dataset.dark = String(palette.isDark);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", palette.page);
  }, [palette, design.art, design.key, resolvedDark]);

  const setDesign = useCallback(
    async (key: string, options: { sync?: boolean; silent?: boolean } = {}) => {
      const next = designedThemes.find((theme) => theme.key === key);
      if (!next) {
        toast({
          title: "This build does not have that theme",
          description: `The server named "${key}", which the web shelf does not carry yet.`,
          tone: "error",
        });
        return false;
      }
      const previous = designKey;
      setDesignKey(next.key);
      persist(THEME_KEY, next.key);
      if (!(options.sync ?? true) || status !== "authenticated") {
        setPreviewKey(null);
        if (!options.silent) toast({ title: `${next.name} is on`, tone: "success" });
        return true;
      }
      try {
        const me = await api.patch<Me>("/auth/me/theme/", { theme: next.key });
        setPreviewKey(null);
        updateUser(me);
        if (!options.silent) toast({ title: `${next.name} is on`, tone: "success" });
        return true;
      } catch (error) {
        setDesignKey(previous);
        persist(THEME_KEY, previous);
        toast({
          title: "That theme was not applied",
          description: error instanceof Error ? error.message : "The server refused it.",
          tone: "error",
        });
        return false;
      }
    },
    [designKey, status, toast, updateUser],
  );

  const previewDesign = useCallback((key: string) => {
    if (designedThemes.some((theme) => theme.key === key)) setPreviewKey(key);
  }, []);

  const clearPreview = useCallback(() => setPreviewKey(null), []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    persist(MODE_KEY, next);
  }, []);

  const artFor = useCallback(
    (page: ShellPage | null) => {
      const art = design.art;
      if (!art) return null;
      if ("page" in art && typeof art.page === "string") return art.page;
      if (!page) return null;
      return (art as Partial<Record<ShellPage, string>>)[page] ?? null;
    },
    [design],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      design,
      selectedDesign,
      palette,
      mode,
      resolvedDark,
      setDesign,
      previewDesign,
      clearPreview,
      setMode,
      artFor,
      themes: designedThemes,
    }),
    [design, selectedDesign, palette, mode, resolvedDark, setDesign, previewDesign, clearPreview, setMode, artFor],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}

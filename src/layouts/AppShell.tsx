import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Bookmark,
  ChevronDown,
  GalleryVerticalEnd,
  Headphones,
  LogOut,
  MessageCircle,
  Plus,
  QrCode,
  Radio,
  Search,
  Settings,
  Sparkles,
  UserRound,
  CirclePlay,
  Wallet,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Backdrop } from "@/components/layout/Backdrop";
import { BrandMark } from "@/components/icons/Brand";
import { PlayerBar } from "@/components/layout/PlayerBar";
import { cn } from "@/utils/cn";
import { useAuth } from "@/hooks/useAuth";
import { useIdlePrefetch, useRoutePrefetch } from "@/hooks/useRoutePrefetch";
import { useTheme } from "@/hooks/useTheme";
import { SHELL_ROUTES } from "@/routes/lazyPages";
import type { ShellPage } from "@/theme/catalog";

/**
 * The shell's own links, with their page's code fetched a beat early.
 *
 * Every tab in the sidebar and the bottom bar goes through here, which is the
 * whole point: a reader who taps Drops should land on Drops, not on a spinner
 * while the Drops chunk downloads. See `useRoutePrefetch`.
 */
function PrefetchNavLink({
  to,
  ...rest
}: Omit<ComponentProps<typeof NavLink>, "to"> & { to: string }) {
  const warm = useRoutePrefetch(to);
  return <NavLink to={to} {...warm} {...rest} />;
}

function PrefetchLink({
  to,
  ...rest
}: Omit<ComponentProps<typeof Link>, "to"> & { to: string }) {
  const warm = useRoutePrefetch(to);
  return <Link to={to} {...warm} {...rest} />;
}

const primary = [
  { to: "/app/drops", label: "Drops", icon: GalleryVerticalEnd, page: "drops" as ShellPage },
  { to: "/app/moments", label: "Moments", icon: CirclePlay, page: "moments" as ShellPage },
  { to: "/app/convo", label: "Convo", icon: MessageCircle, page: "convo" as ShellPage },
  { to: "/app/audio", label: "Audio", icon: Headphones, page: "audio" as ShellPage },
  { to: "/app/live", label: "Live", icon: Radio, page: "live" as ShellPage },
];

const secondary = [
  { to: "/app/search", label: "Search", icon: Search },
  { to: "/app/alerts", label: "Notifications", icon: Bell },
  { to: "/app/saved", label: "Saved", icon: Bookmark },
  // Named for where it goes. The screen behind this row is the app's Wallet —
  // the balance, the two numbers beside it, and the ledger that explains them —
  // so a row called "Sparks" would be promising a different page.
  { to: "/app/sparks", label: "Wallet", icon: Wallet },
];

function pageForPath(pathname: string): ShellPage | null {
  if (pathname === "/app" || pathname.startsWith("/app/drops")) return "drops";
  if (pathname.startsWith("/app/moments")) return "moments";
  if (pathname.startsWith("/app/convo")) return "convo";
  if (pathname.startsWith("/app/audio")) return "audio";
  if (pathname.startsWith("/app/live")) return "live";
  return null;
}

function ProfileMenu({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center gap-2 rounded-[14px] border border-transparent p-1.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]",
          compact && "justify-center",
          open && "bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar user={user} size={34} />
        <span className={cn("min-w-0 flex-1", compact ? "hidden" : "hidden lg:block")}>
          <span className="block truncate text-[12px] font-extrabold">{user.name || user.username}</span>
          <span className="block truncate text-[10px] text-dim">@{user.username}</span>
        </span>
        <ChevronDown className={cn("size-3.5 text-dim", compact ? "hidden" : "hidden lg:block")} aria-hidden />
      </button>
      {open ? (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-56 overflow-hidden rounded-[16px] border border-line bg-card p-1.5 shadow-xl animate-fade-up"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
            onClick={() => {
              setOpen(false);
              navigate(`/app/u/${user.username}`);
            }}
          >
            <UserRound className="size-4 text-dim" /> Your profile
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
            onClick={() => {
              setOpen(false);
              navigate("/app/qr");
            }}
          >
            <QrCode className="size-4 text-dim" /> My QR code
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
            onClick={() => {
              setOpen(false);
              navigate("/app/settings");
            }}
          >
            <Settings className="size-4 text-dim" /> Settings
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold text-[var(--bad)] hover:bg-[color-mix(in_srgb,var(--bad)_8%,transparent)]"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const { backdropFor, design } = useTheme();
  const { user } = useAuth();
  const page = pageForPath(location.pathname);
  const backdrop = backdropFor(page);
  const art = backdrop?.art ?? null;
  const inChat = location.pathname.startsWith("/app/convo");

  // The five tabs behind the bottom bar are the pages a signed-in reader moves
  // between most, so their code is fetched in the first quiet moment after the
  // page they opened has painted. Failure is silent and harmless — see
  // `preloadRoute`.
  useIdlePrefetch(SHELL_ROUTES, !!user);

  return (
    // `isolate` is load-bearing and not decoration: it is what keeps the
    // backdrop's negative stack level inside this element, so the picture lands
    // over this page's own ground and under every card and line the pages draw.
    <div className="relative isolate min-h-dvh bg-page text-ink">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-[12px] bg-card px-4 py-3 font-bold text-ink shadow-lg focus:translate-y-0"
      >
        Skip to main content
      </a>
      <Backdrop backdrop={backdrop} />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-[color-mix(in_srgb,var(--card)_86%,transparent)] py-4 backdrop-blur-xl transition-[width,padding] duration-300 md:flex",
          inChat
            ? "w-[76px] px-3 lg:w-[76px] lg:px-3"
            : "w-[88px] px-3 lg:w-[240px] lg:px-4",
        )}
      >
        <PrefetchLink
          to="/app/drops"
          className={cn("mb-7 flex items-center gap-2.5", inChat ? "justify-center px-0" : "px-1.5")}
          aria-label="Xelvic home"
        >
          <BrandMark size={36} />
          <span className={cn("text-[17px] font-extrabold tracking-[-0.04em]", inChat ? "hidden" : "hidden lg:block")}>Xelvic</span>
        </PrefetchLink>

        <nav className="space-y-1" aria-label="Main">
          {primary.map((item) => (
            <PrefetchNavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[13px] font-bold transition",
                  inChat && "justify-center px-0",
                  isActive
                    ? "bg-[color-mix(in_srgb,var(--accent)_13%,transparent)] text-accent"
                    : "text-dim hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-ink",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("size-[19px] shrink-0", isActive && "stroke-[2.4]")} aria-hidden />
                  <span className={cn(inChat ? "hidden" : "hidden lg:block")}>{item.label}</span>
                </>
              )}
            </PrefetchNavLink>
          ))}
        </nav>

        <div className="my-4 h-px bg-line" />

        <nav className="space-y-1" aria-label="More">
          {secondary.map((item) => (
            <PrefetchNavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-[14px] px-3 py-2 text-[12.5px] font-semibold transition",
                  inChat && "justify-center px-0",
                  isActive
                    ? "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-accent"
                    : "text-dim hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-ink",
                )
              }
            >
              <item.icon className="size-[18px] shrink-0" aria-hidden />
              <span className={cn(inChat ? "hidden" : "hidden lg:block")}>{item.label}</span>
            </PrefetchNavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-2">
          <PrefetchLink
            to="/app/drops?compose=1"
            className="flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-accent px-3 font-bold text-on-accent transition hover:brightness-105 active:scale-[.98]"
            title="Create a drop"
          >
            <Plus className="size-5" aria-hidden />
            <span className={cn("text-[13px]", inChat ? "hidden" : "hidden lg:block")}>New drop</span>
          </PrefetchLink>
          <PrefetchLink
            to="/app/settings?section=marketplace"
            className={cn(
              "flex min-h-10 items-center justify-center gap-2 rounded-[12px] border border-line bg-card px-3 text-dim transition hover:text-ink md:justify-center",
              !inChat && "lg:justify-start",
            )}
            title="Themes and appearance"
          >
            <Sparkles className="size-4" aria-hidden />
            <span className={cn("text-[12px] font-bold", inChat ? "hidden" : "hidden lg:block")}>{design.name}</span>
          </PrefetchLink>
          <ProfileMenu compact={inChat} />
        </div>
      </aside>

      <div
        className={cn(
          "transition-[padding] duration-300",
          inChat ? "md:pl-[76px]" : "md:pl-[88px] lg:pl-[240px]",
        )}
      >
        <header className="flex items-center gap-3 border-b border-line bg-[color-mix(in_srgb,var(--page)_88%,transparent)] px-4 py-3 backdrop-blur-xl md:hidden">
          <PrefetchLink to="/app/drops" className="flex items-center gap-2" aria-label="Xelvic home">
            <BrandMark size={30} />
            <span className="text-[15px] font-extrabold tracking-[-0.04em]">Xelvic</span>
          </PrefetchLink>
          <div className="ml-auto flex items-center gap-0.5">
            <PrefetchLink to="/app/search" className="icon-btn" aria-label="Search">
              <Search className="size-[18px]" />
            </PrefetchLink>
            <PrefetchLink to="/app/alerts" className="icon-btn" aria-label="Notifications">
              <Bell className="size-[18px]" />
            </PrefetchLink>
            <PrefetchLink to="/app/sparks" className="icon-btn" aria-label="Rewards and themes">
              <Sparkles className="size-[18px]" />
            </PrefetchLink>
            {user ? (
              <PrefetchLink to={`/app/u/${user.username}`} aria-label="Your profile" className="ml-1">
                <Avatar user={user} size={32} />
              </PrefetchLink>
            ) : null}
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className={cn("relative min-h-[calc(100dvh-57px)] md:min-h-dvh", !art && "bg-page")}>
          <Outlet />
        </main>
      </div>

      <PlayerBar offset="desktop" compact={inChat} />
      <PlayerBar offset="mobile" />

      {!inChat ? (
        <nav
          className="fixed inset-x-2 bottom-2 z-50 md:hidden"
          aria-label="Main navigation"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
        <div className="glass-nav flex items-center justify-around rounded-[22px] px-1.5 py-1.5">
          {primary.map((item) => (
            <PrefetchNavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[16px] px-1 py-1.5 text-[9.5px] font-bold transition",
                  isActive
                    ? "text-[var(--accent-pill)]"
                    : "text-[var(--nav-quiet)] hover:text-[var(--nav-ink)]",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("size-[20px]", isActive && "stroke-[2.5]")} aria-hidden />
                  <span>{item.label}</span>
                </>
              )}
            </PrefetchNavLink>
          ))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

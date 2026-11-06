import { lazy, type ComponentType } from "react";

/**
 * Every page the shell can open, and the one place that knows how to fetch it.
 *
 * The pages used to be declared inside `App.tsx`, which was fine while the only
 * thing anybody wanted from them was a route element. A second thing is wanted
 * now: the ability to start fetching a page's code *before* the link is
 * followed — on hover, on focus, on a finger touching the tab — so that the
 * click that opens the page is not also the click that begins downloading it.
 *
 * Keeping the loaders in a module of their own means `preloadRoute` and the
 * route table cannot drift apart: both read the same `load` object, so a page
 * added here is preloadable from the moment it exists.
 */

type PageLoader = () => Promise<{ default: ComponentType }>;

const load = {
  drops: () => import("@/pages/DropsPage").then((m) => ({ default: m.DropsPage })),
  drop: () => import("@/pages/DropPage").then((m) => ({ default: m.DropPage })),
  moments: () => import("@/pages/MomentsPage").then((m) => ({ default: m.MomentsPage })),
  chat: () => import("@/pages/ChatPage").then((m) => ({ default: m.ChatPage })),
  convo: () =>
    import("@/features/convo/ConvoLayout").then((m) => ({ default: m.ConvoLayout })),
  audio: () => import("@/pages/AudioPage").then((m) => ({ default: m.AudioPage })),
  audioCategory: () =>
    import("@/pages/AudioCategoryPage").then((m) => ({ default: m.AudioCategoryPage })),
  audioBoard: () =>
    import("@/pages/AudioBoardPage").then((m) => ({ default: m.AudioBoardPage })),
  audioStudio: () =>
    import("@/pages/AudioStudioPage").then((m) => ({ default: m.AudioStudioPage })),
  audioStudioDetail: () =>
    import("@/pages/AudioStudioDetailPage").then((m) => ({
      default: m.AudioStudioDetailPage,
    })),
  playlist: () =>
    import("@/pages/PlaylistPage").then((m) => ({ default: m.PlaylistPage })),
  live: () => import("@/pages/LivePage").then((m) => ({ default: m.LivePage })),
  room: () => import("@/pages/RoomPage").then((m) => ({ default: m.RoomPage })),
  profile: () => import("@/pages/ProfilePage").then((m) => ({ default: m.ProfilePage })),
  crew: () => import("@/pages/CrewPage").then((m) => ({ default: m.CrewPage })),
  insights: () =>
    import("@/features/insights/InsightsPage").then((m) => ({ default: m.InsightsPage })),
  search: () => import("@/pages/SearchPage").then((m) => ({ default: m.SearchPage })),
  alerts: () => import("@/pages/AlertsPage").then((m) => ({ default: m.AlertsPage })),
  activity: () =>
    import("@/pages/ActivityPage").then((m) => ({ default: m.ActivityPage })),
  saved: () => import("@/pages/SavedPage").then((m) => ({ default: m.SavedPage })),
  tag: () => import("@/pages/TagPage").then((m) => ({ default: m.TagPage })),
  vibeStudio: () =>
    import("@/pages/VibeStudioPage").then((m) => ({ default: m.VibeStudioPage })),
  sparks: () => import("@/pages/SparksPage").then((m) => ({ default: m.SparksPage })),
  sparksLeaderboard: () =>
    import("@/pages/SparksLeaderboardPage").then((m) => ({
      default: m.SparksLeaderboardPage,
    })),
  settings: () =>
    import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
  publicPlaylist: () =>
    import("@/pages/PublicPlaylistPage").then((m) => ({
      default: m.PublicPlaylistPage,
    })),
  ownQr: () => import("@/pages/OwnQrPage").then((m) => ({ default: m.OwnQrPage })),
  circle: () => import("@/pages/CirclePage").then((m) => ({ default: m.CirclePage })),
  artist: () => import("@/pages/ArtistPage").then((m) => ({ default: m.ArtistPage })),
  dealsHome: () =>
    import("@/features/deals/DealsHomeView").then((m) => ({
      default: m.DealsHomeView,
    })),
  dealDetail: () =>
    import("@/features/deals/DealDetailView").then((m) => ({
      default: m.DealDetailView,
    })),
  creators: () =>
    import("@/features/deals/CreatorDirectoryView").then((m) => ({
      default: m.CreatorDirectoryView,
    })),
} satisfies Record<string, PageLoader>;

export const DropsPage = lazy(load.drops);
export const DropPage = lazy(load.drop);
export const MomentsPage = lazy(load.moments);
export const ChatPage = lazy(load.chat);
export const ConvoLayout = lazy(load.convo);
export const AudioPage = lazy(load.audio);
export const AudioCategoryPage = lazy(load.audioCategory);
export const AudioBoardPage = lazy(load.audioBoard);
export const AudioStudioPage = lazy(load.audioStudio);
export const AudioStudioDetailPage = lazy(load.audioStudioDetail);
export const PlaylistPage = lazy(load.playlist);
export const LivePage = lazy(load.live);
export const RoomPage = lazy(load.room);
export const ProfilePage = lazy(load.profile);
export const CrewPage = lazy(load.crew);
export const InsightsPage = lazy(load.insights);
export const SearchPage = lazy(load.search);
export const AlertsPage = lazy(load.alerts);
export const ActivityPage = lazy(load.activity);
export const SavedPage = lazy(load.saved);
export const TagPage = lazy(load.tag);
export const VibeStudioPage = lazy(load.vibeStudio);
export const SparksPage = lazy(load.sparks);
export const SparksLeaderboardPage = lazy(load.sparksLeaderboard);
export const SettingsPage = lazy(load.settings);
export const PublicPlaylistPage = lazy(load.publicPlaylist);
export const OwnQrPage = lazy(load.ownQr);
export const CirclePage = lazy(load.circle);
export const ArtistPage = lazy(load.artist);
export const DealsHomeView = lazy(load.dealsHome);
export const DealDetailView = lazy(load.dealDetail);
export const CreatorDirectoryView = lazy(load.creators);

/**
 * The loaders behind the shell's own tabs, in the order a reader meets them.
 *
 * `useIdlePrefetch` walks this list while the browser has nothing else to do,
 * so the five pages behind the tab bar are already in hand by the time a thumb
 * reaches them — without delaying the first page the reader actually asked for.
 */
export const SHELL_ROUTES = [
  "/app/drops",
  "/app/moments",
  "/app/convo",
  "/app/audio",
  "/app/live",
] as const;

/**
 * Which loader a URL would need, worked out from the pathname alone.
 *
 * The routes live in `App.tsx` as a `<Routes>` tree, and this is the same tree
 * written as a lookup. It is deliberately a separate reading rather than a
 * route match: preloading must not need a router, a history or a render — a
 * `NavLink` knows its `to`, and that is all this needs.
 */
function loaderFor(pathname: string): PageLoader | null {
  // A link may carry a query — `/app/drops?compose=1` — and the question it
  // asks the router is still the Drops page. The search string and the hash
  // are not part of the page's identity here.
  const bare = pathname.split(/[?#]/, 1)[0] ?? "";
  const path = bare.replace(/\/+$/, "") || "/";

  if (!path.startsWith("/app/")) {
    // A shared playlist is the one page outside the shell that a link on the
    // web can point at, and it is opened cold — preloading it from a link's
    // hover is the only chance to warm it.
    if (path.startsWith("/s/")) return load.publicPlaylist;
    return null;
  }

  const [head, second, third] = path.slice("/app/".length).split("/");

  switch (head) {
    case "drops":
      if (second === "vibes" && third === "studio") return load.vibeStudio;
      return second ? load.drop : load.drops;
    case "moments":
      return load.moments;
    case "circles":
      return load.circle;
    case "convo":
      // The layout draws the list; a thread id additionally opens a chat. The
      // router asks for the layout first, so both are warmed together — a
      // missing thread should still show the list without a second wait.
      return second
        ? () => Promise.all([load.convo(), load.chat()]).then(() => load.convo())
        : load.convo;
    case "audio":
      if (second === "board") return load.audioBoard;
      if (second === "c") return load.audioCategory;
      if (second === "studio") return third ? load.audioStudioDetail : load.audioStudio;
      if (second === "artist") return load.artist;
      return second ? load.playlist : load.audio;
    case "live":
      return second ? load.room : load.live;
    case "u":
      return third === "crew" ? load.crew : load.profile;
    case "insights":
      return load.insights;
    case "search":
      return load.search;
    case "alerts":
      return load.alerts;
    case "activity":
      return load.activity;
    case "saved":
      return load.saved;
    case "tags":
      return load.tag;
    case "sparks":
      return second === "leaderboard" ? load.sparksLeaderboard : load.sparks;
    case "settings":
      return load.settings;
    case "deals":
      if (second === "new") return load.creators;
      return second ? load.dealDetail : load.dealsHome;
    case "qr":
      return load.ownQr;
    default:
      return null;
  }
}

/** The routes this app can warm before they are asked for. */
export function canPreload(pathname: string): boolean {
  return loaderFor(pathname) !== null;
}

/**
 * Start fetching a page's code, and do nothing else.
 *
 * A prefetch that fails is not an error worth showing: the router asks for the
 * same chunk when the link is actually followed, and that attempt gets to fail
 * in the place where somebody is waiting and can be told. This one is only ever
 * an attempt to save a round trip.
 */
export function preloadRoute(pathname: string): void {
  const loader = loaderFor(pathname);
  if (!loader) return;
  void loader().catch(() => {
    // Deliberately silent — see above.
  });
}
import { lazy, Suspense, type ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { NotFoundPage, ProtectedRoute, PublicOnly } from "@/app/ProtectedRoute";
import { Spinner } from "@/components/Button";
import { SignInPage } from "@/pages/SignInPage";

const DropsPage = lazy(() =>
  import("@/pages/DropsPage").then((module) => ({ default: module.DropsPage })),
);
const DropPage = lazy(() =>
  import("@/pages/DropPage").then((module) => ({ default: module.DropPage })),
);
const MomentsPage = lazy(() =>
  import("@/pages/MomentsPage").then((module) => ({
    default: module.MomentsPage,
  })),
);
const ChatPage = lazy(() =>
  import("@/pages/ChatPage").then((module) => ({ default: module.ChatPage })),
);
const ConvoLayout = lazy(() =>
  import("@/features/convo/ConvoLayout").then((module) => ({
    default: module.ConvoLayout,
  })),
);
const AudioPage = lazy(() =>
  import("@/pages/AudioPage").then((module) => ({ default: module.AudioPage })),
);
const PlaylistPage = lazy(() =>
  import("@/pages/PlaylistPage").then((module) => ({
    default: module.PlaylistPage,
  })),
);
const LivePage = lazy(() =>
  import("@/pages/LivePage").then((module) => ({ default: module.LivePage })),
);
const RoomPage = lazy(() =>
  import("@/pages/RoomPage").then((module) => ({ default: module.RoomPage })),
);
const ProfilePage = lazy(() =>
  import("@/pages/ProfilePage").then((module) => ({
    default: module.ProfilePage,
  })),
);
const CrewPage = lazy(() =>
  import("@/pages/CrewPage").then((module) => ({ default: module.CrewPage })),
);
const InsightsPage = lazy(() =>
  import("@/features/insights/InsightsPage").then((module) => ({
    default: module.InsightsPage,
  })),
);
const SearchPage = lazy(() =>
  import("@/pages/SearchPage").then((module) => ({
    default: module.SearchPage,
  })),
);
const AlertsPage = lazy(() =>
  import("@/pages/AlertsPage").then((module) => ({
    default: module.AlertsPage,
  })),
);
const ActivityPage = lazy(() =>
  import("@/pages/ActivityPage").then((module) => ({
    default: module.ActivityPage,
  })),
);
const SavedPage = lazy(() =>
  import("@/pages/SavedPage").then((module) => ({ default: module.SavedPage })),
);
const TagPage = lazy(() =>
  import("@/pages/TagPage").then((module) => ({ default: module.TagPage })),
);
const VibeStudioPage = lazy(() =>
  import("@/pages/VibeStudioPage").then((module) => ({
    default: module.VibeStudioPage,
  })),
);
const SparksPage = lazy(() =>
  import("@/pages/SparksPage").then((module) => ({
    default: module.SparksPage,
  })),
);
const SparksLeaderboardPage = lazy(() =>
  import("@/pages/SparksLeaderboardPage").then((module) => ({
    default: module.SparksLeaderboardPage,
  })),
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);
const PublicPlaylistPage = lazy(() =>
  import("@/pages/PublicPlaylistPage").then((module) => ({
    default: module.PublicPlaylistPage,
  })),
);
const OwnQrPage = lazy(() =>
  import("@/pages/OwnQrPage").then((module) => ({ default: module.OwnQrPage })),
);
const ArtistPage = lazy(() =>
  import("@/pages/ArtistPage").then((module) => ({
    default: module.ArtistPage,
  })),
);
const DealsHomeView = lazy(() =>
  import("@/features/deals/DealsHomeView").then((module) => ({
    default: module.DealsHomeView,
  })),
);
const DealDetailView = lazy(() =>
  import("@/features/deals/DealDetailView").then((module) => ({
    default: module.DealDetailView,
  })),
);
const CreatorDirectoryView = lazy(() =>
  import("@/features/deals/CreatorDirectoryView").then((module) => ({
    default: module.CreatorDirectoryView,
  })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="size-6 text-[var(--accent)]" />
    </div>
  );
}

function LazyPage({ page: Page }: { page: ComponentType }) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Page />
    </Suspense>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicOnly>
            <SignInPage />
          </PublicOnly>
        }
      />
      <Route
        path="/signin"
        element={
          <PublicOnly>
            <SignInPage />
          </PublicOnly>
        }
      />
      <Route path="/s/:token" element={<LazyPage page={PublicPlaylistPage} />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/drops" replace />} />
        <Route path="drops" element={<LazyPage page={DropsPage} />} />
        <Route path="drops/:dropId" element={<LazyPage page={DropPage} />} />
        {/* The back of the house for my own Vibes, and one clip's whole read.
            Both are mine only — the server answers an empty list or a 404 to
            anybody else — and both are reached from a Vibe's own top bar. */}
        <Route path="drops/vibes/studio" element={<LazyPage page={VibeStudioPage} />} />
        <Route
          path="drops/vibes/studio/:vibeId"
          element={<LazyPage page={VibeStudioPage} />}
        />
        <Route path="moments" element={<LazyPage page={MomentsPage} />} />
        <Route path="convo" element={<LazyPage page={ConvoLayout} />}>
          <Route path=":threadId" element={<LazyPage page={ChatPage} />} />
        </Route>
        <Route path="audio" element={<LazyPage page={AudioPage} />} />
        <Route
          path="audio/:playlistId"
          element={<LazyPage page={PlaylistPage} />}
        />
        <Route path="live" element={<LazyPage page={LivePage} />} />
        <Route path="live/:roomId" element={<LazyPage page={RoomPage} />} />
        <Route path="u/:username" element={<LazyPage page={ProfilePage} />} />
        {/* The two lists behind the counts on a profile, and the one place a
            Crew can be edited. The app reaches them by tapping the numbers, so
            the same two names are what the route carries. */}
        <Route path="u/:username/crew/:kind" element={<LazyPage page={CrewPage} />} />
        {/* Reachable only from your own profile, and only yours: the server
            refuses it to anybody else with a named code. */}
        <Route path="insights" element={<LazyPage page={InsightsPage} />} />
        <Route path="search" element={<LazyPage page={SearchPage} />} />
        <Route path="alerts" element={<LazyPage page={AlertsPage} />} />
        <Route path="activity" element={<LazyPage page={ActivityPage} />} />
        <Route path="saved" element={<LazyPage page={SavedPage} />} />
        {/* A `#word` in a caption opens here — the shelf the whole app shares.
            The word is a path segment with its glyph left off, which is what
            `TagFeedScreen` takes and what every link the feed draws emits. */}
        <Route path="tags/:tag" element={<LazyPage page={TagPage} />} />
        <Route path="sparks" element={<LazyPage page={SparksPage} />} />
        <Route
          path="sparks/leaderboard"
          element={<LazyPage page={SparksLeaderboardPage} />}
        />
        <Route path="settings" element={<LazyPage page={SettingsPage} />} />
        {/* `new` before `:dealId` because both are one segment deep: the static
            one has to be the door the directory is reached by. React Router
            ranks a static segment above a dynamic one either way, but the two
            routes read in the order they are used. */}
        <Route path="deals" element={<LazyPage page={DealsHomeView} />} />
        <Route path="deals/new" element={<LazyPage page={CreatorDirectoryView} />} />
        <Route path="deals/:dealId" element={<LazyPage page={DealDetailView} />} />
        <Route path="qr" element={<LazyPage page={OwnQrPage} />} />
        <Route
          path="audio/artist/:artistSlug"
          element={<LazyPage page={ArtistPage} />}
        />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

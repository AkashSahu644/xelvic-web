import { Suspense, type ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import {
  AlertsPage,
  ActivityPage,
  ArtistPage,
  AudioBoardPage,
  AudioCategoryPage,
  AudioPage,
  AudioStudioDetailPage,
  AudioStudioPage,
  ChatPage,
  CirclePage,
  ConvoLayout,
  CreatorDirectoryView,
  CrewPage,
  DealDetailView,
  DealsHomeView,
  DropPage,
  DropsPage,
  InsightsPage,
  LivePage,
  MomentsPage,
  OwnQrPage,
  PlaylistPage,
  ProfilePage,
  PublicPlaylistPage,
  RoomPage,
  SavedPage,
  SearchPage,
  SettingsPage,
  SparksLeaderboardPage,
  SparksPage,
  TagPage,
  VibeStudioPage,
} from "@/routes/lazyPages";
import { NotFoundPage, ProtectedRoute, PublicOnly } from "@/routes/ProtectedRoute";
import { Spinner } from "@/components/ui/Button";
import { SignInPage } from "@/pages/SignInPage";

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
        <Route path="circles/:circleId" element={<LazyPage page={CirclePage} />} />
        <Route path="convo" element={<LazyPage page={ConvoLayout} />}>
          <Route path=":threadId" element={<LazyPage page={ChatPage} />} />
        </Route>
        <Route path="audio" element={<LazyPage page={AudioPage} />} />
        {/* The weekly board, reached by "See all" on the trending strip. It is a
            different question from a category shelf, which is why it is not a
            chip and why it has a door of its own. */}
        <Route path="audio/board" element={<LazyPage page={AudioBoardPage} />} />
        {/* One shelf of the reco engine, opened from a chip. The chip sends its
            card and its filter options in the route's state, so the page draws
            its heading before anything has answered; a direct visit asks the
            catalogue for the same card. */}
        <Route path="audio/c/:key" element={<LazyPage page={AudioCategoryPage} />} />
        {/* One's own numbers. The list and each row are two doors, and the row
            is opened by the id the list carried — a bare id is enough because
            the studio detail route accepts one. */}
        <Route path="audio/studio" element={<LazyPage page={AudioStudioPage} />} />
        <Route
          path="audio/studio/:itemId"
          element={<LazyPage page={AudioStudioDetailPage} />}
        />
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

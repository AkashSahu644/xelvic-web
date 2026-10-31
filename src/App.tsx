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
const SparksPage = lazy(() =>
  import("@/pages/SparksPage").then((module) => ({
    default: module.SparksPage,
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
        <Route path="search" element={<LazyPage page={SearchPage} />} />
        <Route path="alerts" element={<LazyPage page={AlertsPage} />} />
        <Route path="activity" element={<LazyPage page={ActivityPage} />} />
        <Route path="saved" element={<LazyPage page={SavedPage} />} />
        <Route path="sparks" element={<LazyPage page={SparksPage} />} />
        <Route path="settings" element={<LazyPage page={SettingsPage} />} />
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

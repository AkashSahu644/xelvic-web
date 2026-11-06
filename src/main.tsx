import "@fontsource-variable/manrope";
import "@/styles/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "@/routes/App";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { AuthProvider } from "@/providers/AuthProvider";
import { CallProvider } from "@/providers/CallProvider";
import { NoticeProvider } from "@/features/notices/NoticeProvider";
import { PlayerProvider } from "@/providers/PlayerProvider";
import { PreferencesProvider } from "@/providers/PreferencesProvider";
import { SocketProvider } from "@/providers/SocketProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { ApiError } from "@/utils/errors";
import { persistQueryCache, restoreQueryCache } from "@/store/queryCache";

/**
 * The cache everyone shares.
 *
 * `staleTime` is the promise that a page re-opened within the minute draws
 * what it already had instead of asking again — the data is still served, and
 * a background refetch corrects it if something changed. `gcTime` is how long
 * that copy survives after the last screen using it unmounts: the React Query
 * default of five minutes meant that walking Drops → Audio → Drops a few
 * minutes later started the feed from a spinner, when the feed that had just
 * been read was still perfectly good to draw. Thirty minutes keeps a session's
 * worth of pages in hand without keeping anything a reload would not clear.
 *
 * `refetchOnWindowFocus` stays off for the same reason it was off before: a
 * tab switch is not a page change, and refetching every mounted query on one
 * made coming back to Xelvic feel like opening it.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => {
        if (error instanceof ApiError) {
          if (error.status >= 400 && error.status < 500) return false;
        }
        return count < 2;
      },
    },
  },
});

/**
 * The answers from the last visit are put back before the tree mounts.
 *
 * Hydrating here rather than in an effect is the whole point: the first render
 * of the first page can already draw the feed, the tray and the unread count,
 * and the network's refetch lands behind a page that is readable instead of in
 * front of a screen full of skeletons. See `store/queryCache.ts` for what is
 * kept, for how long, and why it is deleted on sign-out.
 */
restoreQueryCache(queryClient);
persistQueryCache(queryClient);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastProvider>
            <AuthProvider>
              <PreferencesProvider>
                <ThemeProvider>
                  <SocketProvider>
                    <NoticeProvider>
                      <CallProvider>
                        <PlayerProvider>
                          <App />
                        </PlayerProvider>
                      </CallProvider>
                    </NoticeProvider>
                  </SocketProvider>
                </ThemeProvider>
              </PreferencesProvider>
            </AuthProvider>
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);

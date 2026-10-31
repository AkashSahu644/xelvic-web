import { useEffect, useState } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { MessageCircleMore, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { ConvoPage, NewConvoPanel } from "@/pages/ConvoPage";

function EmptyChatPane() {
  return (
    <div className="relative flex h-full min-h-[520px] flex-col items-center justify-center overflow-hidden bg-[color-mix(in_srgb,var(--page)_94%,var(--card))] px-6 text-center sm:px-10">
      <div
        className="pointer-events-none absolute -right-24 -top-28 size-96 rounded-full bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 -left-24 h-64 w-[560px] rounded-[50%] opacity-50 blur-2xl"
        style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
        aria-hidden
      />

      <div className="relative flex w-full max-w-[520px] flex-col items-center">
        <div className="relative h-[190px] w-[230px]">
          <span className="absolute left-1 top-[92px] size-3 rounded-full bg-[color-mix(in_srgb,var(--accent)_35%,var(--card))]" aria-hidden />
          <span className="absolute left-[48px] top-1 size-2.5 rounded-full bg-[color-mix(in_srgb,var(--accent)_18%,var(--card))]" aria-hidden />
          <span className="absolute right-[42px] top-3 size-3 rounded-full bg-[color-mix(in_srgb,var(--accent)_24%,var(--card))]" aria-hidden />
          <span className="absolute right-1 top-[118px] size-3 rounded-full bg-[color-mix(in_srgb,var(--accent)_48%,var(--card))]" aria-hidden />
          <span className="absolute right-0 bottom-5 text-[23px] text-accent/70" aria-hidden>✦</span>
          <span className="absolute left-0 top-0 text-[22px] text-accent/70" aria-hidden>✦</span>

          <div className="absolute left-7 top-6 flex size-[146px] items-center justify-center rounded-[48%] bg-[color-mix(in_srgb,var(--accent-soft)_72%,var(--card))] text-accent shadow-[0_14px_35px_color-mix(in_srgb,var(--accent)_12%,transparent)]">
            <MessageCircleMore className="size-[128px]" strokeWidth={1.4} aria-hidden />
          </div>
          <div className="absolute bottom-0 right-1 flex size-[98px] items-center justify-center rounded-[45%] bg-[color-mix(in_srgb,var(--accent)_18%,var(--card))] text-accent shadow-[0_12px_28px_color-mix(in_srgb,var(--accent)_18%,transparent)]">
            <MessageCircleMore className="size-[84px] -scale-x-100" strokeWidth={1.5} aria-hidden />
          </div>
        </div>
        <h2 className="mt-7 text-[24px] font-extrabold tracking-[-0.035em] sm:text-[27px]">
          Pick a convo
        </h2>
        <p className="mx-auto mt-4 max-w-[390px] text-[14px] leading-7 text-dim sm:text-[15px]">
          Choose someone from your list, or start a fresh conversation. Your messages stay between you and them.
        </p>
        <Link to="/app/search" className="btn btn-primary mt-8 h-12 gap-2 rounded-full px-7 shadow-[0_8px_20px_color-mix(in_srgb,var(--accent)_22%,transparent)]">
          <Search className="size-4" aria-hidden />
          Find people
        </Link>
        <p className="mt-4 text-[10.5px] font-semibold text-dim">
          Select a conversation from the left to open it here.
        </p>
      </div>
    </div>
  );
}

export function ConvoLayout() {
  const { threadId } = useParams();
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMounted, setComposeMounted] = useState(false);
  const [composeVisible, setComposeVisible] = useState(false);
  const chatOpen = Boolean(threadId);

  useEffect(() => {
    if (threadId) setComposeOpen(false);
  }, [threadId]);

  useEffect(() => {
    if (composeOpen) {
      setComposeMounted(true);
      setComposeVisible(true);
      return;
    }
    setComposeVisible(false);
    const timer = window.setTimeout(() => setComposeMounted(false), 320);
    return () => window.clearTimeout(timer);
  }, [composeOpen]);

  return (
    <div className="relative flex h-[calc(100dvh-57px)] w-full overflow-hidden md:h-dvh">
      <aside
        className={cn(
          "min-h-0 w-full shrink-0 flex-col border-line bg-[var(--pane)] md:flex md:w-[320px] md:border-r lg:w-[360px] xl:w-[390px]",
          chatOpen ? "hidden" : "flex",
        )}
        aria-label="Convos"
      >
        <ConvoPage
          embedded
          activeThreadId={threadId}
          composeOpen={composeOpen}
          onToggleCompose={() => setComposeOpen((open) => !open)}
        />
      </aside>
      <aside
        className={cn(
          "absolute inset-0 z-20 flex w-full flex-col overflow-hidden border-line bg-card transition-all duration-300 ease-out motion-reduce:transition-none lg:relative lg:inset-auto lg:z-auto lg:shrink-0 lg:border-r",
          composeVisible
            ? "translate-x-0 opacity-100 lg:w-[350px]"
            : "-translate-x-full opacity-0 lg:w-0 lg:translate-x-0",
          !composeVisible && "pointer-events-none",
        )}
        aria-hidden={!composeVisible}
        aria-label="New convo"
      >
        {composeMounted ? (
          <div className="h-full w-full shrink-0 lg:w-[350px]">
            <NewConvoPanel onClose={() => setComposeOpen(false)} />
          </div>
        ) : null}
      </aside>
      <section
        className={cn(
          "relative min-h-0 min-w-0 flex-1 flex-col bg-[color-mix(in_srgb,var(--page)_82%,transparent)]",
          chatOpen ? "flex" : "hidden md:flex",
        )}
      >
        {chatOpen ? <Outlet /> : <EmptyChatPane />}
      </section>
    </div>
  );
}

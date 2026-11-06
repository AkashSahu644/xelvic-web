import type { ReactNode } from "react";

/**
 * The app's `Blank`: a mark at 18% ink, a 17pt title, a dim line under it.
 *
 * Line-for-line from `Blank` in `app/lib/screens/widgets.dart`, which draws it
 * on six screens — an empty shelf, a crew with nobody in it, a search that found
 * nothing, a shelf the server refused. The web has `EmptyState` for the same job
 * elsewhere, but that one is the *web's* shape — a tinted rounded tile over an
 * extrabold heading — and the screens ported from the phone were drawn the other
 * way. The app's version wins on those so that they read as one family.
 *
 * It lives in `components/` rather than beside whichever screen needed it first,
 * because the app keeps it in its shared widgets file for the same reason: the
 * second reader is never the last one.
 */
export function Blank({
  icon,
  title,
  line,
  action,
  top = "pt-[70px]",
}: {
  icon: ReactNode;
  title: string;
  line?: string;
  action?: ReactNode;
  /**
   * The gap the app leaves above it.
   *
   * 70px when it sits at the top of a `ListView`, 80px for the error case, and
   * nothing at all when the caller centres it itself — which is what the shelf
   * does, its blank being the whole of the body rather than the head of a list.
   */
  top?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-8 pb-8 text-center ${top}`}>
      <span className="text-[color-mix(in_srgb,var(--ink)_18%,transparent)]">{icon}</span>
      <h2 className="mt-3.5 text-[17px] font-bold">{title}</h2>
      {line ? <p className="mt-1.5 max-w-sm text-[14px] leading-[1.4] text-dim">{line}</p> : null}
      {action}
    </div>
  );
}

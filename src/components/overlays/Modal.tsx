import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";
import { lockScroll } from "@/utils/scrollLock";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
  hideClose?: boolean;
}

const sizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-none h-[100dvh] rounded-none",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
  hideClose,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeFromEffect = useEffectEvent(onClose);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    // Counted, because a modal can be open over a viewer that is holding the
    // page still itself — see `utils/scrollLock.ts`.
    const releaseScroll = lockScroll();
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    window.setTimeout(() => focusable?.focus(), 20);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFromEffect();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const nodes = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => node.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      releaseScroll();
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-[rgb(8_8_12_/_0.58)] backdrop-blur-[3px]"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line bg-card shadow-2xl animate-fade-up",
          "rounded-t-[24px] sm:rounded-[20px]",
          sizes[size],
          size === "full" && "sm:rounded-none",
          className,
        )}
      >
        {title ? (
          <header className="flex items-start gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-lg font-extrabold tracking-tight">
                {title}
              </h2>
              {description ? <p className="mt-0.5 text-xs leading-5 text-dim">{description}</p> : null}
            </div>
            {hideClose ? null : (
              <button type="button" onClick={onClose} className="icon-btn -mr-2 -mt-1" aria-label="Close">
                <X className="size-4" />
              </button>
            )}
          </header>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto scroll-area">{children}</div>
        {footer ? <footer className="border-t border-line px-5 py-3">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

/**
 * A yes/no question with the app's own three parts.
 *
 * `body` is what is about to happen and `note` is the sentence underneath it
 * that says the part people skip — *"This cannot be undone."*, *"After 30 days
 * it is gone for good and cannot be recovered."* The app's `confirm()` has
 * carried both since the dialogs were written, and a confirmation that dropped
 * the second half would be asking a question with the answer left out.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  note,
  confirmLabel = "Confirm",
  destructive,
  loading,
  icon,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: string;
  note?: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  /**
   * The app's dialogs all open with a mark — `confirm(icon: ...)` — and the one
   * place it carries meaning rather than decoration is a destructive one, where
   * `Icons.lock_reset` or `Icons.delete_outline` says in a glance what the
   * sentence underneath is about to say in words.
   */
  icon?: ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      {icon || body || note ? (
        <div className="px-5 py-4">
          {icon ? (
            <span
              className={cn(
                "mb-3 flex size-10 items-center justify-center rounded-full",
                destructive
                  ? "bg-[color-mix(in_srgb,var(--bad)_12%,transparent)] text-[var(--bad)]"
                  : "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent",
              )}
              aria-hidden
            >
              {icon}
            </span>
          ) : null}
          {body ? <p className="text-sm leading-6 text-dim">{body}</p> : null}
          {note ? (
            <p className="mt-2 text-[12px] leading-5 text-[color-mix(in_srgb,var(--ink)_55%,transparent)]">
              {note}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex justify-end gap-2 px-5 pb-5 pt-2">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={cn("btn", destructive ? "btn-danger" : "btn-primary")}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? "Working..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

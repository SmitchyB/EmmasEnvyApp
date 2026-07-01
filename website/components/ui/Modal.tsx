"use client";

import { ReactNode, useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal backdrop"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        className={`relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-white/20 bg-pink-darkest/95 shadow-modal backdrop-blur-md ${wide ? "max-w-3xl" : "max-w-lg"}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 pb-4 pt-5">
          {title ? (
            <h2 id="modal-title" className="pr-2 text-lg font-semibold leading-snug text-white">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-xl leading-none text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex shrink-0 flex-wrap gap-3 border-t border-white/10 px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

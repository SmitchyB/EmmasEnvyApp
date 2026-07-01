import { ReactNode } from "react";

export function Card({
  children,
  className = "",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/20 bg-white/10 p-5 shadow-card backdrop-blur-sm ${
        interactive
          ? "transition hover:-translate-y-0.5 hover:border-white/30 hover:shadow-lg hover:shadow-black/25"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

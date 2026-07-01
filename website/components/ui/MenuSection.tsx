import Link from "next/link";
import { ReactNode } from "react";

export function MenuSection({
  title,
  children,
  variant = "default",
}: {
  title: string;
  children: ReactNode;
  variant?: "default" | "staff";
}) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-widest text-white/50">{title}</p>
      <div
        className={`overflow-hidden rounded-2xl border shadow-card backdrop-blur-sm ${
          variant === "staff"
            ? "border-white/20 bg-white/[0.07]"
            : "border-white/15 bg-white/5"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function MenuRow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 text-white transition last:border-b-0 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30"
    >
      <span className="font-medium">{children}</span>
      <span className="text-lg text-white/40" aria-hidden>
        ›
      </span>
    </Link>
  );
}

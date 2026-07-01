import Link from "next/link";
import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-light/50 disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "btn-shimmer border border-pink/40 bg-gradient-to-br from-pink-dark via-pink-dark to-pink-darkest text-pink-light shadow-lg shadow-pink-darkest/45 hover:border-pink-light/50 hover:from-pink hover:via-pink-dark hover:to-pink-darkest hover:text-white",
  secondary:
    "btn-shimmer border border-pink-light/25 bg-pink-darkest/60 text-pink-light hover:border-pink-light/40 hover:bg-pink-dark/70 shadow-md shadow-black/20",
  ghost: "bg-transparent text-pink-light hover:bg-white/10 hover:text-white",
  danger: "bg-red-700/90 text-white hover:bg-red-600 shadow-md shadow-black/20 border border-red-400/30",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
  href?: string;
  shimmer?: boolean;
  className?: string;
};

export function Button({
  children,
  variant = "primary",
  className = "",
  disabled,
  href,
  shimmer = true,
  ...props
}: ButtonProps) {
  const shimmerOff = variant === "primary" && !shimmer ? "!overflow-visible before:!hidden after:!hidden" : "";
  const noShimmer = !shimmer && variant !== "primary" ? "before:!hidden after:!hidden" : "";
  const classes = `${base} ${variants[variant]} ${shimmerOff} ${noShimmer} ${className}`;

  if (href && !disabled) {
    return (
      <Link href={href} className={classes}>
        <span>{children}</span>
      </Link>
    );
  }

  return (
    <button type="button" disabled={disabled} className={classes} {...props}>
      <span>{children}</span>
    </button>
  );
}

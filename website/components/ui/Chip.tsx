import { ButtonHTMLAttributes } from "react";

export function Chip({
  selected = false,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      className={`rounded-full border px-4 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
        selected
          ? "border-pink-light bg-gradient-to-br from-pink-dark to-pink-darkest text-pink-light shadow-md shadow-pink-darkest/30"
          : "border-white/25 bg-white/5 text-white/85 hover:border-white/40 hover:bg-white/10"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

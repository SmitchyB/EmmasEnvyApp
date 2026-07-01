import { InputHTMLAttributes } from "react";

const fieldClass =
  "w-full rounded-xl border border-white/25 bg-white/10 px-3 py-3 text-white placeholder:text-white/50 outline-none transition focus:border-white/50 focus:ring-2 focus:ring-white/30";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldClass} ${className}`} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldClass} min-h-[100px] ${className}`} {...props} />;
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm text-white/85">
      {children}
    </label>
  );
}

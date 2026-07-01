import { ReactNode } from "react";

export function GradientShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`gradient-bg min-h-screen flex flex-col ${className}`}>{children}</div>
  );
}

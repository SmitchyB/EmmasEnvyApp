import { ReactNode } from "react";

type Width = "sm" | "md" | "lg" | "xl" | "full";

const widths: Record<Width, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  full: "max-w-5xl",
};

export function PageContainer({
  children,
  width = "full",
  className = "",
}: {
  children: ReactNode;
  width?: Width;
  className?: string;
}) {
  return <div className={`mx-auto w-full ${widths[width]} ${className}`}>{children}</div>;
}

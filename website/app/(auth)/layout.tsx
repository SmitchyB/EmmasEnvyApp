import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = { robots: { index: false } };

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-md px-4 py-10">{children}</div>;
}

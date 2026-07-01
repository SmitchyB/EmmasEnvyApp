import type { Metadata } from "next";
import { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { StaffGuard } from "@/components/layout/StaffGuard";

export const metadata: Metadata = { robots: { index: false } };

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <StaffGuard>{children}</StaffGuard>
      </main>
    </>
  );
}

import { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav, DesktopNav } from "@/components/layout/BottomNav";
import { Footer } from "@/components/layout/Footer";

export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <DesktopNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-8 md:pb-10">{children}</main>
      <Footer />
      <BottomNav />
    </>
  );
}

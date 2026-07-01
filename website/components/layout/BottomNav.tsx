"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { uploadsUrl } from "@emmasenvy/shared";
import Image from "next/image";
import { Button } from "@/components/ui/Button";

const tabs = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  { href: "/portfolio", label: "Portfolio", match: (p: string) => p.startsWith("/portfolio") },
  {
    href: "/appointments",
    label: "Appointments",
    match: (p: string) => p.startsWith("/appointments") || p.startsWith("/staff/appointments"),
  },
  { href: "/account", label: "Account", match: (p: string) => p.startsWith("/account") || p.startsWith("/settings") },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const avatarUrl = user?.profile_picture ? uploadsUrl(user.profile_picture) : null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/20 bg-pink-darkest/90 shadow-nav backdrop-blur-md md:hidden">
      <ul className="mx-auto flex max-w-lg">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const isAccount = tab.href === "/account";
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`relative flex flex-col items-center gap-1 px-2 py-3 text-xs transition ${
                  active ? "text-white" : "text-white/60"
                }`}
              >
                {active ? (
                  <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-white" />
                ) : null}
                {isAccount && avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt=""
                    width={22}
                    height={22}
                    className="h-[22px] w-[22px] rounded-full object-cover ring-1 ring-white/30"
                  />
                ) : (
                  <span className="text-base leading-none">{isAccount ? "👤" : tab.label[0]}</span>
                )}
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden border-b border-white/10 md:block">
      <ul className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2.5">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`rounded-xl px-4 py-2.5 text-sm transition ${
                  active
                    ? "bg-white/15 text-white shadow-sm shadow-black/10"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
        <li className="ml-auto">
          <Button href="/book" className="!py-2.5 !text-sm">
            Book now
          </Button>
        </li>
      </ul>
    </nav>
  );
}

import Link from "next/link";
import { POLICY_PAGES } from "@/lib/policies";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/15 px-4 py-6 text-sm text-white/70">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p suppressHydrationWarning>© {new Date().getFullYear()} Emmas Envy. All rights reserved.</p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          {POLICY_PAGES.map((p) => (
            <Link key={p.slug} href={`/policies/${p.slug}`} className="hover:text-white">
              {p.title}
            </Link>
          ))}
          <Link href="/support" className="hover:text-white">
            Support
          </Link>
        </nav>
      </div>
    </footer>
  );
}

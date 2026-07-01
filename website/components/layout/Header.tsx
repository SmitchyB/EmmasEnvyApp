"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export function Header() {
  const [logoError, setLogoError] = useState(false);

  return (
    <header className="border-b border-white/15 px-4 py-3 shadow-nav">
      <div className="mx-auto flex max-w-5xl items-center justify-center">
        <Link href="/" className="flex items-center justify-center">
          {!logoError ? (
            <Image
              src="/logo.png"
              alt="Emmas Envy"
              width={180}
              height={56}
              style={{ width: "auto", height: "56px" }}
              className="object-contain"
              onError={() => setLogoError(true)}
              priority
            />
          ) : (
            <span className="text-xl font-bold text-white">Emmas Envy</span>
          )}
        </Link>
      </div>
    </header>
  );
}

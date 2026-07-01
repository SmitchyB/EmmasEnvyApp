import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { GradientShell } from "@/components/ui/GradientShell";
import { absoluteUrl, defaultDescription, siteName } from "@/lib/seo";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: siteName, template: `%s | ${siteName}` },
  description: defaultDescription,
  openGraph: {
    type: "website",
    siteName,
    title: siteName,
    description: defaultDescription,
  },
  twitter: { card: "summary_large_image", title: siteName, description: defaultDescription },
  alternates: { canonical: absoluteUrl("/") },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="min-h-full antialiased">
        <Providers>
          <GradientShell>{children}</GradientShell>
        </Providers>
      </body>
    </html>
  );
}

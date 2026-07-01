export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const siteName = "Emmas Envy";
export const defaultDescription =
  "Premium nail services at Emmas Envy. Browse our portfolio, book appointments, and join our rewards program.";

export function absoluteUrl(path: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

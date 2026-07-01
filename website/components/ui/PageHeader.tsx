import Link from "next/link";
import { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  action,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8">
      {backHref ? (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center text-sm font-medium text-white/75 transition hover:text-white"
        >
          ← {backLabel}
        </Link>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
          {subtitle ? <p className="mt-1 text-base text-white/70">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

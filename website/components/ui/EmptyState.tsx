import { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function EmptyState({
  icon = "✨",
  title,
  message,
  actionLabel,
  actionHref,
  onAction,
}: {
  icon?: ReactNode;
  title?: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <Card className="py-10 text-center">
      {icon ? <div className="mb-3 text-3xl">{icon}</div> : null}
      {title ? <p className="mb-2 text-lg font-semibold text-white">{title}</p> : null}
      <p className="text-white/75">{message}</p>
      {actionLabel && actionHref ? (
        <Button href={actionHref} className="mt-5">
          {actionLabel}
        </Button>
      ) : null}
      {actionLabel && onAction ? (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </Card>
  );
}

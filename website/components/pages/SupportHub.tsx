"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isStaffRole, listMyTickets, type SupportTicket, type SupportTicketStatus } from "@emmasenvy/shared";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

const STATUS_FILTERS: { id: "all" | SupportTicketStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "pending_customer", label: "Awaiting you" },
  { id: "pending_staff", label: "Awaiting staff" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
];

export function SupportHub() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | SupportTicketStatus>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return tickets;
    return tickets.filter((t) => t.status === statusFilter);
  }, [tickets, statusFilter]);

  const load = useCallback(async () => {
    if (!user || !token) return;
    setLoading(true);
    try {
      setTickets(await listMyTickets(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user, token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (authLoading) return <LoadingSpinner />;

  if (!user) {
    return (
      <EmptyState
        message="Sign in to view support tickets or open a new request."
        actionLabel="Sign in"
        actionHref="/account"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Support" subtitle="Your support tickets" />
      {isStaffRole(user.role) ? (
        <Button href="/staff/support" variant="secondary">
          Staff queue
        </Button>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Chip key={f.id} selected={statusFilter === f.id} onClick={() => setStatusFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>
      <Button href="/support/create">New ticket</Button>
      {error ? (
        <div className="rounded-xl border border-red-400/30 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-4">
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              className="block w-full text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              onClick={() => router.push(`/support/ticket/${t.id}`)}
            >
              <Card interactive>
                <p className="font-semibold">{t.subject}</p>
                <p className="mt-1 text-sm text-white/70">
                  {t.status} · #{t.id}
                </p>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

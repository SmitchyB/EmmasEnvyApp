"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  closeTicketAsCustomer,
  createTicket,
  fetchIssueTypes,
  getTicket,
  postTicketMessage,
  type IssueTypeOption,
} from "@emmasenvy/shared";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PageHeader } from "@/components/ui/PageHeader";

export function CreateTicketForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { token } = useAuth();
  const [issueTypes, setIssueTypes] = useState<IssueTypeOption[]>([]);
  const [issueType, setIssueType] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIssueTypes().then(setIssueTypes).catch(() => setIssueTypes([]));
    const linked = params.get("linkedAppointmentId");
    const prefill = params.get("prefillIssueType");
    if (prefill) setIssueType(prefill);
    if (linked) setSubject(`Appointment #${linked}`);
  }, [params]);

  if (!token) {
    return (
      <EmptyState
        message="Sign in to create a support ticket."
        actionLabel="Sign in"
        actionHref="/account"
      />
    );
  }

  return (
    <div>
      <PageHeader title="New support ticket" subtitle="Tell us how we can help" backHref="/support" />
      <Card className="space-y-4">
        {error ? <p className="text-red-200">{error}</p> : null}
        <div>
          <Label>Issue type</Label>
          <select value={issueType} onChange={(e) => setIssueType(e.target.value)} className="w-full rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-white">
            <option value="" className="text-gray-900">Select…</option>
            {issueTypes.map((t) => (
              <option key={t.id} value={t.id} className="text-gray-900">{t.label}</option>
            ))}
          </select>
        </div>
        <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <div><Label>Message</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <Button onClick={async () => {
          try {
            const linked = params.get("linkedAppointmentId");
            const t = await createTicket(token, {
              issue_type: issueType,
              subject,
              body,
              linked_appointment_id: linked ? parseInt(linked, 10) : undefined,
            });
            router.push(`/support/ticket/${t.id}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to create ticket");
          }
        }}>Submit</Button>
      </Card>
    </div>
  );
}

export function TicketThread({ ticketId }: { ticketId: number }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<Awaited<ReturnType<typeof getTicket>> | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      setTicket(await getTicket(token, ticketId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token, ticketId]);

  if (!token) {
    return (
      <EmptyState message="Sign in to view this ticket." actionLabel="Sign in" actionHref="/account" />
    );
  }
  if (loading) return <LoadingSpinner />;
  if (!ticket) return <p className="text-red-200">{error}</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={ticket.ticket.subject || `Ticket #${ticket.ticket.id}`}
        subtitle={`Status: ${ticket.ticket.status}`}
        backHref="/support"
        backLabel="Support"
      />
      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <Card key={m.id}>
            <p className="text-xs text-white/50">{m.author_kind} · {m.created_at}</p>
            <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
          </Card>
        ))}
      </div>
      <Card className="space-y-4">
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Reply…" />
        <div className="flex flex-wrap gap-3">
          <Button onClick={async () => {
            await postTicketMessage(token, ticketId, message);
            setMessage("");
            await load();
          }}>Send</Button>
          <Button variant="secondary" onClick={async () => {
            await closeTicketAsCustomer(token, ticketId);
            await load();
          }}>Close ticket</Button>
        </div>
      </Card>
    </div>
  );
}

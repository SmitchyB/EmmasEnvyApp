"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  fetchIssueTypes,
  guestClaimTicket,
  guestCloseTicket,
  guestCreateTicket,
  guestGetThread,
  guestPostMessage,
  listStaffTickets,
  type IssueTypeOption,
} from "@emmasenvy/shared";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { getGuestTicketToken, setGuestTicketToken } from "@/lib/storage";

export function GuestNewTicketForm() {
  const router = useRouter();
  const [issueTypes, setIssueTypes] = useState<IssueTypeOption[]>([]);
  const [issueType, setIssueType] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIssueTypes().then(setIssueTypes).catch(() => setIssueTypes([]));
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Guest support</h1>
      <Card className="space-y-3">
        {error ? <p className="text-red-200">{error}</p> : null}
        <div><Label>Email</Label><Input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} /></div>
        <div><Label>Phone</Label><Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} /></div>
        <div>
          <Label>Issue type</Label>
          <select value={issueType} onChange={(e) => setIssueType(e.target.value)} className="w-full rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-white">
            {issueTypes.map((t) => <option key={t.id} value={t.id} className="text-gray-900">{t.label}</option>)}
          </select>
        </div>
        <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <div><Label>Message</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <Button onClick={async () => {
          try {
            const { ticket } = await guestCreateTicket({ issue_type: issueType, subject, body, guest_email: guestEmail, guest_phone: guestPhone });
            router.push(`/support/guest-claim?ref=${encodeURIComponent(ticket.public_reference)}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
          }
        }}>Submit</Button>
        <Link href="/support" className="block text-center text-sm text-white/70">Back</Link>
      </Card>
    </div>
  );
}

export function GuestClaimForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [reference, setReference] = useState(params.get("ref") || "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Claim ticket</h1>
      <Card className="space-y-3">
        {error ? <p className="text-red-200">{error}</p> : null}
        <div><Label>Ticket reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
        <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <Button onClick={async () => {
          try {
            const r = await guestClaimTicket({ public_reference: reference.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined });
            setGuestTicketToken(r.guest_ticket_token);
            router.push("/support/guest-chat");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Claim failed");
          }
        }}>Claim</Button>
      </Card>
    </div>
  );
}

export function GuestChatView() {
  const [message, setMessage] = useState("");
  const [thread, setThread] = useState<Awaited<ReturnType<typeof guestGetThread>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const token = getGuestTicketToken();
    if (!token) { setError("No guest session. Start or claim a ticket."); return; }
    try {
      setThread(await guestGetThread(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (error)
    return (
      <Card className="text-center">
        <p>{error}</p>
        <Button href="/support" className="mt-4">
          Support home
        </Button>
      </Card>
    );
  if (!thread) return <p className="text-white/70">Loading…</p>;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Guest chat · #{thread.ticket.id}</h1>
      <div className="mb-4 space-y-2">
        {thread.messages.map((m) => (
          <Card key={m.id}><p className="text-xs text-white/50">{m.author_kind}</p><p>{m.body}</p></Card>
        ))}
      </div>
      <Card className="space-y-3">
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} />
        <div className="flex gap-2">
          <Button onClick={async () => {
            const token = getGuestTicketToken();
            if (!token) return;
            await guestPostMessage(token, message);
            setMessage("");
            await load();
          }}>Send</Button>
          <Button variant="secondary" onClick={async () => {
            const token = getGuestTicketToken();
            if (!token) return;
            await guestCloseTicket(token);
            await load();
          }}>Close</Button>
        </div>
      </Card>
    </div>
  );
}

export function StaffSupportQueue() {
  const { token } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Awaited<ReturnType<typeof listStaffTickets>>>([]);

  useEffect(() => {
    if (!token) return;
    listStaffTickets(token).then(setTickets).catch(() => setTickets([]));
  }, [token]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Staff support queue</h1>
      <div className="space-y-2">
        {tickets.map((t) => (
          <button key={t.id} type="button" className="block w-full text-left" onClick={() => router.push(`/support/ticket/${t.id}`)}>
            <Card><p className="font-semibold">{t.subject}</p><p className="text-sm text-white/70">{t.status}</p></Card>
          </button>
        ))}
      </div>
    </div>
  );
}

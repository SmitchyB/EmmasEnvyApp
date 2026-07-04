"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { listStaffTickets } from "@emmasenvy/shared";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/Card";

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

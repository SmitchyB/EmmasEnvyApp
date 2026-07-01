"use client";

import { useEffect, useState } from "react";
import {
  createNewsletterApi,
  createPromoCodeApi,
  deleteNewsletterApi,
  deletePromoCodeApi,
  listNewslettersApi,
  listPromoCodes,
  patchNewsletterApi,
  patchPromoCodeApi,
  sendNewsletterApi,
  type NewsletterDto,
  type PromoCodeDto,
} from "@emmasenvy/shared";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export function NewslettersPromosView() {
  const { token } = useAuth();
  const [promos, setPromos] = useState<PromoCodeDto[]>([]);
  const [newsletters, setNewsletters] = useState<NewsletterDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState("");
  const [nlSubject, setNlSubject] = useState("");
  const [nlBody, setNlBody] = useState("");

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [p, n] = await Promise.all([listPromoCodes(token), listNewslettersApi(token)]);
      setPromos(p);
      setNewsletters(n);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Newsletters & promos</h1>
      <Card className="mb-6 space-y-3">
        <h2 className="font-semibold">New promo code</h2>
        <div><Label>Code</Label><Input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} /></div>
        <div><Label>Discount amount</Label><Input value={promoDiscount} onChange={(e) => setPromoDiscount(e.target.value)} /></div>
        <Button onClick={async () => {
          if (!token) return;
          await createPromoCodeApi(token, {
            code: promoCode.trim(),
            discount_type: "fixed",
            discount_value: parseFloat(promoDiscount) || 0,
            is_active: true,
          });
          setPromoCode("");
          setPromoDiscount("");
          await load();
        }}>Create promo</Button>
      </Card>
      <div className="mb-6 space-y-2">
        {promos.map((p) => (
          <Card key={p.id}>
            <p className="font-semibold">{p.code}</p>
            <p className="text-sm text-white/70">${p.discount_value} off · {p.is_active ? "Active" : "Inactive"}</p>
            <Button variant="danger" className="mt-2 text-xs" onClick={async () => {
              if (!token) return;
              await deletePromoCodeApi(token, p.id);
              await load();
            }}>Delete</Button>
          </Card>
        ))}
      </div>
      <Card className="mb-6 space-y-3">
        <h2 className="font-semibold">New newsletter</h2>
        <div><Label>Subject</Label><Input value={nlSubject} onChange={(e) => setNlSubject(e.target.value)} /></div>
        <div><Label>Body</Label><Textarea value={nlBody} onChange={(e) => setNlBody(e.target.value)} /></div>
        <Button onClick={async () => {
          if (!token) return;
          await createNewsletterApi(token, { subject: nlSubject, content: nlBody });
          setNlSubject("");
          setNlBody("");
          await load();
        }}>Save draft</Button>
      </Card>
      <div className="space-y-2">
        {newsletters.map((n) => (
          <Card key={n.id}>
            <p className="font-semibold">{n.subject}</p>
            <p className="text-sm text-white/70">{n.sent_at ? "Sent" : "Draft"}</p>
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" className="text-xs" onClick={async () => {
                if (!token) return;
                await sendNewsletterApi(token, n.id);
                await load();
              }}>Send</Button>
              <Button variant="danger" className="text-xs" onClick={async () => {
                if (!token) return;
                await deleteNewsletterApi(token, n.id);
                await load();
              }}>Delete</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

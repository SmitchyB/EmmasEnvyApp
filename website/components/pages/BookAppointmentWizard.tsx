"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  createAppointment,
  durationToMinutes,
  fetchAppointmentAvailability,
  getPrimaryPortfolio,
  isStaffRole,
  uploadsUrl,
  type ServiceType,
} from "@emmasenvy/shared";
import { useAuth } from "@/contexts/AuthContext";
import { useBookingData } from "@/contexts/BookingDataContext";
import { PortfolioPickerModal } from "@/components/booking/PortfolioPickerModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { pickFiles } from "@/lib/uploads";

const STEPS = ["Service", "Date", "Time", "Contact", "Notes", "Inspiration"] as const;

function formatDateLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function upcomingDateStrings(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }
  return out;
}

export function BookAppointmentWizard({
  initialServices,
}: {
  initialServices: ServiceType[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token } = useAuth();
  const { refreshAppointments } = useBookingData();
  const isStaff = isStaffRole(user?.role);

  const [serviceTypes] = useState(initialServices);
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [inspoUris, setInspoUris] = useState<string[]>([]);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedService = useMemo(
    () => serviceTypes.find((s) => s.id === serviceId) ?? null,
    [serviceTypes, serviceId]
  );
  const dates = useMemo(() => upcomingDateStrings(45), []);

  useEffect(() => {
    if (!user) return;
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
    if (name) setClientName(name);
    if (user.email) setClientEmail(user.email);
    if (user.phone) setClientPhone(user.phone);
  }, [user]);

  useEffect(() => {
    const raw = searchParams.get("portfolioPhotoIds");
    if (!raw) return;
    (async () => {
      try {
        const primary = await getPrimaryPortfolio();
        const ids = new Set(
          raw
            .split(",")
            .map((x) => parseInt(x.trim(), 10))
            .filter((n) => !Number.isNaN(n))
        );
        const paths =
          primary?.portfolio?.photos
            ?.filter((p) => ids.has(p.id))
            .map((p) => p.url)
            .filter(Boolean) as string[];
        if (paths?.length) setInspoUris((prev) => [...new Set([...prev, ...paths])]);
      } catch {
        // ignore
      }
    })();
  }, [searchParams]);

  useEffect(() => {
    if (!date || !serviceId) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setSlotsLoading(true);
      try {
        const s = await fetchAppointmentAvailability({ date, serviceTypeId: serviceId }, token);
        if (!cancelled) setSlots(s);
      } catch {
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, serviceId, token]);

  const goNext = () => {
    setError(null);
    if (step === 0 && !serviceId) {
      setError("Choose a service");
      return;
    }
    if (step === 1 && !date) {
      setError("Choose a date");
      return;
    }
    if (step === 2 && !time) {
      setError("Choose a time");
      return;
    }
    if (step === 3) {
      if (!clientName.trim()) {
        setError("Enter client name");
        return;
      }
      if (!clientEmail.trim() && !clientPhone.trim()) {
        setError("Enter email or phone");
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const pickDeviceImages = async () => {
    const files = await pickFiles("image/*", true);
    setInspoUris((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const submit = async () => {
    if (!selectedService || !date || !time) return;
    const employeeId = selectedService.employee_id;
    if (employeeId == null) {
      setError("This service has no assigned stylist yet.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createAppointment(
        {
          client_id: user?.id ?? null,
          client_name: clientName.trim(),
          client_email: clientEmail.trim() || null,
          client_phone: clientPhone.trim() || null,
          employee_id: employeeId,
          date,
          time,
          description: notes.trim() || selectedService.title,
          inspo_pics: inspoUris.length ? inspoUris : null,
          service_type_id: selectedService.id,
        },
        token
      );
      await refreshAppointments();
      router.push(isStaff ? "/staff/appointments" : "/appointments");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not book. Try another time.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer width="md" className="pb-24 md:pb-8">
      <PageHeader title="Book appointment" subtitle="Schedule your visit in a few steps" backHref="/" />

      <StepIndicator steps={STEPS} currentStep={step} />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="min-h-[280px] space-y-4">
        {step === 0 && serviceTypes.length === 0 ? (
          <p className="text-white/70">No bookable services are available yet.</p>
        ) : null}
        {step === 0 &&
          serviceTypes.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setServiceId(s.id)}
              className={`block w-full text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                serviceId === s.id ? "ring-2 ring-white ring-offset-2 ring-offset-pink-darkest" : ""
              }`}
            >
              <Card interactive>
                <p className="font-bold">{s.title}</p>
                {s.description ? <p className="mt-1 text-sm text-white/75">{s.description}</p> : null}
                <p className="mt-2 text-sm text-white/60">
                  {durationToMinutes(s.duration_needed)} min · ${s.price ?? 0}
                </p>
              </Card>
            </button>
          ))}

        {step === 1 && (
          <div className="flex flex-wrap gap-2">
            {dates.map((d) => (
              <Chip
                key={d}
                selected={date === d}
                onClick={() => {
                  setDate(d);
                  setTime(null);
                }}
              >
                {formatDateLabel(d)}
              </Chip>
            ))}
          </div>
        )}

        {step === 2 && slotsLoading ? <p className="text-white/70">Loading times…</p> : null}
        {step === 2 && !slotsLoading && (
          <div className="flex flex-wrap gap-2">
            {slots.length === 0 ? (
              <p className="text-white/70">No openings this day. Pick another date.</p>
            ) : (
              slots.map((t) => (
                <Chip key={t} selected={time === t} onClick={() => setTime(t)}>
                  {t}
                </Chip>
              ))
            )}
          </div>
        )}

        {step === 3 && (
          <Card className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="Email"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="Phone"
              />
            </div>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <Label>Notes for your stylist (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Style goals, allergies, etc."
            />
          </Card>
        )}

        {step === 5 && (
          <Card className="space-y-4">
            <p className="text-sm text-white/75">
              Choose reference looks from the portfolio or upload images from your device.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => setPortfolioOpen(true)}>
                Choose from portfolio
              </Button>
              {isStaff ? (
                <Button variant="secondary" onClick={() => void pickDeviceImages()}>
                  Upload from device
                </Button>
              ) : null}
            </div>
            <p className="text-sm text-white/60">Selected: {inspoUris.length} image(s)</p>
            {inspoUris.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {inspoUris.map((uri, i) => {
                  const src = uri.startsWith("blob:") ? uri : uploadsUrl(uri) ?? uri;
                  return src ? (
                    <div key={i} className="relative aspect-square overflow-hidden rounded-lg shadow-sm">
                      <Image src={src} alt="" fill className="object-cover" unoptimized={uri.startsWith("blob:")} />
                    </div>
                  ) : null;
                })}
              </div>
            ) : null}
          </Card>
        )}
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-white/10 bg-pink-darkest/90 p-4 shadow-nav backdrop-blur-md md:static md:mt-8 md:border-t-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
        <div className="mx-auto flex max-w-xl gap-3">
          {step > 0 ? (
            <Button variant="secondary" className="flex-1" onClick={() => setStep((s) => s - 1)}>
              Previous
            </Button>
          ) : (
            <div className="hidden flex-1 md:block" />
          )}
          {step < STEPS.length - 1 ? (
            <Button className="flex-1" onClick={goNext}>
              Next
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => void submit()} disabled={submitting}>
              {submitting ? "Booking…" : "Book appointment"}
            </Button>
          )}
        </div>
      </div>

      <PortfolioPickerModal
        open={portfolioOpen}
        onClose={() => setPortfolioOpen(false)}
        initialSelected={inspoUris.filter((u) => !u.startsWith("blob:"))}
        onConfirm={(paths) => setInspoUris((prev) => [...new Set([...prev, ...paths])])}
      />
    </PageContainer>
  );
}

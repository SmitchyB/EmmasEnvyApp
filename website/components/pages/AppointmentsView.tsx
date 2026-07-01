"use client";

import { ReactNode, useEffect, useState } from "react";
import {
  cancelAppointmentApi,
  fetchAppointmentAvailability,
  fetchPublicServiceTypes,
  isStaffRole,
  STATUS_CANCELED,
  updateAppointment,
  uploadsUrl,
  type Appointment,
  type ServiceType,
} from "@emmasenvy/shared";
import { useAuth } from "@/contexts/AuthContext";
import { useBookingData } from "@/contexts/BookingDataContext";
import { PortfolioPickerModal } from "@/components/booking/PortfolioPickerModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  formatAppointmentDate,
  formatAppointmentTimeLabel,
  formatWorkflowTimestamp,
  appointmentCostDisplay,
  formatAppointmentDuration,
  normalizeAppointmentYmd,
  upcomingDateStrings,
} from "@/lib/appointment-utils";
import { uploadAppointmentFinishedPhotoWeb } from "@/lib/upload-helpers";
import { pickFiles } from "@/lib/uploads";
import Image from "next/image";

function isCanceled(a: Appointment) {
  return a.status === STATUS_CANCELED;
}
function isServiceComplete(a: Appointment) {
  if (a.completed_at) return true;
  const s = String(a.status ?? "").trim().toLowerCase();
  return s === "complete" || s === "completed";
}
function isPaidAppointment(a: Appointment) {
  return !!(a.paid_at || a.invoice_payment_status === "Paid" || a.status === "Paid");
}

function sortAppointments(list: Appointment[]) {
  return [...list].sort((a, b) => {
    const da = normalizeAppointmentYmd(a.date).localeCompare(normalizeAppointmentYmd(b.date));
    if (da !== 0) return da;
    return a.time.localeCompare(b.time);
  });
}

function statusBadgeClass(status: string) {
  const s = status.toLowerCase();
  if (s.includes("cancel")) return "bg-red-500/20 text-red-100 border-red-400/30";
  if (s.includes("confirm") || s.includes("paid")) return "bg-emerald-500/20 text-emerald-100 border-emerald-400/30";
  if (s.includes("progress") || s.includes("check")) return "bg-sky-500/20 text-sky-100 border-sky-400/30";
  if (s.includes("complete")) return "bg-violet-500/20 text-violet-100 border-violet-400/30";
  return "bg-white/10 text-white/80 border-white/20";
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-white/10 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs uppercase tracking-wide text-white/50">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}

export function AppointmentsView({ staffMode = false }: { staffMode?: boolean }) {
  const { user, token } = useAuth();
  const { appointments, refreshAppointments, loading } = useBookingData();
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [resDate, setResDate] = useState<string | null>(null);
  const [resTime, setResTime] = useState<string | null>(null);
  const [resSlots, setResSlots] = useState<string[]>([]);
  const [resSlotsLoading, setResSlotsLoading] = useState(false);
  const [inspoOpen, setInspoOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStaff = staffMode || isStaffRole(user?.role);
  const list = sortAppointments(appointments);
  const nextDates = upcomingDateStrings(45);

  useEffect(() => {
    fetchPublicServiceTypes().then(setServiceTypes).catch(() => setServiceTypes([]));
  }, []);

  useEffect(() => {
    refreshAppointments();
  }, [refreshAppointments]);

  useEffect(() => {
    if (!resDate || !detail?.service_type_id || !token) {
      setResSlots([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setResSlotsLoading(true);
      try {
        const s = await fetchAppointmentAvailability(
          { date: resDate, serviceTypeId: detail.service_type_id!, ignoreAppointmentId: detail.id },
          token
        );
        if (!cancelled) setResSlots(s);
      } catch {
        if (!cancelled) setResSlots([]);
      } finally {
        if (!cancelled) setResSlotsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resDate, detail?.id, detail?.service_type_id, token]);

  if (!user || !token) {
    return (
      <EmptyState
        icon="📅"
        title="Your appointments"
        message="Sign in to view and manage your appointments."
        actionLabel="Sign in"
        actionHref="/account"
      />
    );
  }

  if (loading && list.length === 0) return <LoadingSpinner />;

  const serviceTitle = (a: Appointment) =>
    a.service_type_title?.trim() ||
    serviceTypes.find((s) => s.id === a.service_type_id)?.title ||
    "Service";

  const servicePrice = (a: Appointment) =>
    serviceTypes.find((s) => s.id === a.service_type_id)?.price ?? null;

  const detailCost = detail ? appointmentCostDisplay(detail, servicePrice(detail)) : null;
  const detailDuration = detail ? formatAppointmentDuration(detail.duration) : null;

  const updateStatus = async (status: string) => {
    if (!detail || !token) return;
    try {
      const u = await updateAppointment(token, detail.id, { status });
      await refreshAppointments();
      setDetail(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const uploadAfterPhoto = async () => {
    if (!detail || !token) return;
    const files = await pickFiles("image/*", false);
    if (!files[0]) return;
    try {
      const { appointment } = await uploadAppointmentFinishedPhotoWeb(token, detail.id, files[0]);
      await refreshAppointments();
      setDetail(appointment);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  };

  return (
    <div>
      <PageHeader
        title={isStaff ? "Staff Appointments" : "Appointments"}
        subtitle={isStaff ? "Manage client bookings" : "View and manage your bookings"}
      />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {list.length === 0 ? (
        <EmptyState
          icon="📅"
          message="No appointments yet."
          actionLabel="Book now"
          actionHref="/book"
        />
      ) : (
        <div className="space-y-4">
          {list.map((a) => {
            const costDisplay = appointmentCostDisplay(a, servicePrice(a));
            const payLabel = a.invoice_payment_status ?? "—";
            return (
            <button
              key={a.id}
              type="button"
              className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-2xl"
              onClick={() => setDetail(a)}
            >
              <Card interactive>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white">{formatAppointmentDate(a.date)}</p>
                    <p className="mt-1 text-sm text-white/75">
                      {formatAppointmentTimeLabel(a.time)}
                      {" · "}
                      {isStaff ? a.client_name : serviceTitle(a)}
                      {" · "}
                      {a.status}
                    </p>
                    {isStaff ? (
                      <p className="mt-1 text-sm text-pink-light/90">
                        Payment: {payLabel}
                        {costDisplay ? ` · ${costDisplay.line}` : ""}
                      </p>
                    ) : costDisplay ? (
                      <p className="mt-1 text-sm font-medium text-pink-light">{costDisplay.line}</p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(a.status ?? "Pending")}`}
                  >
                    {a.status}
                  </span>
                </div>
              </Card>
            </button>
            );
          })}
        </div>
      )}

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? formatAppointmentDate(detail.date) : "Appointment details"}
        wide
        footer={
          detail ? (
            <>
              {!isStaff && !isCanceled(detail) ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setResDate(normalizeAppointmentYmd(detail.date));
                      setResTime(detail.time);
                      setRescheduleOpen(true);
                    }}
                  >
                    Reschedule
                  </Button>
                  <Button variant="secondary" onClick={() => setInspoOpen(true)}>
                    Edit inspiration
                  </Button>
                  <Button variant="ghost" href={`/support/create?linkedAppointmentId=${detail.id}`}>
                    Get support
                  </Button>
                  <Button
                    variant="danger"
                    onClick={async () => {
                      if (!token) return;
                      await cancelAppointmentApi(token, detail.id);
                      await refreshAppointments();
                      setDetail(null);
                    }}
                  >
                    Cancel
                  </Button>
                </>
              ) : null}
              {isStaff && !isCanceled(detail) ? (
                <>
                  {detail.status === "Pending" ? (
                    <Button onClick={() => void updateStatus("Confirmed")}>Confirm</Button>
                  ) : null}
                  {detail.status === "Confirmed" ? (
                    <Button onClick={() => void updateStatus("Checked In")}>Check in</Button>
                  ) : null}
                  {detail.status === "Checked In" ? (
                    <Button onClick={() => void updateStatus("In Progress")}>Start service</Button>
                  ) : null}
                  {detail.status === "In Progress" ? (
                    <Button onClick={() => void updateStatus("Complete")}>Mark complete</Button>
                  ) : null}
                  {!isServiceComplete(detail) ? (
                    <Button variant="secondary" onClick={() => void uploadAfterPhoto()}>
                      Add after photo
                    </Button>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null
        }
      >
        {detail ? (
          <div>
            <DetailRow
              label="When"
              value={`${formatAppointmentTimeLabel(detail.time)} · Colorado Springs, CO`}
            />
            <DetailRow label="Service" value={serviceTitle(detail)} />
            <DetailRow label="Status" value={detail.status} />
            {detailCost ? (
              <>
                <DetailRow label="Cost" value={detailCost.line} />
                {detailCost.hint ? (
                  <p className="pb-3 text-sm text-white/60">{detailCost.hint}</p>
                ) : null}
              </>
            ) : null}
            {detail.invoice_payment_status ? (
              <DetailRow label="Payment" value={detail.invoice_payment_status} />
            ) : null}
            {detailDuration ? <DetailRow label="Duration" value={detailDuration} /> : null}
            {detail.description?.trim() ? (
              <DetailRow label="Notes" value={detail.description.trim()} />
            ) : null}
            {detail.client_name && isStaff ? (
              <DetailRow label="Client" value={detail.client_name} />
            ) : null}
            {isStaff ? (
              <>
                <DetailRow label="Booked" value={formatWorkflowTimestamp(detail.created_at)} />
                <DetailRow label="Confirmed" value={formatWorkflowTimestamp(detail.confirmed_at)} />
                <DetailRow label="Checked in" value={formatWorkflowTimestamp(detail.checked_in_at)} />
                <DetailRow label="In progress" value={formatWorkflowTimestamp(detail.in_progress_at)} />
                <DetailRow label="Completed" value={formatWorkflowTimestamp(detail.completed_at)} />
                <DetailRow label="Paid" value={formatWorkflowTimestamp(detail.paid_at)} />
                {detail.rescheduled_at ? (
                  <DetailRow label="Rescheduled" value={formatWorkflowTimestamp(detail.rescheduled_at)} />
                ) : null}
              </>
            ) : null}
            {isStaff && isServiceComplete(detail) && !isPaidAppointment(detail) ? (
              <p className="mt-3 text-sm text-white/70">
                Payment is collected in salon (POS checkout is available in the mobile app only).
              </p>
            ) : null}
            {detail.inspo_pics?.length ? (
              <div className="mt-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-white/50">
                  {isStaff ? "Client inspiration" : "Your inspiration"}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {detail.inspo_pics.map((pic, i) => {
                    const url = uploadsUrl(pic);
                    return url ? (
                      <Image
                        key={i}
                        src={url}
                        alt=""
                        width={80}
                        height={80}
                        className="aspect-square rounded-lg object-cover shadow-sm"
                      />
                    ) : null;
                  })}
                </div>
              </div>
            ) : null}
            {isStaff && detail.completed_photos?.length ? (
              <div className="mt-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-white/50">After photos</p>
                <div className="grid grid-cols-3 gap-2">
                  {detail.completed_photos.map((pic, i) => {
                    const url = uploadsUrl(pic);
                    return url ? (
                      <Image
                        key={i}
                        src={url}
                        alt=""
                        width={80}
                        height={80}
                        className="aspect-square rounded-lg object-cover shadow-sm"
                      />
                    ) : null;
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal open={rescheduleOpen} onClose={() => setRescheduleOpen(false)} title="Reschedule">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-white/50">Choose a date</p>
            <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto p-1">
              {nextDates.map((d) => (
                <Chip key={d} selected={resDate === d} onClick={() => { setResDate(d); setResTime(null); }}>
                  {d}
                </Chip>
              ))}
            </div>
          </div>
          {resSlotsLoading ? <p className="text-white/70">Loading slots…</p> : null}
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-white/50">Choose a time</p>
            <div className="flex flex-wrap gap-2">
              {resSlots.map((t) => (
                <Chip key={t} selected={resTime === t} onClick={() => setResTime(t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 border-t border-white/10 pt-4">
          <Button
            className="w-full"
            onClick={async () => {
              if (!detail || !token || !resDate || !resTime) return;
              const u = await updateAppointment(token, detail.id, { date: resDate, time: resTime });
              await refreshAppointments();
              setDetail(u);
              setRescheduleOpen(false);
            }}
          >
            Save new time
          </Button>
        </div>
      </Modal>

      <PortfolioPickerModal
        open={inspoOpen}
        onClose={() => setInspoOpen(false)}
        onConfirm={async (paths) => {
          if (!detail || !token) return;
          const u = await updateAppointment(token, detail.id, {
            inspo_pics: [...(detail.inspo_pics ?? []), ...paths],
          });
          await refreshAppointments();
          setDetail(u);
        }}
      />
    </div>
  );
}

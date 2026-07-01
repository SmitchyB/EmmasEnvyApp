"use client";

import { useEffect, useState } from "react";
import { getPrimaryPortfolio, uploadsUrl, type PortfolioPhoto } from "@emmasenvy/shared";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Modal } from "@/components/ui/Modal";
import Image from "next/image";

export function PortfolioPickerModal({
  open,
  onClose,
  initialSelected = [],
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  initialSelected?: string[];
  onConfirm: (paths: string[]) => void;
}) {
  const [photos, setPhotos] = useState<PortfolioPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(initialSelected));
    setLoading(true);
    getPrimaryPortfolio()
      .then((r) => setPhotos(r?.portfolio?.photos ?? []))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false));
  }, [open, initialSelected]);

  const toggle = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choose from portfolio"
      wide
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onConfirm(Array.from(selected));
              onClose();
            }}
          >
            Add selected ({selected.size})
          </Button>
        </>
      }
    >
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid max-h-[50vh] grid-cols-3 gap-3 overflow-y-auto p-1">
          {photos.map((p) => {
            const url = p.url;
            const img = uploadsUrl(url);
            if (!img || !url) return null;
            const on = selected.has(url);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(url)}
                className={`relative aspect-square overflow-hidden rounded-xl border-2 shadow-sm transition hover:scale-[1.02] ${
                  on ? "border-white ring-2 ring-white/30" : "border-transparent"
                }`}
              >
                <Image src={img} alt="" fill className="object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

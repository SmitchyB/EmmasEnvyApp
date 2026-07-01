"use client";

import { useEffect, useState } from "react";
import {
  createServiceTypeApi,
  deleteServiceTypeApi,
  listMyServiceTypes,
  updateServiceTypeApi,
  type ServiceType,
} from "@emmasenvy/shared";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Modal } from "@/components/ui/Modal";

export function MyServicesView() {
  const { token } = useAuth();
  const [services, setServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceType | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("60");
  const [price, setPrice] = useState("");

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      setServices(await listMyServiceTypes(token));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setDescription("");
    setDuration("60");
    setPrice("");
    setModalOpen(true);
  };

  const openEdit = (s: ServiceType) => {
    setEditing(s);
    setTitle(s.title);
    setDescription(s.description || "");
    setDuration(String(s.duration_needed || "60"));
    setPrice(String(s.price ?? ""));
    setModalOpen(true);
  };

  const save = async () => {
    if (!token) return;
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      duration_needed: duration,
      price: price ? parseFloat(price) : 0,
      tags: null,
    };
    if (editing) await updateServiceTypeApi(token, editing.id, body);
    else await createServiceTypeApi(token, body);
    setModalOpen(false);
    await load();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">My services</h1>
      <Button className="mb-4" onClick={openNew}>Add service</Button>
      <div className="space-y-3">
        {services.map((s) => (
          <Card key={s.id}>
            <p className="font-semibold">{s.title}</p>
            <p className="text-sm text-white/75">{s.description}</p>
            <p className="text-sm text-white/60">{s.duration_needed} · ${s.price}</p>
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" className="text-xs" onClick={() => openEdit(s)}>Edit</Button>
              <Button variant="danger" className="text-xs" onClick={async () => {
                if (!token) return;
                await deleteServiceTypeApi(token, s.id);
                await load();
              }}>Delete</Button>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit service" : "New service"}>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label>Duration (minutes)</Label><Input value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
          <div><Label>Price</Label><Input value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <Button className="w-full" onClick={() => void save()}>Save</Button>
        </div>
      </Modal>
    </div>
  );
}

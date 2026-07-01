"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  deletePortfolioPhoto,
  getMyPortfolio,
  saveMyPortfolio,
  updatePortfolioPhoto,
  uploadsUrl,
  type PortfolioPhoto,
} from "@emmasenvy/shared";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { uploadPortfolioPhotoWeb } from "@/lib/upload-helpers";
import { pickFiles } from "@/lib/uploads";

export function ManagePortfolioView() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visible, setVisible] = useState(false);
  const [photos, setPhotos] = useState<PortfolioPhoto[]>([]);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await getMyPortfolio(token);
      if (r?.portfolio) {
        setTitle(r.portfolio.name || "");
        setDescription(r.portfolio.description || "");
        setVisible(!!r.portfolio.visible);
        setPhotos(r.portfolio.photos || []);
      }
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
      <h1 className="mb-4 text-2xl font-bold">Manage portfolio</h1>
      <Card className="mb-4 space-y-3">
        <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /> Visible to public</label>
        <Button onClick={async () => {
          if (!token) return;
          await saveMyPortfolio(token, { visible });
          await load();
        }}>Save visibility</Button>
      </Card>
      <Button className="mb-4" variant="secondary" onClick={async () => {
        const files = await pickFiles("image/*", true);
        if (!token) return;
        for (const f of files) await uploadPortfolioPhotoWeb(token, f);
        await load();
      }}>Upload photos</Button>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {photos.map((p) => {
          const url = uploadsUrl(p.url);
          return (
            <Card key={p.id}>
              {url ? <Image src={url} alt="" width={200} height={200} className="mb-2 rounded object-cover" /> : null}
              <Input defaultValue={p.caption || ""} onBlur={async (e) => {
                if (!token) return;
                await updatePortfolioPhoto(token, p.id, { caption: e.target.value });
              }} placeholder="Caption" />
              <Button variant="danger" className="mt-2 w-full text-xs" onClick={async () => {
                if (!token) return;
                await deletePortfolioPhoto(token, p.id);
                await load();
              }}>Delete</Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

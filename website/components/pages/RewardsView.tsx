"use client";

import { useEffect, useState } from "react";
import {
  createRewardOfferingApi,
  deleteRewardOfferingApi,
  getMeRewards,
  listAvailableRewardOfferings,
  listRewardOfferingsAdmin,
  patchRewardOfferingApi,
  type RewardOfferingDto,
  type RewardTypeApi,
} from "@emmasenvy/shared";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";

function formatOfferingValue(o: RewardOfferingDto): string {
  if (o.reward_type === "percent_off" && o.value != null) return `${o.value}% off`;
  if (o.reward_type === "dollar_off" && o.value != null) return `$${o.value} off`;
  if (o.reward_type === "free_service") return "Free service";
  return "—";
}

export function RewardsView({ adminMode = false }: { adminMode?: boolean }) {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<RewardOfferingDto[]>([]);
  const [points, setPoints] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RewardOfferingDto | null>(null);
  const [title, setTitle] = useState("");
  const [rewardType, setRewardType] = useState<RewardTypeApi>("dollar_off");
  const [pointCost, setPointCost] = useState("");
  const [value, setValue] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      if (adminMode && token) {
        setCatalog(await listRewardOfferingsAdmin(token));
      } else if (token) {
        const [mr, offers] = await Promise.all([getMeRewards(token), listAvailableRewardOfferings()]);
        setPoints(mr.points);
        setCatalog(offers);
      } else {
        setCatalog(await listAvailableRewardOfferings());
      }
    } catch {
      setCatalog([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token, adminMode]);

  if (loading) return <LoadingSpinner />;

  const openEdit = (o: RewardOfferingDto) => {
    setEditing(o);
    setTitle(o.title);
    setRewardType(o.reward_type);
    setPointCost(String(o.point_cost));
    setValue(o.value != null ? String(o.value) : "");
    setModalOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setRewardType("dollar_off");
    setPointCost("");
    setValue("");
    setModalOpen(true);
  };

  const save = async () => {
    if (!token) return;
    const body = {
      title: title.trim(),
      reward_type: rewardType,
      point_cost: parseInt(pointCost, 10),
      value: value ? parseFloat(value) : null,
      min_purchase_amount: 0,
      is_active: true,
      service_type_id: null,
    };
    if (editing) await patchRewardOfferingApi(token, editing.id, body);
    else await createRewardOfferingApi(token, body);
    setModalOpen(false);
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={adminMode ? "Rewards Admin" : "Rewards"}
        subtitle={adminMode ? "Manage reward offerings" : "Earn points and redeem perks"}
      />
      {!adminMode && points != null ? (
        <Card>
          <p className="text-lg">
            Your points: <strong>{points}</strong>
          </p>
        </Card>
      ) : null}
      {!adminMode && !user ? (
        <Card>
          <p className="text-white/75">Sign in to view your points balance.</p>
          <Button href="/account" className="mt-4">
            Sign in
          </Button>
        </Card>
      ) : null}
      {adminMode ? (
        <Button onClick={openNew}>New reward offering</Button>
      ) : null}
      <div className="space-y-4">
        {catalog.map((o) => (
          <Card key={o.id}>
            <p className="font-semibold">{o.title}</p>
            <p className="text-sm text-white/75">{formatOfferingValue(o)} · {o.point_cost} pts</p>
            {adminMode ? (
              <div className="mt-3 flex gap-3">
                <Button variant="secondary" className="text-xs" onClick={() => openEdit(o)}>Edit</Button>
                <Button variant="danger" className="text-xs" onClick={async () => {
                  if (!token) return;
                  await deleteRewardOfferingApi(token, o.id);
                  await load();
                }}>Delete</Button>
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit offering" : "New offering"}
        footer={
          <Button className="w-full" onClick={() => void save()}>
            Save
          </Button>
        }
      >
        <div className="space-y-4">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Point cost</Label><Input value={pointCost} onChange={(e) => setPointCost(e.target.value)} /></div>
          <div><Label>Value</Label><Input value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <select value={rewardType} onChange={(e) => setRewardType(e.target.value as RewardTypeApi)} className="w-full rounded-xl border border-white/25 bg-white/10 px-3 py-3 text-white outline-none focus:border-white/50 focus:ring-2 focus:ring-white/30">
            <option value="dollar_off" className="text-gray-900">Dollar off</option>
            <option value="percent_off" className="text-gray-900">Percent off</option>
            <option value="free_service" className="text-gray-900">Free service</option>
          </select>
        </div>
      </Modal>
    </div>
  );
}

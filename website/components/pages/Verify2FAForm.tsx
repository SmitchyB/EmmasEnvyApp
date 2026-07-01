"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { verify2FA } from "@emmasenvy/shared";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";

export function Verify2FAForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setSession, getDeviceId } = useAuth();
  const tempToken = params.get("tempToken") || "";
  const staySignedIn = params.get("staySignedIn") !== "0";
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!tempToken) { setError("Missing session. Sign in again."); return; }
    setLoading(true);
    setError(null);
    try {
      const deviceId = await getDeviceId();
      const { user, token } = await verify2FA({ tempToken, code, rememberDevice, deviceId });
      await setSession(user, token, { persist: staySignedIn });
      router.replace("/account");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Verify identity" subtitle="Enter the code sent to your device" />
      <Card className="space-y-4">
        {error ? <p className="text-sm text-red-200">{error}</p> : null}
        <div><Label>Verification code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" /></div>
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} />
          Trust this device
        </label>
        <Button className="w-full" disabled={loading} onClick={() => void submit()}>Verify</Button>
        <Link href="/account" className="block text-center text-sm text-white/70">Back to sign in</Link>
      </Card>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSignupDraft, clearSignupDraft, register } from "@emmasenvy/shared";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export function Signup2FAChoiceForm() {
  const router = useRouter();
  const { setSession, getDeviceId } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qr_url: string } | null>(null);

  const draft = getSignupDraft();
  if (!draft) {
    return (
      <Card className="text-center">
        <p>Signup session expired.</p>
        <Button href="/account" className="mt-4">
          Back
        </Button>
      </Card>
    );
  }

  const finishRegister = async (opts: { two_factor_enabled: boolean; two_factor_type?: "email" | "phone" | "totp" }) => {
    setLoading(true);
    setError(null);
    try {
      const deviceId = await getDeviceId();
      const result = await register({ ...draft, deviceId, ...opts });
      if ("requires2FA" in result && result.requires2FA && result.tempToken) {
        if (result.totp_setup) setTotpSetup(result.totp_setup);
        router.push(`/verify-2fa?tempToken=${encodeURIComponent(result.tempToken)}&twoFactorType=${result.twoFactorType || "totp"}&staySignedIn=1`);
        return;
      }
      if ("token" in result && result.user && result.token) {
        clearSignupDraft();
        await setSession(result.user, result.token);
        router.replace("/complete-profile");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Secure your account" subtitle="Choose how you'd like to protect your account" />
      {error ? (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-950/30 px-4 py-3 text-sm text-red-100">{error}</div>
      ) : null}
      {totpSetup ? (
        <Card className="mb-4 space-y-3 text-sm">
          <p>Scan this QR code with your authenticator app:</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={totpSetup.qr_url} alt="TOTP QR" className="mx-auto max-w-[200px]" />
          <p className="break-all text-white/70">Secret: {totpSetup.secret}</p>
        </Card>
      ) : null}
      <Card className="space-y-3">
        <Button className="w-full" disabled={loading} onClick={() => void finishRegister({ two_factor_enabled: true, two_factor_type: "email" })}>
          Enable email 2FA
        </Button>
        <Button className="w-full" variant="secondary" disabled={loading} onClick={() => void finishRegister({ two_factor_enabled: true, two_factor_type: "phone" })}>
          Enable phone 2FA
        </Button>
        <Button className="w-full" variant="secondary" disabled={loading} onClick={() => void finishRegister({ two_factor_enabled: true, two_factor_type: "totp" })}>
          Enable authenticator app
        </Button>
        <Button className="w-full" variant="ghost" disabled={loading} onClick={() => void finishRegister({ two_factor_enabled: false })}>
          Skip for now
        </Button>
      </Card>
    </div>
  );
}

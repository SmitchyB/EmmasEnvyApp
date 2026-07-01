"use client";

import Link from "next/link";
import { useState } from "react";
import { completeForgotPassword, requestPasswordReset, verifyForgotCode } from "@emmasenvy/shared";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";

type Step = "request" | "verify" | "reset";

export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>("request");
  const [identifierType, setIdentifierType] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const request = async () => {
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset({
        email: identifierType === "email" ? email.trim() : undefined,
        phone: identifierType === "phone" ? phone.trim().replace(/\D/g, "") : undefined,
      });
      setMessage("If an account exists, a code was sent.");
      setStep("verify");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setError(null);
    setLoading(true);
    try {
      const { resetToken: rt } = await verifyForgotCode({
        email: identifierType === "email" ? email.trim() : undefined,
        phone: identifierType === "phone" ? phone.trim().replace(/\D/g, "") : undefined,
        code,
      });
      setResetToken(rt);
      setStep("reset");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true);
    setError(null);
    try {
      await completeForgotPassword({ resetToken, newPassword, confirmPassword });
      setMessage("Password updated. You can sign in now.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Forgot password" subtitle="We'll send you a code to reset your password" backHref="/account" />
      {message ? <p className="mb-4 text-sm text-green-200">{message}</p> : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-950/30 px-4 py-3 text-sm text-red-100">{error}</div>
      ) : null}
      <Card className="space-y-4">
        {step === "request" ? (
          <>
            <div className="flex gap-2">
              <Button variant={identifierType === "email" ? "primary" : "ghost"} onClick={() => setIdentifierType("email")}>Email</Button>
              <Button variant={identifierType === "phone" ? "primary" : "ghost"} onClick={() => setIdentifierType("phone")}>Phone</Button>
            </div>
            {identifierType === "email" ? (
              <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            ) : (
              <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            )}
            <Button className="w-full" disabled={loading} onClick={() => void request()}>Send code</Button>
          </>
        ) : null}
        {step === "verify" ? (
          <>
            <div><Label>Verification code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
            <Button className="w-full" disabled={loading} onClick={() => void verify()}>Verify code</Button>
          </>
        ) : null}
        {step === "reset" ? (
          <>
            <div><Label>New password</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
            <div><Label>Confirm password</Label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
            <Button className="w-full" disabled={loading} onClick={() => void reset()}>Set new password</Button>
          </>
        ) : null}
        <Link href="/account" className="block text-center text-sm text-white/70">Back to sign in</Link>
      </Card>
    </div>
  );
}

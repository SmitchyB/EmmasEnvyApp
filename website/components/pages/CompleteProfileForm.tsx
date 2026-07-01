"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { completeProfile } from "@emmasenvy/shared";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { uploadProfilePhotoWeb } from "@/lib/upload-helpers";
import { pickFiles } from "@/lib/uploads";

export function CompleteProfileForm() {
  const router = useRouter();
  const params = useSearchParams();
  const signedUpWith = params.get("signedUpWith") || "email";
  const { user, token, setSession } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [dob, setDob] = useState(user?.dob || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!token) return;
    if (!firstName.trim() || !dob.trim()) {
      setError("First name and date of birth are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let currentToken = token;
      let currentUser = user!;
      if (photoFile) {
        const r = await uploadProfilePhotoWeb(token, photoFile);
        currentUser = r.user;
        await setSession(r.user, token);
      }
      const { user: u, token: newToken } = await completeProfile(currentToken, {
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        dob: dob.trim(),
        email: signedUpWith === "phone" ? email.trim() || undefined : undefined,
        phone: signedUpWith === "email" ? phone.trim() || undefined : undefined,
      });
      await setSession(u, newToken || currentToken);
      router.replace("/account");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Complete your profile" subtitle="Just a few details to finish setting up" />
      <Card className="space-y-4">
        {error ? <p className="text-sm text-red-200">{error}</p> : null}
        <div><Label>First name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
        <div><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
        <div><Label>Date of birth (YYYY-MM-DD)</Label><Input value={dob} onChange={(e) => setDob(e.target.value)} /></div>
        {signedUpWith === "phone" ? (
          <div><Label>Email (optional)</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        ) : (
          <div><Label>Phone (optional)</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        )}
        <Button variant="secondary" onClick={async () => {
          const files = await pickFiles("image/*", false);
          if (files[0]) setPhotoFile(files[0]);
        }}>
          {photoFile ? "Photo selected" : "Add profile photo"}
        </Button>
        <Button className="w-full" disabled={loading} onClick={() => void submit()}>Save & continue</Button>
        <Link href="/account" className="block text-center text-sm text-white/70">Skip for now</Link>
      </Card>
    </div>
  );
}

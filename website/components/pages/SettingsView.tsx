"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  deleteAccountApi,
  getSessions,
  requestDataExport,
  revokeSession,
  untrustSession,
  updateAccount,
  update2FA,
  updateProfile,
  uploadsUrl,
} from "@emmasenvy/shared";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Label } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { downloadJsonExport, uploadProfilePhotoWeb } from "@/lib/upload-helpers";
import { pickFiles } from "@/lib/uploads";

export function SettingsView() {
  const router = useRouter();
  const { user, token, setSession, logout } = useAuth();
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof getSessions>>["sessions"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [secureUnlocked, setSecureUnlocked] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorType, setTwoFactorType] = useState<"email" | "phone" | "totp">("email");

  const loadSessions = useCallback(async () => {
    if (!token) return;
    try {
      const { sessions: list } = await getSessions(token);
      setSessions(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sessions");
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? "");
      setLastName(user.last_name ?? "");
      setDob(user.dob ?? "");
      setNewEmail(user.email ?? "");
      setNewPhone(user.phone ?? "");
      setTwoFactorEnabled(!!user.two_factor_enabled);
      setTwoFactorType((user.two_factor_type as "email" | "phone" | "totp") || "email");
    }
  }, [user]);

  useEffect(() => {
    if (token) loadSessions();
  }, [token, loadSessions]);

  if (!user || !token) {
    return (
      <EmptyState
        icon="⚙️"
        title="Settings"
        message="Sign in to manage your profile and account preferences."
        actionLabel="Sign in"
        actionHref="/account"
      />
    );
  }

  const avatarUrl = user.profile_picture ? uploadsUrl(user.profile_picture) : null;

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" subtitle="Profile, security, and privacy" />
      {error ? (
        <div className="rounded-xl border border-red-400/30 bg-red-950/30 px-4 py-3 text-sm text-red-100">{error}</div>
      ) : null}

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="flex flex-col items-center gap-4 pb-2">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={128}
              height={128}
              className="h-32 w-32 rounded-full object-cover ring-4 ring-pink-light/30 shadow-lg shadow-black/30"
            />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white/20 text-5xl ring-4 ring-pink-light/30">
              👤
            </div>
          )}
        </div>
        <div><Label>First name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
        <div><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
        <div><Label>Date of birth</Label><Input value={dob} onChange={(e) => setDob(e.target.value)} /></div>
        <Button variant="secondary" onClick={async () => {
          const files = await pickFiles("image/*", false);
          if (files[0]) {
            const { user: u } = await uploadProfilePhotoWeb(token, files[0]);
            await setSession(u, token);
          }
        }}>Change photo</Button>
        <Button onClick={async () => {
          const { user: u } = await updateProfile(token, {
            first_name: firstName.trim() || undefined,
            last_name: lastName.trim() || undefined,
            dob: dob.trim() || null,
          });
          await setSession(u, token);
        }}>Save profile</Button>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">Two-factor authentication</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={twoFactorEnabled} onChange={(e) => setTwoFactorEnabled(e.target.checked)} />
          Enable 2FA
        </label>
        <select
          value={twoFactorType}
          onChange={(e) => setTwoFactorType(e.target.value as "email" | "phone" | "totp")}
          className="w-full rounded-xl border border-white/25 bg-white/10 px-3 py-3 text-white outline-none focus:border-white/50 focus:ring-2 focus:ring-white/30"
        >
          <option value="email" className="text-gray-900">Email</option>
          <option value="phone" className="text-gray-900">Phone</option>
          <option value="totp" className="text-gray-900">Authenticator app</option>
        </select>
        <Input type="password" placeholder="Current password (required to change 2FA)" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        <Button onClick={async () => {
          const r = await update2FA({ token, two_factor_enabled: twoFactorEnabled, two_factor_type: twoFactorType, current_password: currentPassword || undefined });
          await setSession(r.user, token);
        }}>Update 2FA</Button>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">Email, phone & password</h2>
        {!secureUnlocked ? (
          <>
            <Input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            <Button variant="secondary" onClick={() => setSecureUnlocked(true)}>Unlock</Button>
          </>
        ) : (
          <>
            <div><Label>Email</Label><Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} /></div>
            <div><Label>New password</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
            <div><Label>Confirm password</Label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
            <Button onClick={async () => {
              const { user: u } = await updateAccount(token, {
                current_password: currentPassword,
                email: newEmail.trim() || undefined,
                phone: newPhone.trim() || undefined,
                new_password: newPassword || undefined,
                confirm_password: confirmPassword || undefined,
              });
              await setSession(u, token);
              setSecureUnlocked(false);
            }}>Save account changes</Button>
          </>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">Active sessions</h2>
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/15 p-3 text-sm">
            <span>{s.device_name || `Session ${s.id}`}</span>
            <div className="flex gap-3">
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => void untrustSession(token, s.id).then(loadSessions)}>Untrust</Button>
              <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => void revokeSession(token, s.id).then(loadSessions)}>Revoke</Button>
            </div>
          </div>
        ))}
      </Card>

      <Card className="space-y-4 border-red-400/20">
        <h2 className="text-lg font-semibold text-red-100">Data privacy</h2>
        <Button variant="secondary" onClick={async () => {
          const data = await requestDataExport(token);
          downloadJsonExport(data);
        }}>Export my data</Button>
        <Input type="password" placeholder="Password to confirm deletion" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
        <Button variant="danger" onClick={async () => {
          await deleteAccountApi(token, deletePassword);
          await logout();
          router.replace("/");
        }}>Delete account</Button>
      </Card>
    </div>
  );
}

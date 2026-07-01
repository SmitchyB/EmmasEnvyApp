"use client";



import Image from "next/image";

import Link from "next/link";

import { useRouter } from "next/navigation";

import { useEffect, useState } from "react";

import { isStaffRole, login, setSignupDraft, uploadsUrl } from "@emmasenvy/shared";

import { useAuth } from "@/contexts/AuthContext";

import { Button } from "@/components/ui/Button";

import { Card } from "@/components/ui/Card";

import { Input, Label } from "@/components/ui/Input";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

import { MenuRow, MenuSection } from "@/components/ui/MenuSection";

import { PageContainer } from "@/components/ui/PageContainer";

import { PageHeader } from "@/components/ui/PageHeader";



type AuthMode = "signin" | "signup";

type IdentifierType = "email" | "phone";



function PillToggle<T extends string>({

  options,

  value,

  onChange,

}: {

  options: { value: T; label: string }[];

  value: T;

  onChange: (v: T) => void;

}) {

  return (

    <div className="flex rounded-xl border border-white/20 bg-white/5 p-1">

      {options.map((opt) => (

        <button

          key={opt.value}

          type="button"

          onClick={() => onChange(opt.value)}

          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${

            value === opt.value

              ? "btn-shimmer border border-pink/40 bg-gradient-to-br from-pink-dark to-pink-darkest text-pink-light shadow-md"

              : "text-white/75 hover:text-white"

          }`}

        >

          {opt.label}

        </button>

      ))}

    </div>

  );

}



export function AccountView() {

  const router = useRouter();

  const { user, setSession, logout, getDeviceId, isLoading: authLoading } = useAuth();

  const [mode, setMode] = useState<AuthMode>("signin");

  const [identifierType, setIdentifierType] = useState<IdentifierType>("email");

  const [email, setEmail] = useState("");

  const [phone, setPhone] = useState("");

  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [staySignedIn, setStaySignedIn] = useState(true);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);



  useEffect(() => {

    if (!user?.id) return;

    if (!user.first_name || !user.dob) {

      router.replace(`/complete-profile?signedUpWith=${user.email ? "email" : "phone"}`);

    }

  }, [user, router]);



  if (authLoading) return <LoadingSpinner />;



  if (user) {

    const avatarUrl = user.profile_picture ? uploadsUrl(user.profile_picture) : null;

    const staff = isStaffRole(user.role);

    return (

      <PageContainer width="sm" className="space-y-8">

        <PageHeader title="Account" subtitle="Manage your profile and preferences" />

        <Card className="flex flex-col items-center gap-4 py-8 text-center">

          {avatarUrl ? (

            <Image

              src={avatarUrl}

              alt=""

              width={128}

              height={128}

              className="h-32 w-32 rounded-full object-cover ring-4 ring-pink-light/30 shadow-lg shadow-black/30"

            />

          ) : (

            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white/20 text-5xl ring-4 ring-pink-light/30 shadow-lg">

              👤

            </div>

          )}

          <div>

            <p className="text-lg font-semibold">

              {[user.first_name, user.last_name].filter(Boolean).join(" ") || "Member"}

            </p>

            {user.email ? <p className="mt-1 text-sm text-white/70">{user.email}</p> : null}

            {user.phone ? <p className="text-sm text-white/70">{user.phone}</p> : null}

          </div>

        </Card>



        <MenuSection title="Your account">

          <MenuRow href="/settings">Settings</MenuRow>

          <MenuRow href="/appointments">Appointments</MenuRow>

          <MenuRow href="/rewards">Rewards</MenuRow>

          <MenuRow href="/support">Support</MenuRow>

        </MenuSection>



        {staff ? (

          <MenuSection title="Staff tools" variant="staff">

            <MenuRow href="/staff/appointments">Appointments</MenuRow>

            <MenuRow href="/staff/portfolio">Portfolio</MenuRow>

            <MenuRow href="/staff/services">Services</MenuRow>

            <MenuRow href="/staff/newsletters-promos">Newsletters & Promos</MenuRow>

            <MenuRow href="/staff/rewards">Rewards Admin</MenuRow>

            <MenuRow href="/staff/support">Support Queue</MenuRow>

          </MenuSection>

        ) : null}



        <Button

          variant="danger"

          className="w-full"

          disabled={loading}

          onClick={async () => {

            setLoading(true);

            await logout();

            setLoading(false);

          }}

        >

          {loading ? "Signing out…" : "Sign out"}

        </Button>

      </PageContainer>

    );

  }



  const handleSignIn = async () => {

    setError(null);

    const useEmail = identifierType === "email";

    const emailVal = email.trim();

    const phoneVal = phone.trim().replace(/\D/g, "");

    if (useEmail && !emailVal) {

      setError("Enter your email");

      return;

    }

    if (!useEmail && phoneVal.length < 10) {

      setError("Enter a valid phone number");

      return;

    }

    if (!password) {

      setError("Enter password");

      return;

    }

    setLoading(true);

    try {

      const deviceId = await getDeviceId();

      const result = await login({

        email: useEmail ? emailVal : undefined,

        phone: !useEmail ? phoneVal : undefined,

        password,

        staySignedIn,

        deviceId,

      });

      if ("requires2FA" in result && result.requires2FA && result.tempToken) {

        router.push(

          `/verify-2fa?tempToken=${encodeURIComponent(result.tempToken)}&twoFactorType=${result.twoFactorType || "totp"}&staySignedIn=${staySignedIn ? "1" : "0"}`

        );

        return;

      }

      if ("user" in result && result.token) {

        await setSession(result.user, result.token, { persist: staySignedIn });

      }

    } catch (e) {

      setError(e instanceof Error ? e.message : "Sign in failed");

    } finally {

      setLoading(false);

    }

  };



  const handleSignUp = () => {

    setError(null);

    const useEmail = identifierType === "email";

    const emailVal = email.trim();

    const phoneVal = phone.trim().replace(/\D/g, "");

    if (useEmail && !emailVal) {

      setError("Enter your email");

      return;

    }

    if (!useEmail && phoneVal.length < 10) {

      setError("Enter a valid phone number");

      return;

    }

    if (!password || password.length < 8) {

      setError("Password must be at least 8 characters");

      return;

    }

    if (password !== confirmPassword) {

      setError("Passwords do not match");

      return;

    }

    setSignupDraft({

      email: useEmail ? emailVal : undefined,

      phone: !useEmail ? phoneVal : undefined,

      password,

      identifierType,

    });

    router.push("/signup-2fa-choice");

  };



  return (

    <PageContainer width="sm" className="space-y-6">

      <PageHeader

        title="Account"

        subtitle={mode === "signin" ? "Welcome back" : "Create your account"}

      />



      <PillToggle

        options={[

          { value: "signin" as const, label: "Sign in" },

          { value: "signup" as const, label: "Sign up" },

        ]}

        value={mode}

        onChange={setMode}

      />



      <PillToggle

        options={[

          { value: "email" as const, label: "Email" },

          { value: "phone" as const, label: "Phone" },

        ]}

        value={identifierType}

        onChange={setIdentifierType}

      />



      {error ? (

        <div className="rounded-xl border border-red-400/30 bg-red-950/30 px-4 py-3 text-sm text-red-100">

          {error}

        </div>

      ) : null}



      <Card className="space-y-4">

        {identifierType === "email" ? (

          <div>

            <Label>Email</Label>

            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

          </div>

        ) : (

          <div>

            <Label>Phone</Label>

            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />

          </div>

        )}

        <div>

          <Label>Password</Label>

          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        </div>

        {mode === "signup" ? (

          <div>

            <Label>Confirm password</Label>

            <Input

              type="password"

              value={confirmPassword}

              onChange={(e) => setConfirmPassword(e.target.value)}

            />

          </div>

        ) : (

          <label className="flex items-center gap-2 text-sm text-white/80">

            <input type="checkbox" checked={staySignedIn} onChange={(e) => setStaySignedIn(e.target.checked)} />

            Stay signed in

          </label>

        )}

        {mode === "signin" ? (

          <>

            <Button className="w-full" disabled={loading} onClick={() => void handleSignIn()}>

              {loading ? "Signing in…" : "Sign in"}

            </Button>

            <Link

              href="/forgot-password"

              className="block text-center text-sm text-white/70 transition hover:text-white"

            >

              Forgot password?

            </Link>

          </>

        ) : (

          <Button className="w-full" onClick={handleSignUp}>

            Continue

          </Button>

        )}

      </Card>

    </PageContainer>

  );

}


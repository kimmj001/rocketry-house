"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, LockKeyhole, Mail, Rocket, Send, UserRoundPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isValidEmail, mapSupabaseUserToAuthUser, normalizeEmail, saveAuthUserProfileToCloud, validatePassword, writeMockUser } from "@/lib/auth";
import { savePersistentRecord } from "@/lib/cloud-persistence";
import { recordAccountActivity } from "@/lib/account-activity";
import { sampleOrganizations } from "@/lib/team-data";
import { getSupabaseClient, isMockMode } from "@/lib/supabase";

type AuthMode = "sign-in" | "sign-up";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"personal" | "team" | "organization">("personal");
  const [organizationName, setOrganizationName] = useState<string>(sampleOrganizations[0]?.name ?? "");
  const [approvalRequested, setApprovalRequested] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const isSignUp = mode === "sign-up";

  useEffect(() => {
    const type = new URLSearchParams(window.location.search).get("type");
    if (type === "personal" || type === "team" || type === "organization") {
      setAccountType(type);
    }
  }, []);

  useEffect(() => {
    if (accountType !== "team") setApprovalRequested(false);
  }, [accountType]);

  async function submit() {
    setLoading(true);
    setStatus("");
    const supabase = getSupabaseClient();
    const trimmedName = name.trim();
    const trimmedEmail = normalizeEmail(email);
    const selectedOrganization = accountType === "team" && organizationName ? organizationName : undefined;

    try {
      if (!trimmedEmail || !password) {
        throw new Error("Email and password are required.");
      }
      if (!isValidEmail(trimmedEmail)) {
        throw new Error("Enter a valid email address.");
      }
      validatePassword(password);

      if (isSignUp && !trimmedName) {
        throw new Error("Display name is required.");
      }

      if (!supabase || isMockMode) {
        throw new Error("Cloud account service is not configured. Add Supabase environment variables before accepting real users.");
      }

      const response = isSignUp
        ? await supabase.auth.signUp({
            email: trimmedEmail,
            password,
            options: {
              data: {
                name: trimmedName,
                account_type: accountType,
                organization_name: accountType === "team" ? selectedOrganization : accountType === "organization" ? trimmedName : undefined,
                organization_approval_status: accountType === "team" && selectedOrganization ? "requested" : accountType === "organization" ? "approved" : "none"
              }
            }
          })
        : await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      if (response.error) throw response.error;
      if (!response.data.user) {
        throw new Error("Supabase did not return a user. Check email confirmation settings and try signing in.");
      }
      const savedUser = mapSupabaseUserToAuthUser(response.data.user, {
        name: trimmedName || trimmedEmail.split("@")[0],
        email: trimmedEmail,
        accountType,
        organizationName: accountType === "team" ? selectedOrganization : accountType === "organization" ? trimmedName : undefined,
        organizationApprovalStatus: accountType === "team" && selectedOrganization ? "requested" : accountType === "organization" ? "approved" : "none",
        createdAt: new Date().toISOString()
      });
      writeMockUser(savedUser);

      const profileResult = await saveAuthUserProfileToCloud(savedUser);
      const archiveResult = await savePersistentRecord("profiles", savedUser.id, savedUser);
      if (profileResult.error || archiveResult.error) {
        throw new Error("Account was created, but profile archiving failed. Please try signing in again.");
      }
      if (isSignUp) {
        await recordAccountActivity({
          type: "account_created",
          title: `Created ${savedUser.accountType} account`,
          detail: savedUser.email,
          subjectId: savedUser.id,
          subjectUrl: "/profile",
          occurredAt: savedUser.createdAt,
          idempotencyKey: `account-created:${savedUser.id}`
        });
      }
      router.push("/profile");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-space-radial px-6 py-24">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_440px]">
        <section className="flex min-h-[620px] flex-col justify-center">
          <p className="text-sm uppercase tracking-[0.2em] text-orange-100/60">Rocketry House Account</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-semibold">{isSignUp ? "Create your Rocketry House account." : "Welcome back to your rocket workshop."}</h1>
          <p className="mt-5 max-w-2xl text-lg text-orange-50/68">
            Sign in to keep motors, CAD rockets, simulations, forks, upload archives, and profile activity tied to your personal, team, or organization account.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["Motor library", "Rocket builds", "Project archive"].map((item) => <div key={item} className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm">{item}</div>)}
          </div>
        </section>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            {isSignUp ? <UserRoundPlus className="h-6 w-6 text-orange-200" /> : <LockKeyhole className="h-6 w-6 text-orange-200" />}
            <div>
              <h2 className="text-2xl font-semibold">{isSignUp ? "Sign up" : "Sign in"}</h2>
              <p className="text-sm text-orange-50/58">{isMockMode ? "Cloud account service is not configured yet." : "Secure cloud account access is enabled."}</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {isSignUp ? <Field icon={Rocket} label="Display name" value={name} onChange={setName} /> : null}
            <Field icon={Mail} label="Email" value={email} onChange={setEmail} />
            <Field icon={LockKeyhole} label="Password" value={password} onChange={setPassword} type="password" />
            {isSignUp ? (
              <label className="block text-sm text-orange-50/65">
                Account type
                <select value={accountType} onChange={(event) => setAccountType(event.target.value as never)} className="mt-1 w-full rounded-md border border-white/10 bg-[#121421] px-3 py-2 text-orange-50">
                  <option value="personal">Personal</option>
                  <option value="team">Team</option>
                  <option value="organization">Organization</option>
                </select>
              </label>
            ) : null}
            {isSignUp && accountType === "team" ? (
              <div className="rounded-lg border border-cyan-200/15 bg-cyan-300/[0.04] p-4">
                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 h-5 w-5 text-cyan-200" />
                  <div>
                    <p className="font-semibold text-orange-50">Team organization membership</p>
                    <p className="mt-1 text-sm leading-6 text-orange-50/58">If your team belongs to an existing organization, request approval. After the organization approves, your team appears under that organization profile and contributes to its ranking.</p>
                  </div>
                </div>
                <label className="mt-4 block text-sm text-orange-50/65">
                  Parent organization
                  <span className="mt-1 flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    <Building2 className="h-4 w-4 text-cyan-100/60" />
                    <select value={organizationName} disabled={!sampleOrganizations.length} onChange={(event) => setOrganizationName(event.target.value)} className="w-full bg-transparent text-orange-50 outline-none disabled:opacity-60">
                      {sampleOrganizations.length ? sampleOrganizations.map((organization) => (
                        <option key={organization.name} value={organization.name} className="bg-[#121421] text-orange-50">
                          {organization.name}
                        </option>
                      )) : <option value="" className="bg-[#121421] text-orange-50">No registered organizations yet</option>}
                    </select>
                  </span>
                </label>
                <button type="button" disabled={!organizationName} onClick={() => setApprovalRequested(true)} className="mt-3 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-orange-50/75 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
                  <Send className="h-4 w-4" />
                  {approvalRequested ? "Approval request sent" : "Request organization approval"}
                </button>
                {!approvalRequested ? <p className="mt-2 text-xs text-cyan-50/55">{organizationName ? "A request will also be attached automatically when this team account is created." : "Organization approval becomes available after a real organization account is registered."}</p> : null}
              </div>
            ) : null}
            {isSignUp && accountType === "organization" ? (
              <div className="rounded-lg border border-orange-200/15 bg-orange-300/[0.04] p-4 text-sm leading-6 text-orange-50/62">
                Organization accounts can contain multiple teams. They approve team membership requests and compete on organization rankings through the combined performance of approved teams.
              </div>
            ) : null}
          </div>

          {status ? <p className="mt-4 rounded-md bg-red-500/12 p-3 text-sm text-red-100">{status}</p> : null}

          <div className="mt-6 grid gap-3">
            <Button onClick={submit} disabled={loading}>{loading ? "Working..." : isSignUp ? "Create account" : "Sign in"}</Button>
          </div>

          <p className="mt-5 text-center text-sm text-orange-50/60">
            {isSignUp ? "Already have an account? " : "New to Rocketry House? "}
            <Link className="text-orange-200 hover:text-orange-100" href={isSignUp ? "/auth/sign-in" : "/auth/sign-up"}>
              {isSignUp ? "Sign in" : "Create one"}
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}

function Field({ icon: Icon, label, value, onChange, type = "text" }: { icon: typeof Mail; label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block text-sm text-orange-50/65">
      {label}
      <span className="mt-1 flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
        <Icon className="h-4 w-4 text-orange-100/60" />
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-transparent text-orange-50 outline-none" />
      </span>
    </label>
  );
}

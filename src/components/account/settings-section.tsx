import { useState, type FormEvent } from "react";
import { Bell, KeyRound, Loader2, LogOut, Save, UserRound } from "lucide-react";
import { toast } from "sonner";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrength } from "@/components/auth/password-strength";
import { isStrongPassword, isUaePhone, normalizePhone } from "@/components/auth/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useStore } from "@/context/store";
import { api, errorMessage } from "@/lib/api";
import type { NotificationPrefs, User } from "@/lib/types";

const selectClass =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

// Browser push isn't built yet, so there's no switch for it. Account security messages
// (verification, password resets, sign-in codes) are sent whatever these are set to.
const PREFS: Array<{ key: keyof NotificationPrefs; label: string; description: string }> = [
  {
    key: "email",
    label: "Email",
    description: "Order confirmations, shipping updates, cancellations and refunds.",
  },
  {
    key: "sms",
    label: "SMS",
    description: "Out-for-delivery and delivered alerts, and refund confirmations.",
  },
  {
    key: "marketing",
    label: "Offers & promotions",
    description: "Flash deals and personalised recommendations.",
  },
];

function Card({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof UserRound;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-base font-bold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function SettingsSection({ user }: { user: User }) {
  const { setUser, logoutAllDevices } = useStore();

  const [profile, setProfile] = useState({
    name: user.name,
    phone: user.phone ?? "",
    gender: user.gender ?? "",
  });
  const [profileErrors, setProfileErrors] = useState<{
    name?: string | undefined;
    phone?: string | undefined;
  }>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [prefs, setPrefs] = useState<NotificationPrefs>(user.notificationPrefs);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordErrors, setPasswordErrors] = useState<{
    current?: string | undefined;
    next?: string | undefined;
    confirm?: string | undefined;
  }>({});
  const [savingPassword, setSavingPassword] = useState(false);

  const [signingOut, setSigningOut] = useState(false);
  const isGoogleAccount = user.authProvider === "google";

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const next: { name?: string | undefined; phone?: string | undefined } = {};
    if (profile.name.trim().length < 2) next.name = "Enter your full name";
    if (!isUaePhone(profile.phone)) next.phone = "Enter a UAE mobile number, e.g. 050 123 4567";
    setProfileErrors(next);
    if (Object.keys(next).length) return;

    setSavingProfile(true);
    try {
      const response = await api<{ user: User }>("/auth/me", {
        method: "PUT",
        body: {
          name: profile.name.trim(),
          phone: normalizePhone(profile.phone),
          gender: profile.gender,
        },
      });
      setUser(response.user);
      toast.success("Profile updated");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSavingProfile(false);
    }
  }

  async function updatePref(key: keyof NotificationPrefs, value: boolean) {
    const previous = prefs;
    const optimistic = { ...prefs, [key]: value };
    setPrefs(optimistic);
    setSavingPrefs(true);
    try {
      const response = await api<{ user: User }>("/auth/me", {
        method: "PUT",
        body: { notificationPrefs: optimistic },
      });
      setUser(response.user);
      setPrefs(response.user.notificationPrefs);
    } catch (caught) {
      setPrefs(previous);
      toast.error(errorMessage(caught));
    } finally {
      setSavingPrefs(false);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    const next: {
      current?: string | undefined;
      next?: string | undefined;
      confirm?: string | undefined;
    } = {};
    if (!isGoogleAccount && !passwords.current) next.current = "Enter your current password";
    if (!isStrongPassword(passwords.next))
      next.next = "Your new password doesn't meet all five rules yet";
    if (passwords.confirm !== passwords.next) next.confirm = "Passwords don't match";
    setPasswordErrors(next);
    if (Object.keys(next).length) return;

    setSavingPassword(true);
    try {
      const response = await api<{ message: string }>("/auth/me/password", {
        method: "PUT",
        body: { currentPassword: passwords.current, newPassword: passwords.next },
      });
      setPasswords({ current: "", next: "", confirm: "" });
      toast.success(response.message || "Password updated");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSignOutEverywhere() {
    setSigningOut(true);
    try {
      await logoutAllDevices();
    } catch (caught) {
      toast.error(errorMessage(caught));
      setSigningOut(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile, alerts and account security.
        </p>
      </div>

      <Card
        title="Profile"
        description="How we address you and reach you about orders."
        icon={UserRound}
      >
        <form onSubmit={saveProfile} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settings-name">Full name</Label>
              <Input
                id="settings-name"
                value={profile.name}
                onChange={(event) => {
                  setProfile((current) => ({ ...current, name: event.target.value }));
                  setProfileErrors((current) => ({ ...current, name: undefined }));
                }}
                autoComplete="name"
                aria-invalid={Boolean(profileErrors.name)}
                className="h-11 rounded-xl"
              />
              {profileErrors.name && (
                <p className="text-xs font-medium text-destructive">{profileErrors.name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-phone">Mobile number</Label>
              <Input
                id="settings-phone"
                type="tel"
                inputMode="tel"
                value={profile.phone}
                onChange={(event) => {
                  setProfile((current) => ({ ...current, phone: event.target.value }));
                  setProfileErrors((current) => ({ ...current, phone: undefined }));
                }}
                autoComplete="tel"
                placeholder="050 123 4567"
                aria-invalid={Boolean(profileErrors.phone)}
                className="h-11 rounded-xl"
              />
              {profileErrors.phone && (
                <p className="text-xs font-medium text-destructive">{profileErrors.phone}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settings-gender">Gender</Label>
              <select
                id="settings-gender"
                className={selectClass}
                value={profile.gender}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, gender: event.target.value }))
                }
              >
                <option value="">Not specified</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-email">Email address</Label>
              <Input
                id="settings-email"
                value={user.email}
                readOnly
                disabled
                className="h-11 rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                Contact support if you need to change the email on your account.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              className="h-10 rounded-xl font-semibold"
              disabled={savingProfile}
            >
              {savingProfile ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {savingProfile ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Card>

      <Card
        title="Notification preferences"
        description="Choose how Smart Deal keeps in touch. In-app notifications and account security messages always arrive."
        icon={Bell}
      >
        <ul className="divide-y divide-border">
          {PREFS.map((pref) => (
            <li
              key={pref.key}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <Label htmlFor={`pref-${pref.key}`} className="text-sm font-semibold">
                  {pref.label}
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">{pref.description}</p>
              </div>
              <Switch
                id={`pref-${pref.key}`}
                checked={prefs[pref.key]}
                disabled={savingPrefs}
                onCheckedChange={(checked) => void updatePref(pref.key, checked)}
              />
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title="Change password"
        description={
          isGoogleAccount
            ? "You signed up with Google — set a password to also sign in with your email."
            : "Updating your password signs you out of every other device."
        }
        icon={KeyRound}
      >
        <form onSubmit={savePassword} className="space-y-4" noValidate>
          {!isGoogleAccount && (
            <PasswordField
              id="password-current"
              label="Current password"
              value={passwords.current}
              onChange={(value) => {
                setPasswords((current) => ({ ...current, current: value }));
                setPasswordErrors((current) => ({ ...current, current: undefined }));
              }}
              error={passwordErrors.current}
            />
          )}

          <PasswordField
            id="password-next"
            label="New password"
            value={passwords.next}
            onChange={(value) => {
              setPasswords((current) => ({ ...current, next: value }));
              setPasswordErrors((current) => ({ ...current, next: undefined }));
            }}
            error={passwordErrors.next}
            autoComplete="new-password"
          />
          <PasswordStrength password={passwords.next} />

          <PasswordField
            id="password-confirm"
            label="Confirm new password"
            value={passwords.confirm}
            onChange={(value) => {
              setPasswords((current) => ({ ...current, confirm: value }));
              setPasswordErrors((current) => ({ ...current, confirm: undefined }));
            }}
            error={passwordErrors.confirm}
            autoComplete="new-password"
          />

          <div className="flex justify-end">
            <Button
              type="submit"
              className="h-10 rounded-xl font-semibold"
              disabled={savingPassword}
            >
              {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
              {savingPassword ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Devices" description="Signed in somewhere you don't recognise?" icon={LogOut}>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="h-10 rounded-xl font-semibold"
              disabled={signingOut}
            >
              {signingOut && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign out of all devices
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display">Sign out everywhere?</AlertDialogTitle>
              <AlertDialogDescription>
                Every phone, tablet and browser signed in to this account will be signed out
                immediately — including this one. You&apos;ll need to sign in again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Stay signed in</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-xl"
                onClick={() => void handleSignOutEverywhere()}
              >
                Sign out everywhere
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </div>
  );
}

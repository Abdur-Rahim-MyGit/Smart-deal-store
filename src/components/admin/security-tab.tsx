import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, KeyRound, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SectionCard } from "@/components/dashboard/dashboard-shell";
import { useStore } from "@/context/store";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Field, FormDialog, Note, TabState, adminRetry } from "@/components/admin/people-shared";

interface MfaStatus {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesLeft: number;
  required: boolean;
}

interface SetupResponse {
  secret: string;
  otpauthUrl: string;
  qrSvg: string;
}

const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Recovery codes are shown once, so offer copy and download. */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const text = codes.join("\n");
  return (
    <div className="space-y-3 rounded-2xl border border-amber-500/40 bg-amber-500/8 p-4">
      <p className="text-sm font-bold">Save your recovery codes</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Each code signs you in once if you lose your phone. They won&apos;t be shown again, so keep
        them somewhere safe, like a password manager.
      </p>
      <ul className="grid grid-cols-2 gap-1.5 font-mono text-sm sm:grid-cols-5">
        {codes.map((code) => (
          <li key={code} className="rounded-lg bg-card px-2 py-1 text-center">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg"
          onClick={() =>
            void navigator.clipboard
              .writeText(text)
              .then(() => toast.success("Codes copied"))
              .catch(() => toast.error("Couldn't copy. Select the codes and copy them instead."))
          }
        >
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-lg">
          <a
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Smart Deal recovery codes\n\n${text}\n`)}`}
            download="smart-deal-recovery-codes.txt"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Download
          </a>
        </Button>
        <Button size="sm" className="ml-auto rounded-lg" onClick={onDone}>
          I&apos;ve saved them
        </Button>
      </div>
    </div>
  );
}

/** Two-step sign-in for the signed-in staff member, plus the store-wide staff policy. */
export function SecurityTab({ forced = false }: { forced?: boolean }) {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useStore();
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmCode, setConfirmCode] = useState("");

  const status = useQuery({
    queryKey: ["mfa-status"],
    queryFn: () => api<MfaStatus>("/auth/mfa"),
    retry: adminRetry,
  });

  // In forced mode the console unlocks once the dashboard reloads, so wait until the new
  // recovery codes have been saved before reloading it.
  function refresh({ unlockConsole = !forced } = {}) {
    void queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
    if (unlockConsole) void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    void refreshUser().catch(() => undefined);
  }

  const start = useMutation({
    mutationFn: () => api<SetupResponse>("/auth/mfa/setup", { method: "POST" }),
    onSuccess: (response) => {
      setSetup(response);
      setCode("");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const enable = useMutation({
    mutationFn: () =>
      api<{ message: string; recoveryCodes: string[] }>("/auth/mfa/enable", {
        method: "POST",
        body: { code },
      }),
    onSuccess: (response) => {
      toast.success(response.message);
      setSetup(null);
      setCodes(response.recoveryCodes);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const disable = useMutation({
    mutationFn: () =>
      api<{ message: string }>("/auth/mfa/disable", {
        method: "POST",
        body: { password, code: confirmCode },
      }),
    onSuccess: (response) => {
      toast.success(response.message);
      setDisableOpen(false);
      setPassword("");
      setConfirmCode("");
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const regenerate = useMutation({
    mutationFn: () =>
      api<{ message: string; recoveryCodes: string[] }>("/auth/mfa/recovery-codes", {
        method: "POST",
        body: { code: confirmCode },
      }),
    onSuccess: (response) => {
      toast.success(response.message);
      setRegenOpen(false);
      setConfirmCode("");
      setCodes(response.recoveryCodes);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const policy = useMutation({
    mutationFn: (requireAdminMfa: boolean) =>
      api<{ message: string }>("/admin/settings", { method: "PUT", body: { requireAdminMfa } }),
    onSuccess: () => {
      toast.success("Staff sign-in policy updated");
      void queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const data = status.data;

  return (
    <div className="space-y-4">
      {forced && (
        <Note className="text-xs">
          This store requires two-step sign-in for every staff account. Set it up below to open the
          rest of the admin console.
        </Note>
      )}

      <SectionCard
        title="Two-step sign-in"
        description="After your password, sign-in asks for a code from an authenticator app on your phone."
      >
        <TabState
          isLoading={status.isLoading}
          error={status.error}
          onRetry={() => void status.refetch()}
        >
          {codes ? (
            <RecoveryCodes
              codes={codes}
              onDone={() => {
                setCodes(null);
                if (forced) void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
              }}
            />
          ) : data?.enabled ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-success/30 bg-success/8 p-4">
                <ShieldCheck className="h-6 w-6 text-success" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Two-step sign-in is on</p>
                  <p className="text-xs text-muted-foreground">
                    {data.enabledAt ? `Since ${formatDate(data.enabledAt)} · ` : ""}
                    {data.recoveryCodesLeft} recovery code
                    {data.recoveryCodesLeft === 1 ? "" : "s"} left
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setConfirmCode("");
                    setRegenOpen(true);
                  }}
                >
                  <KeyRound className="mr-1.5 h-4 w-4" /> New recovery codes
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl text-destructive hover:text-destructive"
                  disabled={data.required}
                  title={data.required ? "Required for staff on this store" : undefined}
                  onClick={() => {
                    setPassword("");
                    setConfirmCode("");
                    setDisableOpen(true);
                  }}
                >
                  <ShieldOff className="mr-1.5 h-4 w-4" /> Turn off
                </Button>
              </div>
              {data.recoveryCodesLeft <= 2 && (
                <Note>You&apos;re running low on recovery codes. Create a new set.</Note>
              )}
            </div>
          ) : setup ? (
            <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
              <img
                src={svgDataUrl(setup.qrSvg)}
                alt="QR code to add Smart Deal to your authenticator app"
                className="h-[220px] w-[220px] rounded-xl border border-border bg-white p-2"
              />
              <div className="space-y-4">
                <ol className="list-decimal space-y-1.5 pl-4 text-sm">
                  <li>
                    Open an authenticator app (Google Authenticator, Microsoft Authenticator,
                    1Password…).
                  </li>
                  <li>Scan the QR code, or type in the key below.</li>
                  <li>Enter the 6-digit code the app shows.</li>
                </ol>
                <div className="rounded-xl bg-muted/60 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Setup key</p>
                  <p className="font-mono text-sm break-all">
                    {setup.secret.match(/.{1,4}/g)?.join(" ")}
                  </p>
                </div>
                <Field label="Code from your app" htmlFor="mfa-setup-code">
                  <div className="flex gap-2">
                    <Input
                      id="mfa-setup-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="123456"
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                      className="max-w-[160px] rounded-xl text-center font-mono tracking-[0.3em]"
                    />
                    <Button
                      className="rounded-xl"
                      disabled={code.length !== 6 || enable.isPending}
                      onClick={() => enable.mutate()}
                    >
                      {enable.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Turn on
                    </Button>
                  </div>
                </Field>
                <Button variant="ghost" size="sm" onClick={() => setSetup(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Two-step sign-in is off for {user?.email}. Turning it on protects the console even
                if your password leaks.
              </p>
              <Button
                className="rounded-xl"
                disabled={start.isPending}
                onClick={() => start.mutate()}
              >
                {start.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <ShieldCheck className="mr-1.5 h-4 w-4" /> Set up two-step sign-in
              </Button>
            </div>
          )}
        </TabState>
      </SectionCard>

      {user?.isSuperAdmin && data && !forced && (
        <SectionCard
          title="Staff sign-in policy"
          description="Applies to every admin account on this store."
        >
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
            <span>
              <span className="block text-sm font-semibold">
                Require two-step sign-in for all staff
              </span>
              <span className="block text-[11px] text-muted-foreground">
                Staff without it can only reach this page until they set it up. You need it on your
                own account first.
              </span>
            </span>
            <Switch
              checked={data.required}
              disabled={policy.isPending || (!data.enabled && !data.required)}
              onCheckedChange={(checked) => policy.mutate(checked)}
            />
          </label>
        </SectionCard>
      )}

      <FormDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        title="Turn off two-step sign-in?"
        description="Signing in will only need your password again."
        submitLabel="Turn off"
        pending={disable.isPending}
        onSubmit={() => disable.mutate()}
      >
        <Field label="Password" htmlFor="mfa-off-password" required>
          <Input
            id="mfa-off-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-xl"
          />
        </Field>
        <Field label="Code from your app (or a recovery code)" htmlFor="mfa-off-code" required>
          <Input
            id="mfa-off-code"
            autoComplete="one-time-code"
            value={confirmCode}
            onChange={(event) => setConfirmCode(event.target.value)}
            className="rounded-xl"
          />
        </Field>
      </FormDialog>

      <FormDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        title="Create new recovery codes?"
        description="Your current recovery codes stop working."
        submitLabel="Create codes"
        pending={regenerate.isPending}
        onSubmit={() => regenerate.mutate()}
      >
        <Field label="Code from your app" htmlFor="mfa-regen-code" required>
          <Input
            id="mfa-regen-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={confirmCode}
            onChange={(event) => setConfirmCode(event.target.value.replace(/\D/g, ""))}
            className="rounded-xl"
          />
        </Field>
      </FormDialog>
    </div>
  );
}

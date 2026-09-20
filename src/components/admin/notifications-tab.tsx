import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Mail, Megaphone, MessageSquare, Pencil, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard, TableScroll } from "@/components/dashboard/dashboard-shell";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { useStore } from "@/context/store";
import { useDebounce } from "@/hooks/use-debounce";
import { api, errorMessage } from "@/lib/api";
import { EMIRATES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Field,
  FormDialog,
  Note,
  SELECT_CLASS,
  TabState,
  adminRetry,
  fromLocalInput,
} from "@/components/admin/people-shared";
import { canDo } from "@/components/admin/ops-utils";

interface Template {
  key: string;
  name: string;
  audience: "Customer" | "Seller";
  title: string;
  message: string;
  email: boolean;
  sms: boolean;
  variables: string[];
  customised: boolean;
}

interface Channel {
  connected: boolean;
  provider: string;
  from?: string | undefined;
  note?: string | undefined;
}

type AudienceType = "marketing_optin" | "recent_buyers" | "lapsed" | "emirate" | "subscribers";

interface Campaign {
  _id: string;
  title: string;
  message: string;
  link?: string | undefined;
  audience: { type: AudienceType; emirate?: string; days?: number };
  channels: { email: boolean; sms: boolean };
  status: "Scheduled" | "Sending" | "Sent" | "Cancelled" | "Failed";
  scheduledFor?: string | undefined;
  sentAt?: string | undefined;
  recipientCount: number;
  createdBy?: { name: string } | undefined;
  createdAt: string;
}

const AUDIENCES: Array<{ value: AudienceType; label: string; hint: string }> = [
  {
    value: "marketing_optin",
    label: "Everyone who opted in to offers",
    hint: "Customers with offers switched on",
  },
  {
    value: "recent_buyers",
    label: "Recent buyers",
    hint: "Opted in and ordered in the last N days",
  },
  { value: "lapsed", label: "Lapsed customers", hint: "Opted in but haven't ordered in N days" },
  {
    value: "emirate",
    label: "Customers in one emirate",
    hint: "Opted in, by default delivery address",
  },
  {
    value: "subscribers",
    label: "Newsletter subscribers",
    hint: "Email only, with an unsubscribe link",
  },
];

/** Stand-in values so the preview reads like a real message. */
const SAMPLE_VALUES: Record<string, string> = {
  orderId: "SD-20260919-4F2A1B",
  total: "249.00",
  reason: "The seller ran out of stock.",
  refund: "AED 249.00 credited to your Smart Deal wallet.",
  amount: "249.00",
  ibanLast4: "3456",
  reference: "FT24091812345",
  ticketId: "SD-TKT-20260919-0042",
  excerpt: "Thanks for waiting, your replacement ships today.",
  stockStatus: "Low stock",
  product: "Vitamin C Serum 30ml",
  sku: "SKU-VC-30",
  stock: "3",
};

const render = (text: string) =>
  text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name: string) => SAMPLE_VALUES[name] ?? "");

const audienceLabel = (campaign: Campaign) => {
  const base = AUDIENCES.find((entry) => entry.value === campaign.audience.type)?.label ?? "";
  if (campaign.audience.type === "emirate") return `Customers in ${campaign.audience.emirate}`;
  if (campaign.audience.days) return `${base} (${campaign.audience.days} days)`;
  return base;
};

function ChannelCard({
  icon: Icon,
  label,
  channel,
}: {
  icon: typeof Mail;
  label: string;
  channel?: Channel | undefined;
}) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-bold">
          <Icon className="h-4 w-4 text-muted-foreground" /> {label}
        </span>
        <StatusBadge status={channel?.connected ? "Active" : "Disabled"} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{channel?.provider ?? "—"}</p>
      {channel?.from && <p className="text-[11px] text-muted-foreground">From {channel.from}</p>}
      {channel?.note && <p className="mt-1 text-[11px] text-muted-foreground">{channel.note}</p>}
    </div>
  );
}

/** Automatic notification wording, promotional campaigns and delivery channels. */
export function NotificationsTab() {
  const queryClient = useQueryClient();
  const { user } = useStore();
  const canEditTemplates = canDo(user, "settings");
  const canRunCampaigns = canDo(user, "marketing");

  /* ---- channels ---- */
  const channels = useQuery({
    queryKey: ["notification-channels"],
    queryFn: () =>
      api<{ channels: { email: Channel; sms: Channel; inApp: Channel } }>(
        "/admin/notifications/channels",
      ).then((response) => response.channels),
    retry: adminRetry,
  });
  const [testEmail, setTestEmail] = useState(user?.email ?? "");
  const [testPhone, setTestPhone] = useState("");
  const emailTest = useMutation({
    mutationFn: () =>
      api<{ message: string }>("/admin/test-email", { method: "POST", body: { email: testEmail } }),
    onSuccess: (response) => toast.success(response.message),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const smsTest = useMutation({
    mutationFn: () =>
      api<{ message: string }>("/admin/notifications/test-sms", {
        method: "POST",
        body: { phone: testPhone },
      }),
    onSuccess: (response) => toast.success(response.message),
    onError: (error) => toast.error(errorMessage(error)),
  });

  /* ---- templates ---- */
  const templates = useQuery({
    queryKey: ["notification-templates"],
    queryFn: () =>
      api<{ templates: Template[] }>("/admin/notifications/templates").then(
        (response) => response.templates,
      ),
    enabled: canEditTemplates,
    retry: adminRetry,
  });
  const [editing, setEditing] = useState<Template | null>(null);
  const [draft, setDraft] = useState({ title: "", message: "", email: false, sms: false });
  const saveTemplate = useMutation({
    mutationFn: () =>
      api<{ message: string }>(`/admin/notifications/templates/${editing?.key}`, {
        method: "PUT",
        body: draft,
      }),
    onSuccess: (response) => {
      toast.success(response.message);
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const resetTemplate = useMutation({
    mutationFn: (key: string) =>
      api<{ message: string }>(`/admin/notifications/templates/${key}`, { method: "DELETE" }),
    onSuccess: (response) => {
      toast.success(response.message);
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  /* ---- campaigns ---- */
  const campaigns = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: () =>
      api<{ campaigns: Campaign[] }>("/admin/campaigns").then((response) => response.campaigns),
    enabled: canRunCampaigns,
    retry: adminRetry,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((entry) => entry.status === "Sending") ? 3000 : false,
  });
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({
    title: "",
    message: "",
    link: "",
    audience: "marketing_optin" as AudienceType,
    emirate: "Dubai",
    days: "30",
    email: true,
    sms: false,
    schedule: false,
    scheduledFor: "",
  });
  const audiencePayload = {
    type: compose.audience,
    ...(compose.audience === "emirate" ? { emirate: compose.emirate } : {}),
    ...(["recent_buyers", "lapsed"].includes(compose.audience)
      ? { days: Number(compose.days) }
      : {}),
  };
  const audienceKey = useDebounce(JSON.stringify(audiencePayload), 300);
  const [recipients, setRecipients] = useState<number | null>(null);
  useEffect(() => {
    if (!composeOpen) return;
    let cancelled = false;
    api<{ recipients: number }>("/admin/campaigns/preview", {
      method: "POST",
      body: { audience: JSON.parse(audienceKey) },
    })
      .then((response) => !cancelled && setRecipients(response.recipients))
      .catch(() => !cancelled && setRecipients(null));
    return () => {
      cancelled = true;
    };
  }, [audienceKey, composeOpen]);

  const sendCampaign = useMutation({
    mutationFn: () =>
      api<{ message: string }>("/admin/campaigns", {
        method: "POST",
        body: {
          title: compose.title,
          message: compose.message,
          link: compose.link,
          audience: audiencePayload,
          channels: { email: compose.email, sms: compose.sms },
          scheduledFor: compose.schedule ? fromLocalInput(compose.scheduledFor) : null,
        },
      }),
    onSuccess: (response) => {
      toast.success(response.message);
      setComposeOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const cancelCampaign = useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/admin/campaigns/${id}/cancel`, { method: "PUT" }),
    onSuccess: (response) => {
      toast.success(response.message);
      void queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function openTemplate(template: Template) {
    setEditing(template);
    setDraft({
      title: template.title,
      message: template.message,
      email: template.email,
      sms: template.sms,
    });
  }

  function submitCampaign() {
    if (compose.title.trim().length < 2) return void toast.error("Add a title");
    if (compose.message.trim().length < 5) return void toast.error("Write the message");
    if (compose.schedule && !compose.scheduledFor) return void toast.error("Pick when to send it");
    sendCampaign.mutate();
  }

  const subscribersOnly = compose.audience === "subscribers";

  return (
    <div className="space-y-4">
      <SectionCard
        title="Delivery channels"
        description="How notifications reach people right now."
      >
        <TabState
          isLoading={channels.isLoading}
          error={channels.error}
          onRetry={() => void channels.refetch()}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <ChannelCard icon={Mail} label="Email" channel={channels.data?.email} />
            <ChannelCard icon={MessageSquare} label="SMS" channel={channels.data?.sms} />
            <ChannelCard icon={BellRing} label="In-app" channel={channels.data?.inApp} />
          </div>
          {canEditTemplates && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="Send a test email" htmlFor="test-email">
                <div className="flex gap-2">
                  <Input
                    id="test-email"
                    type="email"
                    value={testEmail}
                    onChange={(event) => setTestEmail(event.target.value)}
                    className="rounded-xl"
                  />
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={emailTest.isPending}
                    onClick={() => emailTest.mutate()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </Field>
              <Field label="Send a test SMS" htmlFor="test-sms">
                <div className="flex gap-2">
                  <Input
                    id="test-sms"
                    type="tel"
                    placeholder="+971 50 123 4567"
                    value={testPhone}
                    onChange={(event) => setTestPhone(event.target.value)}
                    className="rounded-xl"
                  />
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={smsTest.isPending}
                    onClick={() => smsTest.mutate()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </Field>
            </div>
          )}
        </TabState>
      </SectionCard>

      {canEditTemplates && (
        <SectionCard
          title="Automatic notifications"
          description="The wording and channels for messages the store sends on its own. In-app notifications always go out; each person's own email and SMS settings still apply."
        >
          <TabState
            isLoading={templates.isLoading}
            error={templates.error}
            onRetry={() => void templates.refetch()}
          >
            <TableScroll>
              <thead>
                <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="py-2 pr-3 font-bold">Notification</th>
                  <th className="py-2 pr-3 font-bold">Message</th>
                  <th className="py-2 pr-3 font-bold">Email</th>
                  <th className="py-2 pr-3 font-bold">SMS</th>
                  <th className="py-2 font-bold">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(templates.data ?? []).map((template) => (
                  <tr key={template.key}>
                    <td className="py-2.5 pr-3 align-top">
                      <span className="block font-semibold">{template.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        To {template.audience.toLowerCase()}s
                        {template.customised ? " · customised" : ""}
                      </span>
                    </td>
                    <td className="max-w-[420px] py-2.5 pr-3 align-top text-xs text-muted-foreground">
                      <span className="block font-medium text-foreground">
                        {render(template.title)}
                      </span>
                      {render(template.message)}
                    </td>
                    <td className="py-2.5 pr-3 align-top text-xs">
                      {template.email ? "On" : "Off"}
                    </td>
                    <td className="py-2.5 pr-3 align-top text-xs">{template.sms ? "On" : "Off"}</td>
                    <td className="py-2.5 text-right align-top">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        aria-label={`Edit ${template.name}`}
                        onClick={() => openTemplate(template)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableScroll>
          </TabState>
        </SectionCard>
      )}

      {canRunCampaigns && (
        <SectionCard
          title="Campaigns"
          description="Promotions sent to customers who opted in to offers."
          actions={
            <Button
              className="rounded-xl"
              onClick={() => {
                setRecipients(null);
                setComposeOpen(true);
              }}
            >
              <Megaphone className="mr-1.5 h-4 w-4" /> New campaign
            </Button>
          }
        >
          <TabState
            isLoading={campaigns.isLoading}
            error={campaigns.error}
            onRetry={() => void campaigns.refetch()}
          >
            {(campaigns.data ?? []).length === 0 ? (
              <EmptyState
                icon={Megaphone}
                title="No campaigns yet"
                description="Send a promotion to customers who opted in to offers."
              />
            ) : (
              <TableScroll>
                <thead>
                  <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                    <th className="py-2 pr-3 font-bold">Campaign</th>
                    <th className="py-2 pr-3 font-bold">Audience</th>
                    <th className="py-2 pr-3 font-bold">Status</th>
                    <th className="py-2 pr-3 text-right font-bold">Recipients</th>
                    <th className="py-2 pr-3 font-bold">When</th>
                    <th className="py-2 font-bold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(campaigns.data ?? []).map((campaign) => (
                    <tr key={campaign._id}>
                      <td className="py-2.5 pr-3">
                        <span className="block font-semibold">{campaign.title}</span>
                        <span className="block max-w-[320px] truncate text-[11px] text-muted-foreground">
                          {campaign.message}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-xs">{audienceLabel(campaign)}</td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge status={campaign.status} />
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {campaign.status === "Sent" ? campaign.recipientCount : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                        {formatDateTime(
                          campaign.sentAt ?? campaign.scheduledFor ?? campaign.createdAt,
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {campaign.status === "Scheduled" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg text-destructive"
                            disabled={cancelCampaign.isPending}
                            onClick={() => cancelCampaign.mutate(campaign._id)}
                          >
                            Cancel
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableScroll>
            )}
          </TabState>
        </SectionCard>
      )}

      <FormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        size="lg"
        title={editing?.name ?? "Notification"}
        description={`Sent to ${editing?.audience.toLowerCase() ?? "customer"}s. Placeholders in {{braces}} are filled in when it's sent.`}
        submitLabel="Save notification"
        pending={saveTemplate.isPending}
        onSubmit={() => saveTemplate.mutate()}
        footerExtra={
          editing?.customised ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 underline underline-offset-4"
              onClick={() => editing && resetTemplate.mutate(editing.key)}
            >
              <RotateCcw className="h-3 w-3" /> Reset to default
            </button>
          ) : undefined
        }
      >
        <Field label="Title" htmlFor="tpl-title" required>
          <Input
            id="tpl-title"
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            className="rounded-xl"
          />
        </Field>
        <Field label="Message" htmlFor="tpl-message" required>
          <Textarea
            id="tpl-message"
            rows={3}
            value={draft.message}
            onChange={(event) => setDraft({ ...draft, message: event.target.value })}
            className="rounded-xl"
          />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {editing?.variables.map((name) => (
            <button
              key={name}
              type="button"
              className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] hover:bg-accent"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  message: `${current.message} {{${name}}}`.trim(),
                }))
              }
            >
              {`{{${name}}}`}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
            Also send by email
            <Switch
              checked={draft.email}
              onCheckedChange={(checked) => setDraft({ ...draft, email: checked })}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
            Also send by SMS
            <Switch
              checked={draft.sms}
              onCheckedChange={(checked) => setDraft({ ...draft, sms: checked })}
            />
          </label>
        </div>
        <div className="rounded-xl bg-muted/60 p-3">
          <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            Preview
          </p>
          <p className="mt-1 text-sm font-semibold">{render(draft.title)}</p>
          <p className="text-sm text-muted-foreground">{render(draft.message)}</p>
        </div>
      </FormDialog>

      <FormDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        size="lg"
        title="New campaign"
        description="Only customers who switched on offers and promotions receive it."
        submitLabel={compose.schedule ? "Schedule campaign" : "Send now"}
        pending={sendCampaign.isPending}
        onSubmit={submitCampaign}
        footerExtra={
          recipients === null
            ? "Counting recipients…"
            : `${recipients} recipient${recipients === 1 ? "" : "s"}`
        }
      >
        <Field label="Title" htmlFor="cmp-title" required>
          <Input
            id="cmp-title"
            value={compose.title}
            maxLength={120}
            onChange={(event) => setCompose({ ...compose, title: event.target.value })}
            placeholder="Weekend flash sale: up to 50% off"
            className="rounded-xl"
          />
        </Field>
        <Field label="Message" htmlFor="cmp-message" required>
          <Textarea
            id="cmp-message"
            rows={3}
            maxLength={600}
            value={compose.message}
            onChange={(event) => setCompose({ ...compose, message: event.target.value })}
            className="rounded-xl"
          />
        </Field>
        <Field
          label="Link (optional)"
          htmlFor="cmp-link"
          hint="A store path like /search?flash=true, or a full https:// address."
        >
          <Input
            id="cmp-link"
            value={compose.link}
            onChange={(event) => setCompose({ ...compose, link: event.target.value })}
            className="rounded-xl"
          />
        </Field>
        <Field
          label="Audience"
          htmlFor="cmp-audience"
          hint={AUDIENCES.find((entry) => entry.value === compose.audience)?.hint}
        >
          <select
            id="cmp-audience"
            className={SELECT_CLASS}
            value={compose.audience}
            onChange={(event) =>
              setCompose({ ...compose, audience: event.target.value as AudienceType })
            }
          >
            {AUDIENCES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </Field>
        {compose.audience === "emirate" && (
          <Field label="Emirate" htmlFor="cmp-emirate">
            <select
              id="cmp-emirate"
              className={SELECT_CLASS}
              value={compose.emirate}
              onChange={(event) => setCompose({ ...compose, emirate: event.target.value })}
            >
              {EMIRATES.map((emirate) => (
                <option key={emirate} value={emirate}>
                  {emirate}
                </option>
              ))}
            </select>
          </Field>
        )}
        {["recent_buyers", "lapsed"].includes(compose.audience) && (
          <Field label="Period (days)" htmlFor="cmp-days">
            <Input
              id="cmp-days"
              type="number"
              min={1}
              max={365}
              value={compose.days}
              onChange={(event) => setCompose({ ...compose, days: event.target.value })}
              className="max-w-[140px] rounded-xl"
            />
          </Field>
        )}
        <div
          className={cn(
            "grid gap-2 sm:grid-cols-2",
            subscribersOnly && "pointer-events-none opacity-50",
          )}
        >
          <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
            Email
            <Switch
              checked={subscribersOnly || compose.email}
              onCheckedChange={(checked) => setCompose({ ...compose, email: checked })}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
            SMS
            <Switch
              checked={!subscribersOnly && compose.sms}
              onCheckedChange={(checked) => setCompose({ ...compose, sms: checked })}
            />
          </label>
        </div>
        <Note>
          {subscribersOnly
            ? "Newsletter subscribers get an email with an unsubscribe link."
            : "Customers also see it in their in-app notifications."}
        </Note>
        <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
          Schedule for later
          <Switch
            checked={compose.schedule}
            onCheckedChange={(checked) => setCompose({ ...compose, schedule: checked })}
          />
        </label>
        {compose.schedule && (
          <Field label="Send at" htmlFor="cmp-when">
            <Input
              id="cmp-when"
              type="datetime-local"
              value={compose.scheduledFor}
              onChange={(event) => setCompose({ ...compose, scheduledFor: event.target.value })}
              className="max-w-[260px] rounded-xl"
            />
          </Field>
        )}
      </FormDialog>
    </div>
  );
}

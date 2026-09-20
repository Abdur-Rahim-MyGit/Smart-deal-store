import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, ImageOff, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/dashboard/dashboard-shell";
import { EmptyState } from "@/components/common/empty-state";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Banner } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ConfirmDialog,
  Field,
  FormDialog,
  GridSkeleton,
  Note,
  SELECT_CLASS,
  TabState,
  adminRetry,
  fromLocalInput,
  numberField,
  toLocalInput,
} from "@/components/admin/people-shared";

const POSITIONS: Array<Banner["position"]> = [
  "Hero Carousel",
  "Promo Grid",
  "Sidebar",
  "Flash Sale Banner",
];

const POSITION_COPY: Record<Banner["position"], string> = {
  "Hero Carousel": "The full-width slider at the top of the home page.",
  "Promo Grid": "The smaller promo tiles further down the home page.",
  Sidebar: "Narrow slot beside category and search results on desktop. Shows the first live one.",
  "Flash Sale Banner":
    "Strip above the flash deals rail, shown while flash deals are live. Shows the first live one.",
};

interface BannerForm {
  title: string;
  subtitle: string;
  eyebrow: string;
  ctaLabel: string;
  imageUrl: string;
  linkUrl: string;
  position: Banner["position"];
  tone: "light" | "dark";
  startDate: string;
  endDate: string;
  order: string;
  isActive: boolean;
}

const BLANK: BannerForm = {
  title: "",
  subtitle: "",
  eyebrow: "",
  ctaLabel: "Shop now",
  imageUrl: "",
  linkUrl: "/",
  position: "Hero Carousel",
  tone: "dark",
  startDate: "",
  endDate: "",
  order: "0",
  isActive: true,
};

const isUrl = (value: string) => /^(https?:\/\/|\/)/.test(value.trim());

export function BannersTab() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState<BannerForm>(BLANK);
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null);

  const query = useQuery({
    queryKey: ["admin-banners"],
    queryFn: () => api<{ banners: Banner[] }>("/admin/banners"),
    retry: adminRetry,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
    void queryClient.invalidateQueries({ queryKey: ["home"] });
    void queryClient.invalidateQueries({ queryKey: ["banners"] });
  }

  const save = useMutation({
    mutationFn: (input: { id?: string | undefined; body: Record<string, unknown> }) =>
      input.id
        ? api<{ message: string }>(`/admin/banners/${input.id}`, {
            method: "PUT",
            body: input.body,
          })
        : api<{ message: string }>("/admin/banners", { method: "POST", body: input.body }),
    onSuccess: (response) => {
      toast.success(response.message || "Banner saved");
      setFormOpen(false);
      setEditing(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/admin/banners/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Banner deleted");
      setDeleteTarget(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function openCreate(position?: Banner["position"]) {
    setEditing(null);
    setForm({ ...BLANK, ...(position ? { position } : {}) });
    setFormOpen(true);
  }

  function openEdit(banner: Banner) {
    setEditing(banner);
    setForm({
      title: banner.title,
      subtitle: banner.subtitle ?? "",
      eyebrow: banner.eyebrow ?? "",
      ctaLabel: banner.ctaLabel ?? "",
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl ?? "",
      position: banner.position,
      tone: banner.tone,
      startDate: toLocalInput(banner.startDate),
      endDate: toLocalInput(banner.endDate),
      order: String(banner.order ?? 0),
      isActive: banner.isActive,
    });
    setFormOpen(true);
  }

  function submit() {
    if (!form.title.trim()) {
      toast.error("Give the banner a title");
      return;
    }
    if (!isUrl(form.imageUrl)) {
      toast.error("The image URL must start with https:// or /");
      return;
    }
    if (form.linkUrl.trim() && !isUrl(form.linkUrl)) {
      toast.error("The link must start with https:// or /");
      return;
    }
    const start = fromLocalInput(form.startDate);
    const end = fromLocalInput(form.endDate);
    if (start && end && new Date(end) <= new Date(start)) {
      toast.error("The end date must be after the start date");
      return;
    }

    save.mutate({
      id: editing?._id,
      body: {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        eyebrow: form.eyebrow.trim(),
        ctaLabel: form.ctaLabel.trim(),
        imageUrl: form.imageUrl.trim(),
        linkUrl: form.linkUrl.trim(),
        position: form.position,
        tone: form.tone,
        startDate: start,
        endDate: end,
        order: numberField(form.order) ?? 0,
        isActive: form.isActive,
      },
    });
  }

  const banners = query.data?.banners ?? [];

  return (
    <div className="space-y-4">
      <SectionCard
        title="Banners"
        description="Artwork and copy for the storefront's promotional slots."
        actions={
          <Button className="rounded-xl" onClick={() => openCreate()}>
            <Plus className="mr-1.5 h-4 w-4" /> New banner
          </Button>
        }
      >
        <div className="space-y-5">
          <TabState
            isLoading={query.isLoading}
            error={query.error}
            onRetry={() => void query.refetch()}
            skeleton={<GridSkeleton count={4} />}
          >
            {banners.length === 0 ? (
              <EmptyState
                icon={ImageOff}
                title="No banners yet"
                description="Add a hero banner and it appears on the home page straight away."
                action={
                  <Button className="rounded-xl" onClick={() => openCreate()}>
                    <Plus className="mr-1.5 h-4 w-4" /> New banner
                  </Button>
                }
              />
            ) : (
              POSITIONS.filter((position) =>
                banners.some((banner) => banner.position === position),
              ).map((position) => (
                <section key={position} className="space-y-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h3 className="font-display text-sm font-bold">{position}</h3>
                      <p className="text-[11px] text-muted-foreground">{POSITION_COPY[position]}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => openCreate(position)}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Add here
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {banners
                      .filter((banner) => banner.position === position)
                      .map((banner) => (
                        <BannerCard
                          key={banner._id}
                          banner={banner}
                          onEdit={() => openEdit(banner)}
                          onDelete={() => setDeleteTarget(banner)}
                        />
                      ))}
                  </div>
                </section>
              ))
            )}
          </TabState>

          <Note>
            Active "Hero Carousel" banners show on the home page as soon as you save — within their
            schedule, if you set one. Sort order runs low to high inside each slot.
          </Note>
        </div>
      </SectionCard>

      <FormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        size="lg"
        title={editing ? `Edit “${editing.title}”` : "New banner"}
        submitLabel={editing ? "Save banner" : "Publish banner"}
        pending={save.isPending}
        onSubmit={submit}
      >
        <Field
          label="Image URL"
          htmlFor="banner-image"
          required
          hint="Must start with https:// or / for a local asset."
        >
          <Input
            id="banner-image"
            value={form.imageUrl}
            onChange={(event) =>
              setForm((current) => ({ ...current, imageUrl: event.target.value }))
            }
            placeholder="https://images.example.com/hero.jpg"
            className="rounded-xl"
          />
        </Field>

        <BannerPreview form={form} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Eyebrow" htmlFor="banner-eyebrow" hint="Small label above the title.">
            <Input
              id="banner-eyebrow"
              value={form.eyebrow}
              onChange={(event) =>
                setForm((current) => ({ ...current, eyebrow: event.target.value }))
              }
              placeholder="Beauty Week"
              className="rounded-xl"
            />
          </Field>
          <Field label="CTA label" htmlFor="banner-cta">
            <Input
              id="banner-cta"
              value={form.ctaLabel}
              onChange={(event) =>
                setForm((current) => ({ ...current, ctaLabel: event.target.value }))
              }
              placeholder="Shop now"
              className="rounded-xl"
            />
          </Field>
        </div>

        <Field label="Title" htmlFor="banner-title" required>
          <Input
            id="banner-title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Glow season: up to 40% off skincare"
            className="rounded-xl"
          />
        </Field>

        <Field label="Subtitle" htmlFor="banner-subtitle">
          <Textarea
            id="banner-subtitle"
            rows={2}
            value={form.subtitle}
            onChange={(event) =>
              setForm((current) => ({ ...current, subtitle: event.target.value }))
            }
            className="rounded-xl"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Link URL"
            htmlFor="banner-link"
            hint="Where the banner sends shoppers, e.g. /category/skincare."
          >
            <Input
              id="banner-link"
              value={form.linkUrl}
              onChange={(event) =>
                setForm((current) => ({ ...current, linkUrl: event.target.value }))
              }
              className="rounded-xl"
            />
          </Field>
          <Field label="Position" htmlFor="banner-position" hint={POSITION_COPY[form.position]}>
            <select
              id="banner-position"
              className={SELECT_CLASS}
              value={form.position}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  position: event.target.value as Banner["position"],
                }))
              }
            >
              {POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Tone"
            htmlFor="banner-tone"
            hint="Controls the overlay behind the text: pick “dark” for light artwork and “light” for dark artwork, so the copy stays readable."
          >
            <select
              id="banner-tone"
              className={SELECT_CLASS}
              value={form.tone}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  tone: event.target.value === "light" ? "light" : "dark",
                }))
              }
            >
              <option value="dark">Dark overlay · light text</option>
              <option value="light">Light overlay · dark text</option>
            </select>
          </Field>
          <Field
            label="Sort order"
            htmlFor="banner-order"
            hint="Lower numbers appear first in the slot."
          >
            <Input
              id="banner-order"
              type="number"
              value={form.order}
              onChange={(event) =>
                setForm((current) => ({ ...current, order: event.target.value }))
              }
              className="rounded-xl"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Schedule start"
            htmlFor="banner-start"
            hint="Leave blank to show it immediately."
          >
            <Input
              id="banner-start"
              type="datetime-local"
              value={form.startDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, startDate: event.target.value }))
              }
              className="rounded-xl"
            />
          </Field>
          <Field
            label="Schedule end"
            htmlFor="banner-end"
            hint="Leave blank to run it until you deactivate it."
          >
            <Input
              id="banner-end"
              type="datetime-local"
              value={form.endDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, endDate: event.target.value }))
              }
              className="rounded-xl"
            />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-2.5">
          <div>
            <Label htmlFor="banner-active" className="text-xs font-bold">
              Active
            </Label>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Active banners in the "Hero Carousel" slot appear on the home page immediately.
            </p>
          </div>
          <Switch
            id="banner-active"
            checked={form.isActive}
            onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
          />
        </div>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this banner?"
        confirmLabel="Delete banner"
        pending={remove.isPending}
        description={
          <>
            <p>
              <strong className="text-foreground">{deleteTarget?.title}</strong> disappears from the{" "}
              {deleteTarget?.position.toLowerCase()} slot right away. This can't be undone.
            </p>
            <p>To hide it temporarily, edit the banner and switch it to inactive instead.</p>
          </>
        }
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget._id)}
      />
    </div>
  );
}

function BannerCard({
  banner,
  onEdit,
  onDelete,
}: {
  banner: Banner;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="relative aspect-[16/7] bg-muted">
        <img src={banner.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        <div
          className={cn(
            "absolute inset-0 flex flex-col justify-end gap-0.5 p-3",
            banner.tone === "dark"
              ? "bg-gradient-to-t from-black/70 to-transparent text-white"
              : "bg-gradient-to-t from-white/80 to-transparent text-slate-900",
          )}
        >
          {banner.eyebrow && (
            <p className="text-[10px] font-bold tracking-wide uppercase">{banner.eyebrow}</p>
          )}
          <p className="line-clamp-2 text-xs font-bold">{banner.title}</p>
        </div>
        <span
          className={cn(
            "absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold",
            banner.isActive ? "bg-success text-white" : "bg-slate-700 text-white",
          )}
        >
          {banner.isActive ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="space-y-2 p-3">
        <dl className="space-y-0.5 text-[11px] text-muted-foreground">
          <div className="flex justify-between gap-2">
            <dt>Link</dt>
            <dd className="truncate font-medium text-foreground">{banner.linkUrl || "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Order</dt>
            <dd className="font-medium text-foreground">{banner.order}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Schedule</dt>
            <dd className="font-medium text-foreground">
              {banner.startDate || banner.endDate
                ? `${banner.startDate ? formatDate(banner.startDate) : "Now"} → ${banner.endDate ? formatDate(banner.endDate) : "Open"}`
                : "Always on"}
            </dd>
          </div>
        </dl>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 rounded-lg" onClick={onEdit}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg text-destructive"
            aria-label={`Delete ${banner.title}`}
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </article>
  );
}

/** Live preview so admins can check the artwork and overlay before saving. */
function BannerPreview({ form }: { form: BannerForm }) {
  const valid = isUrl(form.imageUrl);
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="relative aspect-[16/6] bg-muted">
        {valid ? (
          <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
            <p className="text-[11px]">Paste an image URL to preview the banner</p>
          </div>
        )}
        {valid && (
          <div
            className={cn(
              "absolute inset-0 flex flex-col justify-center gap-1 p-4",
              form.tone === "dark"
                ? "bg-gradient-to-r from-black/70 to-transparent text-white"
                : "bg-gradient-to-r from-white/85 to-transparent text-slate-900",
            )}
          >
            {form.eyebrow && (
              <p className="text-[10px] font-bold tracking-wide uppercase">{form.eyebrow}</p>
            )}
            <p className="font-display max-w-[70%] text-sm font-extrabold">
              {form.title || "Banner title"}
            </p>
            {form.subtitle && <p className="max-w-[60%] text-[11px] opacity-90">{form.subtitle}</p>}
            {form.ctaLabel && (
              <span
                className={cn(
                  "mt-1 w-fit rounded-full px-2.5 py-1 text-[10px] font-bold",
                  form.tone === "dark" ? "bg-white text-slate-900" : "bg-slate-900 text-white",
                )}
              >
                {form.ctaLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

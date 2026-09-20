import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/dashboard/dashboard-shell";
import { EmptyState } from "@/components/common/empty-state";
import { RichText } from "@/components/common/rich-text";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { CmsPage } from "@/lib/types";
import {
  ConfirmDialog,
  DataTable,
  Field,
  Note,
  SELECT_CLASS,
  TabState,
  adminRetry,
  numberField,
} from "@/components/admin/people-shared";

const FOOTER_GROUPS: Array<CmsPage["footerGroup"]> = ["Help", "Company", "Policies", "None"];

const FORMATTING_HINT =
  'Write "## " at the start of a line for a heading, "- " for a bullet, and leave a blank line between paragraphs.';

interface PageForm {
  title: string;
  slug: string;
  summary: string;
  content: string;
  titleAr: string;
  summaryAr: string;
  contentAr: string;
  footerGroup: CmsPage["footerGroup"];
  sortOrder: string;
  isPublished: boolean;
}

const BLANK: PageForm = {
  title: "",
  slug: "",
  summary: "",
  content: "",
  titleAr: "",
  summaryAr: "",
  contentAr: "",
  footerGroup: "None",
  sortOrder: "0",
  isPublished: true,
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export function PagesTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CmsPage | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PageForm>(BLANK);
  const [deleteTarget, setDeleteTarget] = useState<CmsPage | null>(null);
  const [previewLang, setPreviewLang] = useState<"en" | "ar">("en");

  const query = useQuery({
    queryKey: ["admin-pages"],
    queryFn: () => api<{ pages: CmsPage[] }>("/admin/pages"),
    retry: adminRetry,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
    void queryClient.invalidateQueries({ queryKey: ["cms-pages"] });
    void queryClient.invalidateQueries({ queryKey: ["page"] });
  }

  const save = useMutation({
    mutationFn: (input: { id?: string | undefined; body: Record<string, unknown> }) =>
      input.id
        ? api<{ message: string }>(`/admin/pages/${input.id}`, { method: "PUT", body: input.body })
        : api<{ message: string }>("/admin/pages", { method: "POST", body: input.body }),
    onSuccess: (response) => {
      toast.success(response.message || "Page saved");
      closeEditor();
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/admin/pages/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Page deleted");
      setDeleteTarget(null);
      closeEditor();
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function closeEditor() {
    setEditing(null);
    setCreating(false);
  }

  function openCreate() {
    setEditing(null);
    setCreating(true);
    setForm(BLANK);
    setPreviewLang("en");
  }

  function openEdit(page: CmsPage) {
    setCreating(false);
    setEditing(page);
    setForm({
      title: page.title,
      slug: page.slug,
      summary: page.summary ?? "",
      content: page.content ?? "",
      titleAr: page.titleAr ?? "",
      summaryAr: page.summaryAr ?? "",
      contentAr: page.contentAr ?? "",
      footerGroup: page.footerGroup,
      sortOrder: String(page.sortOrder ?? 0),
      isPublished: page.isPublished !== false,
    });
  }

  function submit() {
    if (!form.title.trim()) {
      toast.error("Give the page a title");
      return;
    }
    const slug = slugify(form.slug || form.title);
    if (!slug) {
      toast.error("The page needs a URL slug");
      return;
    }
    if (form.contentAr.trim() && !form.titleAr.trim()) {
      toast.error("Add an Arabic title to go with the Arabic content");
      return;
    }
    save.mutate({
      id: editing?._id,
      body: {
        title: form.title.trim(),
        slug,
        summary: form.summary.trim(),
        content: form.content,
        titleAr: form.titleAr.trim(),
        summaryAr: form.summaryAr.trim(),
        contentAr: form.contentAr,
        footerGroup: form.footerGroup,
        sortOrder: numberField(form.sortOrder) ?? 0,
        isPublished: form.isPublished,
      },
    });
  }

  const pages = query.data?.pages ?? [];
  const inEditor = creating || Boolean(editing);

  if (inEditor) {
    const previewSlug = slugify(form.slug || form.title);
    return (
      <div className="space-y-4">
        <SectionCard
          title={editing ? `Edit “${editing.title}”` : "New content page"}
          description={
            editing ? `/pages/${editing.slug}` : "Published pages can be linked from the footer."
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" className="rounded-xl" onClick={closeEditor}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to list
              </Button>
              {editing && (
                <Button asChild variant="outline" className="rounded-xl">
                  <Link to="/pages/$slug" params={{ slug: editing.slug }} target="_blank">
                    <ExternalLink className="mr-1.5 h-4 w-4" /> View page
                  </Link>
                </Button>
              )}
              <Button className="rounded-xl" disabled={save.isPending} onClick={submit}>
                {save.isPending ? "Saving…" : "Save page"}
              </Button>
            </div>
          }
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Title" htmlFor="page-title" required>
                  <Input
                    id="page-title"
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, title: event.target.value }))
                    }
                    className="rounded-xl"
                  />
                </Field>
                <Field
                  label="URL slug"
                  htmlFor="page-slug"
                  hint={
                    previewSlug
                      ? `Lives at /pages/${previewSlug}`
                      : "Generated from the title if left blank."
                  }
                >
                  <Input
                    id="page-slug"
                    value={form.slug}
                    placeholder={slugify(form.title)}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, slug: event.target.value }))
                    }
                    className="rounded-xl font-mono"
                  />
                </Field>
              </div>

              <Field
                label="Summary"
                htmlFor="page-summary"
                hint="One line shown under the page title."
              >
                <Textarea
                  id="page-summary"
                  rows={2}
                  value={form.summary}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, summary: event.target.value }))
                  }
                  className="rounded-xl"
                />
              </Field>

              <Field label="Content" htmlFor="page-content" hint={FORMATTING_HINT}>
                <Textarea
                  id="page-content"
                  rows={16}
                  value={form.content}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, content: event.target.value }))
                  }
                  placeholder={
                    "## Returns\n\nWe accept returns within 14 days.\n\n- Keep the original packaging\n- Refunds land in your wallet"
                  }
                  className="rounded-xl font-mono text-xs leading-relaxed"
                />
              </Field>

              <fieldset className="space-y-3 rounded-xl border border-border p-3">
                <legend className="px-1 text-xs font-bold">Arabic version (optional)</legend>
                <p className="text-[11px] text-muted-foreground">
                  Shoppers can switch the page to Arabic. It reads right to left and uses the same
                  formatting. Leave it empty to show the page in English only.
                </p>
                <Field label="Arabic title" htmlFor="page-title-ar">
                  <Input
                    id="page-title-ar"
                    dir="rtl"
                    lang="ar"
                    value={form.titleAr}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, titleAr: event.target.value }))
                    }
                    className="rounded-xl"
                  />
                </Field>
                <Field label="Arabic summary" htmlFor="page-summary-ar">
                  <Textarea
                    id="page-summary-ar"
                    dir="rtl"
                    lang="ar"
                    rows={2}
                    value={form.summaryAr}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, summaryAr: event.target.value }))
                    }
                    className="rounded-xl"
                  />
                </Field>
                <Field label="Arabic content" htmlFor="page-content-ar">
                  <Textarea
                    id="page-content-ar"
                    dir="rtl"
                    lang="ar"
                    rows={10}
                    value={form.contentAr}
                    onFocus={() => setPreviewLang("ar")}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, contentAr: event.target.value }))
                    }
                    className="rounded-xl font-mono text-xs leading-relaxed"
                  />
                </Field>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Footer group"
                  htmlFor="page-group"
                  hint="Which footer column links to this page. “None” keeps it unlinked."
                >
                  <select
                    id="page-group"
                    className={SELECT_CLASS}
                    value={form.footerGroup}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        footerGroup: event.target.value as CmsPage["footerGroup"],
                      }))
                    }
                  >
                    {FOOTER_GROUPS.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Sort order"
                  htmlFor="page-order"
                  hint="Lower numbers appear higher in the footer column."
                >
                  <Input
                    id="page-order"
                    type="number"
                    value={form.sortOrder}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, sortOrder: event.target.value }))
                    }
                    className="rounded-xl"
                  />
                </Field>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-2.5">
                <div>
                  <Label htmlFor="page-published" className="text-xs font-bold">
                    Published
                  </Label>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Unpublished pages return a "not found" on the storefront.
                  </p>
                </div>
                <Switch
                  id="page-published"
                  checked={form.isPublished}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, isPublished: checked }))
                  }
                />
              </div>

              {editing && (
                <Button
                  variant="outline"
                  className="rounded-xl text-destructive"
                  onClick={() => setDeleteTarget(editing)}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Delete this page
                </Button>
              )}
            </div>

            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  Live preview
                </p>
                <div
                  role="group"
                  aria-label="Preview language"
                  className="inline-flex rounded-lg border border-border p-0.5 text-xs"
                >
                  {(["en", "ar"] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      aria-pressed={previewLang === lang}
                      onClick={() => setPreviewLang(lang)}
                      className={
                        previewLang === lang
                          ? "rounded-md bg-primary px-2.5 py-1 font-semibold text-primary-foreground"
                          : "rounded-md px-2.5 py-1 text-muted-foreground"
                      }
                    >
                      {lang === "en" ? "English" : "العربية"}
                    </button>
                  ))}
                </div>
              </div>
              {previewLang === "en" ? (
                <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-background p-5">
                  <h1 className="font-display text-2xl font-extrabold">
                    {form.title || "Page title"}
                  </h1>
                  {form.summary && (
                    <p className="mt-1.5 text-sm text-muted-foreground">{form.summary}</p>
                  )}
                  <div className="mt-4">
                    {form.content.trim() ? (
                      <RichText content={form.content} />
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Start typing in the content box to see the formatted page here.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  dir="rtl"
                  lang="ar"
                  className="max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-background p-5"
                >
                  <h1 className="font-display text-2xl font-extrabold">
                    {form.titleAr || "عنوان الصفحة"}
                  </h1>
                  {form.summaryAr && (
                    <p className="mt-1.5 text-sm text-muted-foreground">{form.summaryAr}</p>
                  )}
                  <div className="mt-4">
                    {form.contentAr.trim() ? (
                      <RichText content={form.contentAr} />
                    ) : (
                      <p dir="ltr" className="text-sm text-muted-foreground italic">
                        No Arabic content yet. The page shows in English only.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Delete this page?"
          confirmLabel="Delete page"
          pending={remove.isPending}
          description={
            <>
              <p>
                <strong className="text-foreground">{deleteTarget?.title}</strong> and its URL{" "}
                <span className="font-mono">/pages/{deleteTarget?.slug}</span> stop working
                immediately, including any footer links pointing at it.
              </p>
              <p>To take it offline temporarily, switch it to unpublished instead.</p>
            </>
          }
          onConfirm={() => deleteTarget && remove.mutate(deleteTarget._id)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Content pages"
        description="About, FAQ and policy pages linked from the storefront footer."
        actions={
          <Button className="rounded-xl" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> New page
          </Button>
        }
      >
        <div className="space-y-4">
          <TabState
            isLoading={query.isLoading}
            error={query.error}
            onRetry={() => void query.refetch()}
          >
            {pages.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No content pages yet"
                description="Add your policies and help articles so the footer has something to link to."
                action={
                  <Button className="rounded-xl" onClick={openCreate}>
                    <Plus className="mr-1.5 h-4 w-4" /> New page
                  </Button>
                }
              />
            ) : (
              <DataTable
                rows={pages}
                rowKey={(row) => row._id}
                onRowClick={openEdit}
                columns={[
                  {
                    key: "title",
                    header: "Page",
                    cell: (row) => (
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {row.title}
                          {row.contentAr?.trim() && (
                            <span className="ms-2 rounded bg-muted px-1.5 py-0.5 align-middle text-[10px] font-bold text-muted-foreground">
                              EN · AR
                            </span>
                          )}
                        </p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          /pages/{row.slug}
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: "group",
                    header: "Footer group",
                    cell: (row) => (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">
                        {row.footerGroup}
                      </span>
                    ),
                  },
                  {
                    key: "order",
                    header: "Order",
                    className: "text-right tabular-nums",
                    cell: (row) => row.sortOrder,
                  },
                  {
                    key: "published",
                    header: "Published",
                    cell: (row) =>
                      row.isPublished !== false ? (
                        <span className="rounded-full bg-success/12 px-2.5 py-0.5 text-[11px] font-semibold text-success">
                          Live
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          Draft
                        </span>
                      ),
                  },
                  {
                    key: "updated",
                    header: "Updated",
                    className: "whitespace-nowrap",
                    cell: (row) => (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(row.updatedAt)}
                      </span>
                    ),
                  },
                  {
                    key: "actions",
                    header: <span className="sr-only">Actions</span>,
                    className: "text-right",
                    cell: (row) => (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          aria-label={`Edit ${row.title}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(row);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-destructive"
                          aria-label={`Delete ${row.title}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteTarget(row);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ),
                  },
                ]}
                card={(row) => (
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{row.title}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          /pages/{row.slug}
                        </p>
                      </div>
                      <span
                        className={
                          row.isPublished !== false
                            ? "rounded-full bg-success/12 px-2 py-0.5 text-[10px] font-bold text-success"
                            : "rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground"
                        }
                      >
                        {row.isPublished !== false ? "Live" : "Draft"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {row.footerGroup} · order {row.sortOrder} · updated{" "}
                      {formatDate(row.updatedAt)}
                    </p>
                  </div>
                )}
              />
            )}
          </TabState>

          <Note>
            {FORMATTING_HINT} The editor shows a live preview of exactly how the page will read.
          </Note>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this page?"
        confirmLabel="Delete page"
        pending={remove.isPending}
        description={
          <>
            <p>
              <strong className="text-foreground">{deleteTarget?.title}</strong> and its URL{" "}
              <span className="font-mono">/pages/{deleteTarget?.slug}</span> stop working
              immediately, including any footer links pointing at it.
            </p>
            <p>To take it offline temporarily, switch it to unpublished instead.</p>
          </>
        }
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget._id)}
      />
    </div>
  );
}

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/common/status-badge";
import { flattenDescendants, useCategories } from "@/hooks/use-categories";
import { api, errorMessage } from "@/lib/api";
import type { Product, ProductStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ImageUploader } from "@/components/common/image-uploader";

interface VariantRow {
  key: string;
  _id?: string | undefined;
  sku: string;
  values: string[];
  price: string;
  mrp: string;
  stock: string;
  lowStockThreshold: string;
  weightKg: string;
}

interface SpecRow {
  key: string;
  name: string;
  value: string;
}

type FieldErrors = {
  [K in "title" | "brand" | "category" | "description" | "images" | "variants"]?:
    string | undefined;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const refId = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "_id" in value)
    return String((value as { _id: unknown })._id);
  return "";
};
const selectClass =
  "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function optionNamesOf(product?: Product | null): string[] {
  const names = new Set<string>();
  product?.variants.forEach((variant) =>
    Object.keys(variant.options ?? {}).forEach((name) => names.add(name)),
  );
  return [...names].slice(0, 2);
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div>
        <h3 className="font-display text-base font-bold">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export interface ProductEditorProps {
  /** Pass a product to edit it; omit to create a new one. */
  product?: Product | null | undefined;
  mode: "vendor" | "admin";
  onSaved: (product: Product) => void;
  onCancel: () => void;
}

/** Full product form (details, media, variants, specs) shared by seller and admin dashboards. */
export function ProductEditor({ product, mode, onSaved, onCancel }: ProductEditorProps) {
  const { tree, isLoading: categoriesLoading } = useCategories();
  const editing = Boolean(product);
  const initialOptions = useMemo(() => optionNamesOf(product), [product]);

  const [title, setTitle] = useState(product?.title ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [category, setCategory] = useState(refId(product?.category));
  const [subcategory, setSubcategory] = useState(refId(product?.subcategory));
  const [description, setDescription] = useState(product?.description ?? "");
  const [highlights, setHighlights] = useState((product?.highlights ?? []).join("\n"));
  const [tags, setTags] = useState((product?.tags ?? []).join(", "));
  const [returnable, setReturnable] = useState(product?.returnable ?? true);
  const [images, setImages] = useState<string[]>(
    product?.images?.length ? product.images : product?.thumbnail ? [product.thumbnail] : [],
  );
  const [imageUrl, setImageUrl] = useState("");
  const [specs, setSpecs] = useState<SpecRow[]>(() =>
    Object.entries(product?.specifications ?? {}).map(([name, value]) => ({
      key: uid(),
      name,
      value,
    })),
  );
  const [optionNames, setOptionNames] = useState<string[]>(initialOptions);
  const [variants, setVariants] = useState<VariantRow[]>(() =>
    product?.variants.length
      ? product.variants.map((variant) => ({
          key: uid(),
          _id: variant._id,
          sku: variant.sku,
          values: initialOptions.map((name) => variant.options?.[name] ?? ""),
          price: String(variant.price),
          mrp: String(variant.mrp),
          stock: String(variant.stock),
          lowStockThreshold: String(variant.lowStockThreshold ?? 5),
          weightKg: variant.weightKg === undefined ? "" : String(variant.weightKg),
        }))
      : [
          {
            key: uid(),
            sku: "",
            values: [],
            price: "",
            mrp: "",
            stock: "",
            lowStockThreshold: "5",
            weightKg: "",
          },
        ],
  );
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? "Active");
  const [saving, setSaving] = useState<null | "draft" | "submit">(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  // Subcategories and their sub-subcategories under the chosen top-level category.
  const selectedRoot = tree.find((entry) => entry._id === category);
  const subcategories = selectedRoot ? flattenDescendants(selectedRoot) : [];

  // Brands must come from the admin-managed directory.
  const brandDirectory = useQuery({
    queryKey: ["brand-directory"],
    queryFn: () =>
      api<{ brands: Array<{ _id: string; name: string }> }>("/products/brand-directory").then(
        (response) => response.brands,
      ),
    staleTime: 5 * 60 * 1000,
  });
  const brandNames = brandDirectory.data?.map((entry) => entry.name) ?? [];

  /* ---------- media ---------- */
  function addImage() {
    const url = imageUrl.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      toast.error("Paste a full image URL starting with https://");
      return;
    }
    if (images.includes(url)) {
      toast.error("That image is already added");
      return;
    }
    setImages((current) => [...current, url].slice(0, 12));
    setImageUrl("");
    setErrors((current) => ({ ...current, images: undefined }));
  }

  function moveImage(index: number, direction: -1 | 1) {
    setImages((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target] as string, next[index] as string];
      return next;
    });
  }

  /* ---------- variants ---------- */
  const updateVariant = (key: string, patch: Partial<VariantRow>) =>
    setVariants((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  function setOptionName(index: number, name: string) {
    setOptionNames((current) => {
      const next = [...current];
      next[index] = name;
      return next;
    });
  }

  function addOption() {
    if (optionNames.length >= 2) return;
    setOptionNames((current) => [...current, ""]);
  }

  function removeOption(index: number) {
    setOptionNames((current) => current.filter((_, position) => position !== index));
    setVariants((current) =>
      current.map((row) => ({
        ...row,
        values: row.values.filter((_, position) => position !== index),
      })),
    );
  }

  function generateSku(row: VariantRow): string {
    const base = `${brand.slice(0, 3)}-${title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.slice(0, 3))
      .join("")}`
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "");
    const suffix = row.values
      .filter(Boolean)
      .map((value) =>
        value
          .replace(/[^A-Za-z0-9]/g, "")
          .slice(0, 4)
          .toUpperCase(),
      )
      .join("-");
    return [
      base.replace(/^-|-$/g, "") || "SKU",
      suffix,
      Math.random().toString(36).slice(2, 5).toUpperCase(),
    ]
      .filter(Boolean)
      .join("-");
  }

  /* ---------- save ---------- */
  function validate(): string | null {
    const next: FieldErrors = {};
    if (title.trim().length < 3) next.title = "Enter a product title";
    if (!brand.trim()) next.brand = "Enter the brand name";
    else if (
      brandDirectory.data &&
      brand.trim().toLowerCase() !== (product?.brand ?? "").toLowerCase() &&
      !brandNames.some((name) => name.toLowerCase() === brand.trim().toLowerCase())
    )
      next.brand = "Choose a brand from the Smart Deal directory";
    if (!category) next.category = "Choose a category";
    if (description.trim().length < 20)
      next.description = "Describe the product in at least 20 characters";
    if (!images.length) next.images = "Add at least one product image";

    const skus = new Set<string>();
    const activeOptions = optionNames.map((name) => name.trim());
    for (const [index, row] of variants.entries()) {
      const label = variants.length > 1 ? `Variant ${index + 1}` : "Pricing";
      const sku = row.sku.trim().toUpperCase();
      const price = Number(row.price);
      const mrp = row.mrp === "" ? price : Number(row.mrp);
      const stock = Number(row.stock);
      if (!sku) next.variants = `${label}: SKU is required`;
      else if (skus.has(sku)) next.variants = `${label}: SKU ${sku} is used twice`;
      else if (!(price > 0)) next.variants = `${label}: enter a selling price`;
      else if (!(mrp >= price))
        next.variants = `${label}: original price can't be lower than the selling price`;
      else if (row.stock === "" || !Number.isInteger(stock) || stock < 0)
        next.variants = `${label}: stock must be a whole number`;
      else if (activeOptions.some((name, position) => name && !row.values[position]?.trim())) {
        next.variants = `${label}: fill in ${activeOptions.filter(Boolean).join(" / ")}`;
      }
      skus.add(sku);
      if (next.variants) break;
    }
    if (!next.variants && variants.length > 1 && !activeOptions.some(Boolean)) {
      next.variants = "Name the option that differs between variants (e.g. Size or Colour)";
    }

    setErrors(next);
    return Object.values(next).find(Boolean) ?? null;
  }

  async function save(intent: "draft" | "submit") {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }

    const payload = {
      title: title.trim(),
      brand: brand.trim(),
      category,
      subcategory: subcategory || null,
      description: description.trim(),
      highlights: highlights
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      specifications: Object.fromEntries(
        specs
          .filter((spec) => spec.name.trim() && spec.value.trim())
          .map((spec) => [spec.name.trim(), spec.value.trim()]),
      ),
      thumbnail: images[0],
      images,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      returnable,
      variants: variants.map((row) => ({
        ...(row._id ? { _id: row._id } : {}),
        sku: row.sku.trim().toUpperCase(),
        price: Number(row.price),
        mrp: row.mrp === "" ? Number(row.price) : Number(row.mrp),
        stock: Number(row.stock),
        lowStockThreshold: Number(row.lowStockThreshold || 0),
        weightKg: row.weightKg.trim() === "" ? null : Number(row.weightKg),
        options: Object.fromEntries(
          optionNames
            .map((name, index) => [name.trim(), (row.values[index] ?? "").trim()] as const)
            .filter(([name, value]) => name && value),
        ),
      })),
      ...(mode === "admin" ? { status } : intent === "draft" ? { status: "Draft" } : {}),
    };

    setSaving(intent);
    try {
      const response = product
        ? await api<{ product: Product; message: string }>(`/products/${product._id}`, {
            method: "PUT",
            body: payload,
          })
        : await api<{ product: Product; message: string }>("/products", {
            method: "POST",
            body: payload,
          });
      toast.success(response.message);
      onSaved(response.product);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(null);
    }
  }

  const fieldError = (message?: string) =>
    message ? <p className="text-xs font-medium text-destructive">{message}</p> : null;

  return (
    <div className="space-y-5">
      {product?.status && product.status !== "Active" && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <StatusBadge status={product.status} />
          {product.rejectionReason ? (
            <span>
              <span className="font-semibold">Reason:</span> {product.rejectionReason}
            </span>
          ) : product.status === "Pending Approval" ? (
            <span className="text-muted-foreground">
              This product is waiting for review by the Smart Deal team.
            </span>
          ) : null}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Section title="Product details">
            <div className="space-y-1.5">
              <Label htmlFor="pe-title">Title</Label>
              <Input
                id="pe-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-10 rounded-xl"
                placeholder="e.g. 10% Vitamin C Brightening Serum"
              />
              {fieldError(errors.title)}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pe-description">Description</Label>
              <Textarea
                id="pe-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-[130px] rounded-xl"
                placeholder="What is it, who is it for, and why will they love it?"
              />
              {fieldError(errors.description)}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pe-highlights">Key highlights (one per line)</Label>
              <Textarea
                id="pe-highlights"
                value={highlights}
                onChange={(event) => setHighlights(event.target.value)}
                className="min-h-[96px] rounded-xl"
                placeholder={"SPF 50 PA++++\nNo white cast\nSweat resistant"}
              />
            </div>
          </Section>

          <Section
            title="Images"
            description="The first image is used as the thumbnail. Upload files directly or paste public image URLs."
          >
            <div className="space-y-3">
              <ImageUploader
                multiple
                onMultipleUploaded={(urls) => setImages((current) => [...current, ...urls])}
                onUploaded={(url) => setImages((current) => [...current, url])}
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span>Or add via public URL</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="flex gap-2">
                <Input
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addImage();
                    }
                  }}
                  placeholder="https://images.example.com/product.jpg"
                  className="h-10 rounded-xl"
                />
                <Button type="button" variant="outline" className="rounded-xl" onClick={addImage}>
                  <ImagePlus className="mr-1.5 h-4 w-4" /> Add URL
                </Button>
              </div>
            </div>
            {fieldError(errors.images)}
            {images.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {images.map((image, index) => (
                  <li
                    key={image}
                    className="group relative overflow-hidden rounded-xl border border-border bg-muted"
                  >
                    <img src={image} alt="" className="aspect-square w-full object-cover" />
                    {index === 0 && (
                      <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        Thumbnail
                      </span>
                    )}
                    <div className="absolute inset-x-2 bottom-2 flex justify-between gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="h-7 w-7 rounded-lg"
                          onClick={() => moveImage(index, -1)}
                          disabled={index === 0}
                          aria-label="Move image left"
                        >
                          <ArrowUp className="h-3.5 w-3.5 -rotate-90" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="h-7 w-7 rounded-lg"
                          onClick={() => moveImage(index, 1)}
                          disabled={index === images.length - 1}
                          aria-label="Move image right"
                        >
                          <ArrowDown className="h-3.5 w-3.5 -rotate-90" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="h-7 w-7 rounded-lg"
                        onClick={() =>
                          setImages((current) => current.filter((entry) => entry !== image))
                        }
                        aria-label="Remove image"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Pricing, stock & variants"
            description="Add a row per sellable option (e.g. each size or shade). Prices are in AED before VAT."
          >
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {optionNames.map((name, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <Input
                      value={name}
                      onChange={(event) => setOptionName(index, event.target.value)}
                      placeholder={
                        index === 0 ? "Option (e.g. Size)" : "Second option (e.g. Colour)"
                      }
                      className="h-9 w-48 rounded-xl"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl"
                      onClick={() => removeOption(index)}
                      aria-label="Remove option"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {optionNames.length < 2 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={addOption}
                  >
                    <Plus className="mr-1 h-4 w-4" /> Add option
                  </Button>
                )}
              </div>
            </div>

            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    {optionNames.map((name, index) => (
                      <th key={index} className="pb-2 font-semibold">
                        {name || `Option ${index + 1}`}
                      </th>
                    ))}
                    <th className="pb-2 font-semibold">SKU</th>
                    <th className="pb-2 font-semibold">Price</th>
                    <th className="pb-2 font-semibold">Original price</th>
                    <th className="pb-2 font-semibold">Stock</th>
                    <th className="pb-2 font-semibold">Low-stock alert</th>
                    <th className="pb-2 font-semibold">Weight (kg)</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="align-top">
                  {variants.map((row) => (
                    <tr key={row.key}>
                      {optionNames.map((name, index) => (
                        <td key={index} className="pr-2 pb-2">
                          <Input
                            aria-label={name.trim() || `Option ${index + 1}`}
                            value={row.values[index] ?? ""}
                            onChange={(event) => {
                              const values = [...row.values];
                              values[index] = event.target.value;
                              updateVariant(row.key, { values });
                            }}
                            className="h-9 rounded-lg"
                          />
                        </td>
                      ))}
                      <td className="pr-2 pb-2">
                        <div className="flex gap-1">
                          <Input
                            aria-label="SKU"
                            value={row.sku}
                            onChange={(event) =>
                              updateVariant(row.key, { sku: event.target.value.toUpperCase() })
                            }
                            className="h-9 min-w-[130px] rounded-lg font-mono text-xs"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 rounded-lg"
                            title="Generate SKU"
                            aria-label="Generate SKU"
                            onClick={() => updateVariant(row.key, { sku: generateSku(row) })}
                          >
                            <Sparkles className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                      <td className="pr-2 pb-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          aria-label="Selling price (AED)"
                          value={row.price}
                          onChange={(event) =>
                            updateVariant(row.key, { price: event.target.value })
                          }
                          className="h-9 w-24 rounded-lg"
                        />
                      </td>
                      <td className="pr-2 pb-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          aria-label="Original price (AED)"
                          value={row.mrp}
                          onChange={(event) => updateVariant(row.key, { mrp: event.target.value })}
                          placeholder="Same"
                          className="h-9 w-24 rounded-lg"
                        />
                      </td>
                      <td className="pr-2 pb-2">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          aria-label="Stock"
                          value={row.stock}
                          onChange={(event) =>
                            updateVariant(row.key, { stock: event.target.value })
                          }
                          className="h-9 w-20 rounded-lg"
                        />
                      </td>
                      <td className="pr-2 pb-2">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          aria-label="Low-stock alert at"
                          value={row.lowStockThreshold}
                          onChange={(event) =>
                            updateVariant(row.key, { lowStockThreshold: event.target.value })
                          }
                          className="h-9 w-20 rounded-lg"
                        />
                      </td>
                      <td className="pr-2 pb-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="—"
                          aria-label="Shipping weight in kg"
                          value={row.weightKg}
                          onChange={(event) =>
                            updateVariant(row.key, { weightKg: event.target.value })
                          }
                          className="h-9 w-20 rounded-lg"
                        />
                      </td>
                      <td className="pb-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setVariants((current) =>
                              current.filter((entry) => entry.key !== row.key),
                            )
                          }
                          disabled={variants.length === 1}
                          aria-label="Remove variant"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {fieldError(errors.variants)}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() =>
                setVariants((current) => [
                  ...current,
                  {
                    key: uid(),
                    sku: "",
                    values: optionNames.map(() => ""),
                    price: current[current.length - 1]?.price ?? "",
                    mrp: current[current.length - 1]?.mrp ?? "",
                    stock: "",
                    lowStockThreshold: "5",
                    weightKg: "",
                  },
                ])
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Add variant
            </Button>
          </Section>

          <Section title="Specifications" description="Shown as a table on the product page.">
            <div className="space-y-2">
              {specs.map((spec) => (
                <div key={spec.key} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                  <Input
                    value={spec.name}
                    onChange={(event) =>
                      setSpecs((current) =>
                        current.map((entry) =>
                          entry.key === spec.key ? { ...entry, name: event.target.value } : entry,
                        ),
                      )
                    }
                    placeholder="e.g. Volume"
                    className="h-9 rounded-lg"
                  />
                  <Input
                    value={spec.value}
                    onChange={(event) =>
                      setSpecs((current) =>
                        current.map((entry) =>
                          entry.key === spec.key ? { ...entry, value: event.target.value } : entry,
                        ),
                      )
                    }
                    placeholder="e.g. 50 ml"
                    className="h-9 rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-lg"
                    onClick={() =>
                      setSpecs((current) => current.filter((entry) => entry.key !== spec.key))
                    }
                    aria-label="Remove specification"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() =>
                setSpecs((current) => [...current, { key: uid(), name: "", value: "" }])
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Add specification
            </Button>
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Organisation">
            <div className="space-y-1.5">
              <Label htmlFor="pe-brand">Brand</Label>
              <Input
                id="pe-brand"
                list="pe-brand-options"
                autoComplete="off"
                placeholder="Start typing to pick a brand"
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
                className="h-10 rounded-xl"
              />
              <datalist id="pe-brand-options">
                {brandNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              {fieldError(errors.brand) ?? (
                <p className="text-[11px] text-muted-foreground">
                  {mode === "admin"
                    ? "Brands come from the directory in Catalog → Brands."
                    : "Pick a listed brand. To sell a new brand, contact Smart Deal support."}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pe-category">Category</Label>
              <select
                id="pe-category"
                className={selectClass}
                value={category}
                disabled={categoriesLoading}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setSubcategory("");
                }}
              >
                <option value="">Choose a category</option>
                {tree.map((entry) => (
                  <option key={entry._id} value={entry._id}>
                    {entry.name}
                  </option>
                ))}
              </select>
              {fieldError(errors.category)}
            </div>
            {subcategories.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="pe-subcategory">Subcategory</Label>
                <select
                  id="pe-subcategory"
                  className={selectClass}
                  value={subcategory}
                  onChange={(event) => setSubcategory(event.target.value)}
                >
                  <option value="">None</option>
                  {subcategories.map(({ category: entry, depth }) => (
                    <option key={entry._id} value={entry._id}>
                      {"\u00a0\u00a0\u00a0".repeat(depth - 1)}
                      {depth > 1 ? "↳ " : ""}
                      {entry.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="pe-tags">Tags</Label>
              <Input
                id="pe-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="bestseller, vegan, gift"
                className="h-10 rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">
                Comma separated. Used in search and merchandising.
              </p>
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <Checkbox
                checked={returnable}
                onCheckedChange={(checked) => setReturnable(checked === true)}
                className="mt-0.5"
              />
              <span>
                Returnable within the return window
                <span className="block text-xs text-muted-foreground">
                  Turn off for hygiene items such as supplements.
                </span>
              </span>
            </label>
          </Section>

          {mode === "admin" && (
            <Section title="Visibility">
              <div className="space-y-1.5">
                <Label htmlFor="pe-status">Status</Label>
                <select
                  id="pe-status"
                  className={selectClass}
                  value={status}
                  onChange={(event) => setStatus(event.target.value as ProductStatus)}
                >
                  {(["Active", "Draft", "Pending Approval"] as ProductStatus[])
                    .concat(
                      product?.status === "Rejected" || product?.status === "Suspended"
                        ? [product.status]
                        : [],
                    )
                    .map((entry) => (
                      <option
                        key={entry}
                        value={entry}
                        disabled={entry === "Rejected" || entry === "Suspended"}
                      >
                        {entry}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  To reject or suspend a product, use the actions in the Products list so the seller
                  is told why.
                </p>
              </div>
            </Section>
          )}

          {mode === "vendor" && (
            <div className="rounded-2xl border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
              New products and changes to title, description or prices are reviewed by Smart Deal
              before going live. Stock-only updates go live immediately.
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-lift backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          className="rounded-xl"
          onClick={onCancel}
          disabled={Boolean(saving)}
        >
          Cancel
        </Button>
        {mode === "vendor" &&
          (!editing || product?.status === "Draft" || product?.status === "Rejected") && (
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => void save("draft")}
              disabled={Boolean(saving)}
            >
              {saving === "draft" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save as draft
            </Button>
          )}
        <Button
          type="button"
          className={cn("rounded-xl font-semibold")}
          onClick={() => void save("submit")}
          disabled={Boolean(saving)}
        >
          {saving === "submit" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "admin"
            ? editing
              ? "Save product"
              : "Create product"
            : editing
              ? "Save changes"
              : "Submit for review"}
        </Button>
      </div>
    </div>
  );
}

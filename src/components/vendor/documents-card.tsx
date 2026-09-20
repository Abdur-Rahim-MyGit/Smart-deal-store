import { useRef, useState } from "react";
import { Eye, FileCheck2, FileWarning, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/dashboard/dashboard-shell";
import { useStore } from "@/context/store";
import { errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { openProtectedFile, uploadFile } from "@/lib/protected-file";
import type { User, VendorDocumentType } from "@/lib/types";

const DOCUMENTS: Array<{
  type: VendorDocumentType;
  label: string;
  hint: string;
  required: boolean;
}> = [
  {
    type: "tradeLicense",
    label: "Trade licence",
    hint: "Required before Smart Deal can approve your store.",
    required: true,
  },
  {
    type: "vatCertificate",
    label: "VAT registration certificate",
    hint: "Needed if your business is VAT registered.",
    required: false,
  },
];

/** Upload and check the documents Smart Deal uses to verify the store. */
export function VendorDocumentsCard() {
  const { user, setUser } = useStore();
  const [busy, setBusy] = useState<VendorDocumentType | null>(null);
  const [expiry, setExpiry] = useState("");
  const inputs = useRef<Partial<Record<VendorDocumentType, HTMLInputElement | null>>>({});
  const documents = user?.vendorDetails?.documents;

  async function upload(type: VendorDocumentType, file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Files can be up to 10 MB");
      return;
    }
    setBusy(type);
    try {
      const response = await uploadFile<{ message: string; user: User }>(
        `/vendors/documents/${type}`,
        file,
        type === "tradeLicense" && expiry ? { expiresAt: expiry } : {},
      );
      setUser(response.user);
      toast.success(response.message);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
      const input = inputs.current[type];
      if (input) input.value = "";
    }
  }

  return (
    <SectionCard
      title="Verification documents"
      description="Only you and the Smart Deal team reviewing sellers can open these files."
    >
      <ul className="space-y-3">
        {DOCUMENTS.map((entry) => {
          const doc = documents?.[entry.type];
          const expired = doc?.expiresAt ? new Date(doc.expiresAt).getTime() < Date.now() : false;
          return (
            <li key={entry.type} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="flex min-w-0 items-start gap-2">
                  {doc && !expired ? (
                    <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {entry.label}
                      {entry.required && <span className="text-destructive"> *</span>}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {doc
                        ? `Uploaded ${formatDate(doc.uploadedAt)}${doc.expiresAt ? ` · ${expired ? "expired" : "expires"} ${formatDate(doc.expiresAt)}` : ""}`
                        : entry.hint}
                    </span>
                  </span>
                </span>
                <span className="flex gap-2">
                  {doc && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg"
                      onClick={() =>
                        void openProtectedFile(`/vendors/documents/${entry.type}`).catch((error) =>
                          toast.error(errorMessage(error)),
                        )
                      }
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={busy !== null}
                    onClick={() => inputs.current[entry.type]?.click()}
                  >
                    {busy === entry.type ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {doc ? "Replace" : "Upload"}
                  </Button>
                </span>
              </div>
              {entry.type === "tradeLicense" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="licence-expiry" className="text-[11px] text-muted-foreground">
                    Licence expiry (sent with the next upload)
                  </Label>
                  <Input
                    id="licence-expiry"
                    type="date"
                    value={expiry}
                    onChange={(event) => setExpiry(event.target.value)}
                    className="h-8 max-w-[170px] rounded-lg text-xs"
                  />
                </div>
              )}
              <input
                ref={(element) => {
                  inputs.current[entry.type] = element;
                }}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => void upload(entry.type, event.target.files?.[0])}
              />
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-muted-foreground">PDF, JPG, PNG or WEBP, up to 10 MB.</p>
    </SectionCard>
  );
}

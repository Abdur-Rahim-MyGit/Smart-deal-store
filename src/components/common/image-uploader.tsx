import { useRef, useState } from "react";
import { Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { API_URL, getAccessToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  onUploaded: (url: string) => void;
  multiple?: boolean;
  onMultipleUploaded?: (urls: string[]) => void;
  className?: string;
  accept?: string;
}

export function ImageUploader({
  onUploaded,
  multiple = false,
  onMultipleUploaded,
  className,
  accept = "image/jpeg,image/png,image/webp,image/gif",
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: FileList | File[]) {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      if (multiple && onMultipleUploaded) {
        const formData = new FormData();
        Array.from(files).forEach((file) => formData.append("files", file));

        const res = await fetch(`${API_URL}/upload/multiple`, {
          method: "POST",
          headers,
          credentials: "include",
          body: formData,
        });

        const data = (await res.json()) as { success?: boolean; urls?: string[]; message?: string };
        if (!res.ok || !data.success || !data.urls) {
          throw new Error(data.message || "Failed to upload images");
        }

        onMultipleUploaded(data.urls);
        toast.success(`Uploaded ${data.urls.length} images successfully`);
      } else {
        const file = files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`${API_URL}/upload/single`, {
          method: "POST",
          headers,
          credentials: "include",
          body: formData,
        });

        const data = (await res.json()) as { success?: boolean; url?: string; message?: string };
        if (!res.ok || !data.success || !data.url) {
          throw new Error(data.message || "Failed to upload image");
        }

        onUploaded(data.url);
        toast.success("Image uploaded successfully");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Image upload failed";
      toast.error(msg);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void uploadFiles(e.dataTransfer.files);
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-colors",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border bg-muted/30 hover:border-muted-foreground/50",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void uploadFiles(e.target.files);
        }}
      />

      <div className="flex flex-col items-center gap-1.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <UploadCloud className="h-5 w-5" />
          )}
        </div>
        <div className="text-xs font-medium">
          {isUploading ? (
            <span className="text-primary font-semibold">Uploading image…</span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Click to upload
              </button>{" "}
              or drag & drop
            </>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">PNG, JPG, WEBP, GIF up to 10MB</p>
      </div>
    </div>
  );
}

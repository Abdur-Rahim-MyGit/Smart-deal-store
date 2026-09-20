import { useState, type FormEvent } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { RatingInput } from "@/components/common/rating-stars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/api";
import type { OrderItem } from "@/lib/types";

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** Write a review for a delivered item. Reviews are queued for moderation. */
export function ReviewDialog({
  item,
  onOpenChange,
  onSubmitted,
}: {
  item: OrderItem | null;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!item) return;
    if (comment.trim().length < 10) {
      setError("Please write at least 10 characters about the product");
      return;
    }

    setSaving(true);
    try {
      const response = await api<{ message: string }>(`/products/${item.product}/reviews`, {
        method: "POST",
        body: { rating, title: title.trim() || undefined, comment: comment.trim() },
      });
      toast.success(response.message || "Thanks for your review!", {
        description: "It will appear on the product page once our team approves it.",
      });
      setTitle("");
      setComment("");
      setRating(5);
      setError(null);
      onSubmitted();
      onOpenChange(false);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Write a review</DialogTitle>
          <DialogDescription>
            Share how the product worked for you. Reviews are checked by our team before they go
            live.
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
            {item.thumbnail && (
              <img
                src={item.thumbnail}
                alt=""
                className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
              />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{item.title}</p>
              {item.variantLabel && (
                <p className="text-xs text-muted-foreground">{item.variantLabel}</p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label>Your rating</Label>
            <div className="flex items-center gap-3">
              <RatingInput value={rating} onChange={setRating} />
              <span className="text-sm font-semibold text-muted-foreground">
                {LABELS[rating] ?? ""}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-title">Headline (optional)</Label>
            <Input
              id="review-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder="e.g. Exactly as described"
              className="h-11 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-comment">Your review</Label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(event) => {
                setComment(event.target.value);
                setError(null);
              }}
              rows={5}
              maxLength={2000}
              placeholder="What did you like? How was the quality, fit or battery life?"
              aria-invalid={Boolean(error)}
              className="rounded-xl"
            />
            {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl font-semibold" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
              {saving ? "Submitting…" : "Submit review"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

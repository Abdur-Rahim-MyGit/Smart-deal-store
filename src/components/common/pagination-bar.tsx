import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function pageList(page: number, pages: number): Array<number | "…"> {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
  const list: Array<number | "…"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);
  if (start > 2) list.push("…");
  for (let current = start; current <= end; current += 1) list.push(current);
  if (end < pages - 1) list.push("…");
  list.push(pages);
  return list;
}

export function PaginationBar({
  page,
  pages,
  onChange,
  className,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
  className?: string | undefined;
}) {
  if (pages <= 1) return null;
  return (
    <nav
      className={cn("flex items-center justify-center gap-1.5", className)}
      aria-label="Pagination"
    >
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-xl"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pageList(page, pages).map((entry, index) =>
        entry === "…" ? (
          <span key={`gap-${index}`} className="px-1.5 text-sm text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={entry}
            variant={entry === page ? "default" : "outline"}
            size="icon"
            className="h-9 w-9 rounded-xl text-sm"
            onClick={() => onChange(entry)}
            aria-current={entry === page ? "page" : undefined}
          >
            {entry}
          </Button>
        ),
      )}
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-xl"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function usePaged<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safe = Math.min(Math.max(1, page), pages);
  const start = (safe - 1) * pageSize;
  return { rows: items.slice(start, start + pageSize), pages, page: safe, total };
}

export function SimplePagination({
  page, pages, total, onPage, pageSize,
}: { page: number; pages: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-2 mt-3 text-sm">
      <div className="text-muted-foreground text-xs">Showing {from}–{to} of {total}</div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2 text-xs">Page {page} / {pages}</span>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

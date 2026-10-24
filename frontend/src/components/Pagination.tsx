type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label?: string;
  className?: string;
};

type PageItem = number | "ellipsis";

function pageItems(total: number, current: number): PageItem[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const items: PageItem[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("ellipsis");
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < total - 1) items.push("ellipsis");
  items.push(total);
  return items;
}

export function Pagination({ page, totalPages, onPageChange, label = "Pagination", className }: PaginationProps) {
  if (totalPages <= 1) return null;
  const items = pageItems(totalPages, page);
  return (
    <nav className={className ? "pagination " + className : "pagination"} aria-label={label}>
      <button
        className="pagination-step"
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <span aria-hidden="true">&larr;</span> Previous
      </button>
      <div className="pagination-pages">
        {items.map((item, index) =>
          item === "ellipsis" ? (
            <span className="pagination-ellipsis" key={"ellipsis-" + index} aria-hidden="true">
              &hellip;
            </span>
          ) : (
            <button
              key={item}
              className={item === page ? "pagination-page is-current" : "pagination-page"}
              type="button"
              onClick={() => onPageChange(item)}
              aria-label={"Page " + item}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </button>
          ),
        )}
      </div>
      <button
        className="pagination-step"
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        Next <span aria-hidden="true">&rarr;</span>
      </button>
    </nav>
  );
}
type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label?: string;
  className?: string;
  showFirstLast?: boolean;
};

type PageItem = number | "ellipsis-start" | "ellipsis-end";

function pageItems(total: number, current: number): PageItem[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const items: PageItem[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("ellipsis-start");
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < total - 1) items.push("ellipsis-end");
  items.push(total);
  return items;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  label = "Pagination",
  className,
  showFirstLast = false,
}: PaginationProps) {
  if (totalPages <= 1) return null;
  const items = pageItems(totalPages, page);
  const baseClass = className ? `pagination ${className}` : "pagination";
  return (
    <nav className={baseClass} aria-label={label} role="navigation">
      {showFirstLast && (
        <button
          className="pagination-step pagination-first"
          type="button"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          aria-label="First page"
          title="First page"
        >
          <span aria-hidden="true">«</span>
        </button>
      )}
      <button
        className="pagination-step"
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <span aria-hidden="true">←</span>
        <span className="pagination-step-label">Prev</span>
      </button>
      <div className="pagination-pages" role="list">
        {items.map((item, index) =>
          typeof item === "string" ? (
            <span
              className="pagination-ellipsis"
              key={item + index}
              aria-hidden="true"
            >
              &hellip;
            </span>
          ) : (
            <button
              key={item}
              className={item === page ? "pagination-page is-current" : "pagination-page"}
              type="button"
              role="listitem"
              onClick={() => onPageChange(item)}
              aria-label={`Page ${item}`}
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
        <span className="pagination-step-label">Next</span>
        <span aria-hidden="true">→</span>
      </button>
      {showFirstLast && (
        <button
          className="pagination-step pagination-last"
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          aria-label="Last page"
          title="Last page"
        >
          <span aria-hidden="true">»</span>
        </button>
      )}
    </nav>
  );
}

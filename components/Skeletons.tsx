import type { ReactNode } from "react";

/**
 * Loading placeholders. Each one uses the same layout classes as the content it stands in for,
 * so the swap to real content doesn't move anything (no CLS). Screen readers hear the label only.
 */
export function Loading({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

const times = (n: number) => Array.from({ length: n }, (_, i) => i);

/** About one screen of cards: taller would push the footer below the fold and pull it back up if the load fails. */
export function GridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid">
      {times(count).map((i) => (
        <div key={i} className="card">
          <span className="card-media skeleton" />
          <div className="card-body">
            <span className="skeleton sk-line" />
            <span className="skeleton sk-line sk-short" />
            <span className="skeleton sk-line sk-short" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="summary">
      <span className="skeleton sk-line" />
      <span className="skeleton sk-line sk-short" />
      <span className="skeleton sk-block" />
    </div>
  );
}

/** Cart / orders / order lines; `summary` adds the sidebar the cart and order pages have. */
export function LinesSkeleton({ rows = 3, summary = false }: { rows?: number; summary?: boolean }) {
  const lines = (
    <div className="lines">
      {times(rows).map((i) => (
        <div key={i} className="line">
          <span className="line-thumb skeleton" />
          <div className="line-meta">
            <span className="skeleton sk-line" />
            <span className="skeleton sk-line sk-short" />
          </div>
        </div>
      ))}
    </div>
  );
  return summary ? <div className="with-summary">{lines}<SummarySkeleton /></div> : lines;
}

export function CheckoutSkeleton() {
  return (
    <div className="with-summary">
      <div className="form">
        {times(2).map((i) => (
          <div key={i} className="fieldset">
            <span className="skeleton sk-title" />
            <span className="skeleton sk-block" />
            <span className="skeleton sk-block" />
          </div>
        ))}
      </div>
      <SummarySkeleton />
    </div>
  );
}

export function ProductSkeleton() {
  return (
    <div className="product">
      <div className="gallery"><span className="gallery-main skeleton" /></div>
      <div className="product-info">
        <span className="skeleton sk-title" />
        <span className="skeleton sk-line sk-short" />
        <span className="skeleton sk-block" />
        <span className="skeleton sk-block" />
      </div>
    </div>
  );
}

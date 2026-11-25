"use client";

import type { ReactNode } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
}

/** Underlined tab bar. Content is rendered by the caller for the active id. */
export function Tabs<T extends string>({
  items,
  active,
  onChange,
  label,
  className = "",
}: {
  items: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={`flex gap-6 overflow-x-auto ${className}`}>
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`panel-${item.id}`}
            onClick={() => onChange(item.id)}
            className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-0.5 text-[15px] font-medium transition-colors ${
              selected ? "border-brand text-text" : "border-transparent text-muted hover:text-text"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

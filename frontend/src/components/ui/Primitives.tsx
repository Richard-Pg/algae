import type { ComponentProps, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";

export function Panel({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-xl border border-line bg-surface p-5 ${className}`} {...props} />;
}

export function PanelHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="label">{title}</h2>
      {children}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 aria-hidden className={`size-5 animate-spin ${className}`} />;
}

export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-24 text-muted">
      <Spinner /> {label}
    </div>
  );
}

const noticeStyle = {
  error: { className: "border-risk-high-line bg-risk-high-tint text-[#7e1d14]", Icon: AlertTriangle },
  warning: { className: "border-risk-medium-line bg-risk-medium-tint text-[#5c3d00]", Icon: AlertTriangle },
  success: { className: "border-[#c4dccd] bg-brand-tint text-brand-strong", Icon: CheckCircle2 },
  info: { className: "border-line bg-surface text-text", Icon: Info },
};

export function Notice({
  tone = "info",
  title,
  children,
  action,
  className = "",
}: {
  tone?: keyof typeof noticeStyle;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { className: toneClass, Icon } = noticeStyle[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-lg border p-4 ${toneClass} ${className}`}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={`text-sm leading-relaxed ${title ? "mt-1" : ""}`}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** A binomial in italics; qualifiers like "spp." stay upright, as in print. */
export function SpeciesName({ name, className = "" }: { name: string; className?: string }) {
  const parts = name.split(/\s+/);
  return (
    <span className={`font-serif ${className}`}>
      {parts.map((part, i) => {
        const upright = /^(spp?\.|sp\.|cf\.|aff\.|var\.|f\.)$/i.test(part);
        return (
          <span key={i} className={upright ? "font-sans text-[0.7em] not-italic opacity-80" : "italic"}>
            {i > 0 ? " " : ""}
            {part}
          </span>
        );
      })}
    </span>
  );
}

export function KeyValue({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="label">{label}</dt>
      <dd className={`mt-1 text-[15px] leading-snug ${mono ? "font-mono" : ""}`}>{children}</dd>
    </div>
  );
}

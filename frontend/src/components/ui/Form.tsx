import type { ComponentProps, ReactNode } from "react";

const control =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-[15px] text-text placeholder:text-[#8a958f] transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-paper disabled:text-muted";

export function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="text-risk-high"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${control} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${control} min-h-24 ${className}`} {...props} />;
}

export function Select({
  options,
  placeholder = "Select…",
  className = "",
  ...props
}: ComponentProps<"select"> & { options: string[]; placeholder?: string }) {
  // Keep a prefilled value that isn't one of the standard options instead of dropping it.
  const current = typeof props.value === "string" ? props.value : "";
  const all = current && !options.includes(current) ? [current, ...options] : options;
  return (
    <select className={`${control} ${className}`} {...props}>
      <option value="">{placeholder}</option>
      {all.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export const OPTIONS = {
  toxinPresence: ["Yes", "No", "Unknown"],
  riskLevel: ["None", "Low", "Medium", "High", "Unknown"],
  waterType: ["Freshwater", "Marine", "Brackish", "Terrestrial", "Mixed/Variable", "Unknown"],
  confidence: ["High", "Moderate", "Low", "Uncertain"],
  sampleType: ["Freshwater bloom", "Marine sample", "Brackish sample", "Lab culture", "Surface water", "Field sample", "Other"],
  microscopy: ["Brightfield", "Phase contrast", "DIC", "Fluorescence", "SEM", "Light microscopy", "Unknown"],
};

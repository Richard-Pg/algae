import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "signal" | "secondary" | "ghost-ink" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong",
  signal: "bg-signal text-ink hover:bg-[#b4dca3]",
  secondary: "border border-line-strong bg-surface text-text hover:border-muted",
  "ghost-ink": "border border-ink-line text-ink-text hover:border-ink-muted hover:bg-ink-raised",
  ghost: "text-muted hover:text-text hover:bg-black/5",
  danger: "border border-risk-high-line bg-surface text-risk-high hover:bg-risk-high-tint",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[15px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: CommonProps & ComponentProps<"button">) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  href,
  ...props
}: CommonProps & { href: string } & Omit<ComponentProps<"a">, "href">) {
  return <Link href={href} className={buttonClass(variant, size, className)} {...props} />;
}

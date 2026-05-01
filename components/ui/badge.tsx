import * as React from "react";
import { cn } from "@/lib/utils";

type Variant =
  | "default"
  | "muted"
  | "saffron"
  | "jade"
  | "burgundy"
  | "gold"
  | "success"
  | "warning"
  | "danger";

const variants: Record<Variant, string> = {
  default:
    "bg-[var(--surface-soft)] text-[var(--foreground)] border border-[var(--border)]",
  muted:
    "bg-transparent text-[var(--muted-foreground)] border border-[var(--border-strong)]",
  saffron:
    "bg-[var(--saffron-tint)] text-[var(--saffron)] border border-[var(--border-saffron)]",
  jade: "bg-[var(--jade-tint)] text-[var(--jade)] border border-[var(--jade-soft)]",
  burgundy:
    "bg-[#fdf2f2] text-[var(--burgundy)] border border-[var(--burgundy-soft)]",
  gold: "bg-[#fdf6e3] text-[var(--gold)] border border-[var(--gold-soft)]",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border border-amber-200",
  danger: "bg-rose-50 text-rose-700 border border-rose-200",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

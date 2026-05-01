"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "tonal";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--saffron)] text-white shadow-[var(--shadow-saffron)] hover:bg-[#92400e] active:bg-[#7c2d12] disabled:bg-[var(--subtle)] disabled:text-white disabled:shadow-none",
  secondary:
    "bg-[var(--jade)] text-white hover:bg-[#0d5e57] active:bg-[#0a4f4a] disabled:bg-[var(--subtle)] disabled:text-white",
  ghost:
    "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
  outline:
    "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--saffron)] hover:bg-[var(--saffron-tint)]",
  tonal:
    "bg-[var(--saffron-tint)] text-[var(--saffron)] hover:bg-[var(--saffron-soft)]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-sm rounded-full",
  md: "h-10 px-5 text-sm rounded-full",
  lg: "h-12 px-7 text-base rounded-full",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--saffron)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";

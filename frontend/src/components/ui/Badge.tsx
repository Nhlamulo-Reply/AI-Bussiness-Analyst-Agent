import type { ReactNode } from "react";

type BadgeTone = "neutral" | "success" | "warning" | "info" | "accent";

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  title?: string;
}

export function Badge({ children, tone = "neutral", title }: BadgeProps) {
  return (
    <span className={`badge badge--${tone}`} title={title}>
      {children}
    </span>
  );
}

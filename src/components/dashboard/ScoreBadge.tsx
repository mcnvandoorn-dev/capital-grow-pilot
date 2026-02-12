import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number | null;
  size?: "sm" | "md";
}

export function ScoreBadge({ score, size = "sm" }: ScoreBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <span className="text-xs text-muted-foreground">—</span>
    );
  }

  const getColor = (s: number) => {
    if (s >= 70) return "bg-positive/10 text-positive";
    if (s >= 40) return "bg-warning/10 text-warning";
    return "bg-negative/10 text-negative";
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md font-semibold tabular-nums",
        getColor(score),
        size === "sm" && "h-6 min-w-[2rem] px-1.5 text-xs",
        size === "md" && "h-8 min-w-[2.5rem] px-2 text-sm"
      )}
    >
      {Math.round(score)}
    </span>
  );
}

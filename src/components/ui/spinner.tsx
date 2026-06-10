import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

type SpinnerProps = {
  label?: string;
  size?: number;
  className?: string;
};

function Spinner({
  label = "Loading...",
  size = 40,
  className = "",
}: SpinnerProps) {
  const iconSizeClass =
    size >= 48 ? "w-12 h-12" : size >= 36 ? "w-9 h-9" : "w-8 h-8";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        className
      )}
    >
      <div className={cn("rounded-full bg-white/70 p-2 shadow", iconSizeClass)}>
        <Loader2Icon className="animate-spin text-secondary" aria-hidden />
      </div>
      {label ? (
        <div className="text-sm text-muted-foreground">{label}</div>
      ) : null}
    </div>
  );
}

export { Spinner };

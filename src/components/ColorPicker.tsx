import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COLOR_PALETTE } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Props {
  value: string;
  onChange: (hex: string) => void;
  /** Optional label rendered next to the swatch button. */
  label?: string;
  /** Visual size of the swatch button. */
  size?: "sm" | "md";
  className?: string;
}

export function ColorPicker({ value, onChange, label, size = "md", className }: Props) {
  const [open, setOpen] = useState(false);
  const dim = size === "sm" ? "h-5 w-5" : "h-7 w-7";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium transition-colors hover:bg-accent",
            className
          )}
        >
          <span
            className={cn("rounded-full ring-1 ring-border", dim)}
            style={{ backgroundColor: value }}
          />
          {label && <span className="text-foreground">{label}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-8 gap-1.5">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className="relative h-6 w-6 rounded-md ring-1 ring-border transition-transform hover:scale-110"
              style={{ backgroundColor: c }}
              aria-label={c}
            >
              {value.toLowerCase() === c.toLowerCase() && (
                <Check
                  className="absolute inset-0 m-auto h-3.5 w-3.5"
                  strokeWidth={3}
                  color="#fff"
                />
              )}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent"
          />
          <span className="text-[11px] uppercase text-muted-foreground">{value}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
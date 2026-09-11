"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type CatalogOption = {
  value: string;
  label: string;
  subtitle?: string;
};

const DEFAULT_MAX_VISIBLE = 80;

interface CatalogSelectProps {
  id: string;
  label?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: CatalogOption[];
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  hint?: string;
  className?: string;
  /** Evita renderizar miles de filas (p.ej. materiales). */
  maxVisible?: number;
  /**
   * Se dispara con cada cambio del texto de búsqueda, además del
   * filtrado en memoria que ya hace este componente. Úsalo para
   * disparar una búsqueda en el backend (as-you-type) cuando `options`
   * no trae el catálogo completo precargado (p.ej. comodín "cliente").
   */
  onFilterChange?: (value: string) => void;
}

export default function CatalogSelect({
  id,
  label,
  value,
  onChange,
  options,
  isLoading = false,
  disabled = false,
  placeholder = "Selecciona...",
  emptyMessage = "No hay opciones.",
  searchPlaceholder = "Buscar...",
  hint,
  className,
  maxVisible = DEFAULT_MAX_VISIBLE,
  onFilterChange,
}: CatalogSelectProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return options;
    return options.filter((o) => {
      const haystack = `${o.label} ${o.value} ${o.subtitle ?? ""}`.toLowerCase();
      return haystack.includes(f);
    });
  }, [options, filter]);

  const visible = filtered.slice(0, maxVisible);
  const hiddenCount = Math.max(0, filtered.length - visible.length);

  const triggerText = isLoading
    ? "Cargando..."
    : selected?.label
      ? selected.label
      : options.length === 0
        ? emptyMessage
        : placeholder;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <Label htmlFor={id} className="text-xs font-medium flex items-center gap-1">
          {label}
        </Label>
      ) : null}
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (disabled || isLoading) return;
          setOpen(next);
          if (!next) setFilter("");
        }}
      >
        <div className="relative">
          <PopoverTrigger asChild>
            <button
              id={id}
              type="button"
              disabled={disabled || isLoading}
              className={cn(
                "flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-1 text-left text-sm shadow-sm",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-60",
                value ? "pr-14" : "pr-8",
                !selected && "text-muted-foreground",
              )}
              aria-expanded={open}
              aria-haspopup="listbox"
            >
              <span className="min-w-0 flex-1 truncate">{triggerText}</span>
            </button>
          </PopoverTrigger>
          {value && !disabled && !isLoading ? (
            <button
              type="button"
              tabIndex={-1}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange("");
                setOpen(false);
                setFilter("");
              }}
              className="absolute right-8 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Limpiar selección"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {isLoading ? (
            <Loader2 className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          )}
        </div>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-[220px] p-0"
          align="start"
        >
          <div className="relative border-b p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => {
                const next = e.target.value;
                setFilter(next);
                onFilterChange?.(next);
              }}
              placeholder={searchPlaceholder}
              className="h-8 pl-8 text-sm"
              autoFocus
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1" role="listbox">
            {options.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </p>
            ) : visible.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                Sin resultados para “{filter.trim()}”.
              </p>
            ) : (
              <>
                {visible.map((o) => {
                  const isSelected = o.value === value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(o.value);
                        setOpen(false);
                        setFilter("");
                      }}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                        isSelected && "bg-accent",
                      )}
                    >
                      <Check
                        className={cn(
                          "mt-0.5 h-3.5 w-3.5 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{o.label}</span>
                        {o.subtitle ? (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {o.subtitle}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
                {hiddenCount > 0 ? (
                  <p className="px-2 py-2 text-center text-[11px] text-muted-foreground">
                    Mostrando {visible.length} de {filtered.length}. Escribe para
                    acotar.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {hint ? (
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

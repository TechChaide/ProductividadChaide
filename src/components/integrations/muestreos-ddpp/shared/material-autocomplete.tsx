"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMaterialSearch, type MaterialResult } from "@/hooks/integrations/muestreos-ddpp/use-material-search";
import { cn } from "@/lib/utils";
import { Loader2, Package, Search, X } from "lucide-react";

type AutocompleteItem = { kind: "material"; data: MaterialResult };

interface MaterialAutocompleteProps {
  centro: string;
  resp: string;
  onSelect: (item: Pick<MaterialResult, "MATERIAL" | "DESCRIPCION">) => void;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  hint?: string;
}

export default function MaterialAutocomplete({
  centro,
  resp,
  onSelect,
  value,
  placeholder = "Buscar material (mín. 2 caracteres)...",
  disabled = false,
  className,
  hint,
}: MaterialAutocompleteProps) {
  const { termino, setTermino, resultados: materiales, loading } =
    useMaterialSearch(centro, resp);

  const resultados = useMemo((): AutocompleteItem[] => {
    const q = termino.trim().toLowerCase();
    if (q.length < 2) return [];
    return materiales.map((m) => ({ kind: "material" as const, data: m }));
  }, [termino, materiales]);

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedLabel, setSelectedLabel] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value && !selectedLabel) {
      setSelectedLabel(value);
    }
  }, [value, selectedLabel]);

  useEffect(() => {
    if (resultados.length > 0 && termino.trim().length >= 2) {
      setIsOpen(true);
    }
  }, [resultados, termino]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (item: AutocompleteItem) => {
    onSelect({
      MATERIAL: item.data.MATERIAL,
      DESCRIPCION: item.data.DESCRIPCION,
    });
    setSelectedLabel(`${item.data.MATERIAL} — ${item.data.DESCRIPCION}`);
    setTermino("");
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleClear = () => {
    setSelectedLabel("");
    setTermino("");
    onSelect({ MATERIAL: "", DESCRIPCION: "" });
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && resultados[activeIndex]) {
        handleSelect(resultados[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const showInput = !selectedLabel;

  return (
    <div ref={containerRef} className={cn("w-full space-y-1.5", className)}>
      <div className="relative">
        <Package className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

        {showInput ? (
          <input
            ref={inputRef}
            type="text"
            value={termino}
            disabled={disabled}
            onChange={(e) => {
              setTermino(e.target.value);
              setActiveIndex(-1);
            }}
            onFocus={() => {
              if (resultados.length > 0) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoComplete="off"
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-9 py-1 text-sm shadow-sm",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          />
        ) : (
          <div
            className={cn(
              "flex h-9 w-full items-center rounded-md border border-input bg-background pl-9 pr-9 py-1 text-sm shadow-sm",
              disabled && "opacity-60 cursor-not-allowed",
            )}
          >
            <span className="truncate">{selectedLabel}</span>
          </div>
        )}

        {loading && (
          <Loader2 className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}

        {!loading && selectedLabel && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Limpiar selección"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {!loading && showInput && !disabled && (
          <Search className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}

        {isOpen && resultados.length > 0 && (
          <ul
            role="listbox"
            className={cn(
              "absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover shadow-md",
              "p-1 text-sm",
            )}
          >
            {resultados.map((item, idx) => {
              const highlighted = idx === activeIndex;
              return (
                <li
                  key={`mat-${item.data.CENTRO}-${item.data.MATERIAL}`}
                  role="option"
                  aria-selected={highlighted}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(item);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5",
                    highlighted ? "bg-accent text-accent-foreground" : "",
                  )}
                >
                  <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium font-mono text-xs">
                      {item.data.MATERIAL}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.data.DESCRIPCION}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {isOpen &&
          termino.trim().length >= 2 &&
          resultados.length === 0 &&
          !loading && (
            <div
              className={cn(
                "absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md",
                "p-3 text-sm text-muted-foreground text-center",
              )}
            >
              Sin resultados para &quot;{termino.trim()}&quot;.
            </div>
          )}
      </div>

      {hint ? (
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

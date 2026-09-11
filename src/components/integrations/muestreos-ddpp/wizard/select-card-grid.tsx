"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Check, Search } from "lucide-react";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SelectableCard {
  id: string | number;
  title: string;
  subtitle?: string;
  extra?: string;
}

interface SelectCardGridProps {
  items: SelectableCard[];
  selectedId?: string | number | null;
  onSelect: (id: string | number) => void;
  // Callback opcional disparado tras `onSelect` con un delay de 250ms.
  // Sirve para avanzar automáticamente al siguiente paso del wizard.
  onAfterSelect?: () => void;
  icon?: ComponentType<{ className?: string }>;
  filterPlaceholder?: string;
  emptyMessage?: string;
  isLoading?: boolean;
  skeletonCount?: number;
}

export default function SelectCardGrid({
  items,
  selectedId,
  onSelect,
  onAfterSelect,
  icon: Icon,
  filterPlaceholder = "Filtrar...",
  emptyMessage = "No hay elementos disponibles.",
  isLoading = false,
  skeletonCount = 6,
}: SelectCardGridProps) {
  // Ref de timers pendientes + useEffect de cleanup. Deben ir ANTES de
  // cualquier función que los use (regla de "Temporal Dead Zone" en JS:
  // un `const` no está inicializado hasta su línea de declaración).
  const pendingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current != null) {
        window.clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, []);

  const [filter, setFilter] = useState("");

  const handleCardClick = useCallback(
    (id: string | number) => {
      onSelect(id);
      if (onAfterSelect) {
        // Cancelamos cualquier timer previo antes de programar el nuevo.
        if (pendingTimerRef.current != null) {
          window.clearTimeout(pendingTimerRef.current);
        }
        pendingTimerRef.current = window.setTimeout(
          () => onAfterSelect(),
          250,
        );
      }
    },
    [onSelect, onAfterSelect],
  );

  const filtered = useMemo(() => {
    if (!filter.trim()) return items;
    const f = filter.toLowerCase();
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(f) ||
        (it.subtitle?.toLowerCase().includes(f) ?? false) ||
        (it.extra?.toLowerCase().includes(f) ?? false),
    );
  }, [items, filter]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0">
        {[...Array(skeletonCount)].map((_, i) => (
          <Card key={i} className="border">
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={filterPlaceholder}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0">
          {filtered.map((item) => {
            const selected = selectedId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleCardClick(item.id)}
                className={cn(
                  "text-left rounded-md border p-4 transition-colors",
                  "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40",
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "bg-card",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    {Icon && (
                      <div
                        className={cn(
                          "rounded-md p-2 shrink-0",
                          selected ? "bg-primary/10" : "bg-slate-100",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            selected ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {item.subtitle}
                        </p>
                      )}
                      {item.extra && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {item.extra}
                        </p>
                      )}
                    </div>
                  </div>
                  {selected && (
                    <Badge variant="default" className="bg-primary shrink-0">
                      <Check className="h-3 w-3 mr-1" />
                      Elegido
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {filtered.length} elemento{filtered.length === 1 ? "" : "s"}{" "}
          {filter ? "filtrado(s)" : "disponible(s)"} de {items.length} totales.
        </div>
      )}
    </div>
  );
}

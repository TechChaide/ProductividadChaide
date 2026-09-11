"use client";

/**
 * Paso intermedio del wizard de procesos: seleccionar tipo de medición
 * para el ATM × componente actuales (antes de la causa).
 */

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ClipboardList, Ruler, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  applyTipoMedicionPolicy,
  resolveTiposMedicionParaComponente,
  type TipoMedicionFlujoPolicy,
  type TipoMedicionOption,
} from "@/lib/integrations/muestreos-ddpp/tipo-medicion-tabla";

interface StepSelectTipoMedicionProps {
  codigoAreaTipoMotivo: number | null;
  codigoComponente: number | null;
  selectedCodigoTipoMedicion: number | null;
  onSelect: (option: TipoMedicionOption) => void;
  /** Avance automático tras seleccionar. */
  onAfterSelect?: () => void;
  /** Notifica al padre cuántos tipos hay (para habilitar Siguiente). */
  onOptionsLoaded?: (options: TipoMedicionOption[]) => void;
  stepHint?: string;
  title?: string;
  description?: string;
  /** Política de filtrado (p.ej. solo tablas dimensionales). */
  policy?: TipoMedicionFlujoPolicy;
  emptyMessage?: string;
}

export default function StepSelectTipoMedicion({
  codigoAreaTipoMotivo,
  codigoComponente,
  selectedCodigoTipoMedicion,
  onSelect,
  onAfterSelect,
  onOptionsLoaded,
  stepHint = "Paso 5 de 7",
  title = "Selecciona el tipo de medición",
  description = "Elige cómo vas a capturar en este componente. Si solo hay captura simple, se registran los datos fijos sin campos adicionales.",
  policy,
  emptyMessage = "No hay tipos de medición disponibles para este componente.",
}: StepSelectTipoMedicionProps) {
  const [options, setOptions] = useState<TipoMedicionOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (codigoAreaTipoMotivo == null || codigoComponente == null) {
      setOptions([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    resolveTiposMedicionParaComponente(codigoAreaTipoMotivo, codigoComponente)
      .then((tipos) => {
        if (cancelled) return;
        const resolved = applyTipoMedicionPolicy(tipos, policy);
        setOptions(resolved.options);
        onOptionsLoaded?.(resolved.options);
        if (resolved.selected) {
          onSelect(resolved.selected);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setOptions([]);
        onOptionsLoaded?.([]);
        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar los tipos de medición.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoAreaTipoMotivo, codigoComponente]);

  const filtered = options.filter((o) => {
    if (!filter.trim()) return true;
    const f = filter.toLowerCase();
    return (
      o.nombre_tipo_medicion.toLowerCase().includes(f) ||
      String(o.codigo_tipo_medicion).includes(f) ||
      o.tablas.some((t) => t.toLowerCase().includes(f))
    );
  });

  const canSelect =
    codigoAreaTipoMotivo != null && codigoComponente != null;

  return (
    <div className="space-y-6">
      <div>
        <span className="text-sm text-primary font-medium">{stepHint}</span>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      {!canSelect ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          Completa área, motivo y componente primero.
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
          {error}
        </div>
      ) : options.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <>
          {!(options.length === 1 && options[0]?.sinTabla) && (
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Filtrar tipos de medición..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((opt) => {
              const isSelected =
                selectedCodigoTipoMedicion === opt.codigo_tipo_medicion;
              const isSimple = !!opt.sinTabla;
              return (
                <button
                  key={opt.codigo_tipo_medicion}
                  type="button"
                  onClick={() => {
                    onSelect(opt);
                    onAfterSelect?.();
                  }}
                  className={cn(
                    "flex items-start gap-3 rounded-md border p-4 text-left transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30 text-muted-foreground",
                    )}
                  >
                    {isSelected ? (
                      <Check className="h-4 w-4" />
                    ) : isSimple ? (
                      <ClipboardList className="h-4 w-4" />
                    ) : (
                      <Ruler className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="block text-sm font-semibold leading-tight">
                        {opt.nombre_tipo_medicion}
                      </span>
                      {isSelected && (
                        <Badge variant="secondary" className="shrink-0">
                          Elegido
                        </Badge>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {isSimple
                        ? "Solo datos fijos del registro"
                        : opt.tablas.length > 0
                          ? opt.tablas.join(", ")
                          : `cód. ${opt.codigo_tipo_medicion}`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Ningún tipo coincide con el filtro.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export type { TipoMedicionOption };

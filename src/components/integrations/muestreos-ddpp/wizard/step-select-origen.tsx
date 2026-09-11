"use client";

/**
 * Paso de origen (ATM → origen) para los wizards de /procesos.
 * Carga `origenService` (getOrigenesByCodigoAreaTipoMotivo + getAll).
 * Si el servicio no trae filas, usa la tabla virtual como fallback.
 */
import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import type { MuestreoTablaVirtual, Origen } from "@/types/integrations/muestreos-ddpp";
import { loadOrigenesByAtm } from "@/lib/integrations/muestreos-ddpp/flujo-seleccion";
import { EMPTY_TABLA_VIRTUAL } from "@/lib/integrations/muestreos-ddpp/tabla-virtual-empty";
import SelectCardGrid, {
  type SelectableCard,
} from "@/components/integrations/muestreos-ddpp/wizard/select-card-grid";

interface StepSelectOrigenProps {
  codigoArea: number | null;
  codigoAreaTipoMotivo: number | null;
  selectedOrigenId: number | null;
  onSelect: (origenId: number, nombreOrigen: string) => void;
  onAfterSelect?: () => void;
  tablaVirtual?: MuestreoTablaVirtual[];
  stepHint?: string;
  title?: string;
  description?: string;
}

function origenesFromVirtual(
  filas: MuestreoTablaVirtual[],
  codigoArea: number,
  codigoAtm: number,
): Origen[] {
  const map = new Map<number, Origen>();
  for (const f of filas) {
    if (f.codigo_area !== codigoArea) continue;
    if (f.codigo_area_tipo_motivo !== codigoAtm) continue;
    if (!f.codigo_origen) continue;
    map.set(f.codigo_origen, {
      codigo_origen: f.codigo_origen,
      codigo_area_tipo_motivo: f.codigo_area_tipo_motivo,
      nombre_origen: f.nombre_origen,
      estado: "A",
    });
  }
  return Array.from(map.values()).sort((a, b) =>
    a.nombre_origen.localeCompare(b.nombre_origen, "es"),
  );
}

export default function StepSelectOrigen({
  codigoArea,
  codigoAreaTipoMotivo,
  selectedOrigenId,
  onSelect,
  onAfterSelect,
  tablaVirtual = EMPTY_TABLA_VIRTUAL,
  stepHint = "Paso 3 de 7",
  title = "Selecciona el origen",
  description = "Orígenes asociados al motivo (ATM) elegido.",
}: StepSelectOrigenProps) {
  const [origenes, setOrigenes] = useState<Origen[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (codigoAreaTipoMotivo == null) {
      setOrigenes([]);
      return;
    }
    setIsLoading(true);
    loadOrigenesByAtm(codigoAreaTipoMotivo)
      .then((lista) => {
        if (cancelled) return;
        if (lista.length > 0) {
          setOrigenes(lista);
          return;
        }
        if (codigoArea != null) {
          setOrigenes(
            origenesFromVirtual(tablaVirtual, codigoArea, codigoAreaTipoMotivo),
          );
        } else {
          setOrigenes([]);
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (codigoArea != null) {
          setOrigenes(
            origenesFromVirtual(tablaVirtual, codigoArea, codigoAreaTipoMotivo),
          );
        } else {
          setOrigenes([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [codigoArea, codigoAreaTipoMotivo, tablaVirtual.length]);

  const cards: SelectableCard[] = useMemo(
    () =>
      origenes.map((o) => ({
        id: o.codigo_origen,
        title: o.nombre_origen,
        subtitle: `Origen #${o.codigo_origen}`,
      })),
    [origenes],
  );

  return (
    <div className="space-y-6">
      <div>
        <span className="text-sm text-primary font-medium">{stepHint}</span>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      {codigoAreaTipoMotivo == null ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          Completa los pasos anteriores primero.
        </div>
      ) : (
        <SelectCardGrid
          items={cards}
          selectedId={selectedOrigenId}
          onSelect={(id) => {
            const o = origenes.find((x) => x.codigo_origen === id);
            if (o) onSelect(o.codigo_origen, o.nombre_origen);
          }}
          onAfterSelect={onAfterSelect}
          icon={MapPin}
          filterPlaceholder="Filtrar orígenes..."
          emptyMessage="No hay orígenes asociados a este motivo."
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

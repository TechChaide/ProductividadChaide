"use client";

/**
 * Selección de componente filtrado por el origen elegido.
 * Carga origen_componente + componente (getAll); si vacío, usa tabla virtual.
 */
import { useEffect, useMemo, useState } from "react";
import { Cpu } from "lucide-react";
import SelectCardGrid, {
  type SelectableCard,
} from "./select-card-grid";
import type { Area, MuestreoTablaVirtual } from "@/types/integrations/muestreos-ddpp";
import {
  loadComponentesByOrigen,
  type ComponenteDeOrigen,
} from "@/lib/integrations/muestreos-ddpp/flujo-seleccion";
import { EMPTY_TABLA_VIRTUAL } from "@/lib/integrations/muestreos-ddpp/tabla-virtual-empty";
import { componenteTieneTablaDimensional } from "@/lib/integrations/muestreos-ddpp/tipo-medicion-tabla";

interface Step3SelectComponenteMuestreoProps {
  selectedArea: Area | null;
  selectedAreaTipoMotivoId: number | null;
  selectedOrigenId: number | null;
  selectedComponenteId: number | null;
  onSelect: (
    componenteId: number,
    nombreComponente: string,
    codigoOrigenComponente: number,
    unidades?: string,
    requierePasscode?: boolean,
  ) => void;
  onAfterSelect?: () => void;
  tablaVirtual?: MuestreoTablaVirtual[];
  stepHint?: string;
  /**
   * Si es true, solo lista componentes que tienen asociaciones vigentes
   * de tipo de medición Dimensional (usado por Muestreos operador).
   */
  soloTablasDimensionales?: boolean;
}

function fromVirtual(
  filas: MuestreoTablaVirtual[],
  codigoArea: number,
  codigoAtm: number,
  codigoOrigen: number,
): ComponenteDeOrigen[] {
  const map = new Map<number, ComponenteDeOrigen>();
  for (const f of filas) {
    if (f.codigo_area !== codigoArea) continue;
    if (f.codigo_area_tipo_motivo !== codigoAtm) continue;
    if (f.codigo_origen !== codigoOrigen) continue;
    map.set(f.codigo_componente, {
      codigo_componente: f.codigo_componente,
      nombre_componente: f.nombre_componente,
      codigo_origen_componente: f.codigo_origen_componente,
    });
  }
  return Array.from(map.values()).sort((a, b) =>
    a.nombre_componente.localeCompare(b.nombre_componente, "es"),
  );
}

export default function Step3SelectComponenteMuestreo({
  selectedArea,
  selectedAreaTipoMotivoId,
  selectedOrigenId,
  selectedComponenteId,
  onSelect,
  onAfterSelect,
  tablaVirtual = EMPTY_TABLA_VIRTUAL,
  stepHint = "Paso 4 de 7",
  soloTablasDimensionales = false,
}: Step3SelectComponenteMuestreoProps) {
  const [componentes, setComponentes] = useState<ComponenteDeOrigen[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (selectedOrigenId == null) {
      setComponentes([]);
      return;
    }
    setIsLoading(true);
    const resolveLista = async (): Promise<ComponenteDeOrigen[]> => {
      try {
        const lista = await loadComponentesByOrigen(selectedOrigenId);
        if (lista.length > 0) return lista;
      } catch {
        /* fallback a tabla virtual */
      }
      if (selectedArea && selectedAreaTipoMotivoId != null) {
        return fromVirtual(
          tablaVirtual,
          selectedArea.codigo_area,
          selectedAreaTipoMotivoId,
          selectedOrigenId,
        );
      }
      return [];
    };

    resolveLista()
      .then(async (lista) => {
        if (cancelled) return;
        if (!soloTablasDimensionales || selectedAreaTipoMotivoId == null) {
          setComponentes(lista);
          return;
        }
        const flags = await Promise.all(
          lista.map((c) =>
            componenteTieneTablaDimensional(
              selectedAreaTipoMotivoId,
              c.codigo_componente,
            ),
          ),
        );
        if (cancelled) return;
        setComponentes(lista.filter((_, i) => flags[i]));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    selectedArea,
    selectedAreaTipoMotivoId,
    selectedOrigenId,
    tablaVirtual.length,
    soloTablasDimensionales,
  ]);

  const cards: SelectableCard[] = useMemo(
    () =>
      componentes.map((c) => ({
        id: c.codigo_componente,
        title: c.nombre_componente,
        subtitle: `Componente #${c.codigo_componente}`,
      })),
    [componentes],
  );

  return (
    <div className="space-y-6">
      <div>
        <span className="text-sm text-primary font-medium">{stepHint}</span>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Selecciona el componente
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {soloTablasDimensionales
            ? "Solo se listan componentes con tabla dinámica de tipo Dimensional."
            : "Componentes ligados al origen elegido."}
        </p>
      </div>

      {!selectedArea ||
      selectedAreaTipoMotivoId == null ||
      selectedOrigenId == null ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          Completa los pasos anteriores primero.
        </div>
      ) : (
        <SelectCardGrid
          items={cards}
          selectedId={selectedComponenteId}
          onSelect={(id) => {
            const c = componentes.find((x) => x.codigo_componente === id);
            if (c) {
              onSelect(
                c.codigo_componente,
                c.nombre_componente,
                c.codigo_origen_componente,
                c.unidades,
                c.requiere_passcode,
              );
            }
          }}
          onAfterSelect={onAfterSelect}
          icon={Cpu}
          filterPlaceholder="Filtrar componentes..."
          emptyMessage={
            soloTablasDimensionales
              ? "Ningún componente de este origen tiene tabla dinámica dimensional."
              : "No hay componentes disponibles para este origen."
          }
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

"use client";

/**
 * Selección de causa de defecto del origen_componente elegido.
 * Usa causaDefectoService; si vacío, cae a la tabla virtual.
 */
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import SelectCardGrid, {
  type SelectableCard,
} from "./select-card-grid";
import type { Area, CausaDefecto, MuestreoTablaVirtual } from "@/types/integrations/muestreos-ddpp";
import { loadCausasByOrigenComponente } from "@/lib/integrations/muestreos-ddpp/flujo-seleccion";
import { EMPTY_TABLA_VIRTUAL } from "@/lib/integrations/muestreos-ddpp/tabla-virtual-empty";

interface Step4SelectCausaMuestreoProps {
  selectedArea: Area | null;
  selectedAreaTipoMotivoId: number | null;
  selectedOrigenId: number | null;
  selectedComponenteId: number | null;
  selectedOrigenComponenteId?: number | null;
  selectedCausaId: number | null;
  onSelect: (causaId: number, nombreCausa: string) => void;
  onAfterSelect?: () => void;
  tablaVirtual?: MuestreoTablaVirtual[];
  stepHint?: string;
}

function fromVirtual(
  filas: MuestreoTablaVirtual[],
  codigoArea: number,
  codigoAtm: number,
  codigoOrigen: number,
  codigoComponente: number,
): CausaDefecto[] {
  const map = new Map<number, CausaDefecto>();
  for (const f of filas) {
    if (f.codigo_area !== codigoArea) continue;
    if (f.codigo_area_tipo_motivo !== codigoAtm) continue;
    if (f.codigo_origen !== codigoOrigen) continue;
    if (f.codigo_componente !== codigoComponente) continue;
    map.set(f.codigo_causa_defecto, {
      codigo_causa_defecto: f.codigo_causa_defecto,
      codigo_origen_componente: f.codigo_origen_componente,
      nombre_causa_defecto: f.nombre_causa_defecto,
      estado: "A",
      fecha_modificacion: "",
      usuario_modificacion: "",
    });
  }
  return Array.from(map.values()).sort((a, b) =>
    a.nombre_causa_defecto.localeCompare(b.nombre_causa_defecto, "es"),
  );
}

export default function Step4SelectCausaMuestreo({
  selectedArea,
  selectedAreaTipoMotivoId,
  selectedOrigenId,
  selectedComponenteId,
  selectedOrigenComponenteId,
  selectedCausaId,
  onSelect,
  onAfterSelect,
  tablaVirtual = EMPTY_TABLA_VIRTUAL,
  stepHint = "Paso 6 de 7",
}: Step4SelectCausaMuestreoProps) {
  const [causas, setCausas] = useState<CausaDefecto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (selectedOrigenId == null || selectedComponenteId == null) {
      setCausas([]);
      return;
    }
    setIsLoading(true);
    loadCausasByOrigenComponente(
      selectedOrigenId,
      selectedComponenteId,
      selectedOrigenComponenteId,
    )
      .then((lista) => {
        if (cancelled) return;
        if (lista.length > 0) {
          setCausas(lista);
          return;
        }
        if (selectedArea && selectedAreaTipoMotivoId != null) {
          setCausas(
            fromVirtual(
              tablaVirtual,
              selectedArea.codigo_area,
              selectedAreaTipoMotivoId,
              selectedOrigenId,
              selectedComponenteId,
            ),
          );
        } else {
          setCausas([]);
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (selectedArea && selectedAreaTipoMotivoId != null) {
          setCausas(
            fromVirtual(
              tablaVirtual,
              selectedArea.codigo_area,
              selectedAreaTipoMotivoId,
              selectedOrigenId,
              selectedComponenteId,
            ),
          );
        } else {
          setCausas([]);
        }
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
    selectedComponenteId,
    selectedOrigenComponenteId,
    tablaVirtual.length,
  ]);

  const cards: SelectableCard[] = useMemo(
    () =>
      causas.map((c) => ({
        id: c.codigo_causa_defecto,
        title: c.nombre_causa_defecto,
        subtitle: `Causa #${c.codigo_causa_defecto}`,
      })),
    [causas],
  );

  return (
    <div className="space-y-6">
      <div>
        <span className="text-sm text-primary font-medium">{stepHint}</span>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Selecciona la causa de defecto
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Causas del origen y componente seleccionados.
        </p>
      </div>

      {!selectedArea ||
      selectedAreaTipoMotivoId == null ||
      selectedOrigenId == null ||
      selectedComponenteId == null ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          Completa los pasos anteriores primero.
        </div>
      ) : (
        <SelectCardGrid
          items={cards}
          selectedId={selectedCausaId}
          onSelect={(id) => {
            const c = causas.find((x) => x.codigo_causa_defecto === id);
            if (c) onSelect(c.codigo_causa_defecto, c.nombre_causa_defecto);
          }}
          onAfterSelect={onAfterSelect}
          icon={AlertTriangle}
          filterPlaceholder="Filtrar causas..."
          emptyMessage="No hay causas registradas para esta combinación."
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

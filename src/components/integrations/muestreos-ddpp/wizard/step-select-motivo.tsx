"use client";

/**
 * Motivos (ATM) del área, en vivo vía areaTipoMotivo + tipoMotivo.
 * Excluye muestreos de calidad (tienen wizard propio).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Tag } from "lucide-react";
import SelectCardGrid, {
  type SelectableCard,
} from "@/components/integrations/muestreos-ddpp/wizard/select-card-grid";
import type { Area } from "@/types/integrations/muestreos-ddpp";
import {
  esMotivoMuestreoCalidad,
  esMotivoParoMaquina,
  loadMotivosByArea,
  type MotivoDeArea,
} from "@/lib/integrations/muestreos-ddpp/flujo-seleccion";

interface StepSelectMotivoProps {
  selectedArea: Area | null;
  selectedMotivoId: number | null;
  onSelect: (motivoId: number, nombreMotivo: string) => void;
  onAfterSelect?: () => void;
  stepHint?: string;
  /** Excluye motivos de muestreo de calidad (flujo /samplings). Default true. */
  excludeMuestreoCalidad?: boolean;
  /** Excluye paros de máquina (flujo /parosM). Default false. */
  excludeParoMaquina?: boolean;
  /** Filtro extra por nombre (DEFECTO, DEVOLUCION, PARO DE, …). */
  matchesMotivo?: (nombre: string | undefined | null) => boolean;
  /** Elige solo el motivo filtrado y avanza si es único. */
  autoSelect?: boolean;
}

export default function StepSelectMotivo({
  selectedArea,
  selectedMotivoId,
  onSelect,
  onAfterSelect,
  stepHint = "Paso 1 de 6",
  excludeMuestreoCalidad = true,
  excludeParoMaquina = false,
  matchesMotivo,
  autoSelect = false,
}: StepSelectMotivoProps) {
  const [motivos, setMotivos] = useState<MotivoDeArea[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!selectedArea) {
      setMotivos([]);
      return;
    }
    setIsLoading(true);
    loadMotivosByArea(selectedArea.codigo_area, (nombre) => {
      if (excludeMuestreoCalidad && esMotivoMuestreoCalidad(nombre)) return false;
      if (excludeParoMaquina && esMotivoParoMaquina(nombre)) return false;
      if (matchesMotivo && !matchesMotivo(nombre)) return false;
      return true;
    })
      .then((lista) => {
        if (!cancelled) setMotivos(lista);
      })
      .catch(() => {
        if (!cancelled) setMotivos([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedArea, excludeMuestreoCalidad, excludeParoMaquina, matchesMotivo]);

  const cards: SelectableCard[] = useMemo(
    () =>
      motivos.map((m) => ({
        id: m.codigo_area_tipo_motivo,
        title: m.nombre_tipo_motivo,
        subtitle: `ATM #${m.codigo_area_tipo_motivo}`,
      })),
    [motivos],
  );

  const autoDoneForAreaRef = useRef<number | null>(null);
  useEffect(() => {
    autoDoneForAreaRef.current = null;
  }, [selectedArea?.codigo_area]);

  useEffect(() => {
    if (!autoSelect || isLoading || motivos.length === 0 || !selectedArea) {
      return;
    }
    const yaValido =
      selectedMotivoId != null &&
      motivos.some((m) => m.codigo_area_tipo_motivo === selectedMotivoId);
    if (yaValido) return;
    if (autoDoneForAreaRef.current === selectedArea.codigo_area) return;
    autoDoneForAreaRef.current = selectedArea.codigo_area;
    const pick = motivos[0];
    onSelect(pick.codigo_area_tipo_motivo, pick.nombre_tipo_motivo);
    if (motivos.length === 1) onAfterSelect?.();
  }, [
    autoSelect,
    isLoading,
    motivos,
    selectedArea,
    selectedMotivoId,
    onSelect,
    onAfterSelect,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <span className="text-sm text-primary font-medium">{stepHint}</span>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Selecciona el motivo
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {excludeMuestreoCalidad && excludeParoMaquina
            ? "Motivos operativos del área. Muestreos de calidad y paros de máquina tienen su propio flujo."
            : excludeMuestreoCalidad
              ? "Motivos activos del área. Los de muestreo de calidad se capturan en /samplings."
              : "Motivos activos asociados al área seleccionada."}
        </p>
      </div>

      {!selectedArea ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          No hay un área resuelta para tu departamento.
        </div>
      ) : (
        <SelectCardGrid
          items={cards}
          selectedId={selectedMotivoId}
          onSelect={(id) => {
            const m = motivos.find((x) => x.codigo_area_tipo_motivo === id);
            if (m) onSelect(m.codigo_area_tipo_motivo, m.nombre_tipo_motivo);
          }}
          onAfterSelect={onAfterSelect}
          icon={Tag}
          filterPlaceholder="Filtrar motivos..."
          emptyMessage="No hay motivos operativos para esta área."
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

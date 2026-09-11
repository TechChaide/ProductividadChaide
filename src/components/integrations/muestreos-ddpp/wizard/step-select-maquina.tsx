"use client";

/**
 * Paso "Máquina" del wizard (hoy solo Paros, vía
 * `ProcesoCapturaWizardConfig.requiereSeleccionMaquina`).
 *
 * A diferencia de Motivo/Origen/Componente/Causa (que se resuelven por la
 * ruta ATM elegida), la máquina depende de la regional + área del área ya
 * resuelta por `useAreaDesdeDepartamento` — no del origen/componente/causa
 * elegidos en los pasos anteriores.
 */
import { useMemo } from "react";
import { Factory } from "lucide-react";
import SelectCardGrid, {
  type SelectableCard,
} from "@/components/integrations/muestreos-ddpp/wizard/select-card-grid";
import { useMaquinaParo } from "@/hooks/integrations/muestreos-ddpp/use-maquina-paro";

interface StepSelectMaquinaProps {
  regional: string;
  nombreArea: string;
  selectedMaquina: string;
  onSelect: (maquina: string) => void;
  onAfterSelect?: () => void;
  stepHint?: string;
}

export default function StepSelectMaquina({
  regional,
  nombreArea,
  selectedMaquina,
  onSelect,
  onAfterSelect,
  stepHint = "Paso",
}: StepSelectMaquinaProps) {
  const { maquinaOptions, maquinasLoading, maquinaHint } = useMaquinaParo(
    regional,
    nombreArea,
  );

  const cards: SelectableCard[] = useMemo(
    () => maquinaOptions.map((o) => ({ id: o.value, title: o.label })),
    [maquinaOptions],
  );

  return (
    <div className="space-y-6">
      <div>
        <span className="text-sm text-primary font-medium">{stepHint}</span>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Factory className="h-5 w-5 text-primary" />
          Selecciona la máquina
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Máquina donde ocurrió el paro. Obligatoria para continuar.
          {maquinaHint ? ` ${maquinaHint}.` : ""}
        </p>
      </div>

      <SelectCardGrid
        items={cards}
        selectedId={selectedMaquina || null}
        onSelect={(id) => onSelect(String(id))}
        onAfterSelect={onAfterSelect}
        icon={Factory}
        filterPlaceholder="Filtrar máquinas..."
        emptyMessage="No hay máquinas para esta regional y área."
        isLoading={maquinasLoading}
      />
    </div>
  );
}

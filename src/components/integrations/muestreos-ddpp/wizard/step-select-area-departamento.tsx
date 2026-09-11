"use client";

import { useMemo } from "react";
import { Building2 } from "lucide-react";
import SelectCardGrid from "@/components/integrations/muestreos-ddpp/wizard/select-card-grid";
import type { Area } from "@/types/integrations/muestreos-ddpp";

interface StepSelectAreaDepartamentoProps {
  areas: Area[];
  departamento: string;
  selectedAreaId: number | null;
  onSelect: (area: Area) => void;
  onAfterSelect?: () => void;
  stepHint?: string;
}

export default function StepSelectAreaDepartamento({
  areas,
  departamento,
  selectedAreaId,
  onSelect,
  onAfterSelect,
  stepHint,
}: StepSelectAreaDepartamentoProps) {
  const items = useMemo(
    () =>
      areas.map((a) => ({
        id: a.codigo_area,
        title: a.nombre_area ?? `Área ${a.codigo_area}`,
        subtitle: a.nombre_ficha_social
          ? `Ficha: ${a.nombre_ficha_social}`
          : undefined,
        extra: a.regional ? `Regional ${a.regional}` : undefined,
      })),
    [areas],
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">{stepHint}</p>
        <h2 className="text-lg font-semibold mt-1">Selecciona el área</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tu departamento{" "}
          <span className="font-medium text-foreground">{departamento}</span>{" "}
          está asociado a más de un área. Elige con cuál vas a trabajar antes
          de continuar.
        </p>
      </div>
      <SelectCardGrid
        items={items}
        selectedId={selectedAreaId}
        onSelect={(id) => {
          const area = areas.find((a) => a.codigo_area === Number(id));
          if (area) onSelect(area);
        }}
        onAfterSelect={onAfterSelect}
        icon={Building2}
        filterPlaceholder="Buscar área..."
        emptyMessage="No hay áreas disponibles para tu departamento."
      />
    </div>
  );
}

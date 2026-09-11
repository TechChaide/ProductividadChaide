"use client";

/**
 * Máquinas para el paso de captura de Paros.
 *
 * Diferencia con Captura (`useCapturaCatalogos`): allá el `nombre_area`
 * que exige el backend (`getMAquinasByCentroYAreaOrigen`) se resuelve a
 * partir del ORIGEN elegido en el wizard (`nombreAreaPorOrigen`). Acá el
 * área ya viene resuelta por `useAreaDesdeDepartamento` cruzando el
 * DEPARTAMENTO del usuario logueado con `Area.nombre_ficha_social` — se
 * usa directo `selectedArea.nombre_area`, sin volver a resolverla desde
 * el origen.
 */
import { useEffect, useState } from "react";
import type { CatalogOption } from "@/components/integrations/muestreos-ddpp/shared/catalog-select";
import { serviciosMuestreosService } from "@/services/integrations/muestreos-ddpp/serviciosMuestreos.service";
import { extractList } from "@/lib/integrations/muestreos-ddpp/extract-list";
import { pickMaquinaLabel } from "@/lib/integrations/muestreos-ddpp/resolve-area-departamento";

export function useMaquinaParo(regional: string, nombreArea: string) {
  const [maquinaOptions, setMaquinaOptions] = useState<CatalogOption[]>([]);
  const [maquinasLoading, setMaquinasLoading] = useState(false);
  const [maquinaHint, setMaquinaHint] = useState("");

  const centro = regional.trim();
  const area = nombreArea.trim();

  useEffect(() => {
    if (!area) {
      setMaquinaOptions([]);
      setMaquinaHint("");
      return;
    }
    let cancelled = false;
    const load = async () => {
      setMaquinasLoading(true);
      try {
        const res = await serviciosMuestreosService.getMAquinasByCentroYAreaOrigen(
          centro,
          area,
        );
        if (cancelled) return;
        const seen = new Set<string>();
        const options: CatalogOption[] = [];
        extractList<Record<string, unknown>>(res).forEach((row) => {
          const label = pickMaquinaLabel(row);
          if (!label || seen.has(label)) return;
          seen.add(label);
          options.push({ value: label, label });
        });
        options.sort((a, b) => a.label.localeCompare(b.label, "es"));
        setMaquinaOptions(options);
        setMaquinaHint(`Regional ${centro || "—"} · área ${area}`);
      } catch {
        if (!cancelled) {
          setMaquinaOptions([]);
          setMaquinaHint("");
        }
      } finally {
        if (!cancelled) setMaquinasLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [centro, area]);

  return { maquinaOptions, maquinasLoading, maquinaHint };
}

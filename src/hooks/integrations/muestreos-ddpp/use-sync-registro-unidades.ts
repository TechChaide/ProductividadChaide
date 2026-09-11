"use client";

import { useEffect, useState } from "react";
import { componenteService } from "@/services/integrations/muestreos-ddpp/componente.service";
import { extractList, pickRowField } from "@/lib/integrations/muestreos-ddpp/extract-list";
import type { Componente } from "@/types/integrations/muestreos-ddpp";

function extractComponenteRecord(res: unknown): Record<string, unknown> | null {
  if (!res || typeof res !== "object") return null;
  const obj = res as Record<string, unknown>;
  let data: unknown = obj.data ?? obj;

  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }

  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === "object"
      ? (first as Record<string, unknown>)
      : null;
  }

  if (data && typeof data === "object") {
    return data as Record<string, unknown>;
  }

  return null;
}

function unidadesFromRecord(record: Record<string, unknown> | null): string {
  if (!record) return "";
  return pickRowField(record, ["unidades", "Unidades"]);
}

/**
 * Resuelve `Componente.unidades` por PK y notifica al formulario de captura.
 * El valor se persiste en `Registro.unidades` (campo oculto; puede ir vacío).
 */
export function useSyncRegistroUnidades(
  codigoComponente: number | null | undefined,
  onUnidades: (unidades: string) => void,
  unidadesIniciales?: string,
) {
  const [isLoadingUnidades, setIsLoadingUnidades] = useState(false);

  useEffect(() => {
    const seed = (unidadesIniciales ?? "").trim();
    if (seed) {
      onUnidades(seed);
    }
  }, [unidadesIniciales, onUnidades]);

  useEffect(() => {
    if (codigoComponente == null || codigoComponente <= 0) {
      onUnidades("");
      return;
    }

    let cancelled = false;
    setIsLoadingUnidades(true);

    componenteService
      .getById(codigoComponente)
      .then(async (res) => {
        if (cancelled) return;

        let unidades = unidadesFromRecord(extractComponenteRecord(res));

        if (!unidades) {
          const allRes = await componenteService.getAll();
          const lista = extractList<Componente>(allRes);
          const match = lista.find((c) => c.codigo_componente === codigoComponente);
          unidades = (match?.unidades ?? "").trim();
        }

        onUnidades(unidades);
      })
      .catch(async () => {
        if (cancelled) return;

        try {
          const allRes = await componenteService.getAll();
          const lista = extractList<Componente>(allRes);
          const match = lista.find((c) => c.codigo_componente === codigoComponente);
          const unidades = (match?.unidades ?? "").trim();
          onUnidades(unidades);
        } catch {
          onUnidades("");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingUnidades(false);
      });

    return () => {
      cancelled = true;
    };
  }, [codigoComponente, onUnidades]);

  return { isLoadingUnidades };
}

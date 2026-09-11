"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyTipoMedicionPolicy,
  resolveTiposMedicionParaComponente,
  type TipoMedicionFlujoPolicy,
  type TipoMedicionOption,
} from "@/lib/integrations/muestreos-ddpp/tipo-medicion-tabla";

/**
 * Resuelve si el ATM × componente tiene tabla dinámica.
 * Si no hay asociaciones, selecciona captura simple y marca el paso
 * de tipo de medición como omitible (salvo `allowSinTabla: false`).
 */
export function useTipoMedicionFlujo(
  codigoAreaTipoMotivo: number | null,
  codigoComponente: number | null,
  policy?: TipoMedicionFlujoPolicy,
) {
  const [selectedTipoMedicion, setSelectedTipoMedicion] =
    useState<TipoMedicionOption | null>(null);
  const [tiposMedicionCount, setTiposMedicionCount] = useState<number | null>(
    null,
  );
  const [skipTipoMedicion, setSkipTipoMedicion] = useState(false);
  const skipRef = useRef(false);
  const policyRef = useRef(policy);
  policyRef.current = policy;

  const applyResolved = useCallback((tipos: TipoMedicionOption[]) => {
    const resolved = applyTipoMedicionPolicy(tipos, policyRef.current);
    skipRef.current = resolved.skip;
    setSkipTipoMedicion(resolved.skip);
    setTiposMedicionCount(resolved.options.length);
    if (resolved.selected) {
      setSelectedTipoMedicion(resolved.selected);
    } else if (resolved.options.length === 0) {
      setSelectedTipoMedicion(null);
    }
  }, []);

  useEffect(() => {
    if (codigoAreaTipoMotivo == null || codigoComponente == null) {
      skipRef.current = false;
      setSkipTipoMedicion(false);
      setTiposMedicionCount(null);
      setSelectedTipoMedicion(null);
      return;
    }

    skipRef.current = false;
    setSkipTipoMedicion(false);
    setTiposMedicionCount(null);
    let cancelled = false;

    resolveTiposMedicionParaComponente(
      codigoAreaTipoMotivo,
      codigoComponente,
    )
      .then((tipos) => {
        if (cancelled) return;
        applyResolved(tipos);
      })
      .catch(() => {
        if (cancelled) return;
        skipRef.current = false;
        setSkipTipoMedicion(false);
        setTiposMedicionCount(0);
        setSelectedTipoMedicion(null);
      });

    return () => {
      cancelled = true;
    };
  }, [codigoAreaTipoMotivo, codigoComponente, applyResolved]);

  const handleTiposMedicionLoaded = useCallback(
    (options: TipoMedicionOption[]) => {
      const resolved = applyTipoMedicionPolicy(options, {
        ...policyRef.current,
        filtro: undefined,
      });
      skipRef.current = resolved.skip;
      setSkipTipoMedicion(resolved.skip);
      setTiposMedicionCount(resolved.options.length);
      if (resolved.selected) {
        setSelectedTipoMedicion(resolved.selected);
      } else if (resolved.options.length === 0) {
        setSelectedTipoMedicion(null);
      }
    },
    [],
  );

  const resetTipoMedicion = useCallback(() => {
    skipRef.current = false;
    setSkipTipoMedicion(false);
    setTiposMedicionCount(null);
    setSelectedTipoMedicion(null);
  }, []);

  return {
    selectedTipoMedicion,
    setSelectedTipoMedicion,
    tiposMedicionCount,
    skipTipoMedicion,
    skipRef,
    handleTiposMedicionLoaded,
    resetTipoMedicion,
  };
}

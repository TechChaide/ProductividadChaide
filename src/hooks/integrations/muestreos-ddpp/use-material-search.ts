"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { serviciosMuestreosService } from "@/services/integrations/muestreos-ddpp/serviciosMuestreos.service";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

export interface MaterialResult {
  CENTRO: string;
  MATERIAL: string;
  DESCRIPCION: string;
}

function castCentro(regional: string): string {
  const r = regional.trim().toUpperCase();
  if (r === "GYE") return "2000";
  return "1000";
}

export function useMaterialSearch(centro: string, resp: string) {
  const { toast } = useToast();
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<MaterialResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const abortar = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortar();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [abortar]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    abortar();

    const query = termino.trim();
    if (query.length < MIN_CHARS) {
      setResultados([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const json = await serviciosMuestreosService.getMaterialesByCentroResponsablesAsYouType(
          { Centro: castCentro(centro), Busqueda: query },
          controller.signal,
        );
        if (!mountedRef.current) return;

        if (json.cached) setLoading(false);

        setResultados(json.data ?? []);
        setError(null);
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (
          err instanceof Error &&
          (err.name === "CanceledError" || err.name === "AbortError")
        )
          return;
        const msg =
          err instanceof Error ? err.message : "Error al buscar materiales";
        setError(msg);
        setResultados([]);
        toast({
          title: "Error de búsqueda",
          description: msg,
          variant: "destructive",
        });
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [termino, centro, resp, abortar, toast]);

  return { termino, setTermino, resultados, loading, error, abortar };
}

"use client";

import { useEffect, useState } from "react";
import type { Area } from "@/types/integrations/muestreos-ddpp";
import { areaService } from "@/services/integrations/muestreos-ddpp/area.service";
import { serviciosService } from "@/services/integrations/muestreos-ddpp/servicios.service";
import { extractList } from "@/lib/integrations/muestreos-ddpp/extract-list";
import {
  matchAreasByDepartamento,
  parseFichaFromResponse,
  pickDepartamentoFromFicha,
  pickRegionalFromFicha,
} from "@/lib/integrations/muestreos-ddpp/resolve-area-departamento";
import { getCodigoPersonaSesion } from "@/lib/integrations/muestreos-ddpp/session-storage";
import { useUser } from "@/context/user-context";

/**
 * Resuelve el área del usuario cruzando su departamento con `area.getAll()`.
 *
 * Adaptado para ProductividadChaide: primero intenta resolver con
 * `UserContext.user.department` (ya conocido, sin llamadas extra). Si no
 * hay `department`, o el cruce es ambiguo (0 o >1 áreas sin poder
 * desempatar por regional), cae al lookup remoto original —
 * `serviciosService.getInformacionUsuarioByCodigoEmpleado` — usando el
 * `codigo_empleado`/`id_usuario` de la sesión embebida (login propio de
 * este feature, ver `session-gate.tsx`).
 */
export function useAreaDesdeDepartamento() {
  const { user: contextUser } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codigoPersona, setCodigoPersona] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [regional, setRegional] = useState("");
  const [areasMatch, setAreasMatch] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadViaRemoteFicha = async (codigo: string) => {
      const [fichaRes, areasRes] = await Promise.all([
        serviciosService.getInformacionUsuarioByCodigoEmpleado(codigo),
        areaService.getAll(),
      ]);
      if (cancelled) return;

      const ficha = parseFichaFromResponse(fichaRes);
      const depto = pickDepartamentoFromFicha(ficha);
      const regionalFicha = pickRegionalFromFicha(ficha);
      setDepartamento(depto);
      setRegional(regionalFicha);

      if (!depto) {
        setAreasMatch([]);
        setSelectedArea(null);
        setError(
          "La ficha del usuario no tiene DEPARTAMENTO. No se puede cruzar con las áreas.",
        );
        return;
      }

      const areas = extractList<Area>(areasRes);
      const areasFallback = Array.isArray((areasRes as { data?: unknown })?.data)
        ? ((areasRes as { data: Area[] }).data)
        : [];
      const match = matchAreasByDepartamento(
        areas.length > 0 ? areas : areasFallback,
        depto,
        regionalFicha,
      );
      setAreasMatch(match);
      setSelectedArea(match.length === 1 ? (match[0] ?? null) : null);
      if (match.length === 0) {
        setError(
          regionalFicha
            ? `No hay un área activa cuyo nombre de ficha social coincida con el departamento "${depto}" en la regional "${regionalFicha}".`
            : `No hay un área activa cuyo nombre de ficha social coincida con el departamento "${depto}".`,
        );
      }
    };

    const load = async () => {
      setIsLoading(true);
      setError(null);

      // 1) Camino rápido: usar el departamento ya conocido por ProductividadChaide.
      const deptoContext = (contextUser?.department ?? "").trim();
      const codigoContext = (contextUser?.code ?? "").trim();
      if (deptoContext) {
        try {
          const areasRes = await areaService.getAll();
          if (cancelled) return;
          const areas = extractList<Area>(areasRes);
          const match = matchAreasByDepartamento(areas, deptoContext);
          if (match.length === 1) {
            setCodigoPersona(codigoContext);
            setDepartamento(deptoContext);
            setRegional("");
            setAreasMatch(match);
            setSelectedArea(match[0] ?? null);
            setIsLoading(false);
            return;
          }
          // Ambiguo (0 o >1 áreas): cae al lookup remoto para desempatar por regional.
        } catch {
          // Sigue al lookup remoto.
        }
      }

      // 2) Fallback: sesión embebida propia (login del feature) + ficha remota.
      const codigo = getCodigoPersonaSesion() || codigoContext;
      setCodigoPersona(codigo);
      if (!codigo) {
        setIsLoading(false);
        setError(
          "No se encontró un identificador de usuario en la sesión. Vuelve a iniciar sesión.",
        );
        return;
      }
      try {
        await loadViaRemoteFicha(codigo);
      } catch (err) {
        if (cancelled) return;
        setAreasMatch([]);
        setSelectedArea(null);
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo consultar el departamento o las áreas.",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextUser?.department, contextUser?.code]);

  return {
    isLoading,
    error,
    codigoPersona,
    departamento,
    regional,
    areasMatch,
    selectedArea,
    setSelectedArea,
  };
}

"use client";

/**
 * Contraseña requerida para iniciar un registro de "Paros" en este feature
 * embebido. Vive en la tabla `configuracion` del sistema de Seguridades
 * compartido (backend seguridadesGuard, no el de ProductividadChaide),
 * fila con `nombre_configuracion = "PASSCODE_PAROS"` y
 * `codigo_aplicacion = "APP_MUESTREOS"`.
 */
import { useEffect, useState } from "react";
import { configuracionMuestreosDdppService } from "@/services/integrations/muestreos-ddpp/configuracion.service";
import { extractList, pickRowField } from "@/lib/integrations/muestreos-ddpp/extract-list";
import type { Configuracion } from "@/types/integrations/muestreos-ddpp";

const NOMBRE_CONFIGURACION = "PASSCODE_PAROS";

export function usePasscodeParos() {
  const [passcode, setPasscode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await configuracionMuestreosDdppService.getConfigrucacionesByCodigoAplicacion();
        if (cancelled) return;
        const lista = extractList<Configuracion>(res);
        const fila = lista.find((c) => {
          const nombre = (c.nombre_configuracion ?? "").trim().toUpperCase();
          const activa = !c.estado || c.estado === "A";
          return nombre === NOMBRE_CONFIGURACION && activa;
        });
        const valor = fila
          ? pickRowField(fila as unknown as Record<string, unknown>, [
              "valor_configuracion",
            ])
          : "";
        if (!valor) {
          setError(
            `No se encontró la configuración "${NOMBRE_CONFIGURACION}" (codigo_aplicacion=APP_MUESTREOS).`,
          );
        }
        setPasscode(valor || null);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar la contraseña de paros.",
        );
        setPasscode(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { passcode, isLoading, error };
}

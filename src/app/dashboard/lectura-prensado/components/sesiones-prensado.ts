import { sesionService } from "@/services/sesion.service";
import type { Sesion } from "@/types/interfaces";

export async function sesionesActivas(codigoOperador: string): Promise<Sesion[]> {
  const response = await sesionService.getByCodigoOperador(codigoOperador);
  return (response.data || []).filter((s) => s.tipo_evento === "beg" && s.estado === "A");
}

/** Ejecuta la operación para cada código y, si alguna falla, lanza un error que las lista todas. */
async function paraCada(
  codigos: string[],
  accion: string,
  operacion: (codigo: string) => Promise<void>
): Promise<void> {
  const resultados = await Promise.allSettled(codigos.map(operacion));
  const fallidos = resultados.flatMap((r, i) =>
    r.status === "rejected"
      ? [`${codigos[i]} (${r.reason instanceof Error ? r.reason.message : "error desconocido"})`]
      : []
  );
  if (fallidos.length > 0) {
    throw new Error(`No se pudo ${accion} la sesión de: ${fallidos.join(", ")}.`);
  }
}

/**
 * Registra el inicio de sesión ('beg') de cada operador en la estación. Igual que el resto de
 * módulos, antes desactiva cualquier sesión 'beg' que el operador tuviera abierta, así un
 * reintento tras un fallo parcial no deja sesiones duplicadas.
 */
export function iniciarSesionesPrensado(
  codigos: string[],
  codigoEstacion: number,
  codigoRcp: number
): Promise<void> {
  return paraCada(codigos, "iniciar", async (codigo) => {
    const previas = await sesionesActivas(codigo);
    await Promise.all(previas.map((s) => sesionService.delete(s.codigo_sesion)));
    await sesionService.save({
      codigo_sesion: 0,
      codigo_estacion: codigoEstacion,
      codigo_rcp: codigoRcp,
      codigo_operador: codigo,
      tipo_evento: "beg",
      estado: "A",
      fecha_evento: new Date().toISOString(),
    });
  });
}

/**
 * Códigos de operador que siguen con sesión 'beg' activa en la estación. Sirve para detectar a
 * quien se trasladó a otra estación. Devuelve null si no se pudo consultar: quien llama sigue
 * con el equipo que tiene, para no detener el proceso por una falla de red.
 */
export async function operadoresConSesionEn(
  codigos: string[],
  codigoEstacion: number
): Promise<Set<string> | null> {
  try {
    const activos = await Promise.all(
      codigos.map(async (codigo) =>
        (await sesionesActivas(codigo)).some((s) => s.codigo_estacion === codigoEstacion)
          ? codigo
          : null
      )
    );
    return new Set(activos.filter((c): c is string => c !== null));
  } catch (err) {
    console.warn("[LECTURA-PRENSADO] No se pudo validar las sesiones del equipo:", err);
    return null;
  }
}

/** Cierra la sesión de cada operador en la estación: registra el 'fh' y desactiva el 'beg'. */
export function cerrarSesionesPrensado(codigos: string[], codigoEstacion: number): Promise<void> {
  return paraCada(codigos, "cerrar", async (codigo) => {
    const abiertas = (await sesionesActivas(codigo)).filter(
      (s) => s.codigo_estacion === codigoEstacion
    );
    for (const beg of abiertas) {
      await sesionService.save({
        codigo_sesion: 0,
        codigo_estacion: beg.codigo_estacion,
        codigo_rcp: beg.codigo_rcp,
        codigo_operador: beg.codigo_operador,
        tipo_evento: "fh",
        estado: "A",
        fecha_evento: new Date().toISOString(),
      });
      await sesionService.delete(beg.codigo_sesion);
    }
  });
}

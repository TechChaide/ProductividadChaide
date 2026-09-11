/**
 * Persistencia del wizard unificado de procesos (`/dashboard/procesos/captura`).
 */
import type { MuestreoTablaVirtual } from "@/types/integrations/muestreos-ddpp";

const KEY_RUTA = "muestreosDdpp:proceso:ruta";
const KEY_RUTA_PARCIAL = "muestreosDdpp:proceso:rutaParcial";

export interface ProcesoRuta {
  codigo_area?: number;
  codigo_area_tipo_motivo?: number;
  codigo_origen?: number;
  codigo_origen_componente?: number;
  codigo_componente?: number;
  codigo_causa_defecto?: number;
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    if (value == null) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    /* ignorar */
  }
}

export const procesoRutaParcialStorage = {
  get(): ProcesoRuta {
    return readJson<ProcesoRuta>(KEY_RUTA_PARCIAL) ?? {};
  },
  set(ruta: ProcesoRuta): void {
    writeJson(KEY_RUTA_PARCIAL, ruta);
  },
  clear(): void {
    writeJson(KEY_RUTA_PARCIAL, null);
  },
};

export const procesoRutaStorage = {
  get(): MuestreoTablaVirtual | null {
    return readJson<MuestreoTablaVirtual>(KEY_RUTA);
  },
  set(fila: MuestreoTablaVirtual | null): void {
    writeJson(KEY_RUTA, fila);
  },
  clear(): void {
    writeJson(KEY_RUTA, null);
  },
};

export function clearAllProcesoStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY_RUTA);
    window.sessionStorage.removeItem(KEY_RUTA_PARCIAL);
  } catch {
    /* ignorar */
  }
}

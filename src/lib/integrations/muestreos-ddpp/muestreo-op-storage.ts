/**
 * Persistencia del wizard de Muestreos, variante operador
 * (`/dashboard/procesos/samplingsOp` en el proyecto origen).
 * Keys propias (`muestreoOp:*`) para no chocar con la variante inspector.
 */
import type { MuestreoTablaVirtual } from "@/types/integrations/muestreos-ddpp";
import type { ProcesoRutaPartial } from "@/components/integrations/muestreos-ddpp/wizard/proceso-wizard-types";

const KEY_RUTA = "muestreosDdpp:muestreoOp:ruta";
const KEY_RUTA_PARCIAL = "muestreosDdpp:muestreoOp:rutaParcial";

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
    /* sessionStorage lleno o bloqueado */
  }
}

export const muestreoOpRutaParcialStorage = {
  get(): ProcesoRutaPartial {
    return readJson<ProcesoRutaPartial>(KEY_RUTA_PARCIAL) ?? {};
  },
  set(ruta: ProcesoRutaPartial): void {
    writeJson(KEY_RUTA_PARCIAL, ruta);
  },
  clear(): void {
    writeJson(KEY_RUTA_PARCIAL, null);
  },
};

export const muestreoOpRutaStorage = {
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

export function clearAllMuestreoOpStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY_RUTA);
    window.sessionStorage.removeItem(KEY_RUTA_PARCIAL);
  } catch {
    /* ignorar */
  }
}

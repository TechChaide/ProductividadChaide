/**
 * Persistencia ligera del flujo de Paros (`/dashboard/procesos/paros`).
 *
 * El wizard resuelve Área + Motivo automáticamente; el usuario elige
 * Origen → Componente → Causa. Al completar la ruta (o al iniciar el
 * cronómetro) se persiste la fila consolidada + el estado del
 * cronómetro en `sessionStorage`.
 */

import type { MuestreoTablaVirtual } from "@/types/integrations/muestreos-ddpp";

const KEY_FILA = "muestreosDdpp:paro:fila";
const KEY_RUTA_PARCIAL = "muestreosDdpp:paro:rutaParcial";
const KEY_INICIO_MS = "muestreosDdpp:paro:inicioMs";
const KEY_TIEMPO_SEGUNDOS = "muestreosDdpp:paro:tiempoSegundos";
const KEY_MAQUINA = "muestreosDdpp:paro:maquina";

export interface ParoRutaPartial {
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

function readNumber(key: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeValue(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value == null) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, value);
    }
  } catch {
    /* sessionStorage lleno o bloqueado */
  }
}

export const paroRutaParcialStorage = {
  get(): ParoRutaPartial {
    return readJson<ParoRutaPartial>(KEY_RUTA_PARCIAL) ?? {};
  },
  set(ruta: ParoRutaPartial): void {
    if (ruta == null || Object.keys(ruta).length === 0) {
      writeValue(KEY_RUTA_PARCIAL, null);
    } else {
      writeValue(KEY_RUTA_PARCIAL, JSON.stringify(ruta));
    }
  },
  clear(): void {
    writeValue(KEY_RUTA_PARCIAL, null);
  },
};

export const paroFilaStorage = {
  get(): MuestreoTablaVirtual | null {
    return readJson<MuestreoTablaVirtual>(KEY_FILA);
  },
  set(fila: MuestreoTablaVirtual | null): void {
    if (fila == null) {
      writeValue(KEY_FILA, null);
    } else {
      writeValue(KEY_FILA, JSON.stringify(fila));
    }
  },
  clear(): void {
    writeValue(KEY_FILA, null);
  },
};

export const paroInicioStorage = {
  get(): number | null {
    return readNumber(KEY_INICIO_MS);
  },
  set(ms: number | null): void {
    writeValue(KEY_INICIO_MS, ms == null ? null : String(ms));
  },
  clear(): void {
    writeValue(KEY_INICIO_MS, null);
  },
};

export const paroTiempoStorage = {
  get(): number | null {
    return readNumber(KEY_TIEMPO_SEGUNDOS);
  },
  set(seconds: number | null): void {
    writeValue(KEY_TIEMPO_SEGUNDOS, seconds == null ? null : String(seconds));
  },
  clear(): void {
    writeValue(KEY_TIEMPO_SEGUNDOS, null);
  },
};

export const paroMaquinaStorage = {
  get(): string {
    return readJson<string>(KEY_MAQUINA) ?? "";
  },
  set(maquina: string): void {
    if (!maquina) {
      writeValue(KEY_MAQUINA, null);
    } else {
      writeValue(KEY_MAQUINA, JSON.stringify(maquina));
    }
  },
  clear(): void {
    writeValue(KEY_MAQUINA, null);
  },
};

export function clearAllParosStorage(): void {
  paroRutaParcialStorage.clear();
  paroFilaStorage.clear();
  paroInicioStorage.clear();
  paroTiempoStorage.clear();
  paroMaquinaStorage.clear();
}

import type { Asociacion, TipoMedicion } from "@/types/integrations/muestreos-ddpp";
import { asociacionService } from "@/services/integrations/muestreos-ddpp/asociacion.service";
import { tipoMedicionService } from "@/services/integrations/muestreos-ddpp/tipoMedicion.service";

/**
 * Código sintético del "tercer" tipo de medición: captura solo con
 * campos fijos (sin columnas extra). No existe en BD; solo se usa en
 * el wizard de procesos.
 */
export const TIPO_MEDICION_SIN_TABLA_CODIGO = 0;

export type TipoMedicionOption = {
  codigo_tipo_medicion: number;
  nombre_tipo_medicion: string;
  /** Nombre de tabla(s) asociadas a este tipo (informativo). */
  tablas: string[];
  /**
   * `true` cuando el flujo no tiene asociaciones activas y la captura
   * solo persistirá `registro` (+ causas), sin columnas dinámicas.
   */
  sinTabla?: boolean;
};

/**
 * Opción fija para flujos sin columnas extra.
 * Nombre orientado al usuario (evita jerga de "tabla dinámica").
 */
export const TIPO_MEDICION_SIN_TABLA: TipoMedicionOption = {
  codigo_tipo_medicion: TIPO_MEDICION_SIN_TABLA_CODIGO,
  nombre_tipo_medicion: "Captura simple",
  tablas: [],
  sinTabla: true,
};

export function isTipoMedicionSinTabla(
  codigo: number | null | undefined,
): boolean {
  return codigo === TIPO_MEDICION_SIN_TABLA_CODIGO;
}

/** Id interno del paso "Tipo medición" en los wizards. */
export const PROCESO_STEP_TIPO_MEDICION = 5;
export const PROCESO_STEPS_TOTAL = 7;

/** True cuando no hay tabla dinámica: no hay que elegir tipo de medición. */
export function shouldSkipTipoMedicionStep(
  options: TipoMedicionOption[],
): boolean {
  return options.length === 0 || options.every((o) => !!o.sinTabla);
}

/** Tipo de medición de tablas dinámicas dimensionales (catálogo `tipo_medicion`). */
export function esTipoMedicionDimensional(
  nombre: string | undefined | null,
): boolean {
  return (nombre ?? "").toUpperCase().includes("DIMENSIONAL");
}

export function esOpcionTablaDimensional(option: TipoMedicionOption): boolean {
  return !option.sinTabla && esTipoMedicionDimensional(option.nombre_tipo_medicion);
}

export type TipoMedicionFlujoPolicy = {
  /** Si se define, solo se consideran las opciones que cumplen el predicado. */
  filtro?: (option: TipoMedicionOption) => boolean;
  /**
   * Default `true`. Si es `false`, un resultado vacío NO cae a captura
   * simple: el paso se muestra vacío y no se puede avanzar.
   */
  allowSinTabla?: boolean;
  /**
   * Si hay exactamente una opción válida, la selecciona y oculta el
   * paso de tipo de medición.
   */
  autoSelectSingle?: boolean;
};

export type TipoMedicionFlujoResolved = {
  options: TipoMedicionOption[];
  skip: boolean;
  selected: TipoMedicionOption | null;
};

/**
 * Aplica la política de un wizard sobre la lista cruda de tipos.
 */
export function applyTipoMedicionPolicy(
  tipos: TipoMedicionOption[],
  policy?: TipoMedicionFlujoPolicy,
): TipoMedicionFlujoResolved {
  const allowSinTabla = policy?.allowSinTabla !== false;
  const autoSelectSingle = policy?.autoSelectSingle === true;
  let options = policy?.filtro ? tipos.filter(policy.filtro) : [...tipos];
  if (!allowSinTabla) {
    options = options.filter((o) => !o.sinTabla);
  }

  if (allowSinTabla && shouldSkipTipoMedicionStep(options)) {
    return {
      options,
      skip: true,
      selected: options[0] ?? { ...TIPO_MEDICION_SIN_TABLA },
    };
  }

  if (autoSelectSingle && options.length === 1) {
    return { options, skip: true, selected: options[0] };
  }

  return { options, skip: false, selected: null };
}

export async function componenteTieneTablaDimensional(
  codigoAreaTipoMotivo: number,
  codigoComponente: number,
): Promise<boolean> {
  const tipos = await resolveTiposMedicionParaComponente(
    codigoAreaTipoMotivo,
    codigoComponente,
  );
  return tipos.some(esOpcionTablaDimensional);
}

export function visibleProcesoSteps<T extends { id: number }>(
  steps: readonly T[],
  skipTipoMedicion: boolean,
  tipoStepId = PROCESO_STEP_TIPO_MEDICION,
): T[] {
  if (!skipTipoMedicion) return [...steps];
  return steps.filter((s) => s.id !== tipoStepId);
}

export function stepHintFor(
  internalStep: number,
  skipTipoMedicion: boolean,
  options?: { total?: number; tipoStepId?: number },
): string {
  const tipoStepId = options?.tipoStepId ?? PROCESO_STEP_TIPO_MEDICION;
  const totalBase = options?.total ?? PROCESO_STEPS_TOTAL;
  const total = skipTipoMedicion ? totalBase - 1 : totalBase;
  const n =
    skipTipoMedicion && internalStep > tipoStepId
      ? internalStep - 1
      : internalStep;
  return `Paso ${n} de ${total}`;
}

export function nextProcesoStep(
  current: number,
  skipTipoMedicion: boolean,
  max = PROCESO_STEPS_TOTAL,
  tipoStepId = PROCESO_STEP_TIPO_MEDICION,
): number {
  let next = current + 1;
  if (skipTipoMedicion && next === tipoStepId) next += 1;
  return next > max ? current : next;
}

export function prevProcesoStep(
  current: number,
  skipTipoMedicion: boolean,
  tipoStepId = PROCESO_STEP_TIPO_MEDICION,
): number {
  let prev = current - 1;
  if (skipTipoMedicion && prev === tipoStepId) prev -= 1;
  return prev < 1 ? 1 : prev;
}

/**
 * Obtiene los tipos de medición distintos definidos en asociaciones
 * activas para un ATM × componente.
 *
 * Para cada `codigo_tipo_medicion` se considera la versión máxima de
 * ese tipo (así no mezclamos tablas distintas del mismo componente).
 *
 * Si no hay asociaciones activas, devuelve el tipo sintético
 * TIPO_MEDICION_SIN_TABLA para que el wizard pueda continuar
 * sin columnas dinámicas.
 */
export async function resolveTiposMedicionParaComponente(
  codigoAreaTipoMotivo: number,
  codigoComponente: number,
): Promise<TipoMedicionOption[]> {
  const [asocRes, tiposRes] = await Promise.all([
    asociacionService.getTablaByAreaTipoMotivo(
      codigoAreaTipoMotivo,
      codigoComponente,
    ),
    tipoMedicionService.getAll(),
  ]);

  const activas = ((asocRes.data || []) as Asociacion[]).filter(
    (a) => a.estado === "A" && Number(a.codigo_tipo_medicion) > 0,
  );

  if (activas.length === 0) {
    return [{ ...TIPO_MEDICION_SIN_TABLA }];
  }

  const versionMaxPorTipo = new Map<number, number>();
  for (const a of activas) {
    const tm = a.codigo_tipo_medicion;
    const prev = versionMaxPorTipo.get(tm) ?? 0;
    if (a.tabla_version > prev) versionMaxPorTipo.set(tm, a.tabla_version);
  }

  const tablasPorTipo = new Map<number, Set<string>>();
  for (const a of activas) {
    const maxV = versionMaxPorTipo.get(a.codigo_tipo_medicion) ?? 0;
    if (a.tabla_version !== maxV) continue;
    if (!tablasPorTipo.has(a.codigo_tipo_medicion)) {
      tablasPorTipo.set(a.codigo_tipo_medicion, new Set());
    }
    if (a.tabla?.trim()) {
      tablasPorTipo.get(a.codigo_tipo_medicion)!.add(a.tabla.trim());
    }
  }

  const nombreByCodigo = new Map(
    ((tiposRes.data || []) as TipoMedicion[])
      .filter((t) => t.estado === "A")
      .map((t) => [t.codigo_tipo_medicion, t.nombre_tipo_medicion] as const),
  );

  const options: TipoMedicionOption[] = [];
  for (const [codigo, tablas] of tablasPorTipo) {
    options.push({
      codigo_tipo_medicion: codigo,
      nombre_tipo_medicion:
        nombreByCodigo.get(codigo) ?? `Tipo ${codigo}`,
      tablas: [...tablas],
      sinTabla: false,
    });
  }

  options.sort((a, b) =>
    a.nombre_tipo_medicion.localeCompare(b.nombre_tipo_medicion),
  );
  return options;
}

/**
 * Filtra asociaciones activas al tipo elegido y deja solo la versión
 * vigente de ese tipo.
 *
 * Si el tipo es TIPO_MEDICION_SIN_TABLA_CODIGO, no hay columnas
 * dinámicas → array vacío.
 */
export function filterAsociacionesPorTipoMedicion(
  filas: Asociacion[],
  codigoTipoMedicion: number | null | undefined,
): Asociacion[] {
  if (isTipoMedicionSinTabla(codigoTipoMedicion)) {
    return [];
  }

  const activas = filas.filter((a) => a.estado === "A");
  const scoped =
    codigoTipoMedicion != null && codigoTipoMedicion > 0
      ? activas.filter((a) => a.codigo_tipo_medicion === codigoTipoMedicion)
      : activas;

  const versionMax = scoped.reduce(
    (max, a) => Math.max(max, a.tabla_version),
    0,
  );

  const seen = new Set<number>();
  return scoped
    .filter((a) => a.tabla_version === versionMax)
    .filter((a) => {
      if (seen.has(a.codigo_asociacion)) return false;
      seen.add(a.codigo_asociacion);
      return true;
    })
    .sort((x, y) => x.orden - y.orden);
}

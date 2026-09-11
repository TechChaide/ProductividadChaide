/**
 * Carga la cadena operativa Área/ATM → Origen → Componente → Causa
 * usando los servicios CRUD (getAll / métodos por FK), no la tabla virtual.
 *
 * La tabla virtual (`getTablaParamsVirtual`) se usa solo como fallback
 * en los pasos de UI si estos loaders no devuelven filas.
 */
import type {
  AreaTipoMotivo,
  CausaDefecto,
  Componente,
  Origen,
  OrigenComponente,
  TipoMotivo,
} from "@/types/integrations/muestreos-ddpp";
import { areaTipoMotivoService } from "@/services/integrations/muestreos-ddpp/areaTipoMotivo.service";
import { tipoMotivoService } from "@/services/integrations/muestreos-ddpp/tipoMotivo.service";
import { origenService } from "@/services/integrations/muestreos-ddpp/origen.service";
import { origenComponenteService } from "@/services/integrations/muestreos-ddpp/origenComponente.service";
import { componenteService } from "@/services/integrations/muestreos-ddpp/componente.service";
import { causaDefectoService } from "@/services/integrations/muestreos-ddpp/causaDefecto.service";
import { extractList } from "@/lib/integrations/muestreos-ddpp/extract-list";

export type MotivoDeArea = {
  codigo_area_tipo_motivo: number;
  codigo_tipo_motivo: number;
  nombre_tipo_motivo: string;
};

/** Motivos de muestreo de calidad (fuera de alcance de este wizard embebido). */
export function esMotivoMuestreoCalidad(
  nombre: string | undefined | null,
): boolean {
  return (nombre ?? "").toUpperCase().includes("MUESTREO");
}

const KEYWORDS_PARO_MAQUINA = [
  "PARO DE MÁQUINA",
  "PARO DE MAQUINA",
  "PAROS MAQUINA",
  "PARO MAQUINA",
  "PARO MÁQUINA",
] as const;

/** Paros de máquina (Mantenimientos) — fuera de alcance de este wizard embebido. */
export function esMotivoParoMaquina(
  nombre: string | undefined | null,
): boolean {
  const n = (nombre ?? "").toUpperCase();
  return KEYWORDS_PARO_MAQUINA.some((k) => n.includes(k.toUpperCase()));
}

/** Motivos válidos en la vista unificada de captura. */
export function esMotivoHabilitadoCapturaUnificada(
  nombre: string | undefined | null,
): boolean {
  return !esMotivoMuestreoCalidad(nombre) && !esMotivoParoMaquina(nombre);
}

export function nombreMotivoIncluye(
  nombre: string | undefined | null,
  keyword: string,
): boolean {
  return (nombre ?? "").toUpperCase().includes(keyword.toUpperCase());
}

export type ComponenteDeOrigen = {
  codigo_componente: number;
  nombre_componente: string;
  codigo_origen_componente: number;
  unidades?: string;
  /** `Componente.requiere_passcode`; `undefined` si vino del fallback de tabla virtual (se trata como `true`, conservador). */
  requiere_passcode?: boolean;
};

export async function loadMotivosByArea(
  codigoArea: number,
  matchesNombre: (nombre: string | undefined | null) => boolean,
): Promise<MotivoDeArea[]> {
  const [atmRes, tmRes] = await Promise.all([
    areaTipoMotivoService.getTiposMotivoByCodigoArea(codigoArea),
    tipoMotivoService.getAll(),
  ]);
  let atms = extractList<AreaTipoMotivo>(atmRes).filter((a) =>
    isActivo(a.estado),
  );
  if (atms.some((a) => a.codigo_area)) {
    atms = atms.filter((a) => a.codigo_area === codigoArea);
  }
  if (atms.length === 0) {
    atms = extractList<AreaTipoMotivo>(
      await areaTipoMotivoService.getAll(),
    ).filter((a) => isActivo(a.estado) && a.codigo_area === codigoArea);
  }
  const tms = extractList<TipoMotivo>(tmRes);
  const byId = new Map(tms.map((t) => [t.codigo_tipo_motivo, t]));
  const out: MotivoDeArea[] = [];
  for (const atm of atms) {
    const tm = byId.get(atm.codigo_tipo_motivo);
    const extraNombre = (atm as AreaTipoMotivo & { nombre_tipo_motivo?: string })
      .nombre_tipo_motivo;
    const nombre = tm?.nombre_tipo_motivo ?? extraNombre ?? "";
    if (!nombre || !matchesNombre(nombre)) continue;
    if (tm && !isActivo(tm.estado)) continue;
    out.push({
      codigo_area_tipo_motivo: atm.codigo_area_tipo_motivo,
      codigo_tipo_motivo: atm.codigo_tipo_motivo,
      nombre_tipo_motivo: nombre,
    });
  }
  return out.sort((a, b) =>
    a.nombre_tipo_motivo.localeCompare(b.nombre_tipo_motivo, "es"),
  );
}

function isActivo(estado: string | undefined | null): boolean {
  return !estado || estado === "A";
}

export async function loadOrigenesByAtm(
  codigoAreaTipoMotivo: number,
): Promise<Origen[]> {
  const res = await origenService.getOrigenesByCodigoAreaTipoMotivo(
    codigoAreaTipoMotivo,
  );
  let lista = extractList<Origen>(res).filter((o) => isActivo(o.estado));
  if (lista.length === 0) {
    const raw = (res as { data?: unknown })?.data;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const single = raw as Origen;
      if (single.codigo_origen) {
        lista = isActivo(single.estado) ? [single] : [];
      }
    }
  }
  const scoped = lista.filter(
    (o) => o.codigo_area_tipo_motivo === codigoAreaTipoMotivo,
  );
  if (scoped.length > 0) {
    lista = scoped;
  } else if (
    lista.length === 0 ||
    lista.some((o) => !!o.codigo_area_tipo_motivo)
  ) {
    lista = extractList<Origen>(await origenService.getAll()).filter(
      (o) =>
        isActivo(o.estado) &&
        o.codigo_area_tipo_motivo === codigoAreaTipoMotivo,
    );
  }
  return lista.sort((a, b) =>
    a.nombre_origen.localeCompare(b.nombre_origen, "es"),
  );
}

export async function loadComponentesByOrigen(
  codigoOrigen: number,
): Promise<ComponenteDeOrigen[]> {
  const [ocRes, compRes] = await Promise.all([
    origenComponenteService.getAll(),
    componenteService.getAll(),
  ]);
  const ocs = extractList<OrigenComponente>(ocRes).filter(
    (oc) => isActivo(oc.estado) && oc.codigo_origen === codigoOrigen,
  );
  const comps = extractList<Componente>(compRes);
  const byId = new Map(comps.map((c) => [c.codigo_componente, c]));
  const out: ComponenteDeOrigen[] = [];
  const seen = new Set<number>();
  for (const oc of ocs) {
    if (seen.has(oc.codigo_componente)) continue;
    const c = byId.get(oc.codigo_componente);
    if (!c || !isActivo(c.estado)) continue;
    seen.add(oc.codigo_componente);
    out.push({
      codigo_componente: c.codigo_componente,
      nombre_componente: c.nombre_componente,
      codigo_origen_componente: oc.codigo_origen_componente,
      unidades: (c.unidades ?? "").trim(),
      requiere_passcode: c.requiere_passcode,
    });
  }
  return out.sort((a, b) =>
    a.nombre_componente.localeCompare(b.nombre_componente, "es"),
  );
}

export async function resolveOrigenComponente(
  codigoOrigen: number,
  codigoComponente: number,
): Promise<OrigenComponente | null> {
  const ocs = extractList<OrigenComponente>(
    await origenComponenteService.getAll(),
  ).filter(
    (oc) =>
      isActivo(oc.estado) &&
      oc.codigo_origen === codigoOrigen &&
      oc.codigo_componente === codigoComponente,
  );
  return ocs[0] ?? null;
}

export async function loadCausasByOrigenComponente(
  codigoOrigen: number,
  codigoComponente: number,
  codigoOrigenComponente?: number | null,
): Promise<CausaDefecto[]> {
  let ocId = codigoOrigenComponente ?? 0;
  if (!ocId) {
    const oc = await resolveOrigenComponente(codigoOrigen, codigoComponente);
    ocId = oc?.codigo_origen_componente ?? 0;
  }
  if (!ocId) return [];

  let lista = extractList<CausaDefecto>(
    await causaDefectoService.getCausasDefectoByCodigoOrigenComponente(ocId),
  ).filter((c) => isActivo(c.estado));
  const scoped = lista.filter((c) => c.codigo_origen_componente === ocId);
  if (scoped.length > 0) {
    lista = scoped;
  } else if (
    lista.length === 0 ||
    lista.some((c) => !!c.codigo_origen_componente)
  ) {
    lista = extractList<CausaDefecto>(
      await causaDefectoService.getAll(),
    ).filter(
      (c) => isActivo(c.estado) && c.codigo_origen_componente === ocId,
    );
  }
  return lista.sort((a, b) =>
    a.nombre_causa_defecto.localeCompare(b.nombre_causa_defecto, "es"),
  );
}

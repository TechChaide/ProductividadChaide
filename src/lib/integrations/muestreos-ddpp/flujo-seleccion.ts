/**
 * Carga la cadena operativa Área/ATM → Origen → Componente → Causa
 * con consultas acotadas (un área, un ATM, un origen). No usa getAll.
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
import { causaDefectoService } from "@/services/integrations/muestreos-ddpp/causaDefecto.service";
import { extractList } from "@/lib/integrations/muestreos-ddpp/extract-list";

export type MotivoDeArea = {
  codigo_area_tipo_motivo: number;
  codigo_tipo_motivo: number;
  nombre_tipo_motivo: string;
};

/** Motivo de muestreo que ve el operador: nombre con MUESTREO y OPERATIVO. */
export function esMotivoMuestreoOperativo(
  nombre: string | undefined | null,
): boolean {
  const n = (nombre ?? "").toUpperCase();
  return n.includes("MUESTREO") && n.includes("OPERATIV");
}

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
  /** `Componente.requiere_passcode`; `undefined` se trata como `true` (conservador). */
  requiere_passcode?: boolean;
};

type AtmConMotivo = AreaTipoMotivo & {
  tipo_motivo?: TipoMotivo;
  nombre_tipo_motivo?: string;
};

type OrigenComponenteConNombre = OrigenComponente & {
  componente?: Componente;
  nombre_componente?: string;
  unidades?: string;
};

export async function loadMotivosByArea(
  codigoArea: number,
  matchesNombre: (nombre: string | undefined | null) => boolean,
): Promise<MotivoDeArea[]> {
  const [atmRes, tmRes] = await Promise.all([
    areaTipoMotivoService.getTiposMotivoByCodigoArea(codigoArea),
    tipoMotivoService.getAll(),
  ]);
  let atms = extractList<AtmConMotivo>(atmRes).filter((a) => isActivo(a.estado));
  if (atms.some((a) => a.codigo_area)) {
    atms = atms.filter((a) => a.codigo_area === codigoArea);
  }
  if (atms.length === 0) {
    atms = extractList<AtmConMotivo>(await areaTipoMotivoService.getAll()).filter(
      (a) => isActivo(a.estado) && a.codigo_area === codigoArea,
    );
  }
  const byId = new Map(
    extractList<TipoMotivo>(tmRes).map((t) => [Number(t.codigo_tipo_motivo), t]),
  );
  const out: MotivoDeArea[] = [];
  for (const atm of atms) {
    const tm = byId.get(Number(atm.codigo_tipo_motivo));
    const nombre =
      tm?.nombre_tipo_motivo ??
      atm.tipo_motivo?.nombre_tipo_motivo ??
      atm.nombre_tipo_motivo ??
      "";
    if (!nombre || !matchesNombre(nombre)) continue;
    if (tm && !isActivo(tm.estado)) continue;
    if (!tm && atm.tipo_motivo && !isActivo(atm.tipo_motivo.estado)) continue;
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
  const res = await origenService.getCatalogoByAreaTipoMotivo(
    codigoAreaTipoMotivo,
  );
  return extractList<Origen>(res)
    .filter(
      (o) =>
        isActivo(o.estado) &&
        (!o.codigo_area_tipo_motivo ||
          o.codigo_area_tipo_motivo === codigoAreaTipoMotivo),
    )
    .sort((a, b) => a.nombre_origen.localeCompare(b.nombre_origen, "es"));
}

async function componentesDeOrigen(
  codigoOrigen: number,
): Promise<OrigenComponenteConNombre[]> {
  return extractList<OrigenComponenteConNombre>(
    await origenComponenteService.getComponentesByOrigen(codigoOrigen),
  ).filter((oc) => isActivo(oc.estado) && isActivo(oc.componente?.estado));
}

export async function loadComponentesByOrigen(
  codigoOrigen: number,
): Promise<ComponenteDeOrigen[]> {
  const ocs = await componentesDeOrigen(codigoOrigen);
  const out: ComponenteDeOrigen[] = [];
  const seen = new Set<number>();
  for (const oc of ocs) {
    if (seen.has(oc.codigo_componente)) continue;
    const nombre = oc.componente?.nombre_componente ?? oc.nombre_componente ?? "";
    if (!nombre) continue;
    seen.add(oc.codigo_componente);
    out.push({
      codigo_componente: oc.codigo_componente,
      nombre_componente: nombre,
      codigo_origen_componente: oc.codigo_origen_componente,
      unidades: (oc.componente?.unidades ?? oc.unidades ?? "").trim(),
      requiere_passcode: oc.componente?.requiere_passcode,
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
  const ocs = await componentesDeOrigen(codigoOrigen);
  return (
    ocs.find((oc) => oc.codigo_componente === codigoComponente) ?? null
  );
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

  return extractList<CausaDefecto>(
    await causaDefectoService.getCausasDefectoByCodigoOrigenComponente(ocId),
  )
    .filter(
      (c) =>
        isActivo(c.estado) &&
        (!c.codigo_origen_componente || c.codigo_origen_componente === ocId),
    )
    .sort((a, b) =>
      a.nombre_causa_defecto.localeCompare(b.nombre_causa_defecto, "es"),
    );
}

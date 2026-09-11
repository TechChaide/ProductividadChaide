/**
 * Cruce en vivo: DEPARTAMENTO del usuario (ficha social) ↔
 * `area.nombre_ficha_social`.
 */
import type { Area } from "@/types/integrations/muestreos-ddpp";
import { extractList } from "@/lib/integrations/muestreos-ddpp/extract-list";

export function normalizeMatchKey(value: string | undefined | null): string {
  return (value ?? "").trim().toUpperCase();
}

export function pickDepartamentoFromFicha(
  ficha: Record<string, unknown> | null,
): string {
  if (!ficha) return "";
  return (
    ficha.DEPARTAMENTO?.toString().trim() ??
    ficha.departamento?.toString().trim() ??
    ""
  );
}

export function pickRegionalFromFicha(
  ficha: Record<string, unknown> | null,
): string {
  if (!ficha) return "";
  return (
    ficha.LOCALIDAD?.toString().trim() ??
    ficha.REGIONAL?.toString().trim() ??
    ficha.regional?.toString().trim() ??
    ""
  );
}

export function parseFichaFromResponse(
  res: unknown,
): Record<string, unknown> | null {
  const list = extractList<Record<string, unknown>>(res);
  if (list.length > 0) return list[0];
  const data = (res as { data?: unknown })?.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const rec = data as Record<string, unknown>;
    if (rec.DEPARTAMENTO != null || rec.departamento != null) return rec;
  }
  return null;
}

export function matchAreasByDepartamento(
  areas: Area[],
  departamento: string,
  /**
   * Regional del usuario (opcional). Si se pasa, además de filtrar por
   * `nombre_ficha_social`, exige que `Area.regional` coincida.
   *
   * Es necesario porque el mismo `nombre_ficha_social` puede repetirse en
   * más de una regional. Sin este filtro, un usuario podía terminar
   * eligiendo — o auto-seleccionando — un área de la regional equivocada.
   */
  regional?: string,
): Area[] {
  const depto = normalizeMatchKey(departamento);
  if (!depto) return [];
  const reg = normalizeMatchKey(regional);
  return areas
    .filter(
      (a) =>
        (!a.estado || a.estado === "A") &&
        normalizeMatchKey(a.nombre_ficha_social) === depto &&
        (!reg || normalizeMatchKey(a.regional) === reg),
    )
    .sort((a, b) =>
      (a.nombre_area ?? "").localeCompare(b.nombre_area ?? "", "es"),
    );
}

/**
 * Cruza ficha social con el origen de la semiruta:
 * `DEPARTAMENTO` / `GRUPO_DEPARTAMENTO` ≡ `nombre_origen`.
 */
export function matchUsuarioByDepartamento(
  user: { DEPARTAMENTO?: string; GRUPO_DEPARTAMENTO?: string },
  departamento: string | undefined | null,
): boolean {
  const key = normalizeMatchKey(departamento);
  if (!key) return true;
  return (
    normalizeMatchKey(user.DEPARTAMENTO) === key ||
    normalizeMatchKey(user.GRUPO_DEPARTAMENTO) === key
  );
}

function joinResponsables(areas: Area[]): string {
  const parts = areas
    .map((a) => (a.respCtrlProd ?? "").trim())
    .filter(Boolean);
  return [...new Set(parts)].join(" & ");
}

/**
 * Responsables del área cuyo `nombre_ficha_social` coincide con el origen.
 * Si no hay cruce, une los responsables de todas las áreas activas.
 */
export function responsablesPorOrigenOTodas(
  areas: Area[],
  origen: string | undefined | null,
): { responsables: string; fromOrigen: boolean } {
  const activas = areas.filter((a) => !a.estado || a.estado === "A");
  const match = matchAreasByDepartamento(activas, origen ?? "");
  if (match.length > 0) {
    return { responsables: joinResponsables(match), fromOrigen: true };
  }
  return { responsables: joinResponsables(activas), fromOrigen: false };
}

/** `nombre_area` del área cuyo `nombre_ficha_social` coincide con el origen. */
export function nombreAreaPorOrigen(
  areas: Area[],
  origen: string | undefined | null,
): string {
  const match = matchAreasByDepartamento(areas, origen ?? "");
  return (match[0]?.nombre_area ?? "").trim();
}

export function pickMaquinaNombre(row: Record<string, unknown>): string {
  return String(
    row.maquina ??
      row.MAQUINA ??
      row.nombre_maquina ??
      row.Material ??
      "",
  ).trim();
}

export function pickMaquinaComponente(row: Record<string, unknown>): string {
  return String(row.componente ?? row.COMPONENTE ?? "").trim();
}

/** Texto visible del select: `maquina - componente`. */
export function pickMaquinaLabel(row: Record<string, unknown>): string {
  const maquina = pickMaquinaNombre(row);
  const componente = pickMaquinaComponente(row);
  if (maquina && componente) return `${maquina} - ${componente}`;
  return maquina || componente;
}

export function pickMaquinaValue(row: Record<string, unknown>, index: number): string {
  const id = row.id_maq ?? row.ID_MAQ ?? row.codigo_maquina;
  if (id != null && String(id).trim()) return String(id);
  const nombre = pickMaquinaNombre(row);
  return nombre || `maq-${index}`;
}

export function matchesCentro(
  row: Record<string, unknown>,
  centro: string,
): boolean {
  const key = normalizeMatchKey(centro);
  if (!key) return true;
  const regional = normalizeMatchKey(
    String(row.regional ?? row.REGIONAL ?? row.CENTRO ?? row.Localidad ?? ""),
  );
  return !regional || regional === key;
}

/** Valor por defecto cuando el comodín (o el pedido) no aplica al flujo. */
export const COMODIN_NA = "N.A.";

/** Valor por defecto del campo `pedido` cuando el motivo no lo necesita. */
export const PEDIDO_NA = "N.A.";

/** Valor que se guarda en `material` cuando el motivo no lo necesita. */
export const MATERIAL_NO_APLICA = "NO";

export type ComodinCapturaTipo = "proveedor" | "tienda" | "cliente" | "none";

export interface ComodinCapturaConfig {
  tipo: ComodinCapturaTipo;
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  hint?: string;
}

function norm(s: string | undefined | null): string {
  return (s ?? "").trim().toUpperCase();
}

/** Devoluciones + origen PROVEEDOR → comodín es selector de proveedores. */
export function esComodinProveedor(
  motivo: string | undefined | null,
  origen: string | undefined | null,
): boolean {
  return norm(motivo).includes("DEVOLUCION") && norm(origen).includes("PROVEEDOR");
}

/**
 * ORIGEN o COMPONENTE = TIENDAS PROPIAS → comodín es selector de tiendas
 * (REGLA 6/7 del legacy: rótulo "OFICINA VENTAS" → CatalogoTiendas).
 */
export function esComodinTienda(
  origen: string | undefined | null,
  componente: string | undefined | null,
): boolean {
  return (
    norm(origen).includes("TIENDAS PROPIAS") ||
    norm(componente).includes("TIENDAS PROPIAS")
  );
}

/**
 * MOTIVO = DEVOLUCIONES EXTERNAS ESPUMA → comodín es selector de
 * cliente/interlocutor externo (REGLA 6/7 del legacy: rótulo
 * "NOMBRE CLIENTE" → MaestroClientesInterlocutores, filtrado por ciudad
 * según la regional).
 */
export function esComodinCliente(motivo: string | undefined | null): boolean {
  return norm(motivo).includes("DEVOLUCIONES EXTERNAS ESPUMA");
}

/**
 * MOTIVO = GESTIÓN ADM. DISTRI. → necesita el campo dedicado `pedido`
 * (REGLA 5 del legacy: Button3_Click busca en BI.CuboDespachos).
 *
 * `pedido` es un campo propio de `Registro` (independiente de
 * `comodin`/`material`): el comodín para este motivo sigue resolviéndose
 * normalmente (p. ej. "tienda" si el componente es TIENDAS PROPIAS).
 * `material` no aplica para este motivo y se envía fijo como "NO" (ver
 * `MATERIAL_NO_APLICA`).
 */
export function necesitaPedido(motivo: string | undefined | null): boolean {
  return norm(motivo).includes("GESTIÓN ADM. DISTRI.");
}

export interface ResolveComodinCapturaOpts {
  /**
   * Habilita los tipos "tienda" y "cliente" además de "proveedor".
   * Por defecto `false`.
   */
  habilitarExtendidas?: boolean;
}

/**
 * Resuelve cómo debe comportarse el campo `comodin` según motivo/origen
 * (y, si `habilitarExtendidas`, también componente). No decide nada
 * sobre `pedido`: ese campo es independiente, ver `necesitaPedido`.
 */
export function resolveComodinCaptura(
  motivo: string | undefined | null,
  origen: string | undefined | null,
  componente?: string | undefined | null,
  opts?: ResolveComodinCapturaOpts,
): ComodinCapturaConfig {
  if (opts?.habilitarExtendidas && esComodinCliente(motivo)) {
    return {
      tipo: "cliente",
      label: "Cliente",
      placeholder: "Selecciona un cliente",
      searchPlaceholder: "Buscar por nombre o identificación...",
      emptyMessage: "No se encontraron clientes.",
      hint: "Se guarda la identificación del cliente en comodín.",
    };
  }
  if (opts?.habilitarExtendidas && esComodinTienda(origen, componente)) {
    return {
      tipo: "tienda",
      label: "Tienda",
      placeholder: "Selecciona una tienda",
      searchPlaceholder: "Buscar tienda...",
      emptyMessage: "No hay tiendas registradas.",
      hint: "Se guarda el código de oficina de ventas en comodín.",
    };
  }
  if (esComodinProveedor(motivo, origen)) {
    return {
      tipo: "proveedor",
      label: "Proveedor",
      placeholder: "Selecciona un proveedor",
      searchPlaceholder: "Buscar proveedor...",
      emptyMessage:
        "No hay proveedores para este departamento y componente.",
      hint: "Se guarda el código del proveedor en comodín.",
    };
  }
  return {
    tipo: "none",
    label: "Comodín",
    placeholder: COMODIN_NA,
    searchPlaceholder: "",
    emptyMessage: "",
    hint: "No aplica para este flujo.",
  };
}

export function valorComodinParaPayload(
  valor: string | undefined | null,
  config: ComodinCapturaConfig,
): string {
  const v = (valor ?? "").trim();
  if (config.tipo === "none") return COMODIN_NA;
  return v || COMODIN_NA;
}

/** Valor final de `pedido` para el payload: `N.A.` cuando el motivo no lo necesita o no se seleccionó. */
export function valorPedidoParaPayload(
  valor: string | undefined | null,
  motivo: string | undefined | null,
): string {
  if (!necesitaPedido(motivo)) return PEDIDO_NA;
  const v = (valor ?? "").trim();
  return v || PEDIDO_NA;
}

import type { RolOperadorPrensado } from "@/types/interfaces";

/** Roles del puesto con su etiqueta y colores; compartido por el modal y la cabecera. */
export const ROLES_OPERADOR_PRENSADO: {
  valor: RolOperadorPrensado;
  label: string;
  /** Clases para el chip/badge del rol. */
  chip: string;
  /** Clases del botón de rol cuando está seleccionado. */
  activo: string;
}[] = [
  {
    valor: "ALIMENTADOR",
    label: "Alimentador",
    chip: "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
    activo: "border-sky-600 bg-sky-600 text-white hover:bg-sky-600/90",
  },
  {
    valor: "PEGADOR",
    label: "Pegador",
    chip: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    activo: "border-amber-600 bg-amber-600 text-white hover:bg-amber-600/90",
  },
];

export function getRolOperadorPrensado(valor: RolOperadorPrensado) {
  return ROLES_OPERADOR_PRENSADO.find((r) => r.valor === valor) ?? ROLES_OPERADOR_PRENSADO[0];
}

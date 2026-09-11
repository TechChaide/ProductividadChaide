import type { MuestreoTablaVirtual } from "@/types/integrations/muestreos-ddpp";

/** Referencia estable para fallbacks sin tabla virtual (evita loops en useEffect). */
export const EMPTY_TABLA_VIRTUAL: MuestreoTablaVirtual[] = [];

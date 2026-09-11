import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { Area, MuestreoTablaVirtual } from "@/types/integrations/muestreos-ddpp";
import type { TipoMedicionOption } from "@/lib/integrations/muestreos-ddpp/tipo-medicion-tabla";

export interface ProcesoRutaPartial {
  codigo_area?: number;
  codigo_area_tipo_motivo?: number;
  codigo_origen?: number;
  codigo_origen_componente?: number;
  codigo_componente?: number;
  codigo_causa_defecto?: number;
}

export interface ProcesoWizardStorage {
  rutaParcial: {
    get(): ProcesoRutaPartial;
    set(ruta: ProcesoRutaPartial): void;
    clear(): void;
  };
  ruta: {
    get(): MuestreoTablaVirtual | null;
    set(fila: MuestreoTablaVirtual | null): void;
    clear(): void;
  };
  clearAll(): void;
  /** Solo cuando `requiereSeleccionMaquina` está activo (hoy, únicamente Paros). */
  maquina?: {
    get(): string;
    set(value: string): void;
    clear(): void;
  };
}

export interface ProcesoCapturaContext {
  selectedArea: Area;
  regional: string;
  departamento: string;
  selectedAreaTipoMotivo: { id: number; nombre: string };
  selectedOrigen: { id: number; nombre: string };
  selectedComponente: {
    id: number;
    nombre: string;
    codigo_origen_componente: number;
    unidades?: string;
    /** `Componente.requiere_passcode`; `undefined` se trata como `true` (conservador). */
    requiere_passcode?: boolean;
  };
  selectedCausa: { id: number; nombre: string };
  /** Máquina elegida en el paso "Máquina" (solo si `requiereSeleccionMaquina`; si no, cadena vacía). */
  selectedMaquina: string;
  selectedTipoMedicion: TipoMedicionOption | null;
  skipTipoMedicion: boolean;
  filaConsolidada: MuestreoTablaVirtual;
  hint: (step: number) => string;
  onCapturaChange: (data: unknown) => void;
  /** Regresa al paso anterior del wizard (p.ej. si se cancela el gate de contraseña). */
  onBack: () => void;
}

export interface ProcesoCapturaWizardConfig {
  title: string;
  description: string;
  pathLabel: string;
  submitToastTitle: string;
  icon: LucideIcon;
  storage: ProcesoWizardStorage;
  renderCaptura: (ctx: ProcesoCapturaContext) => ReactNode;
  /**
   * Flujo en cascada para la vista unificada:
   * Motivo → Origen → Componente → Causa → Captura.
   * Oculta el paso explícito de tipo medición (se resuelve al elegir componente).
   */
  flujoCascada?: boolean;
  /**
   * Deja solo los motivos cuyo nombre cumple el predicado
   * (p.ej. DEFECTO / DEVOLUCION / PARO DE).
   */
  filtroMotivo?: (nombre: string | undefined | null) => boolean;
  /**
   * Si hay un único motivo filtrado, lo elige y avanza al origen.
   * Si hay varios, preselecciona el primero y deja el paso visible.
   */
  autoSeleccionarMotivo?: boolean;
  /**
   * Agrega un paso "Máquina" (obligatorio) entre Causa y Captura, filtrado
   * por regional + área del usuario. Requiere `storage.maquina`. Hoy solo
   * lo usa Paros.
   */
  requiereSeleccionMaquina?: boolean;
}

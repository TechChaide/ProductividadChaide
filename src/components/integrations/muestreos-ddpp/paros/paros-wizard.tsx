"use client";

/**
 * Wizard de "Paros" (registro con cronómetro) para el feature embebido
 * Paros/Captura. Equivalente a `/dashboard/procesos/paros` en el proyecto
 * origen (muestreos_frontend), montado aquí como componente en vez de página.
 */
import { useMemo, useRef } from "react";
import { PauseCircle } from "lucide-react";
import ProcesoCapturaWizard from "@/components/integrations/muestreos-ddpp/wizard/proceso-captura-wizard";
import type { ProcesoCapturaWizardConfig } from "@/components/integrations/muestreos-ddpp/wizard/proceso-wizard-types";
import ParosCapturaStep from "./paros-captura-step";
import {
  clearAllParosStorage,
  paroFilaStorage,
  paroMaquinaStorage,
  paroRutaParcialStorage,
} from "./paro-storage";
import { nombreMotivoIncluye } from "@/lib/integrations/muestreos-ddpp/flujo-seleccion";

export default function ParosWizard() {
  const resetRef = useRef<(() => void) | null>(null);

  const config = useMemo((): ProcesoCapturaWizardConfig => ({
    title: "Registro de paros",
    description:
      "El área se toma del departamento del usuario. Elige origen, componente y causa; luego inicia el cronómetro del paro.",
    pathLabel: "Ruta del paro",
    submitToastTitle: "Paro listo para registrar",
    icon: PauseCircle,
    // Restringido a PARO DE MÁQUINA: esta captura simplificada (solo
    // cronómetro) es la variante correcta para ese motivo en este feature.
    filtroMotivo: (nombre) => nombreMotivoIncluye(nombre, "PARO DE"),
    autoSeleccionarMotivo: true,
    requiereSeleccionMaquina: true,
    storage: {
      rutaParcial: paroRutaParcialStorage,
      ruta: paroFilaStorage,
      clearAll: clearAllParosStorage,
      maquina: paroMaquinaStorage,
    },
    renderCaptura: (ctx) => (
      <ParosCapturaStep
        {...ctx}
        onResetWizard={() => resetRef.current?.()}
      />
    ),
  }), []);

  return <ProcesoCapturaWizard config={config} resetRef={resetRef} />;
}

"use client";

/**
 * Modal a ~95% de la pantalla que aloja los wizards portados de
 * `muestreos_frontend`. Al abrir, pregunta "Paros o Captura"; según la
 * elección, monta el wizard correspondiente (envuelto en `SessionGate`
 * para pedir el login embebido si hace falta).
 */
import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, PauseCircle, Ruler } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import SessionGate from "@/components/integrations/muestreos-ddpp/auth/session-gate";
import ParosWizard from "@/components/integrations/muestreos-ddpp/paros/paros-wizard";
import CapturaWizard from "@/components/integrations/muestreos-ddpp/captura/captura-wizard";
import MuestreoOpWizard from "@/components/integrations/muestreos-ddpp/muestreo/muestreo-op-wizard";

/**
 * No hay variante "inspector" (`/samplings` en origin): el inspector de
 * calidad nunca muestrea desde esta app, tiene su propia aplicación para
 * eso. Solo se porta la variante operador (`/samplingsOp`).
 */
type Modo = "select" | "paros" | "captura" | "muestreoOp";

interface ProcesoSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OPCIONES: {
  modo: Exclude<Modo, "select">;
  title: string;
  description: string;
  icon: typeof PauseCircle;
}[] = [
  {
    modo: "paros",
    title: "Paros",
    description: "Registro de un paro con cronómetro.",
    icon: PauseCircle,
  },
  {
    modo: "captura",
    title: "Captura",
    description: "Captura de procesos (defectos, devoluciones, etc.).",
    icon: ClipboardList,
  },
  {
    modo: "muestreoOp",
    title: "Muestreos",
    description: "Muestreo dimensional con el área resuelta por tu departamento.",
    icon: Ruler,
  },
];

export default function ProcesoSelectorModal({ open, onOpenChange }: ProcesoSelectorModalProps) {
  const [modo, setModo] = useState<Modo>("select");

  useEffect(() => {
    if (!open) {
      // Reinicia al selector la próxima vez que se abra el modal.
      const t = setTimeout(() => setModo("select"), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  const opcionActiva = OPCIONES.find((o) => o.modo === modo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] h-[95vh] max-w-none sm:rounded-lg p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-4 sm:px-6 py-3 border-b shrink-0 flex-row items-center gap-2 space-y-0">
          {modo !== "select" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 -ml-2"
              onClick={() => setModo("select")}
              aria-label="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : null}
          <DialogTitle>
            {modo === "select" ? "¿Qué quieres registrar?" : opcionActiva?.title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {modo === "select" ? (
            <div className="flex min-h-full items-center justify-center">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full">
                {OPCIONES.map((op) => {
                  const Icon = op.icon;
                  return (
                    <button
                      key={op.modo}
                      type="button"
                      onClick={() => setModo(op.modo)}
                      className="flex flex-col items-center gap-3 rounded-lg border p-6 text-center transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary hover:bg-primary/5 hover:shadow-lg active:translate-y-0 active:scale-[0.98]"
                    >
                      <Icon className="h-10 w-10 text-primary" />
                      <span className="text-lg font-semibold">{op.title}</span>
                      <span className="text-sm text-muted-foreground">{op.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {modo === "paros" ? (
            <SessionGate>
              <ParosWizard />
            </SessionGate>
          ) : null}

          {modo === "captura" ? (
            <SessionGate>
              <CapturaWizard />
            </SessionGate>
          ) : null}

          {modo === "muestreoOp" ? (
            <SessionGate>
              <MuestreoOpWizard />
            </SessionGate>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

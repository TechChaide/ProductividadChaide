"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Definición de un paso del wizard (id + título + descripción). */
export interface StepDef {
  id: number;
  title: string;
  description: string;
}

interface StepperHeaderProps {
  steps: readonly StepDef[];
  currentStep: number;
}

/**
 * Stepper horizontal genérico: muestra cada paso con número/circulo, y resalta
 * el activo. Un paso "completado" se pinta en primary.
 *
 * Se mantiene simple (sin variantes create/edit como el de `opciones/tables`)
 * porque la captura de muestreo no tiene un "modo edición" distinto al de
 * creación.
 */
export default function StepperHeader({ steps, currentStep }: StepperHeaderProps) {
  return (
    <div className="space-y-2">
      {/*
        Responsive del stepper:
        - Móvil (<sm): solo se ven los círculos numerados y el conector.
          El label del paso y la descripción se ocultan (flex-nowrap + sr-only).
          Se gana espacio horizontal crítico para pasos con texto largo.
        - ≥sm: se muestran label + descripción truncados (min-w-0 + truncate).
      */}
      <div
        className="flex items-center justify-between gap-1 sm:gap-2"
        role="list"
        aria-label={`Paso ${Math.max(1, steps.findIndex((s) => s.id === currentStep) + 1)} de ${steps.length}`}
      >
        {steps.map((step, idx) => {
          const completed = step.id < currentStep;
          const active = step.id === currentStep;
          return (
            <div
              key={step.id}
              role="listitem"
              aria-current={active ? "step" : undefined}
              className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0"
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                  completed && "bg-primary text-primary-foreground border-primary",
                  active && "bg-primary text-primary-foreground border-primary ring-2 ring-primary/20",
                  !completed && !active && "bg-muted text-muted-foreground border-muted"
                )}
              >
                {completed ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              {/*
                En móvil, el texto se queda accesible pero invisible
                (lectores de pantalla). En ≥sm pasa a verse truncado.
              */}
              <div className="hidden sm:block min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium truncate",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                  title={step.title}
                >
                  {step.title}
                </p>
                <p
                  className="text-xs text-muted-foreground truncate"
                  title={step.description}
                >
                  {step.description}
                </p>
              </div>
              {/* Texto accesible en móvil */}
              <span className="sr-only sm:hidden">
                {step.title}. {step.description}.
              </span>
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 min-w-[8px] sm:min-w-[16px]",
                    completed ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="text-xs text-muted-foreground">
        Paso {Math.max(1, steps.findIndex((s) => s.id === currentStep) + 1)} de {steps.length}
      </div>
    </div>
  );
}

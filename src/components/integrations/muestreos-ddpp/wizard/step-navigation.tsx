"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";

interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  canGoNext: boolean;
  isSubmitting?: boolean;
  isLastStep?: boolean;
  canSubmit?: boolean;
  /**
   * Si es true, oculta el botón de submit incrustado (se usa en el paso 5
   * porque el guardado se dispara desde los botones flotantes del componente
   * de captura).
   */
  hideSubmit?: boolean;
  onBack: () => void;
  onNext: () => void;
  onCancel: () => void;
  onSubmit?: () => void;
  nextLabel?: string;
}

/**
 * Pie de navegación genérico para el wizard de muestreos. Cuando `isLastStep`
 * es true y se pasa `onSubmit`, muestra "Guardar muestreo" en verde; en otro
 * caso muestra "Siguiente".
 */
export default function StepNavigation({
  currentStep,
  totalSteps,
  canGoNext,
  isSubmitting = false,
  isLastStep = false,
  canSubmit = true,
  hideSubmit = false,
  onBack,
  onNext,
  onCancel,
  onSubmit,
  nextLabel = "Siguiente",
}: StepNavigationProps) {
  const isFirstStep = currentStep === 1;

  return (
    /*
      Responsive de la navegación inferior:
      - Móvil: ambos botones a ancho completo y orden "Siguiente" arriba,
        "Atrás/Cancelar" debajo (la acción primaria queda bajo el pulgar).
      - ≥sm: vuelve al layout horizontal original (Atrás | Siguiente).
    */
    <div className="flex flex-col-reverse gap-2 pt-6 mt-auto border-t sm:flex-row sm:items-center sm:justify-between sm:gap-0">
      <Button
        type="button"
        variant="outline"
        onClick={isFirstStep ? onCancel : onBack}
        disabled={isSubmitting}
        className="w-full sm:w-auto"
      >
        {isFirstStep ? (
          "Cancelar"
        ) : (
          <>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Atrás
          </>
        )}
      </Button>

      {isLastStep ? (
        hideSubmit ? null : (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || !canGoNext || !canSubmit}
            className="w-full bg-green-600 hover:bg-green-700 text-white sm:w-auto"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Guardando..." : "Guardar defecto"}
          </Button>
        )
      ) : (
        <Button
          type="button"
          onClick={onNext}
          disabled={!canGoNext || isSubmitting}
          className="w-full sm:w-auto"
        >
          {nextLabel}
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

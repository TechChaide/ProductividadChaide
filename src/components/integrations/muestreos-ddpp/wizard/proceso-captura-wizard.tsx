"use client";

/**
 * Wizard unificado de procesos operativos (excepto muestreos de calidad).
 *
 * Patrón estándar:
 *   1. Área resuelta desde DEPARTAMENTO ↔ nombre_ficha_social
 *   2. Motivo → Origen → Componente → Tipo medición (si aplica) → Causa → Captura
 *
 * Cada ruta (`/defects`, `/devols`, `/parosM`, `/paros`, `/captura`) monta
 * este componente con su storage y paso de captura propio — sin redirects.
 */
import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from "react";
import { AlertCircle, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Area, MuestreoTablaVirtual } from "@/types/integrations/muestreos-ddpp";
import { useToast } from "@/hooks/use-toast";
import StepperHeader, {
  type StepDef,
} from "@/components/integrations/muestreos-ddpp/wizard/stepper-header";
import StepNavigation from "@/components/integrations/muestreos-ddpp/wizard/step-navigation";
import PathHeader from "@/components/integrations/muestreos-ddpp/wizard/path-header";
import Step3SelectComponenteMuestreo from "@/components/integrations/muestreos-ddpp/wizard/step3-select-componente-muestreo";
import Step4SelectCausaMuestreo from "@/components/integrations/muestreos-ddpp/wizard/step4-select-causa-muestreo";
import StepSelectMaquina from "@/components/integrations/muestreos-ddpp/wizard/step-select-maquina";
import StepSelectMotivo from "@/components/integrations/muestreos-ddpp/wizard/step-select-motivo";
import StepSelectOrigen from "@/components/integrations/muestreos-ddpp/wizard/step-select-origen";
import StepSelectAreaDepartamento from "@/components/integrations/muestreos-ddpp/wizard/step-select-area-departamento";
import StepSelectTipoMedicion from "@/components/integrations/muestreos-ddpp/wizard/step-select-tipo-medicion";
import { useTipoMedicionFlujo } from "@/hooks/integrations/muestreos-ddpp/use-tipo-medicion-flujo";
import { useAreaDesdeDepartamento } from "@/hooks/integrations/muestreos-ddpp/use-area-desde-departamento";
import {
  type TipoMedicionOption,
  nextProcesoStep,
  prevProcesoStep,
  resolveTiposMedicionParaComponente,
  stepHintFor,
  TIPO_MEDICION_SIN_TABLA,
  visibleProcesoSteps,
} from "@/lib/integrations/muestreos-ddpp/tipo-medicion-tabla";
import type { ProcesoCapturaWizardConfig } from "./proceso-wizard-types";
import { EMPTY_TABLA_VIRTUAL } from "@/lib/integrations/muestreos-ddpp/tabla-virtual-empty";
import {
  esMotivoMuestreoCalidad,
  esMotivoParoMaquina,
  loadMotivosByArea,
} from "@/lib/integrations/muestreos-ddpp/flujo-seleccion";

const STEP_AREA_DEF: StepDef = {
  id: 0,
  title: "Área",
  description: "Área operativa de tu departamento",
};

const TIPO_STEP_BASE = 4;

const STEPS_COMPLETO: readonly StepDef[] = [
  { id: 1, title: "Motivo", description: "Tipo de motivo del área" },
  { id: 2, title: "Origen", description: "Origen del ATM" },
  { id: 3, title: "Componente", description: "Componente asociado" },
  { id: 4, title: "Tipo medición", description: "Tabla dinámica, si aplica" },
  { id: 5, title: "Causa", description: "Causa de defecto" },
  { id: 6, title: "Captura", description: "Carga de datos" },
] as const;

const TOTAL_STEPS_COMPLETO = 6;
const TOTAL_STEPS_CASCADA = 5;

const STEPS_CASCADA: readonly StepDef[] = [
  { id: 1, title: "Motivo", description: "Tipos de motivo habilitados del área" },
  { id: 2, title: "Origen", description: "Orígenes del motivo elegido" },
  { id: 3, title: "Componente", description: "Componentes del origen" },
  { id: 4, title: "Causa", description: "Causas del componente" },
  { id: 5, title: "Captura", description: "Carga de datos" },
] as const;

interface ProcesoCapturaWizardProps {
  config: ProcesoCapturaWizardConfig;
  /** Permite al padre invocar reset (p.ej. tras guardar un paro). */
  resetRef?: MutableRefObject<(() => void) | null>;
}

export default function ProcesoCapturaWizard({
  config,
  resetRef,
}: ProcesoCapturaWizardProps) {
  const {
    title,
    description,
    pathLabel,
    submitToastTitle,
    icon: Icon,
    storage,
    renderCaptura,
    flujoCascada = false,
    filtroMotivo,
    autoSeleccionarMotivo = false,
    requiereSeleccionMaquina = false,
  } = config;

  const { toast } = useToast();
  const {
    isLoading: isResolviendoArea,
    error: areaError,
    departamento,
    regional,
    areasMatch,
    selectedArea,
    setSelectedArea,
  } = useAreaDesdeDepartamento();

  const needsAreaPick = areasMatch.length > 1;
  const stepOffset = needsAreaPick ? 1 : 0;

  const STEPS = useMemo((): StepDef[] => {
    let base = flujoCascada ? [...STEPS_CASCADA] : [...STEPS_COMPLETO];
    if (requiereSeleccionMaquina) {
      const capturaIdx = base.length - 1;
      base = [
        ...base.slice(0, capturaIdx),
        { id: 0, title: "Máquina", description: "Máquina donde ocurrió el paro" },
        base[capturaIdx],
      ].map((s, i) => ({ ...s, id: i + 1 }));
    }
    if (!needsAreaPick) return base;
    return [
      { ...STEP_AREA_DEF, id: 1 },
      ...base.map((s, i) => ({ ...s, id: i + 2 })),
    ];
  }, [flujoCascada, needsAreaPick, requiereSeleccionMaquina]);

  const TOTAL_STEPS = STEPS.length;
  const TIPO_STEP = TIPO_STEP_BASE + stepOffset;
  const HINT = { total: TOTAL_STEPS, tipoStepId: TIPO_STEP };
  const stepArea = needsAreaPick ? 1 : null;
  const stepMotivo = 1 + stepOffset;
  const stepOrigen = 2 + stepOffset;
  const stepComponente = 3 + stepOffset;
  const stepCausa = (flujoCascada ? 4 : 5) + stepOffset;
  const stepMaquina = requiereSeleccionMaquina ? stepCausa + 1 : null;
  const stepCaptura = (stepMaquina ?? stepCausa) + 1;

  const [selectedAreaTipoMotivo, setSelectedAreaTipoMotivo] = useState<{
    id: number;
    nombre: string;
  } | null>(null);
  const [selectedOrigen, setSelectedOrigen] = useState<{
    id: number;
    nombre: string;
  } | null>(null);
  const [selectedComponente, setSelectedComponente] = useState<{
    id: number;
    nombre: string;
    codigo_origen_componente: number;
    unidades?: string;
    requiere_passcode?: boolean;
  } | null>(null);
  const [selectedCausa, setSelectedCausa] = useState<{
    id: number;
    nombre: string;
  } | null>(null);
  const [selectedMaquina, setSelectedMaquina] = useState<string>(
    () => storage.maquina?.get() ?? "",
  );

  const {
    selectedTipoMedicion,
    setSelectedTipoMedicion,
    tiposMedicionCount,
    skipTipoMedicion,
    skipRef,
    handleTiposMedicionLoaded,
    resetTipoMedicion,
  } = useTipoMedicionFlujo(
    selectedAreaTipoMotivo?.id ?? null,
    selectedComponente?.id ?? null,
  );

  const [pathSegments, setPathSegments] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [captura, setCaptura] = useState<unknown>(null);
  /** Paso Motivo oculto: el filtro de la ruta ya eligió el único ATM válido. */
  const [ocultarPasoMotivo, setOcultarPasoMotivo] = useState(false);

  useEffect(() => {
    if (!selectedArea) {
      setPathSegments([]);
      return;
    }
    setPathSegments((prev) => {
      const next = prev.length > 0 ? [...prev] : [""];
      next[0] = selectedArea.nombre_area ?? "(Área)";
      return next;
    });
  }, [selectedArea]);

  useEffect(() => {
    if (!selectedArea || !filtroMotivo) {
      setOcultarPasoMotivo(false);
      return;
    }
    if (selectedAreaTipoMotivo) return;

    let cancelled = false;
    const codigoArea = selectedArea.codigo_area;
    const nombreArea = selectedArea.nombre_area ?? "(Área)";
    loadMotivosByArea(codigoArea, (nombre) => {
      if (esMotivoMuestreoCalidad(nombre)) return false;
      if (flujoCascada && esMotivoParoMaquina(nombre)) return false;
      return filtroMotivo(nombre);
    })
      .then((lista) => {
        if (cancelled) return;
        if (lista.length === 0) {
          setOcultarPasoMotivo(false);
          return;
        }
        const pick = lista[0];
        setSelectedAreaTipoMotivo({
          id: pick.codigo_area_tipo_motivo,
          nombre: pick.nombre_tipo_motivo,
        });
        storage.rutaParcial.set({
          codigo_area: codigoArea,
          codigo_area_tipo_motivo: pick.codigo_area_tipo_motivo,
        });
        setPathSegments([nombreArea, pick.nombre_tipo_motivo]);
        const unico = autoSeleccionarMotivo && lista.length === 1;
        setOcultarPasoMotivo(unico);
        if (unico) setCurrentStep((s) => (s <= stepMotivo ? stepOrigen : s));
      })
      .catch(() => {
        if (!cancelled) setOcultarPasoMotivo(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedArea,
    selectedAreaTipoMotivo,
    filtroMotivo,
    autoSeleccionarMotivo,
    flujoCascada,
    storage,
    stepMotivo,
    stepOrigen,
  ]);

  const resetFromMotivo = useCallback(
    (keepArea: Area | null) => {
      setSelectedAreaTipoMotivo(null);
      setSelectedOrigen(null);
      setSelectedComponente(null);
      setSelectedCausa(null);
      setSelectedMaquina("");
      storage.maquina?.clear();
      resetTipoMedicion();
      storage.ruta.clear();
      setOcultarPasoMotivo(false);
      if (keepArea) {
        storage.rutaParcial.set({ codigo_area: keepArea.codigo_area });
        setPathSegments([keepArea.nombre_area ?? "(Área)"]);
      } else {
        storage.rutaParcial.clear();
        setPathSegments([]);
      }
    },
    [resetTipoMedicion, storage],
  );

  const handleSelectAreaMatch = useCallback(
    (area: Area) => {
      setSelectedArea(area);
      setCurrentStep(1);
      resetFromMotivo(area);
    },
    [resetFromMotivo, setSelectedArea],
  );

  const handleSelectMotivo = useCallback(
    (motivoId: number, nombreMotivo: string) => {
      setSelectedAreaTipoMotivo({ id: motivoId, nombre: nombreMotivo });
      setSelectedOrigen(null);
      setSelectedComponente(null);
      setSelectedCausa(null);
      skipRef.current = false;
      if (selectedArea) {
        storage.rutaParcial.set({
          codigo_area: selectedArea.codigo_area,
          codigo_area_tipo_motivo: motivoId,
        });
      }
      storage.ruta.clear();
      setPathSegments((prev) => {
        const next = [...prev];
        next[1] = nombreMotivo;
        return next.slice(0, 2);
      });
    },
    [selectedArea, skipRef, storage],
  );

  const handleSelectOrigen = useCallback(
    (origenId: number, nombreOrigen: string) => {
      setSelectedOrigen({ id: origenId, nombre: nombreOrigen });
      setSelectedComponente(null);
      setSelectedCausa(null);
      skipRef.current = false;
      if (selectedArea && selectedAreaTipoMotivo) {
        storage.rutaParcial.set({
          codigo_area: selectedArea.codigo_area,
          codigo_area_tipo_motivo: selectedAreaTipoMotivo.id,
          codigo_origen: origenId,
        });
      }
      storage.ruta.clear();
      setPathSegments((prev) => {
        const next = [...prev];
        next[2] = nombreOrigen;
        return next.slice(0, 3);
      });
    },
    [selectedArea, selectedAreaTipoMotivo, skipRef, storage],
  );

  const handleSelectComponente = useCallback(
    (
      componenteId: number,
      nombreComponente: string,
      codigoOrigenComponente: number,
      unidades?: string,
      requierePasscode?: boolean,
    ) => {
      skipRef.current = flujoCascada;
      setSelectedComponente({
        id: componenteId,
        nombre: nombreComponente,
        codigo_origen_componente: codigoOrigenComponente,
        unidades: (unidades ?? "").trim() || undefined,
        requiere_passcode: requierePasscode,
      });
      setSelectedCausa(null);
      if (flujoCascada) {
        setSelectedTipoMedicion(null);
      }
      if (selectedArea && selectedAreaTipoMotivo && selectedOrigen) {
        storage.rutaParcial.set({
          codigo_area: selectedArea.codigo_area,
          codigo_area_tipo_motivo: selectedAreaTipoMotivo.id,
          codigo_origen: selectedOrigen.id,
          codigo_origen_componente: codigoOrigenComponente,
          codigo_componente: componenteId,
        });
      }
      storage.ruta.clear();
      setPathSegments((prev) => {
        const next = [...prev];
        next[3] = nombreComponente;
        return next.slice(0, 4);
      });

      if (flujoCascada && selectedAreaTipoMotivo) {
        resolveTiposMedicionParaComponente(
          selectedAreaTipoMotivo.id,
          componenteId,
        )
          .then((tipos) => {
            const pick =
              tipos.find((t) => !t.sinTabla) ??
              tipos[0] ??
              TIPO_MEDICION_SIN_TABLA;
            setSelectedTipoMedicion(pick);
            skipRef.current = true;
          })
          .catch(() => {
            setSelectedTipoMedicion({ ...TIPO_MEDICION_SIN_TABLA });
            skipRef.current = true;
          });
      }
    },
    [selectedArea, selectedAreaTipoMotivo, selectedOrigen, skipRef, storage, flujoCascada],
  );

  const handleSelectTipoMedicion = useCallback(
    (option: TipoMedicionOption) => {
      setSelectedTipoMedicion(option);
      setSelectedCausa(null);
      storage.ruta.clear();
      if (option.sinTabla) {
        setPathSegments((prev) => prev.slice(0, 4));
        return;
      }
      setPathSegments((prev) => {
        const next = [...prev];
        next[4] = option.nombre_tipo_medicion;
        return next.slice(0, 5);
      });
    },
    [setSelectedTipoMedicion, storage],
  );

  const handleSelectCausa = useCallback(
    (causaId: number, nombreCausa: string) => {
      setSelectedCausa({ id: causaId, nombre: nombreCausa });
      if (
        selectedArea &&
        selectedAreaTipoMotivo &&
        selectedOrigen &&
        selectedComponente
      ) {
        const fila: MuestreoTablaVirtual = {
          codigo_area: selectedArea.codigo_area,
          codigo_area_tipo_motivo: selectedAreaTipoMotivo.id,
          codigo_tipo_motivo: 0,
          codigo_origen: selectedOrigen.id,
          codigo_origen_componente: selectedComponente.codigo_origen_componente,
          codigo_componente: selectedComponente.id,
          codigo_causa_defecto: causaId,
          nombre_area: selectedArea.nombre_area,
          nombre_ficha_social: selectedArea.nombre_ficha_social,
          nombre_tipo_motivo: selectedAreaTipoMotivo.nombre,
          nombre_origen: selectedOrigen.nombre,
          nombre_componente: selectedComponente.nombre,
          nombre_causa_defecto: nombreCausa,
        };
        storage.rutaParcial.set({
          codigo_area: fila.codigo_area,
          codigo_area_tipo_motivo: fila.codigo_area_tipo_motivo,
          codigo_origen: fila.codigo_origen,
          codigo_origen_componente: fila.codigo_origen_componente,
          codigo_componente: fila.codigo_componente,
          codigo_causa_defecto: fila.codigo_causa_defecto,
        });
        storage.ruta.set(fila);
      }
      setPathSegments((prev) => {
        const next = [...prev];
        const causaIndex = flujoCascada ? 4 : skipTipoMedicion ? 4 : 5;
        next[causaIndex] = nombreCausa;
        return next.slice(0, causaIndex + 1);
      });
    },
    [
      selectedArea,
      selectedAreaTipoMotivo,
      selectedOrigen,
      selectedComponente,
      skipTipoMedicion,
      flujoCascada,
      storage,
    ],
  );

  const handleSelectMaquina = useCallback(
    (maquina: string) => {
      setSelectedMaquina(maquina);
      storage.maquina?.set(maquina);
    },
    [storage],
  );

  const canGoNext = useMemo(() => {
    if (stepArea != null && currentStep === stepArea) {
      return !!selectedArea;
    }
    if (stepMaquina != null && currentStep === stepMaquina) {
      return !!selectedMaquina.trim();
    }
    if (flujoCascada) {
      switch (currentStep) {
        case stepMotivo:
          return !!selectedAreaTipoMotivo;
        case stepOrigen:
          return !!selectedOrigen;
        case stepComponente:
          return !!selectedComponente;
        case stepCausa:
          return !!selectedCausa;
        case stepCaptura:
          return true;
        default:
          return false;
      }
    }
    switch (currentStep) {
      case stepMotivo:
        return !!selectedAreaTipoMotivo;
      case stepOrigen:
        return !!selectedOrigen;
      case stepComponente:
        return !!selectedComponente;
      case TIPO_STEP:
        if (skipTipoMedicion) return true;
        if (tiposMedicionCount === null) return false;
        return !!selectedTipoMedicion;
      case stepCausa:
        return !!selectedCausa;
      case stepCaptura:
        return true;
      default:
        return false;
    }
  }, [
    currentStep,
    stepArea,
    stepMotivo,
    stepOrigen,
    stepComponente,
    stepCausa,
    stepMaquina,
    stepCaptura,
    selectedArea,
    selectedAreaTipoMotivo,
    selectedOrigen,
    selectedComponente,
    selectedCausa,
    selectedMaquina,
    selectedTipoMedicion,
    tiposMedicionCount,
    skipTipoMedicion,
    flujoCascada,
    TIPO_STEP,
  ]);

  const visibleSteps = useMemo(() => {
    let steps = flujoCascada
      ? [...STEPS]
      : visibleProcesoSteps(STEPS, skipTipoMedicion, TIPO_STEP);
    if (ocultarPasoMotivo) {
      steps = steps.filter((s) => s.id !== stepMotivo);
    }
    return steps;
  }, [STEPS, skipTipoMedicion, flujoCascada, ocultarPasoMotivo, stepMotivo, TIPO_STEP]);
  const isLastStep = currentStep === TOTAL_STEPS;

  useEffect(() => {
    if (flujoCascada) return;
    if (currentStep === TIPO_STEP && skipTipoMedicion) {
      setCurrentStep(TIPO_STEP + 1);
    }
  }, [currentStep, skipTipoMedicion, flujoCascada, TIPO_STEP]);

  const handleBack = () => {
    if (currentStep <= 1) return;
    if (ocultarPasoMotivo && currentStep === stepOrigen) return;
    if (flujoCascada) {
      setCurrentStep((s) => s - 1);
      return;
    }
    setCurrentStep((s) => prevProcesoStep(s, skipRef.current, TIPO_STEP));
  };

  const advanceAfterSelect = useCallback(() => {
    if (flujoCascada) {
      setCurrentStep((s) => (s < TOTAL_STEPS ? s + 1 : s));
      return;
    }
    setCurrentStep((s) =>
      nextProcesoStep(s, skipRef.current, TOTAL_STEPS, TIPO_STEP),
    );
  }, [skipRef, flujoCascada, TOTAL_STEPS]);

  const handleNext = () => {
    if (!canGoNext) return;
    if (flujoCascada) {
      setCurrentStep((s) => (s < TOTAL_STEPS ? s + 1 : s));
      return;
    }
    setCurrentStep((s) =>
      nextProcesoStep(s, skipRef.current, TOTAL_STEPS, TIPO_STEP),
    );
  };

  const handleReset = useCallback(() => {
    setCurrentStep(1);
    setCaptura(null);
    if (needsAreaPick) {
      setSelectedArea(null);
      resetFromMotivo(null);
    } else {
      resetFromMotivo(selectedArea);
    }
    storage.clearAll();
    if (selectedArea && !needsAreaPick) {
      storage.rutaParcial.set({ codigo_area: selectedArea.codigo_area });
    }
  }, [resetFromMotivo, selectedArea, storage, needsAreaPick, setSelectedArea]);

  useEffect(() => {
    if (resetRef) resetRef.current = handleReset;
  }, [handleReset, resetRef]);

  const handleSubmit = useCallback(() => {
    toast({
      title: submitToastTitle,
      description:
        `Área: ${selectedArea?.nombre_area ?? "-"} · ` +
        `Motivo: ${selectedAreaTipoMotivo?.nombre ?? "-"} · ` +
        `Origen: ${selectedOrigen?.nombre ?? "-"} · ` +
        `Componente: ${selectedComponente?.nombre ?? "-"} · ` +
        `Causa: ${selectedCausa?.nombre ?? "-"}`,
    });
    if (captura) {
      // eslint-disable-next-line no-console
      console.info("[proceso] datos captura:", captura);
    }
  }, [
    selectedArea,
    selectedAreaTipoMotivo,
    selectedOrigen,
    selectedComponente,
    selectedCausa,
    captura,
    toast,
    submitToastTitle,
  ]);

  const hint = (step: number) =>
    flujoCascada
      ? `Paso ${step} de ${TOTAL_STEPS}`
      : stepHintFor(step, skipTipoMedicion, HINT);

  const filaConsolidada = useMemo((): MuestreoTablaVirtual | null => {
    if (
      !selectedArea ||
      !selectedAreaTipoMotivo ||
      !selectedOrigen ||
      !selectedComponente ||
      !selectedCausa
    ) {
      return null;
    }
    return {
      codigo_area: selectedArea.codigo_area,
      codigo_area_tipo_motivo: selectedAreaTipoMotivo.id,
      codigo_tipo_motivo: 0,
      codigo_origen: selectedOrigen.id,
      codigo_origen_componente: selectedComponente.codigo_origen_componente,
      codigo_componente: selectedComponente.id,
      codigo_causa_defecto: selectedCausa.id,
      nombre_area: selectedArea.nombre_area,
      nombre_ficha_social: selectedArea.nombre_ficha_social,
      nombre_tipo_motivo: selectedAreaTipoMotivo.nombre,
      nombre_origen: selectedOrigen.nombre,
      nombre_componente: selectedComponente.nombre,
      nombre_causa_defecto: selectedCausa.nombre,
    };
  }, [
    selectedArea,
    selectedAreaTipoMotivo,
    selectedOrigen,
    selectedComponente,
    selectedCausa,
  ]);

  if (isResolviendoArea) {
    return (
      <div className="flex flex-col gap-4 pt-3 pb-10 px-2 sm:px-0">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (areaError || areasMatch.length === 0 || (areasMatch.length === 1 && !selectedArea)) {
    return (
      <div className="flex flex-col gap-4 pt-3 pb-10 px-2 sm:px-0">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          {title}
        </h1>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 text-sm">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">
                  No se pudo resolver el área
                </p>
                <p className="mt-1 text-muted-foreground">
                  {areaError ??
                    "No hay un área configurada para tu departamento."}
                </p>
                {departamento ? (
                  <p className="mt-2 text-muted-foreground">
                    Departamento:{" "}
                    <span className="font-mono font-semibold text-foreground">
                      {departamento}
                    </span>
                    . El cruce usa{" "}
                    <code className="font-mono text-xs">nombre_ficha_social</code>{" "}
                    de las áreas activas.
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pt-3 pb-10 px-2 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          {title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4 px-3 sm:px-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <span className="text-muted-foreground">Departamento</span>
            <Badge variant="secondary">{departamento || "—"}</Badge>
            <span className="text-muted-foreground">Área</span>
            {selectedArea ? (
              <Badge>{selectedArea.nombre_area}</Badge>
            ) : needsAreaPick ? (
              <Badge variant="outline">Pendiente de selección</Badge>
            ) : (
              <Badge>—</Badge>
            )}
            {regional ? (
              <>
                <span className="text-muted-foreground">Regional</span>
                <Badge variant="outline">{regional}</Badge>
              </>
            ) : null}
          </div>
          {needsAreaPick && selectedArea ? (
            <div className="flex flex-wrap gap-2">
              {areasMatch.map((a) => {
                const active = a.codigo_area === selectedArea.codigo_area;
                return (
                  <button
                    key={a.codigo_area}
                    type="button"
                    onClick={() => handleSelectAreaMatch(a)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/5 text-primary"
                        : "hover:border-primary/40",
                    )}
                  >
                    {a.nombre_area}
                  </button>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <PathHeader segments={pathSegments} label={pathLabel} />

      <Card>
        <CardContent className="space-y-6 pt-2 px-3 sm:px-6">
          <StepperHeader steps={visibleSteps} currentStep={currentStep} />

          {stepArea != null && currentStep === stepArea && (
            <StepSelectAreaDepartamento
              areas={areasMatch}
              departamento={departamento}
              selectedAreaId={selectedArea?.codigo_area ?? null}
              onSelect={handleSelectAreaMatch}
              onAfterSelect={advanceAfterSelect}
              stepHint={hint(stepArea)}
            />
          )}

          {currentStep === stepMotivo && autoSeleccionarMotivo && !selectedAreaTipoMotivo ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
              <p className="text-sm text-muted-foreground">
                Resolviendo el motivo de esta ruta…
              </p>
            </div>
          ) : null}

          {currentStep === stepMotivo &&
            !ocultarPasoMotivo &&
            !(autoSeleccionarMotivo && !selectedAreaTipoMotivo) &&
            selectedArea && (
            <StepSelectMotivo
              selectedArea={selectedArea}
              selectedMotivoId={selectedAreaTipoMotivo?.id ?? null}
              onSelect={handleSelectMotivo}
              onAfterSelect={advanceAfterSelect}
              stepHint={hint(stepMotivo)}
              excludeMuestreoCalidad
              excludeParoMaquina={flujoCascada}
              matchesMotivo={filtroMotivo}
              autoSelect={false}
            />
          )}

          {currentStep === stepOrigen && selectedArea && (
            <StepSelectOrigen
              codigoArea={selectedArea.codigo_area}
              codigoAreaTipoMotivo={selectedAreaTipoMotivo?.id ?? null}
              selectedOrigenId={selectedOrigen?.id ?? null}
              onSelect={handleSelectOrigen}
              onAfterSelect={advanceAfterSelect}
              stepHint={hint(stepOrigen)}
              description={
                flujoCascada
                  ? "Orígenes habilitados para el motivo que elegiste."
                  : undefined
              }
            />
          )}

          {currentStep === stepComponente && selectedArea && (
            <Step3SelectComponenteMuestreo
              selectedArea={selectedArea}
              selectedAreaTipoMotivoId={selectedAreaTipoMotivo?.id ?? null}
              selectedOrigenId={selectedOrigen?.id ?? null}
              selectedComponenteId={selectedComponente?.id ?? null}
              onSelect={handleSelectComponente}
              onAfterSelect={advanceAfterSelect}
              tablaVirtual={EMPTY_TABLA_VIRTUAL}
              stepHint={hint(stepComponente)}
            />
          )}

          {!flujoCascada && currentStep === TIPO_STEP && !skipTipoMedicion && selectedArea && (
            <StepSelectTipoMedicion
              codigoAreaTipoMotivo={selectedAreaTipoMotivo?.id ?? null}
              codigoComponente={selectedComponente?.id ?? null}
              selectedCodigoTipoMedicion={
                selectedTipoMedicion?.codigo_tipo_medicion ?? null
              }
              onSelect={handleSelectTipoMedicion}
              onAfterSelect={advanceAfterSelect}
              onOptionsLoaded={handleTiposMedicionLoaded}
              stepHint={hint(TIPO_STEP)}
            />
          )}

          {currentStep === stepCausa && selectedArea && (
            <Step4SelectCausaMuestreo
              selectedArea={selectedArea}
              selectedAreaTipoMotivoId={selectedAreaTipoMotivo?.id ?? null}
              selectedOrigenId={selectedOrigen?.id ?? null}
              selectedComponenteId={selectedComponente?.id ?? null}
              selectedOrigenComponenteId={
                selectedComponente?.codigo_origen_componente ?? null
              }
              selectedCausaId={selectedCausa?.id ?? null}
              onSelect={handleSelectCausa}
              onAfterSelect={advanceAfterSelect}
              tablaVirtual={EMPTY_TABLA_VIRTUAL}
              stepHint={hint(stepCausa)}
            />
          )}

          {stepMaquina != null && currentStep === stepMaquina && selectedArea && (
            <StepSelectMaquina
              regional={selectedArea.regional || regional}
              nombreArea={selectedArea.nombre_area}
              selectedMaquina={selectedMaquina}
              onSelect={handleSelectMaquina}
              onAfterSelect={advanceAfterSelect}
              stepHint={hint(stepMaquina)}
            />
          )}

          {currentStep === stepCaptura &&
            filaConsolidada &&
            selectedAreaTipoMotivo &&
            selectedOrigen &&
            selectedComponente &&
            selectedCausa &&
            renderCaptura({
              // `filaConsolidada` (chequeado arriba) solo existe cuando
              // `selectedArea` ya estaba definido al calcularlo (ver el
              // useMemo de filaConsolidada) — TS no puede inferir esa
              // relación entre variables distintas, de ahí el `!`.
              selectedArea: selectedArea!,
              regional,
              departamento,
              selectedAreaTipoMotivo,
              selectedOrigen,
              selectedComponente,
              selectedCausa,
              selectedMaquina,
              selectedTipoMedicion,
              skipTipoMedicion,
              filaConsolidada,
              hint,
              onCapturaChange: setCaptura,
              onBack: handleBack,
            })}

          <StepNavigation
            currentStep={currentStep}
            totalSteps={visibleSteps.length}
            canGoNext={canGoNext}
            isLastStep={isLastStep}
            hideSubmit={isLastStep}
            onBack={handleBack}
            onNext={handleNext}
            onCancel={handleReset}
            onSubmit={handleSubmit}
          />
        </CardContent>
      </Card>
    </div>
  );
}

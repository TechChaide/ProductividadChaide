"use client";

/**
 * Wizard de "Muestreos operador" (tablas Dimensional) para el feature
 * embebido Paros/Captura. Equivalente a `/dashboard/procesos/samplingsOp`
 * en el proyecto origen (muestreos_frontend), montado aquí como
 * componente en vez de página.
 *
 * El área se resuelve automáticamente cruzando el DEPARTAMENTO del
 * usuario con `nombre_ficha_social` de las áreas activas (igual que
 * Paros/Captura, vía `useAreaDesdeDepartamento`). Solo admite motivos de
 * muestreo y componentes/tipos de medición con tabla Dimensional.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, Ruler } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Area, MuestreoTablaVirtual } from "@/types/integrations/muestreos-ddpp";
import StepperHeader, {
  type StepDef,
} from "@/components/integrations/muestreos-ddpp/wizard/stepper-header";
import StepNavigation from "@/components/integrations/muestreos-ddpp/wizard/step-navigation";
import PathHeader from "@/components/integrations/muestreos-ddpp/wizard/path-header";
import StepSelectMotivo from "@/components/integrations/muestreos-ddpp/wizard/step-select-motivo";
import StepSelectOrigen from "@/components/integrations/muestreos-ddpp/wizard/step-select-origen";
import Step3SelectComponenteMuestreo from "@/components/integrations/muestreos-ddpp/wizard/step3-select-componente-muestreo";
import Step4SelectCausaMuestreo from "@/components/integrations/muestreos-ddpp/wizard/step4-select-causa-muestreo";
import StepSelectTipoMedicion from "@/components/integrations/muestreos-ddpp/wizard/step-select-tipo-medicion";
import Step5CapturarMuestreo from "@/components/integrations/muestreos-ddpp/captura/step5-capturar-muestreo";
import { useTipoMedicionFlujo } from "@/hooks/integrations/muestreos-ddpp/use-tipo-medicion-flujo";
import { useAreaDesdeDepartamento } from "@/hooks/integrations/muestreos-ddpp/use-area-desde-departamento";
import {
  esOpcionTablaDimensional,
  type TipoMedicionFlujoPolicy,
  type TipoMedicionOption,
  nextProcesoStep,
  prevProcesoStep,
  stepHintFor,
  visibleProcesoSteps,
} from "@/lib/integrations/muestreos-ddpp/tipo-medicion-tabla";
import { nombreMotivoIncluye } from "@/lib/integrations/muestreos-ddpp/flujo-seleccion";
import {
  clearAllMuestreoOpStorage,
  muestreoOpRutaParcialStorage,
  muestreoOpRutaStorage,
} from "@/lib/integrations/muestreos-ddpp/muestreo-op-storage";

const TIPO_STEP = 4;
const TOTAL_STEPS = 6;

const STEPS: readonly StepDef[] = [
  { id: 1, title: "Motivo", description: "Tipo de motivo de muestreo" },
  { id: 2, title: "Origen", description: "Origen del ATM" },
  { id: 3, title: "Componente", description: "Componente con tabla dimensional" },
  { id: 4, title: "Tipo medición", description: "Tabla dinámica dimensional" },
  { id: 5, title: "Causa", description: "Causa de defecto" },
  { id: 6, title: "Captura", description: "Tabla dimensional + campos fijos" },
] as const;

const HINT = { total: TOTAL_STEPS, tipoStepId: TIPO_STEP };

const DIMENSIONAL_POLICY: TipoMedicionFlujoPolicy = {
  filtro: esOpcionTablaDimensional,
  allowSinTabla: false,
  autoSelectSingle: true,
};

function esMotivoMuestreo(nombre: string | undefined | null): boolean {
  return nombreMotivoIncluye(nombre, "MUESTREO");
}

export default function MuestreoOpWizard() {
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

  const [selectedAreaTipoMotivo, setSelectedAreaTipoMotivo] = useState<
    { id: number; nombre: string } | null
  >(null);
  const [selectedOrigen, setSelectedOrigen] = useState<
    { id: number; nombre: string } | null
  >(null);
  const [selectedComponente, setSelectedComponente] = useState<
    {
      id: number;
      nombre: string;
      codigo_origen_componente: number;
      unidades?: string;
    } | null
  >(null);
  const [selectedCausa, setSelectedCausa] = useState<
    { id: number; nombre: string } | null
  >(null);

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
    DIMENSIONAL_POLICY,
  );

  const [pathSegments, setPathSegments] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [captura, setCaptura] = useState<unknown>(null);

  const hint = (step: number) => stepHintFor(step, skipTipoMedicion, HINT);

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
    muestreoOpRutaParcialStorage.set({ codigo_area: selectedArea.codigo_area });
  }, [selectedArea]);

  const resetFromMotivo = useCallback(
    (keepArea: Area | null) => {
      setSelectedAreaTipoMotivo(null);
      setSelectedOrigen(null);
      setSelectedComponente(null);
      setSelectedCausa(null);
      resetTipoMedicion();
      muestreoOpRutaStorage.clear();
      if (keepArea) {
        muestreoOpRutaParcialStorage.set({ codigo_area: keepArea.codigo_area });
        setPathSegments([keepArea.nombre_area ?? "(Área)"]);
      } else {
        muestreoOpRutaParcialStorage.clear();
        setPathSegments([]);
      }
    },
    [resetTipoMedicion],
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
        muestreoOpRutaParcialStorage.set({
          codigo_area: selectedArea.codigo_area,
          codigo_area_tipo_motivo: motivoId,
        });
      }
      muestreoOpRutaStorage.clear();

      setPathSegments((prev) => {
        const next = [...prev];
        next[1] = nombreMotivo;
        return next.slice(0, 2);
      });
    },
    [selectedArea, skipRef],
  );

  const handleSelectOrigen = useCallback(
    (origenId: number, nombreOrigen: string) => {
      setSelectedOrigen({ id: origenId, nombre: nombreOrigen });
      setSelectedComponente(null);
      setSelectedCausa(null);
      skipRef.current = false;

      if (selectedArea && selectedAreaTipoMotivo) {
        muestreoOpRutaParcialStorage.set({
          codigo_area: selectedArea.codigo_area,
          codigo_area_tipo_motivo: selectedAreaTipoMotivo.id,
          codigo_origen: origenId,
        });
      }
      muestreoOpRutaStorage.clear();

      setPathSegments((prev) => {
        const next = [...prev];
        next[2] = nombreOrigen;
        return next.slice(0, 3);
      });
    },
    [selectedArea, selectedAreaTipoMotivo, skipRef],
  );

  const handleSelectComponente = useCallback(
    (
      componenteId: number,
      nombreComponente: string,
      codigoOrigenComponente: number,
      unidades?: string,
    ) => {
      setSelectedComponente({
        id: componenteId,
        nombre: nombreComponente,
        codigo_origen_componente: codigoOrigenComponente,
        unidades: (unidades ?? "").trim() || undefined,
      });
      setSelectedCausa(null);
      skipRef.current = false;

      if (selectedArea && selectedAreaTipoMotivo && selectedOrigen) {
        muestreoOpRutaParcialStorage.set({
          codigo_area: selectedArea.codigo_area,
          codigo_area_tipo_motivo: selectedAreaTipoMotivo.id,
          codigo_origen: selectedOrigen.id,
          codigo_origen_componente: codigoOrigenComponente,
          codigo_componente: componenteId,
        });
      }
      muestreoOpRutaStorage.clear();

      setPathSegments((prev) => {
        const next = [...prev];
        next[3] = nombreComponente;
        return next.slice(0, 4);
      });
    },
    [selectedArea, selectedAreaTipoMotivo, selectedOrigen, skipRef],
  );

  const handleSelectTipoMedicion = useCallback(
    (option: TipoMedicionOption) => {
      setSelectedTipoMedicion(option);
      setSelectedCausa(null);
      muestreoOpRutaStorage.clear();

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
    [setSelectedTipoMedicion],
  );

  const tieneTipoEnPath =
    !!selectedTipoMedicion && !selectedTipoMedicion.sinTabla;

  useEffect(() => {
    if (!selectedTipoMedicion || selectedTipoMedicion.sinTabla) return;
    setPathSegments((prev) => {
      if (!prev[3]) return prev;
      if (prev[4] === selectedTipoMedicion.nombre_tipo_medicion) return prev;
      const next = [...prev];
      next[4] = selectedTipoMedicion.nombre_tipo_medicion;
      return next;
    });
  }, [selectedTipoMedicion]);

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
        muestreoOpRutaParcialStorage.set({
          codigo_area: fila.codigo_area,
          codigo_area_tipo_motivo: fila.codigo_area_tipo_motivo,
          codigo_origen: fila.codigo_origen,
          codigo_origen_componente: fila.codigo_origen_componente,
          codigo_componente: fila.codigo_componente,
          codigo_causa_defecto: fila.codigo_causa_defecto,
        });
        muestreoOpRutaStorage.set(fila);
      }

      setPathSegments((prev) => {
        const next = [...prev];
        const causaIndex = tieneTipoEnPath ? 5 : 4;
        next[causaIndex] = nombreCausa;
        return next.slice(0, causaIndex + 1);
      });
    },
    [
      selectedArea,
      selectedAreaTipoMotivo,
      selectedOrigen,
      selectedComponente,
      tieneTipoEnPath,
    ],
  );

  const canGoNext = useMemo(() => {
    switch (currentStep) {
      case 1:
        return !!selectedAreaTipoMotivo;
      case 2:
        return !!selectedOrigen;
      case 3:
        return !!selectedComponente;
      case 4:
        if (skipTipoMedicion) return true;
        if (tiposMedicionCount === null) return false;
        return !!selectedTipoMedicion;
      case 5:
        return !!selectedCausa;
      case 6:
        return true;
      default:
        return false;
    }
  }, [
    currentStep,
    selectedAreaTipoMotivo,
    selectedOrigen,
    selectedComponente,
    selectedCausa,
    selectedTipoMedicion,
    tiposMedicionCount,
    skipTipoMedicion,
  ]);

  const visibleSteps = useMemo(
    () => visibleProcesoSteps(STEPS, skipTipoMedicion, TIPO_STEP),
    [skipTipoMedicion],
  );
  const isLastStep = currentStep === TOTAL_STEPS;

  const handleBack = () => {
    if (currentStep <= 1) return;
    setCurrentStep((s) => prevProcesoStep(s, skipRef.current, TIPO_STEP));
  };

  const advanceAfterSelect = useCallback(() => {
    setCurrentStep((s) =>
      nextProcesoStep(s, skipRef.current, TOTAL_STEPS, TIPO_STEP),
    );
  }, [skipRef]);

  const handleNext = () => {
    if (!canGoNext) return;
    setCurrentStep((s) =>
      nextProcesoStep(s, skipRef.current, TOTAL_STEPS, TIPO_STEP),
    );
  };

  const handleReset = useCallback(() => {
    setCurrentStep(1);
    setCaptura(null);
    resetFromMotivo(selectedArea);
    clearAllMuestreoOpStorage();
    if (selectedArea) {
      muestreoOpRutaParcialStorage.set({ codigo_area: selectedArea.codigo_area });
    }
  }, [resetFromMotivo, selectedArea]);

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

  const handleSubmit = useCallback(() => {
    toast({
      title: "Muestreo dimensional listo para registrar",
      description:
        `Área: ${selectedArea?.nombre_area ?? "-"} · ` +
        `Motivo: ${selectedAreaTipoMotivo?.nombre ?? "-"} · ` +
        `Origen: ${selectedOrigen?.nombre ?? "-"} · ` +
        `Componente: ${selectedComponente?.nombre ?? "-"} · ` +
        `Tipo: ${selectedTipoMedicion?.nombre_tipo_medicion ?? "-"} · ` +
        `Causa: ${selectedCausa?.nombre ?? "-"}`,
    });
    if (captura) {
      // eslint-disable-next-line no-console
      console.info("[muestreoOp] datos captura:", captura);
    }
  }, [
    selectedArea,
    selectedAreaTipoMotivo,
    selectedOrigen,
    selectedComponente,
    selectedCausa,
    selectedTipoMedicion,
    captura,
    toast,
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

  if (areaError || !selectedArea) {
    return (
      <div className="flex flex-col gap-4 pt-3 pb-10 px-2 sm:px-0">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Ruler className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          Muestreos dimensionales
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
          <Ruler className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          Muestreos dimensionales
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          El área se toma de tu departamento. Solo se listan componentes con
          tabla dinámica de tipo Dimensional.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4 px-3 sm:px-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <span className="text-muted-foreground">Departamento</span>
            <Badge variant="secondary">{departamento || "—"}</Badge>
            <span className="text-muted-foreground">Área</span>
            <Badge>{selectedArea.nombre_area}</Badge>
            {(regional || selectedArea.regional) ? (
              <>
                <span className="text-muted-foreground">Regional</span>
                <Badge variant="outline">{regional || selectedArea.regional}</Badge>
              </>
            ) : null}
          </div>
          {areasMatch.length > 1 ? (
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

      <PathHeader
        segments={pathSegments}
        label="Ruta del muestreo"
        placeholder="Aún no se ha seleccionado ningún elemento"
      />

      <Card>
        <CardContent className="space-y-6 pt-2 px-3 sm:px-6">
          <StepperHeader steps={visibleSteps} currentStep={currentStep} />

          {currentStep === 1 && (
            <StepSelectMotivo
              selectedArea={selectedArea}
              selectedMotivoId={selectedAreaTipoMotivo?.id ?? null}
              onSelect={handleSelectMotivo}
              onAfterSelect={advanceAfterSelect}
              stepHint={hint(1)}
              excludeMuestreoCalidad={false}
              matchesMotivo={esMotivoMuestreo}
              autoSelect
            />
          )}

          {currentStep === 2 && (
            <StepSelectOrigen
              codigoArea={selectedArea.codigo_area}
              codigoAreaTipoMotivo={selectedAreaTipoMotivo?.id ?? null}
              selectedOrigenId={selectedOrigen?.id ?? null}
              onSelect={handleSelectOrigen}
              onAfterSelect={advanceAfterSelect}
              stepHint={hint(2)}
            />
          )}

          {currentStep === 3 && (
            <Step3SelectComponenteMuestreo
              selectedArea={selectedArea}
              selectedAreaTipoMotivoId={selectedAreaTipoMotivo?.id ?? null}
              selectedOrigenId={selectedOrigen?.id ?? null}
              selectedComponenteId={selectedComponente?.id ?? null}
              onSelect={handleSelectComponente}
              onAfterSelect={advanceAfterSelect}
              stepHint={hint(3)}
              soloTablasDimensionales
            />
          )}

          {currentStep === 4 && !skipTipoMedicion && (
            <StepSelectTipoMedicion
              codigoAreaTipoMotivo={selectedAreaTipoMotivo?.id ?? null}
              codigoComponente={selectedComponente?.id ?? null}
              selectedCodigoTipoMedicion={
                selectedTipoMedicion?.codigo_tipo_medicion ?? null
              }
              onSelect={handleSelectTipoMedicion}
              onAfterSelect={advanceAfterSelect}
              onOptionsLoaded={handleTiposMedicionLoaded}
              stepHint={hint(4)}
              policy={DIMENSIONAL_POLICY}
              title="Selecciona la tabla dimensional"
              description="Solo se muestran tipos de medición Dimensional vigentes para este componente."
              emptyMessage="Este componente no tiene una tabla dinámica dimensional. Vuelve y elige otro, o configura asociaciones de tipo Dimensional."
            />
          )}

          {currentStep === 5 && (
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
              stepHint={hint(5)}
            />
          )}

          {currentStep === 6 &&
            filaConsolidada &&
            selectedAreaTipoMotivo &&
            selectedOrigen &&
            selectedComponente &&
            selectedCausa && (
              <Step5CapturarMuestreo
                codigoAreaTipoMotivo={selectedAreaTipoMotivo.id}
                codigoComponente={selectedComponente.id}
                unidadesComponente={selectedComponente.unidades}
                codigoTipoMedicion={
                  selectedTipoMedicion?.codigo_tipo_medicion ?? null
                }
                responsables={selectedArea.respCtrlProd ?? ""}
                // Muestreo dimensional del operador: no hay órdenes SAP que
                // consultar/escanear para esta captura (a diferencia de
                // Captura, donde el motivo puede ser DEFECTO/DEVOLUCIÓN
                // ligado a una orden).
                ordenesConsultaHabilitadas={false}
                defaults={{
                  departamento: selectedArea.nombre_area ?? "",
                  motivo: selectedAreaTipoMotivo.nombre,
                  origen: selectedOrigen.nombre,
                  componente: selectedComponente.nombre,
                  causa_defecto: selectedCausa.nombre,
                  regional: regional || selectedArea.regional || "",
                }}
                filaConsolidada={filaConsolidada}
                onChange={setCaptura}
                stepHint={hint(6)}
                title="Carga de datos"
                empleadoAutocomplete
                departamentoEmpleadoFilter={selectedOrigen.nombre}
              />
            )}

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

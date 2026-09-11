"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ParoTablaFija from "./paro-tabla-fija";
import type { ProcesoCapturaContext } from "@/components/integrations/muestreos-ddpp/wizard/proceso-wizard-types";
import { formatDateForSQLServer } from "@/lib/integrations/muestreos-ddpp/datetime2";
import { getCodigoPersonaSesion } from "@/lib/integrations/muestreos-ddpp/session-storage";
import { COMODIN_NA } from "@/lib/integrations/muestreos-ddpp/comodin-captura";
import PasscodeGateModal from "@/components/integrations/muestreos-ddpp/shared/passcode-gate-modal";
import { registroService } from "@/services/integrations/muestreos-ddpp/registro.service";
import { registroCausaDefectoService } from "@/services/integrations/muestreos-ddpp/registroCausaDefecto.service";
import {
  paroFilaStorage,
  paroInicioStorage,
  paroTiempoStorage,
} from "./paro-storage";
import { useToast } from "@/hooks/use-toast";
import { useSyncRegistroUnidades } from "@/hooks/integrations/muestreos-ddpp/use-sync-registro-unidades";

type CronometroEstado = "idle" | "running" | "stopped";

interface ParosCapturaStepProps extends ProcesoCapturaContext {
  onResetWizard: () => void;
}

export default function ParosCapturaStep({
  filaConsolidada,
  selectedArea,
  selectedComponente,
  selectedMaquina,
  regional,
  departamento,
  hint,
  onBack,
  onResetWizard,
}: ParosCapturaStepProps) {
  const { toast } = useToast();
  const [estado, setEstado] = useState<CronometroEstado>("idle");
  const [pidiendoPasscode, setPidiendoPasscode] = useState(false);
  const [tiempoSegundos, setTiempoSegundos] = useState(0);
  const [fechaCaptura, setFechaCaptura] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inicioMsRef = useRef<number | null>(null);
  const causasOkRef = useRef(false);
  const codigoRegistroRef = useRef<number | null>(null);
  const [unidadesRegistro, setUnidadesRegistro] = useState("");

  useSyncRegistroUnidades(
    filaConsolidada.codigo_componente,
    setUnidadesRegistro,
  );

  useEffect(() => {
    paroFilaStorage.set(filaConsolidada);
    const inicio = paroInicioStorage.get();
    const tiempo = paroTiempoStorage.get();
    if (inicio != null) {
      inicioMsRef.current = inicio;
      setEstado("running");
    } else if (tiempo != null && tiempo > 0) {
      setTiempoSegundos(tiempo);
      setEstado("stopped");
    }
  }, [filaConsolidada]);

  useEffect(() => {
    const tick = () => setFechaCaptura(formatDateForSQLServer(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (estado !== "running" || inicioMsRef.current == null) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    tickRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - inicioMsRef.current!) / 1000);
      setTiempoSegundos(elapsed);
      paroTiempoStorage.set(elapsed);
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [estado]);

  const handleIniciar = useCallback(() => {
    const now = Date.now();
    inicioMsRef.current = now;
    paroInicioStorage.set(now);
    paroTiempoStorage.set(0);
    setTiempoSegundos(0);
    setEstado("running");
  }, []);

  const handleCancelar = useCallback(() => {
    inicioMsRef.current = null;
    paroInicioStorage.clear();
    paroTiempoStorage.clear();
    setTiempoSegundos(0);
    setEstado("idle");
    causasOkRef.current = false;
    codigoRegistroRef.current = null;
  }, []);

  const handleFinalizar = useCallback(async () => {
    if (isSaving) return;
    if (estado === "running" && inicioMsRef.current != null) {
      const elapsed = Math.floor((Date.now() - inicioMsRef.current) / 1000);
      setTiempoSegundos(elapsed);
      paroTiempoStorage.set(elapsed);
    }
    setEstado("stopped");
    paroInicioStorage.clear();

    const tiempo =
      estado === "running" && inicioMsRef.current != null
        ? Math.floor((Date.now() - inicioMsRef.current) / 1000)
        : tiempoSegundos;

    if (tiempo <= 0) {
      toast({
        title: "Cronómetro sin tiempo",
        description: "Inicia el paro antes de finalizar.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const ahora = new Date();
      const usuario = getCodigoPersonaSesion() || "sistema";
      let codigoRegistro = codigoRegistroRef.current;

      if (codigoRegistro == null) {
        const payload = {
          fecha_registro: fechaCaptura || formatDateForSQLServer(ahora),
          anio: ahora.getFullYear(),
          mes: ahora.getMonth() + 1,
          dia: ahora.getDate(),
          hora: ahora.getHours(),
          regional: selectedArea.regional || regional || "",
          departamento: selectedArea.nombre_area ?? departamento,
          motivo: filaConsolidada.nombre_tipo_motivo ?? "",
          origen: filaConsolidada.nombre_origen ?? "",
          componente: filaConsolidada.nombre_componente ?? "",
          causa_defecto: filaConsolidada.nombre_causa_defecto ?? "",
          cantidad: "1",
          unidades: unidadesRegistro.trim(),
          maquina: selectedMaquina.trim(),
          material: COMODIN_NA,
          comodin: COMODIN_NA,
          // MOTIVO = GESTIÓN ADM. DISTRI. nunca ocurre en el flujo de paro
          // de máquina: se persiste N.A. por consistencia con `Registro`.
          pedido: COMODIN_NA,
          codigo_empleado: usuario,
          tiempo,
          estado: "A",
          fecha_creacion: formatDateForSQLServer(ahora),
          usuario_creacion: usuario,
        };
        const res = await registroService.save(
          payload as unknown as import("@/types/integrations/muestreos-ddpp").Registro,
        );
        codigoRegistro = res.data?.codigo_registro ?? null;
        if (codigoRegistro == null || codigoRegistro <= 0) {
          throw new Error("El backend no devolvió un codigo_registro válido.");
        }
        codigoRegistroRef.current = codigoRegistro;
      }

      if (!causasOkRef.current) {
        const codigoCausa = filaConsolidada.codigo_causa_defecto;
        if (codigoCausa == null || codigoCausa <= 0) {
          throw new Error("Falta codigo_causa_defecto.");
        }
        await registroCausaDefectoService.save({
          codigo_registro: codigoRegistro,
          codigo_causa_defecto: codigoCausa,
          estado: "A",
        });
        causasOkRef.current = true;
      }

      toast({
        title: "Paro registrado",
        description: `Tiempo: ${tiempo}s · Causa: ${filaConsolidada.nombre_causa_defecto}`,
      });
      handleCancelar();
      onResetWizard();
    } catch (err) {
      toast({
        title: "Error al registrar paro",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving,
    estado,
    tiempoSegundos,
    fechaCaptura,
    selectedArea,
    regional,
    departamento,
    filaConsolidada,
    unidadesRegistro,
    selectedMaquina,
    toast,
    handleCancelar,
    onResetWizard,
  ]);

  return (
    <div className="space-y-4">
      <div>
        <span className="text-sm text-primary font-medium">{hint(6)}</span>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Captura del paro
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Inicia el cronómetro al comenzar el paro y finaliza para registrar.
        </p>
      </div>
      <ParoTablaFija
        fila={filaConsolidada}
        codigoEmpleado={getCodigoPersonaSesion()}
        regional={selectedArea.regional || regional}
        departamentoUsuario={departamento}
        fechaCaptura={fechaCaptura}
        tiempoSegundos={tiempoSegundos}
        estado={estado}
        onIniciar={() => {
          // En paro de máquina (único motivo de este wizard), el
          // componente decide si exige PASSCODE_PAROS. `undefined`
          // (p.ej. vino del fallback de tabla virtual) se trata como
          // `true`: por defecto se pide contraseña.
          if (selectedComponente.requiere_passcode === false) {
            handleIniciar();
          } else {
            setPidiendoPasscode(true);
          }
        }}
        onFinalizar={handleFinalizar}
        onCancelar={handleCancelar}
        disabled={isSaving}
        maquina={selectedMaquina}
        mostrarTabla={estado === "idle"}
        unidadesRegistro={unidadesRegistro}
      />
      <PasscodeGateModal
        open={pidiendoPasscode}
        onSuccess={() => {
          setPidiendoPasscode(false);
          handleIniciar();
        }}
        onCancel={() => {
          setPidiendoPasscode(false);
          onBack();
        }}
      />
    </div>
  );
}

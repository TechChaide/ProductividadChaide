"use client";

/**
 * Tabla "Registro" del flujo de Paros
 * (`/dashboard/procesos/paros`).
 *
 * Esta tarjeta es el espejo visual de la sección "Tabla registro —
 * campos fijos" que existe en los flujos de muestreo (`/samplings`) y
 * paros con selección manual (`/parosM`). Mantiene la misma estructura
 * para que el inspector vea SIEMPRE la misma pantalla, independientemente
 * de qué flujo esté usando.
 *
 * A diferencia de los otros flujos, este formulario es SIMPLE: no tiene
 * wizard ni selección manual. Los valores del path ya vienen resueltos
 * del `DEPARTAMENTO` del inspector (ver `page.tsx`). Al pie del
 * formulario hay exactamente DOS botones inline (NO flotantes):
 *
 *   1. "Iniciar Paro"  → arranca el cronómetro (estado `idle`).
 *   2. "Finalizar y registrar paro" → detiene el cronómetro y registra
 *      el paro (estados `running` y `stopped`).
 *
 * Al lado, un botón "Cancelar" para reiniciar el contador (visible solo
 * cuando el cronómetro está en `running` o `stopped`).
 */

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  IdCard,
  Lock,
  LockKeyhole,
  Play,
  Save,
  Table as TableIcon,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import ParoFlipClock from "./paro-flipclock";
import RegistroUnidadesOculto from "@/components/integrations/muestreos-ddpp/shared/registro-unidades-oculto";

type CronometroEstado = "idle" | "running" | "stopped";

interface ParoTablaFijaProps {
  /** Fila consolidada de la tabla virtual que matchea la ruta del paro. */
  fila: {
    codigo_area: number;
    codigo_area_tipo_motivo: number;
    codigo_componente: number;
    codigo_causa_defecto: number;
    codigo_origen: number;
    nombre_area: string;
    nombre_ficha_social: string;
    nombre_tipo_motivo: string;
    nombre_origen: string;
    nombre_componente: string;
    nombre_causa_defecto: string;
  };
  /** Código de persona del usuario logueado (Registro.codigo_empleado). */
  codigoEmpleado: string;
  /** Regional del usuario (Registro.regional). */
  regional: string;
  /** DEPARTAMENTO del usuario (FichaSocialHistorica.DEPARTAMENTO). */
  departamentoUsuario: string;
  /** Fecha/hora del momento de la captura (Registro.fecha_registro + anio/mes/dia/hora). */
  fechaCaptura: string;
  /** Segundos transcurridos del cronómetro (Registro.tiempo). */
  tiempoSegundos: number;
  /** Estado del cronómetro (lo provee el padre). */
  estado: CronometroEstado;
  /** Handler "Iniciar Paro" (cuando `estado === "idle"`). */
  onIniciar: () => void;
  /** Handler "Finalizar y registrar paro" (cuando `estado !== "idle"`). */
  onFinalizar: () => void;
  /** Handler "Cancelar" para reiniciar el cronómetro. */
  onCancelar: () => void;
  /** Si está deshabilitado (p.ej. mientras se resuelve la ruta). */
  disabled?: boolean;
  /**
   * Si es `true` (default), muestra la tabla fija con todos los campos
   * del modelo `Registro`. Si es `false`, oculta la tabla y deja
   * solamente el header con el reloj en vivo y el FlipClock del
   * cronómetro (cuando hay paro activo o detenido).
   *
   * Sirve para reducir el ruido visual una vez que el inspector ya
   * conoce los valores del path y solo quiere ver el cronómetro.
   */
  mostrarTabla?: boolean;
  /** Unidades del componente (campo oculto de `Registro.unidades`). */
  unidadesRegistro?: string;
  /** Máquina ya elegida en el paso "Máquina" del wizard (`Registro.maquina`); solo se muestra, no se edita acá. */
  maquina: string;
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * Helper para partir un ISO en `AAAA / MM / DD / HH`.
 */
function splitFechaHora(iso: string): {
  anio: string;
  mes: string;
  mesNombre: string;
  dia: string;
  hora: string;
} {
  if (!iso) {
    return { anio: "—", mes: "", mesNombre: "", dia: "—", hora: "—" };
  }
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return {
    anio: d.getFullYear().toString(),
    mes: pad(d.getMonth() + 1),
    mesNombre: MESES[d.getMonth()] ?? "",
    dia: pad(d.getDate()),
    hora: pad(d.getHours()),
  };
}

/**
 * Formatea los segundos del cronómetro a HH:MM:SS.
 */
function formatHMS(s: number): string {
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

/* ============================================================================
 *  Sub-componentes: réplicas locales del look & feel de step5 (parosM /
 *  samplings). Se duplican acá en lugar de importarse de step5 para mantener
 *  el módulo autocontenido y porque la lógica de paro es mucho más simple
 *  (no hay drag & drop ni scanner).
 *  ========================================================================== */

/** Mini-tarjeta read-only con label + valor truncado (estilo PathSummaryItem). */
function PathSummaryItem({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p
        className="text-xs font-medium truncate"
        title={value || "—"}
      >
        {value || "—"}
      </p>
    </div>
  );
}

export default function ParoTablaFija({
  fila,
  codigoEmpleado,
  regional,
  departamentoUsuario,
  fechaCaptura,
  tiempoSegundos,
  estado,
  onIniciar,
  onFinalizar,
  onCancelar,
  disabled = false,
  mostrarTabla = true,
  unidadesRegistro = "",
  maquina,
}: ParoTablaFijaProps) {
  const { anio, mes, mesNombre, dia, hora } = splitFechaHora(fechaCaptura);
  const fechaLegible = `${anio} · ${mesNombre} · ${dia}`;

  // ===== Header reloj en vivo =====
  /**
   * Pintamos la hora con segundos que se refresca cada 1s. Esto hace
   * que la cabecera de la tabla "sienta" que está viva en sincronía con
   * el cronómetro, igual que en step5 de muestreos/parosM.
   */
  const [reloj, setReloj] = useState<Date | null>(null);
  useEffect(() => {
    setReloj(new Date());
    const tick = () => setReloj(new Date());
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const horaCompleta = reloj
    ? `${pad(reloj.getHours())}:${pad(reloj.getMinutes())}:${pad(reloj.getSeconds())}`
    : "—";

  // ===== Cronómetro legible (HH:MM:SS) =====
  const cronometroLegible = useMemo(
    () => formatHMS(tiempoSegundos),
    [tiempoSegundos],
  );

  // Botón principal: cambia label y handler según el estado del cronómetro.
  const enCurso = estado === "running";
  const detenido = estado === "stopped";
  const paroActivo = enCurso || detenido;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        {mostrarTabla && (
          <RegistroUnidadesOculto value={unidadesRegistro} />
        )}
        {/* ===== Header ===== */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">
              Tabla <code className="font-mono text-xs">registro</code> —
              campos fijos
            </h3>
            {mostrarTabla ? (
              <Badge variant="secondary" className="gap-1">
                <LockKeyhole className="h-3 w-3" />
                Obligatorios
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <TableIcon className="h-3 w-3" />
                Tabla oculta
              </Badge>
            )}
          </div>
          <div className="text-right text-xs text-muted-foreground leading-tight">
            <div className="flex items-center gap-1 justify-end">
              <CalendarClock className="h-3 w-3" />
              {fechaLegible}
            </div>
            <div className="font-mono">{horaCompleta}</div>
          </div>
        </div>

        {/* ===== FlipClock (visible solo cuando hay paro activo o detenido) =====
            *
            * SIEMPRE mostramos el FlipClock cuando hay paro en curso o
            * detenido, independientemente del valor de `mostrarTabla`. Es
            * el corazón visual del flujo: el inspector lo ve correr
            * dentro del card sin necesidad del modal fullscreen.
            */}
        {paroActivo && (
          <div
            className={cn(
              "rounded-md border px-3 py-4 flex items-center justify-center",
              enCurso
                ? "bg-gradient-to-b from-red-50 to-white border-red-200 dark:from-red-950/30 dark:to-background dark:border-red-800"
                : "bg-muted/30 border-dashed",
            )}
          >
            <ParoFlipClock
              segundos={tiempoSegundos}
              enCurso={enCurso}
            />
          </div>
        )}

        {/* ===== Tabla fija (ocultable con el prop `mostrarTabla`) ===== */}
        {mostrarTabla && (
          <>
            {/* ===== Resumen del path (read-only) =====
                Material/Comodín no aplican al flujo simple de paros
                (siempre "N.A."): se ocultan por completo en vez de
                mostrarse deshabilitados sin aportar nada. Máquina sí
                aplica: se eligió en el paso "Máquina" del wizard. */}
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-2">
              <PathSummaryItem
                icon={<IdCard className="h-3 w-3" />}
                label="Cód. empleado"
                value={codigoEmpleado}
              />
              <PathSummaryItem label="Regional" value={regional} />
              <PathSummaryItem label="Departamento" value={fila.nombre_area} />
              <PathSummaryItem label="Motivo" value={fila.nombre_tipo_motivo} />
              <PathSummaryItem label="Origen" value={fila.nombre_origen} />
              <PathSummaryItem
                label="Componente"
                value={fila.nombre_componente}
              />
              <PathSummaryItem
                label="Causa defecto"
                value={fila.nombre_causa_defecto}
              />
              <PathSummaryItem label="Máquina" value={maquina} />
            </div>

            {/* ===== Banda inferior: año/mes/día/hora + tiempo del paro ===== */}
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <PathSummaryItem label="Año" value={anio} />
              <PathSummaryItem label="Mes" value={mes} />
              <PathSummaryItem label="Día" value={dia} />
              <PathSummaryItem label="Hora" value={hora} />
              <PathSummaryItem
                label="Tiempo (HH:MM:SS)"
                value={cronometroLegible}
              />
              <PathSummaryItem
                label="Departamento (origen)"
                value={departamentoUsuario}
              />
            </div>
          </>
        )}

        {/* ===== Botones (animación del CTA "Iniciar Paro") =====
        *
        * Cuando el cronómetro está en `idle`:
        *   - Mostramos el botón "Iniciar Paro" GRANDE y CENTRADO en el
        *     card. El icono Play también es grande para reforzar la
        *     acción principal.
        *
        * Cuando arranca el paro (`running` / `stopped`):
        *   - El botón "Iniciar Paro" se OCULTA por completo (no se
        *     muestra en versión contraída): el cronómetro (FlipClock)
        *     ya ocupa el centro del card y los botones "Cancelar" +
        *     "Finalizar y registrar paro" quedan en la banda inferior.
        *     Esto evita el ruido visual de un botón deshabilitado
        *     semi-transparente encima del formulario.
        */}
        {estado === "idle" ? (
          <div className="flex items-center justify-center py-8 sm:py-10">
            <Button
              type="button"
              onClick={onIniciar}
              disabled={disabled}
              size="lg"
              className={cn(
                "gap-3 h-16 px-8 text-base font-semibold w-full max-w-sm sm:w-auto",
                "bg-green-600 hover:bg-green-700 text-white",
                "shadow-xl shadow-green-600/30 ring-1 ring-black/5",
                "transition-all hover:scale-105 active:scale-95",
              )}
            >
              <Play className="h-7 w-7 fill-current" />
              Iniciar Paro
            </Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t">
            {paroActivo && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancelar}
                disabled={disabled}
                className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-950/30"
              >
                <XCircle className="h-4 w-4" />
                Cancelar
              </Button>
            )}
            <Button
              type="button"
              onClick={onFinalizar}
              disabled={disabled}
              className={cn(
                "gap-2 shadow-sm",
                enCurso
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground",
              )}
            >
              <Save className="h-4 w-4" />
              Finalizar y registrar paro
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

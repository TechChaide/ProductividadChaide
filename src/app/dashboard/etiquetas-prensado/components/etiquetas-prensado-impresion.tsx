"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, Loader2, Printer, RefreshCw, Rows3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePrinterIPs } from "@/hooks/usePrinterIPs";
import { useUser } from "@/context/user-context";
import { cn } from "@/lib/utils";
import {
  imprimirEtiquetasPrensado,
  rangoSecuenciales,
} from "@/services/impresionPlanchaEspumaPrensado.service";
import { planchaEspumaPrensadoService } from "@/services/planchaEspumaPrensado.service";
import type { FormatoEtiquetaPrensado } from "@/services/zplPlanchaEspumaPrensado.service";
import type { OrdenPlanchaEspumaPrensado } from "@/types/interfaces";
import EtiquetaPrensadoPreview from "./etiqueta-prensado-preview";

interface EtiquetasPrensadoImpresionProps {
  orden: OrdenPlanchaEspumaPrensado | null;
  /**
   * Se invoca cuando al menos una etiqueta quedó registrada en BDD. El padre debe quitar la
   * selección y recargar las órdenes para que no se pueda reimprimir con lo que quedó en pantalla.
   */
  onImpresionFinalizada?: () => void;
}

type FormatoEtiqueta = FormatoEtiquetaPrensado;

// Cada cuánto se refresca el secuencial del preview mientras hay una orden seleccionada.
const INTERVALO_REFRESCO_SECUENCIAL_MS = 15000;

function formatearFechaOrden(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return String(fechaISO);
  const dia = String(fecha.getUTCDate()).padStart(2, "0");
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${fecha.getUTCFullYear()}`;
}

export default function EtiquetasPrensadoImpresion({
  orden,
  onImpresionFinalizada,
}: EtiquetasPrensadoImpresionProps) {
  const { toast } = useToast();
  const { printerIPs } = usePrinterIPs();
  const { user } = useUser();

  const [formatoPreview, setFormatoPreview] = useState<FormatoEtiqueta>("normal");
  const [confirmando, setConfirmando] = useState<FormatoEtiqueta | null>(null);
  const [imprimiendo, setImprimiendo] = useState<FormatoEtiqueta | null>(null);

  // Próximo secuencial (último registrado + 1) solo para el preview. Es referencial: al
  // imprimir se vuelve a consultar justo antes de cada etiqueta, porque otra estación pudo
  // haber impreso en el intervalo.
  const [secuencialPreview, setSecuencialPreview] = useState<number | null>(null);
  const [cargandoSecuencial, setCargandoSecuencial] = useState(false);
  const [errorSecuencial, setErrorSecuencial] = useState<string | null>(null);
  // Descarta respuestas viejas si se disparan varias consultas seguidas.
  const consultaSecuencialId = useRef(0);

  const cantidad = orden ? Number(orden.CantProgramada) || 0 : 0;

  const refrescarSecuencialPreview = useCallback(async () => {
    const id = ++consultaSecuencialId.current;
    setCargandoSecuencial(true);
    try {
      const ultimo = await planchaEspumaPrensadoService.buscarSecuencialPrensado();
      if (id !== consultaSecuencialId.current) return;
      setSecuencialPreview(ultimo + 1);
      setErrorSecuencial(null);
    } catch (err) {
      if (id !== consultaSecuencialId.current) return;
      console.error("[ETIQUETAS-PRENSADO] Error al consultar secuencial:", err);
      setErrorSecuencial(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      if (id === consultaSecuencialId.current) setCargandoSecuencial(false);
    }
  }, []);

  // Consulta al seleccionar una orden y luego cada INTERVALO mientras no se esté imprimiendo.
  const ordenId = orden?.Orden;
  useEffect(() => {
    if (ordenId == null || imprimiendo) return;
    refrescarSecuencialPreview();
    const timer = setInterval(refrescarSecuencialPreview, INTERVALO_REFRESCO_SECUENCIAL_MS);
    return () => clearInterval(timer);
  }, [ordenId, imprimiendo, refrescarSecuencialPreview]);

  const ejecutarImpresion = async (formato: FormatoEtiqueta) => {
    if (!orden) return;
    if (cantidad <= 0) {
      toast({
        title: "Cantidad inválida",
        description: "La orden no tiene una cantidad programada válida para imprimir.",
        variant: "destructive",
      });
      return;
    }

    setImprimiendo(formato);
    // Invalida cualquier consulta del preview en curso para que no pise el estado al terminar.
    consultaSecuencialId.current++;

    let registradas = 0;
    try {
      // Etiquetas 1..N de la orden; cada una toma su secuencial justo al imprimirse.
      const resultado = await imprimirEtiquetasPrensado({
        orden,
        formato,
        netiquetas: Array.from({ length: cantidad }, (_, i) => i + 1),
        operador: user?.code || "",
        printerIP: printerIPs && printerIPs.length > 0 ? printerIPs[0] : undefined,
      });
      registradas = resultado.registradas;

      if (resultado.error) {
        toast({
          title: resultado.error.titulo,
          description: resultado.error.descripcion,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Impresión completada",
        description: `${resultado.impresas} de ${cantidad} etiquetas (${
          formato === "normal" ? "formato normal" : "formato pequeño"
        }) impresas correctamente. Secuenciales: ${rangoSecuenciales(resultado.secuenciales)}.`,
        className: "bg-green-100 dark:bg-green-900 border-green-500",
      });
    } finally {
      // El secuencial en pantalla ya fue consumido: se descarta para que no quede visible un
      // número usado. Al pasar imprimiendo a null, el useEffect del preview vuelve a consultar
      // de inmediato y los botones de imprimir quedan bloqueados hasta tener el nuevo valor.
      setSecuencialPreview(null);
      setCargandoSecuencial(true);
      setImprimiendo(null);
      if (registradas > 0) onImpresionFinalizada?.();
    }
  };

  const abrirConfirmacion = (formato: FormatoEtiqueta) => {
    if (!orden) return;
    setFormatoPreview(formato);
    setConfirmando(formato);
    // Refresca el número mostrado; el definitivo se vuelve a consultar al imprimir.
    refrescarSecuencialPreview();
  };

  const confirmarImpresion = async () => {
    const formato = confirmando;
    setConfirmando(null);
    if (formato) await ejecutarImpresion(formato);
  };

  return (
    <Card className="shadow-lg w-full">
      <CardHeader className="py-3">
        <CardTitle className="text-base font-bold text-primary flex items-center">
          <Printer className="mr-2 h-4 w-4" /> Impresión de Etiqueta
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {!orden ? (
          <div className="flex items-center justify-center h-[150px] text-muted-foreground text-sm">
            Seleccione una orden en la tabla para ver sus datos e imprimir la etiqueta.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* IZQUIERDA: datos solo lectura */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-row flex-wrap gap-x-8 gap-y-2">
                <div className="flex flex-col min-w-[100px]">
                  <span className="font-medium text-muted-foreground text-xs">Orden</span>
                  <span className="text-base">{orden.Orden || "-"}</span>
                </div>
                <div className="flex flex-col min-w-[120px]">
                  <span className="font-medium text-muted-foreground text-xs">Material</span>
                  <span className="font-mono text-blue-700 text-base">{orden.Material || "-"}</span>
                </div>
                <div className="flex flex-col min-w-[100px]">
                  <span className="font-medium text-muted-foreground text-xs">Fecha</span>
                  <span className="text-base">{formatearFechaOrden(String(orden.Fecha))}</span>
                </div>
              </div>
              <div className="flex flex-col min-w-[220px]">
                <span className="font-medium text-muted-foreground text-xs">Producto</span>
                <span className="whitespace-pre-line text-base">{orden.Nombre || "-"}</span>
              </div>
              <div className="flex flex-col min-w-[100px]">
                <span className="font-medium text-muted-foreground text-xs">Cantidad a imprimir</span>
                <span
                  className={cn(
                    "font-mono text-lg font-semibold",
                    cantidad > 0 ? "text-blue-700" : "text-red-600"
                  )}
                >
                  {cantidad}
                </span>
              </div>
              {cantidad <= 0 && (
                <p className="text-xs text-red-600">
                  Esta orden no tiene una cantidad programada válida; no se puede imprimir.
                </p>
              )}

              <div className="flex gap-2 mt-2">
                <Button
                  onClick={() => abrirConfirmacion("normal")}
                  disabled={!!imprimiendo || cantidad <= 0 || secuencialPreview === null}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  {imprimiendo === "normal" ? "Imprimiendo..." : "Imprimir"}
                </Button>
                <Button
                  onClick={() => abrirConfirmacion("pequena")}
                  disabled={!!imprimiendo || cantidad <= 0 || secuencialPreview === null}
                  variant="outline"
                  className="gap-2"
                >
                  <Rows3 className="h-4 w-4" />
                  {imprimiendo === "pequena" ? "Imprimiendo..." : "Impresión Pequeña"}
                </Button>
              </div>
            </div>

            {/* DERECHA: previsualización gráfica */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-muted-foreground text-xs flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> Previsualización (etiqueta 1 de {cantidad || 0})
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setFormatoPreview("normal")}
                    className={cn(
                      "text-xs px-2 py-1 rounded border",
                      formatoPreview === "normal"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-transparent hover:bg-muted"
                    )}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormatoPreview("pequena")}
                    className={cn(
                      "text-xs px-2 py-1 rounded border",
                      formatoPreview === "pequena"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-transparent hover:bg-muted"
                    )}
                  >
                    Pequeña
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Próximo secuencial:{" "}
                  <span className="font-mono font-semibold text-foreground">{secuencialPreview ?? "-"}</span>
                </span>
                <button
                  type="button"
                  onClick={refrescarSecuencialPreview}
                  disabled={cargandoSecuencial || !!imprimiendo}
                  className="p-1 rounded hover:bg-muted disabled:opacity-50"
                  title="Actualizar secuencial"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", cargandoSecuencial && "animate-spin")} />
                </button>
              </div>
              {errorSecuencial && (
                <p className="text-xs text-red-600">No se pudo consultar el secuencial: {errorSecuencial}</p>
              )}
              <div className="max-w-[360px]">
                {secuencialPreview !== null ? (
                  <EtiquetaPrensadoPreview orden={orden} formato={formatoPreview} secuencial={secuencialPreview} />
                ) : (
                  <div className="flex items-center justify-center aspect-[832/640] border rounded-md text-xs text-muted-foreground gap-2">
                    {cargandoSecuencial ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Consultando secuencial...
                      </>
                    ) : (
                      "Secuencial no disponible"
                    )}
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                El secuencial definitivo se confirma al momento de imprimir cada etiqueta.
              </p>
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmando !== null} onOpenChange={(open) => !open && setConfirmando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <Printer className="mr-2 h-5 w-5" />
              Confirmar impresión ({confirmando === "normal" ? "formato normal" : "formato pequeño"})
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se {cantidad === 1 ? "imprimirá 1 etiqueta" : `imprimirán ${cantidad} etiquetas`} para la orden{" "}
              <span className="font-mono font-semibold">{orden?.Orden}</span> (cantidad programada)
              {secuencialPreview !== null && (
                <>
                  , a partir del secuencial{" "}
                  <span className="font-mono font-semibold">{secuencialPreview}</span> (se confirma al imprimir)
                </>
              )}
              . ¿Desea continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarImpresion}>Imprimir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

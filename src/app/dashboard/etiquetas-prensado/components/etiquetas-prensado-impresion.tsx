"use client";

import { useState } from "react";
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
import { FileText, Printer, Rows3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePrinterIPs } from "@/hooks/usePrinterIPs";
import { cn } from "@/lib/utils";
import {
  generarZPLNormal,
  generarZPLPequena,
  ZPL_LIMPIAR_LOGO,
  type EtiquetaGenerada,
} from "@/services/zplPlanchaEspumaPrensado.service";
import { planchaEspumaPrensadoService } from "@/services/planchaEspumaPrensado.service";
import type { OrdenPlanchaEspumaPrensado } from "@/types/interfaces";
import EtiquetaPrensadoPreview from "./etiqueta-prensado-preview";

interface EtiquetasPrensadoImpresionProps {
  orden: OrdenPlanchaEspumaPrensado | null;
}

type FormatoEtiqueta = "normal" | "pequena";

function formatearFechaOrden(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return String(fechaISO);
  const dia = String(fecha.getUTCDate()).padStart(2, "0");
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${fecha.getUTCFullYear()}`;
}

async function enviarZPLBrowserPrint(zpl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const bp = (window as any).BrowserPrint || window.Zebra?.BrowserPrint;
    if (!bp) {
      reject(new Error("BrowserPrint no detectado. Verifica que el servicio esté instalado y en ejecución."));
      return;
    }
    bp.getDefaultDevice(
      "printer",
      (printer: any, err: any) => {
        if (err || !printer) {
          reject(new Error("No se pudo obtener la impresora por defecto."));
          return;
        }
        printer.send(
          zpl,
          () => resolve(),
          (sendErr: any) =>
            reject(new Error("Error al enviar a la impresora: " + (sendErr?.message || sendErr)))
        );
      },
      () => reject(new Error("Error al resolver la impresora."))
    );
  });
}

async function enviarZPLRed(zpl: string, printerIP: string): Promise<void> {
  const response = await fetch("/api/zebra-network", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zpl, printerIP }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || "Error al imprimir en la impresora de red.");
  }
}

export default function EtiquetasPrensadoImpresion({ orden }: EtiquetasPrensadoImpresionProps) {
  const { toast } = useToast();
  const { printerIPs } = usePrinterIPs();

  const [formatoPreview, setFormatoPreview] = useState<FormatoEtiqueta>("normal");
  const [confirmando, setConfirmando] = useState<FormatoEtiqueta | null>(null);
  const [imprimiendo, setImprimiendo] = useState<FormatoEtiqueta | null>(null);

  const cantidad = orden ? Number(orden.CantProgramada) || 0 : 0;

  const guardarLogEtiqueta = async (etiqueta: EtiquetaGenerada, ordenActual: OrdenPlanchaEspumaPrensado) => {
    try {
      await planchaEspumaPrensadoService.guardarLogPrensado({
        codbarras: etiqueta.codigo,
        secuencial: etiqueta.secuencial,
        orden: String(ordenActual.Orden ?? ""),
        producto: String(ordenActual.Nombre ?? ""),
        netiqueta: etiqueta.numEtiqueta,
        Codpedido: String(ordenActual.Pedido ?? "").trim(),
        TipoColaborador: "O",
      });
    } catch (logErr) {
      console.error("[ETIQUETAS-PRENSADO] Error al guardar log de impresión:", logErr);
      toast({
        title: "Etiqueta impresa, log no guardado",
        description: `Etiqueta ${etiqueta.numEtiqueta}: la impresión fue exitosa pero no se pudo registrar el log.`,
        variant: "destructive",
        duration: 4000,
      });
    }
  };

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
    const etiquetas =
      formato === "normal" ? generarZPLNormal(orden, cantidad) : generarZPLPequena(orden, cantidad);
    const printerIP = printerIPs && printerIPs.length > 0 ? printerIPs[0] : undefined;

    let exitosas = 0;
    try {
      for (const etiqueta of etiquetas) {
        try {
          if (printerIP) {
            await enviarZPLRed(etiqueta.zpl, printerIP);
          } else {
            await enviarZPLBrowserPrint(etiqueta.zpl);
          }
          exitosas++;
          await guardarLogEtiqueta(etiqueta, orden);
          // Pequeño delay entre etiquetas, mismo patrón usado en otros módulos de impresión.
          await new Promise((r) => setTimeout(r, 300));
        } catch (printErr) {
          const message = printErr instanceof Error ? printErr.message : "Error desconocido";
          toast({
            title: `Error al imprimir la etiqueta ${etiqueta.numEtiqueta}`,
            description: `${message} Se detuvo la impresión (${exitosas} de ${etiquetas.length} completadas).`,
            variant: "destructive",
          });
          return;
        }
      }

      // Limpiar el logo descargado en la impresora (solo aplica al formato normal, que lo usa).
      if (formato === "normal") {
        try {
          if (printerIP) {
            await enviarZPLRed(ZPL_LIMPIAR_LOGO, printerIP);
          } else {
            await enviarZPLBrowserPrint(ZPL_LIMPIAR_LOGO);
          }
        } catch (cleanupErr) {
          console.warn("[ETIQUETAS-PRENSADO] No se pudo limpiar el logo de la impresora:", cleanupErr);
        }
      }

      toast({
        title: "Impresión completada",
        description: `${exitosas} de ${etiquetas.length} etiquetas (${
          formato === "normal" ? "formato normal" : "formato pequeño"
        }) impresas correctamente.`,
        className: "bg-green-100 dark:bg-green-900 border-green-500",
      });
    } finally {
      setImprimiendo(null);
    }
  };

  const abrirConfirmacion = (formato: FormatoEtiqueta) => {
    if (!orden) return;
    setFormatoPreview(formato);
    setConfirmando(formato);
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
                  disabled={!!imprimiendo || cantidad <= 0}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  {imprimiendo === "normal" ? "Imprimiendo..." : "Imprimir"}
                </Button>
                <Button
                  onClick={() => abrirConfirmacion("pequena")}
                  disabled={!!imprimiendo || cantidad <= 0}
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
              <div className="max-w-[360px]">
                <EtiquetaPrensadoPreview orden={orden} formato={formatoPreview} />
              </div>
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
              <span className="font-mono font-semibold">{orden?.Orden}</span> (cantidad programada). ¿Desea
              continuar?
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

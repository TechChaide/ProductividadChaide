"use client";

import { useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Printer, RotateCcw, Rows3, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePrinterIPs } from "@/hooks/usePrinterIPs";
import { useUser } from "@/context/user-context";
import { cn } from "@/lib/utils";
import { planchaEspumaPrensadoService } from "@/services/planchaEspumaPrensado.service";
import {
  imprimirEtiquetasPrensado,
  rangoSecuenciales,
  type ResultadoImpresionPrensado,
} from "@/services/impresionPlanchaEspumaPrensado.service";
import {
  ordenDesdeEtiquetaImpresa,
  type FormatoEtiquetaPrensado,
} from "@/services/zplPlanchaEspumaPrensado.service";
import type { EtiquetaImpresaPrensado, OrdenPlanchaEspumaPrensado } from "@/types/interfaces";

interface ReimprimirEtiquetaPrensadoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Una etiqueta puntual (su número dentro de la orden) o todas las activas de la orden. */
type Seleccion = number | "todas" | null;

/** Etiquetas ya anuladas cuya reimpresión no llegó a completarse. */
interface ReimpresionPendiente {
  orden: OrdenPlanchaEspumaPrensado;
  formato: FormatoEtiquetaPrensado;
  netiquetas: number[];
}

const COLUMNAS: { key: keyof EtiquetaImpresaPrensado; label: string }[] = [
  { key: "netiqueta", label: "N° Etiqueta" },
  { key: "secuencial", label: "Secuencial" },
  { key: "codbarras", label: "Código" },
  { key: "producto", label: "Producto" },
  { key: "CodPedido", label: "Cod. Pedido" },
  { key: "operador", label: "Operador" },
  { key: "fecha", label: "Fecha impresión" },
];

// La fecha del log llega como "2026-09-23T04:40:40.163Z". Se muestra en UTC, igual que el
// resto de fechas del módulo, asumiendo que el backend serializa la hora local de la BDD con "Z".
function formatFechaHora(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

// netiqueta = 0 es una etiqueta anulada (ya reimpresa): no se puede volver a seleccionar.
function esActiva(row: EtiquetaImpresaPrensado): boolean {
  return Number(row.netiqueta) > 0;
}

// El log puede traer varias filas por etiqueta (una por operador de la sesión): se agrupan
// por número de etiqueta, que es lo que anula el SP.
function netiquetasActivas(filas: EtiquetaImpresaPrensado[]): number[] {
  return Array.from(new Set(filas.filter(esActiva).map((r) => Number(r.netiqueta)))).sort((a, b) => a - b);
}

function describirEtiquetas(netiquetas: number[]): string {
  return netiquetas.length === 1 ? `la etiqueta ${netiquetas[0]}` : `las etiquetas ${netiquetas.join(", ")}`;
}

export default function ReimprimirEtiquetaPrensadoDialog({
  open,
  onOpenChange,
}: ReimprimirEtiquetaPrensadoDialogProps) {
  const { toast } = useToast();
  const { printerIPs } = usePrinterIPs();
  const { user } = useUser();

  const [orden, setOrden] = useState("");
  const [etiquetas, setEtiquetas] = useState<EtiquetaImpresaPrensado[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Orden efectivamente consultada: distingue "aún no se buscó" de "no hubo resultados".
  const [ordenConsultada, setOrdenConsultada] = useState<string | null>(null);

  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [confirmando, setConfirmando] = useState<FormatoEtiquetaPrensado | null>(null);
  const [procesando, setProcesando] = useState(false);
  // Se conserva aunque se cierre la ventana: son etiquetas anuladas sin reemplazo impreso.
  const [pendiente, setPendiente] = useState<ReimpresionPendiente | null>(null);

  const ultimaPeticionId = useRef(0);

  const activas = useMemo(() => netiquetasActivas(etiquetas), [etiquetas]);
  const todasSeleccionadas = seleccion === "todas";
  const netiquetasSeleccionadas: number[] =
    seleccion === "todas" ? activas : seleccion !== null ? [seleccion] : [];

  const consultar = async (ordenBuscar: string) => {
    const peticionId = ++ultimaPeticionId.current;
    setIsLoading(true);
    setError(null);
    setSeleccion(null);
    try {
      const res = await planchaEspumaPrensadoService.buscarEtiquetasXOrdenPrensado(ordenBuscar);
      if (peticionId !== ultimaPeticionId.current) return;
      setEtiquetas(res.data || []);
      setOrdenConsultada(ordenBuscar);
    } catch (err) {
      if (peticionId !== ultimaPeticionId.current) return;
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      setEtiquetas([]);
      setOrdenConsultada(ordenBuscar);
    } finally {
      if (peticionId === ultimaPeticionId.current) setIsLoading(false);
    }
  };

  const buscar = () => {
    const ordenLimpia = orden.trim();
    if (ordenLimpia) consultar(ordenLimpia);
  };

  const printerIP = printerIPs && printerIPs.length > 0 ? printerIPs[0] : undefined;

  // Imprime las etiquetas ya anuladas y deja registrado lo que no se alcanzó a imprimir.
  const imprimirAnuladas = async (
    ordenData: OrdenPlanchaEspumaPrensado,
    formato: FormatoEtiquetaPrensado,
    netiquetas: number[]
  ): Promise<ResultadoImpresionPrensado> => {
    const resultado = await imprimirEtiquetasPrensado({
      orden: ordenData,
      formato,
      netiquetas,
      operador: user?.code || "",
      printerIP,
    });

    setPendiente(
      resultado.pendientes.length > 0 ? { orden: ordenData, formato, netiquetas: resultado.pendientes } : null
    );

    if (resultado.error) {
      toast({
        title: resultado.error.titulo,
        description:
          resultado.error.descripcion +
          (resultado.pendientes.length > 0
            ? ` ${describirEtiquetas(resultado.pendientes)} ya quedaron anuladas: use "Reintentar" para imprimirlas.`
            : ""),
        variant: "destructive",
      });
    } else {
      toast({
        title: "Reimpresión completada",
        description: `${resultado.impresas} ${
          resultado.impresas === 1 ? "etiqueta reimpresa" : "etiquetas reimpresas"
        } (${formato === "normal" ? "formato normal" : "formato pequeño"}). Secuenciales: ${rangoSecuenciales(
          resultado.secuenciales
        )}.`,
        className: "bg-green-100 dark:bg-green-900 border-green-500",
      });
    }
    return resultado;
  };

  const ejecutarReimpresion = async (formato: FormatoEtiquetaPrensado) => {
    if (!ordenConsultada || seleccion === null) return;
    const codUsuario = user?.code || "";
    if (!codUsuario) {
      toast({
        title: "Usuario no identificado",
        description: "No se pudo obtener el código de usuario para registrar la reimpresión.",
        variant: "destructive",
      });
      return;
    }

    setProcesando(true);
    try {
      // 1) Releer las etiquetas justo antes de anular: la lista en pantalla puede estar
      //    desactualizada (otra estación pudo imprimir o reimprimir entretanto).
      let frescas: EtiquetaImpresaPrensado[];
      try {
        frescas = (await planchaEspumaPrensadoService.buscarEtiquetasXOrdenPrensado(ordenConsultada)).data || [];
      } catch (err) {
        toast({
          title: "Error al validar las etiquetas",
          description: `${err instanceof Error ? err.message : "Error desconocido"} No se anuló ni imprimió nada.`,
          variant: "destructive",
        });
        return;
      }

      const activasFrescas = netiquetasActivas(frescas);
      const aReimprimir = seleccion === "todas" ? activasFrescas : [seleccion];
      if (aReimprimir.length === 0 || !aReimprimir.every((n) => activasFrescas.includes(n))) {
        toast({
          title: "La selección ya no es válida",
          description: "La etiqueta ya fue anulada o reimpresa. Se actualizó la lista; vuelva a seleccionar.",
          variant: "destructive",
        });
        return;
      }

      // 2) Rearmar los datos de la orden ANTES de anular: si el código no se puede
      //    interpretar, se aborta sin dejar etiquetas anuladas y sin reemplazo.
      let ordenData: OrdenPlanchaEspumaPrensado;
      try {
        const base = frescas.find((r) => esActiva(r) && aReimprimir.includes(Number(r.netiqueta)))!;
        ordenData = ordenDesdeEtiquetaImpresa(base);
      } catch (err) {
        toast({
          title: "No se pudo preparar la reimpresión",
          description: `${err instanceof Error ? err.message : "Error desconocido"} No se anuló ni imprimió nada.`,
          variant: "destructive",
        });
        return;
      }

      // 3) Anular (y registrar el log de reimpresión). Si falla, no se imprime nada.
      try {
        await planchaEspumaPrensadoService.cambiarEstadoEtiquetasPrensado({
          orden: ordenConsultada,
          netiqueta: seleccion === "todas" ? -1 : seleccion,
          codUsuario,
        });
      } catch (err) {
        toast({
          title: "Error al anular la etiqueta",
          description: `${err instanceof Error ? err.message : "Error desconocido"} No se imprimió nada.`,
          variant: "destructive",
        });
        return;
      }

      // 4) Imprimir las nuevas: mismo número de etiqueta, secuencial nuevo.
      await imprimirAnuladas(ordenData, formato, aReimprimir);
    } finally {
      setProcesando(false);
      // Siempre se recarga: deja la tabla con el estado real y sin selección.
      consultar(ordenConsultada);
    }
  };

  const reintentarPendiente = async () => {
    if (!pendiente) return;
    setProcesando(true);
    try {
      await imprimirAnuladas(pendiente.orden, pendiente.formato, pendiente.netiquetas);
    } finally {
      setProcesando(false);
      if (ordenConsultada) consultar(ordenConsultada);
    }
  };

  const confirmarReimpresion = async () => {
    const formato = confirmando;
    setConfirmando(null);
    if (formato) await ejecutarReimpresion(formato);
  };

  // Cada apertura empieza limpia para no mostrar resultados de otra orden. No se puede
  // cerrar mientras se anula/imprime.
  const handleOpenChange = (nextOpen: boolean) => {
    if (procesando) return;
    if (!nextOpen) {
      ultimaPeticionId.current++;
      setOrden("");
      setEtiquetas([]);
      setError(null);
      setOrdenConsultada(null);
      setSeleccion(null);
      setIsLoading(false);
    }
    onOpenChange(nextOpen);
  };

  const toggleFila = (row: EtiquetaImpresaPrensado) => {
    if (!esActiva(row) || procesando) return;
    const n = Number(row.netiqueta);
    setSeleccion((prev) => (prev === n ? null : n));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <RotateCcw className="mr-2 h-5 w-5" /> Reimprimir Etiqueta
          </DialogTitle>
          <DialogDescription>
            Ingrese la orden, seleccione una etiqueta (o todas) y reimprímala. La etiqueta actual se anula y se
            imprime una nueva con el mismo número de etiqueta y un secuencial nuevo.
          </DialogDescription>
        </DialogHeader>

        {pendiente && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500 bg-amber-50 dark:bg-amber-950 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="flex-1">
              Orden <span className="font-mono font-semibold">{pendiente.orden.Orden}</span>:{" "}
              {describirEtiquetas(pendiente.netiquetas)} {pendiente.netiquetas.length === 1 ? "quedó" : "quedaron"}{" "}
              anulada{pendiente.netiquetas.length === 1 ? "" : "s"} pero no se{" "}
              {pendiente.netiquetas.length === 1 ? "reimprimió" : "reimprimieron"}.
            </span>
            <Button size="sm" onClick={reintentarPendiente} disabled={procesando} className="gap-2">
              <Printer className="h-4 w-4" /> Reintentar
            </Button>
          </div>
        )}

        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            buscar();
          }}
        >
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Orden</span>
            <Input
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
              placeholder="Ej: 62808871"
              className="w-[220px]"
              disabled={procesando}
              autoFocus
            />
          </div>
          <Button type="submit" disabled={isLoading || procesando || !orden.trim()} className="gap-2">
            <Search className="h-4 w-4" />
            {isLoading ? "Buscando..." : "Buscar"}
          </Button>
        </form>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-[120px] p-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : ordenConsultada === null ? null : etiquetas.length === 0 ? (
          <div className="flex justify-center items-center h-[120px] p-4">
            <p className="text-muted-foreground text-sm">
              No se encontraron etiquetas impresas para la orden{" "}
              <span className="font-mono font-semibold">{ordenConsultada}</span>.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="border rounded-md">
              <ScrollArea className="h-[45vh]">
                <Table className="text-xs [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-card">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[32px] h-8 px-2 py-1">
                        <Checkbox
                          checked={todasSeleccionadas}
                          onCheckedChange={(checked) => setSeleccion(checked ? "todas" : null)}
                          disabled={activas.length === 0 || procesando}
                          aria-label="Seleccionar todas las etiquetas"
                        />
                      </TableHead>
                      {COLUMNAS.map((col) => (
                        <TableHead key={col.key} className="h-8 px-2 py-1 whitespace-nowrap">
                          {col.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {etiquetas.map((row, index) => {
                      const activa = esActiva(row);
                      const seleccionada = activa && netiquetasSeleccionadas.includes(Number(row.netiqueta));
                      return (
                        <TableRow
                          key={`${row.codbarras}-${row.operador}-${index}`}
                          onClick={() => toggleFila(row)}
                          className={cn(
                            activa ? "cursor-pointer" : "opacity-50",
                            seleccionada ? "bg-secondary" : activa && "hover:bg-muted/50"
                          )}
                        >
                          <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={seleccionada}
                              onCheckedChange={() => toggleFila(row)}
                              disabled={!activa || procesando}
                              aria-label={`Seleccionar etiqueta ${row.netiqueta}`}
                            />
                          </TableCell>
                          {COLUMNAS.map((col) => (
                            <TableCell key={col.key} className="px-2 py-1 whitespace-nowrap">
                              {col.key === "fecha"
                                ? formatFechaHora(String(row.fecha ?? ""))
                                : col.key === "netiqueta" && !activa
                                  ? "Anulada"
                                  : String(row[col.key] ?? "").trim()}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {etiquetas.length} {etiquetas.length === 1 ? "registro" : "registros"} de la orden{" "}
                <span className="font-mono">{ordenConsultada}</span> · {activas.length}{" "}
                {activas.length === 1 ? "etiqueta activa" : "etiquetas activas"}
                {netiquetasSeleccionadas.length > 0 && (
                  <>
                    {" "}
                    · Seleccionada{netiquetasSeleccionadas.length === 1 ? "" : "s"}:{" "}
                    {todasSeleccionadas ? "todas" : netiquetasSeleccionadas.join(", ")}
                  </>
                )}
              </span>
              <div className="flex gap-2">
                <Button
                  onClick={() => setConfirmando("normal")}
                  disabled={seleccion === null || procesando}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  {procesando ? "Procesando..." : "Reimprimir"}
                </Button>
                <Button
                  onClick={() => setConfirmando("pequena")}
                  disabled={seleccion === null || procesando}
                  variant="outline"
                  className="gap-2"
                >
                  <Rows3 className="h-4 w-4" />
                  Reimpresión Pequeña
                </Button>
              </div>
            </div>
          </div>
        )}

        <AlertDialog open={confirmando !== null} onOpenChange={(o) => !o && setConfirmando(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center">
                <RotateCcw className="mr-2 h-5 w-5" />
                Confirmar reimpresión ({confirmando === "normal" ? "formato normal" : "formato pequeño"})
              </AlertDialogTitle>
              <AlertDialogDescription>
                {todasSeleccionadas
                  ? `Se anularán TODAS las etiquetas activas (${activas.length})`
                  : `Se anulará la etiqueta ${seleccion}`}{" "}
                de la orden <span className="font-mono font-semibold">{ordenConsultada}</span> y se{" "}
                {netiquetasSeleccionadas.length === 1 ? "imprimirá una nueva" : "imprimirán nuevas"} con secuencial
                nuevo. Esta acción no se puede deshacer. ¿Desea continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmarReimpresion}>Reimprimir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

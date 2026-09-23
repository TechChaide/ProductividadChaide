"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Layers, RotateCcw, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/user-context";
import { cn } from "@/lib/utils";
import { planchaEspumaPrensadoService } from "@/services/planchaEspumaPrensado.service";
import type { OrdenPlanchaEspumaPrensado } from "@/types/interfaces";
import EtiquetasPrensadoImpresion from "./etiquetas-prensado-impresion";
import ReimprimirEtiquetaPrensadoDialog from "./reimprimir-etiqueta-prensado-dialog";

const COLUMNAS: { key: keyof OrdenPlanchaEspumaPrensado; label: string }[] = [
  { key: "Orden", label: "Orden" },
  { key: "Material", label: "Material" },
  { key: "Nombre", label: "Nombre" },
  { key: "Fecha", label: "Fecha" },
  { key: "RespCtrlProd", label: "Resp. Ctrl. Prod." },
  { key: "CantProgramada", label: "Cant. Programada" },
  { key: "CantNotificada", label: "Cant. Notificada" },
  { key: "Pedido", label: "Pedido" },
];

const PAGE_SIZE_OPTIONS = [15, 25, 50, 100];

function getOrdenValue(row: OrdenPlanchaEspumaPrensado | null): string {
  if (!row) return "";
  return String(row.Orden ?? "");
}

function formatFechaISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Fecha actual en Ecuador (UTC-5), independiente de la zona horaria del navegador.
// Devuelve un Date local cuyo año/mes/día coinciden con el día en curso en Ecuador.
function getHoyEcuador(): Date {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(partes.find((p) => p.type === type)?.value);
  return new Date(get("year"), get("month") - 1, get("day"));
}

function formatFechaVisible(date: Date | undefined): string {
  if (!date) return "Seleccionar fecha";
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

// El API entrega la fecha como medianoche UTC ("2026-09-17T00:00:00.000Z"), por lo que debe
// formatearse en UTC: en zonas horarias negativas (Ecuador, UTC-5) la hora local cae un día antes.
function formatFechaCelda(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default function EtiquetasPrensadoContent() {
  const { toast } = useToast();
  const { user, isLoading: isUserContextLoading } = useUser();

  const [fechaInicio, setFechaInicio] = useState<Date>(getHoyEcuador);
  const [fechaFin, setFechaFin] = useState<Date>(getHoyEcuador);
  const [popoverDesdeOpen, setPopoverDesdeOpen] = useState(false);
  const [popoverHastaOpen, setPopoverHastaOpen] = useState(false);

  const [ordenes, setOrdenes] = useState<OrdenPlanchaEspumaPrensado[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrden, setSelectedOrden] = useState<OrdenPlanchaEspumaPrensado | null>(null);
  const [reimprimirOpen, setReimprimirOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE_OPTIONS[0]);

  const ultimaPeticionId = useRef(0);

  const totalRows = ordenes.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedOrdenes = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return ordenes.slice(start, start + rowsPerPage);
  }, [ordenes, page, rowsPerPage]);

  const buscarOrdenes = useCallback(async () => {
    const peticionId = ++ultimaPeticionId.current;

    if (!user?.Centro) {
      setError("No se pudo obtener el centro del usuario.");
      setOrdenes([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await planchaEspumaPrensadoService.buscarOrdenesPlanchasEspumaPrensado(
        formatFechaISO(fechaInicio),
        formatFechaISO(fechaFin),
        user.Centro.toString()
      );
      // Ignorar respuestas de búsquedas anteriores que llegan tarde (evita pisar el resultado más reciente)
      if (peticionId !== ultimaPeticionId.current) return;
      setOrdenes(res.data || []);
      setPage(1);
      setSelectedOrden(null);
    } catch (err) {
      if (peticionId !== ultimaPeticionId.current) return;
      const message = err instanceof Error ? err.message : "Ocurrió un error inesperado.";
      setError(message);
      setOrdenes([]);
      toast({
        title: "Error al buscar órdenes",
        description: message,
        variant: "destructive",
      });
    } finally {
      if (peticionId === ultimaPeticionId.current) setIsLoading(false);
    }
  }, [fechaInicio, fechaFin, user?.Centro, toast]);

  // Tras imprimir se quita la selección de inmediato (aunque la recarga falle) para no dejar
  // la misma orden lista para una reimpresión accidental, y se recarga la lista.
  const alFinalizarImpresion = useCallback(() => {
    setSelectedOrden(null);
    buscarOrdenes();
  }, [buscarOrdenes]);

  useEffect(() => {
    if (isUserContextLoading) return;
    buscarOrdenes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserContextLoading]);

  return (
    <div className="flex flex-col gap-4">
    <Card className="shadow-lg w-full">
      <CardHeader className="py-3">
        <CardTitle className="text-base font-bold text-primary flex items-center">
          <Layers className="mr-2 h-4 w-4" /> Etiquetas Prensado
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Desde</span>
            <Popover open={popoverDesdeOpen} onOpenChange={setPopoverDesdeOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[180px] justify-start gap-2 font-normal">
                  <CalendarIcon className="h-4 w-4" />
                  {formatFechaVisible(fechaInicio)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fechaInicio}
                  onSelect={(date) => {
                    if (date) {
                      setFechaInicio(date);
                      setPopoverDesdeOpen(false);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Hasta</span>
            <Popover open={popoverHastaOpen} onOpenChange={setPopoverHastaOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[180px] justify-start gap-2 font-normal">
                  <CalendarIcon className="h-4 w-4" />
                  {formatFechaVisible(fechaFin)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fechaFin}
                  onSelect={(date) => {
                    if (date) {
                      setFechaFin(date);
                      setPopoverHastaOpen(false);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button onClick={buscarOrdenes} disabled={isLoading} className="gap-2">
            <Search className="h-4 w-4" />
            {isLoading ? "Buscando..." : "Buscar"}
          </Button>
          <Button variant="outline" onClick={() => setReimprimirOpen(true)} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reimprimir Etiqueta
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-2">
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-[150px] p-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : ordenes.length === 0 ? (
          <div className="flex justify-center items-center h-[150px] p-4">
            <p className="text-muted-foreground text-sm">
              No se encontraron órdenes en el rango de fechas seleccionado.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="border rounded-md">
              <ScrollArea className="h-[45vh]">
                <RadioGroup
                  value={getOrdenValue(selectedOrden)}
                  onValueChange={(value) => {
                    const row = ordenes.find((o) => getOrdenValue(o) === value);
                    if (row) setSelectedOrden(row);
                  }}
                  aria-label="Lista de órdenes"
                >
                  <Table className="text-xs [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-card">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[32px] h-8 px-2 py-1"></TableHead>
                        {COLUMNAS.map((col) => (
                          <TableHead key={col.key} className="h-8 px-2 py-1 whitespace-nowrap">
                            {col.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedOrdenes.map((row, index) => {
                        const ordenValue = getOrdenValue(row);
                        const isSelected = getOrdenValue(selectedOrden) === ordenValue;
                        return (
                          <TableRow
                            key={`${ordenValue}-${index}`}
                            onClick={() => setSelectedOrden(row)}
                            className={cn(
                              "cursor-pointer",
                              isSelected ? "bg-secondary" : "hover:bg-muted/50"
                            )}
                          >
                            <TableCell className="px-2 py-1">
                              <RadioGroupItem
                                value={ordenValue}
                                id={`sel-${ordenValue}-${index}`}
                                aria-label={`Seleccionar orden ${ordenValue}`}
                              />
                            </TableCell>
                            {COLUMNAS.map((col) => (
                              <TableCell key={col.key} className={cn("px-2 py-1 whitespace-nowrap")}>
                                {col.key === "Fecha"
                                  ? formatFechaCelda(String(row.Fecha ?? ""))
                                  : String(row[col.key] ?? "")}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </RadioGroup>
              </ScrollArea>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Filas por página:</span>
                <select
                  className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-xs text-muted-foreground">
                {totalRows === 0
                  ? "0"
                  : `${(page - 1) * rowsPerPage + 1} – ${Math.min(
                      page * rowsPerPage,
                      totalRows
                    )} de ${totalRows}`}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  aria-label="Primera página"
                >
                  &#x23ee;
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Página anterior"
                >
                  &#x2039;
                </Button>
                <span className="text-xs text-muted-foreground px-1">
                  {page} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  aria-label="Página siguiente"
                >
                  &#x203a;
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  aria-label="Última página"
                >
                  &#x23ed;
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    <EtiquetasPrensadoImpresion orden={selectedOrden} onImpresionFinalizada={alFinalizarImpresion} />

    <ReimprimirEtiquetaPrensadoDialog open={reimprimirOpen} onOpenChange={setReimprimirOpen} />
    </div>
  );
}

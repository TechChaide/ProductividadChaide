"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileCheck2, ListChecks, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/user-context";
import { cn } from "@/lib/utils";
import { ajusteOrdenesCorteTelaService } from "@/services/ajusteOrdenesCorteTela.service";
import type {
  PreNotificacionOrden,
  InsertarPreNotificacionPayload,
} from "@/types/interfaces";

const SHADE_A = "bg-gradient-to-r from-muted/50 via-muted/25 to-muted/10";
const SHADE_B = "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent";

const COLUMNAS_LISTA: {
  key: string;
  label: string;
  className?: string;
  format?: (value: any) => string;
}[] = [
  { key: "Orden", label: "Orden" },
  { key: "Fecha", label: "Fecha", format: (value) => String(value ?? "").slice(0, 10) },
  { key: "NombreMaterialOrden", label: "Material", className: "max-w-[200px] truncate" },
  { key: "CantidadInicialOrden", label: "Cantidad Original" },
  { key: "CantidadRealOrden", label: "Cantidad Real" },
  { key: "Estado", label: "Estado" },
];

function formatFecha(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AjusteOrdenesTelaContent() {
  const { toast } = useToast();
  const { user } = useUser();

  const [ordenes, setOrdenes] = useState<PreNotificacionOrden[]>([]);
  const [isLoadingLista, setIsLoadingLista] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [selected, setSelected] = useState<PreNotificacionOrden | null>(null);
  const [detalle, setDetalle] = useState<PreNotificacionOrden | null>(null);
  const [isLoadingDetalle, setIsLoadingDetalle] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cargarPreNotificaciones = useCallback(async () => {
    try {
      const hoy = new Date();
      const fechaInicio = new Date(hoy);
      fechaInicio.setDate(hoy.getDate() - 5);
      const fechaFin = new Date(hoy);
      fechaFin.setDate(hoy.getDate() + 5);

      const res = await ajusteOrdenesCorteTelaService.listaPorFecha(
        formatFecha(fechaInicio),
        formatFecha(fechaFin)
      );
      setOrdenes(res.data || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
      toast({
        title: "Error al cargar pre-notificaciones",
        description: message,
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    setIsLoadingLista(true);
    cargarPreNotificaciones().finally(() => setIsLoadingLista(false));
  }, [cargarPreNotificaciones]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await cargarPreNotificaciones();
    setIsRefreshing(false);
  };

  const filteredOrdenes = ordenes.filter((row) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return COLUMNAS_LISTA.some((col) =>
      String(row[col.key] ?? "").toLowerCase().includes(term)
    );
  });

  const handleRowClick = async (row: PreNotificacionOrden) => {
    setSelected(row);
    setDetalle(null);
    setIsLoadingDetalle(true);

    try {
      const res = await ajusteOrdenesCorteTelaService.porOrden(row.Orden);
      setDetalle(res.data?.[0] ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
      toast({
        title: "Error al cargar el detalle de la orden",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingDetalle(false);
    }
  };

  const isConfirmDisabled = !detalle || !selected || isSubmitting;

  const handleConfirmarAjuste = async () => {
    if (!detalle) return;

    const payload: InsertarPreNotificacionPayload = {
      orden: detalle.Orden,
      cantidadInicialOrden: detalle.CantidadInicialOrden,
      cantidadRealOrden: detalle.CantidadRealOrden,
      usuarioLog: user?.name ?? "",
      estado: "F",
      materialOrden: detalle.MaterialOrden,
      nombreMaterialOrden: detalle.NombreMaterialOrden,
      materialComponente: detalle.MaterialComponente,
      nombreMaterialComponente: detalle.NombreMaterialComponente,
      cantidadInicialComponente: detalle.CantidadInicialComponente,
      cantidadRealComponente: detalle.CantidadRealComponente,
    };

    setIsSubmitting(true);
    try {
      const res = await ajusteOrdenesCorteTelaService.confirmar(payload);
      if (res.insertado) {
        toast({
          title: "El Ajuste a la orden fue realizado con éxito",
          className: "bg-green-100 dark:bg-green-900 border-green-500",
        });
        setSelected(null);
        setDetalle(null);
        await cargarPreNotificaciones();
      } else {
        toast({
          title: "No se pudo confirmar el ajuste",
          description: "La solicitud no fue procesada por el servidor.",
          variant: "destructive",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
      toast({
        title: "Error al confirmar el ajuste",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Card className="shadow-lg w-full">
        <CardHeader className="py-3">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="text-base font-bold text-primary flex items-center">
                <ListChecks className="mr-2 h-4 w-4" /> Pre-notificaciones ({ordenes.length})
              </CardTitle>
              <input
                type="text"
                placeholder="Buscar por orden, material, estado..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-72 rounded px-3 py-1.5 text-sm shadow focus:outline-none"
                style={{
                  minWidth: "200px",
                  border: "2px solid rgba(0, 85, 184, 0.5)",
                  boxShadow: "0 0 0 2px rgba(0, 85, 184, 0.08)",
                }}
              />
              <span className="text-xs text-muted-foreground font-semibold">
                {filteredOrdenes.length} mostradas
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoadingLista}
              title="Recargar Pre-notificaciones"
            >
              <RefreshCw className={cn("h-4 w-4", (isRefreshing || isLoadingLista) && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 pb-3">
          {isLoadingLista ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : filteredOrdenes.length === 0 ? (
            <div className="flex justify-center items-center h-[150px] p-4">
              <p className="text-muted-foreground text-sm">
                No se encontraron pre-notificaciones en el rango de fechas seleccionado.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[380px] md:h-[calc(100vh-320px)] w-full">
              <RadioGroup
                value={selected?.Orden ?? ""}
                onValueChange={(value) => {
                  const row = ordenes.find((o) => o.Orden === value);
                  if (row) handleRowClick(row);
                }}
                aria-label="Lista de pre-notificaciones"
              >
                <Table
                  containerClassName="overflow-visible"
                  className="text-xs [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-20 [&_thead_th]:bg-card"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[32px] px-2"></TableHead>
                      {COLUMNAS_LISTA.map((col) => (
                        <TableHead key={col.key} className="h-8 px-2 py-1 whitespace-nowrap">
                          {col.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrdenes.map((row, index) => {
                      const isSelected = selected?.Orden === row.Orden;
                      return (
                        <TableRow
                          key={index}
                          onClick={() => handleRowClick(row)}
                          className={cn(
                            "cursor-pointer",
                            isSelected ? "bg-secondary" : "hover:bg-muted/50"
                          )}
                        >
                          <TableCell className="px-2 py-1">
                            <RadioGroupItem
                              value={row.Orden}
                              id={`sel-${row.Orden}-${index}`}
                              aria-label={`Seleccionar orden ${row.Orden}`}
                            />
                          </TableCell>
                          {COLUMNAS_LISTA.map((col) => (
                            <TableCell
                              key={col.key}
                              className={cn("px-2 py-1 whitespace-nowrap", col.className)}
                              title={String(row[col.key] ?? "")}
                            >
                              {col.format ? col.format(row[col.key]) : String(row[col.key] ?? "")}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </RadioGroup>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card className="overflow-hidden">
          <CardHeader className={cn("py-3", SHADE_A)}>
            <CardTitle className="text-base font-bold text-primary flex items-center">
              <FileCheck2 className="mr-2 h-4 w-4" /> Detalle de Orden
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className={cn(SHADE_B, "px-3 py-2")}>
              <Input value={selected.Orden} readOnly className="max-w-xs font-medium" />
            </div>

            {isLoadingDetalle && (
              <div className={cn(SHADE_A, "flex flex-col gap-2 px-3 py-2")}>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            )}

            {!isLoadingDetalle && detalle && (
              <>
                <div className={cn(SHADE_A, "px-3 py-2")}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Material Orden</Label>
                      <Input value={detalle.MaterialOrden ?? ""} readOnly />
                    </div>
                    <div>
                      <Label>Nombre Material Orden</Label>
                      <Input value={detalle.NombreMaterialOrden ?? ""} readOnly />
                    </div>
                  </div>
                </div>

                <div className={cn(SHADE_B, "px-3 py-2")}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Cantidad Inicial Orden</Label>
                      <Input value={String(detalle.CantidadInicialOrden ?? "")} readOnly />
                    </div>
                    <div>
                      <Label>Cantidad Real Orden</Label>
                      <Input value={String(detalle.CantidadRealOrden ?? "")} readOnly />
                    </div>
                  </div>
                </div>

                <div className={cn(SHADE_A, "px-3 py-2")}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Material Componente</Label>
                      <Input value={detalle.MaterialComponente ?? ""} readOnly />
                    </div>
                    <div>
                      <Label>Nombre Material Componente</Label>
                      <Input value={detalle.NombreMaterialComponente ?? ""} readOnly />
                    </div>
                  </div>
                </div>

                <div className={cn(SHADE_B, "px-3 py-2")}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Cantidad Inicial Componente</Label>
                      <Input value={String(detalle.CantidadInicialComponente ?? "")} readOnly />
                    </div>
                    <div>
                      <Label>Cantidad Real Componente</Label>
                      <Input value={String(detalle.CantidadRealComponente ?? "")} readOnly />
                    </div>
                  </div>
                </div>

                <div className={cn(SHADE_A, "px-3 py-2 flex justify-end")}>
                  <Button
                    onClick={handleConfirmarAjuste}
                    disabled={isConfirmDisabled}
                    className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                  >
                    {isSubmitting ? "Confirmando..." : "Confirmar Ajuste"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

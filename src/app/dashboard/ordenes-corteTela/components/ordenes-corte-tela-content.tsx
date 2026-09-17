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
import { ClipboardCheck, PackageSearch, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/user-context";
import { cn } from "@/lib/utils";
import { ordenCorteTelaService } from "@/services/ordenCorteTela.service";
import type {
  OrdenCorteTelaListItem,
  OrdenCorteTelaDetalle,
  InsertarPreNotificacionPayload,
} from "@/types/interfaces";

const RANGO_TOLERANCIA = 0.4;
const NUMERIC_INPUT_REGEX = /^\d*\.?\d*$/;

const SHADE_A = "bg-gradient-to-r from-muted/50 via-muted/25 to-muted/10";
const SHADE_B = "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent";

const COLUMNAS_LISTA: { key: string; label: string; className?: string }[] = [
  { key: "ORDEN", label: "Orden" },
  { key: "MATERIAL", label: "Material" },
  { key: "NOMBREMATERIAL", label: "Nombre Material", className: "max-w-[200px] truncate" },
  { key: "CANTPROGRAMADA", label: "Cant. Prog." },
  { key: "CANTENTREGADA", label: "Cant. Entreg." },
  { key: "COMPONENTE", label: "Componente" },
  { key: "NOMBRECOMPONENTE", label: "Nombre Componente", className: "max-w-[200px] truncate" },
  { key: "FECHA", label: "Fecha" },
];

function formatFecha(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getOrdenValue(row: OrdenCorteTelaListItem | null): string {
  if (!row) return "";
  return String(row.ORDEN ?? row.Orden ?? row.orden ?? "");
}

function isFueraDeRango(valor: number, original: number): boolean {
  if (Number.isNaN(valor)) return false;
  if (original <= 0) return false;
  const diferencia = Math.abs(valor - original) / Math.abs(original);
  return diferencia > RANGO_TOLERANCIA;
}

export default function OrdenesCorteTelaContent() {
  const { toast } = useToast();
  const { user } = useUser();

  const [ordenes, setOrdenes] = useState<OrdenCorteTelaListItem[]>([]);
  const [isLoadingLista, setIsLoadingLista] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedOrden, setSelectedOrden] = useState<OrdenCorteTelaListItem | null>(null);
  const [detalle, setDetalle] = useState<OrdenCorteTelaDetalle | null>(null);
  const [isLoadingDetalle, setIsLoadingDetalle] = useState(false);

  const [cantProgramadaReal, setCantProgramadaReal] = useState("");
  const [cantidadComponenteReal, setCantidadComponenteReal] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cargarOrdenes = useCallback(async () => {
    try {
      const hoy = new Date();
      const fechaInicio = new Date(hoy);
      fechaInicio.setDate(hoy.getDate() - 5);
      const fechaFin = new Date(hoy);
      fechaFin.setDate(hoy.getDate() + 5);

      const res = await ordenCorteTelaService.listaPorFecha(
        formatFecha(fechaInicio),
        formatFecha(fechaFin)
      );
      setOrdenes(res.data || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
      toast({
        title: "Error al cargar órdenes",
        description: message,
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    setIsLoadingLista(true);
    cargarOrdenes().finally(() => setIsLoadingLista(false));
  }, [cargarOrdenes]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await cargarOrdenes();
    setIsRefreshing(false);
  };

  const filteredOrdenes = ordenes.filter((row) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return COLUMNAS_LISTA.some((col) =>
      String(row[col.key] ?? "").toLowerCase().includes(term)
    );
  });

  const handleRowClick = async (row: OrdenCorteTelaListItem) => {
    setSelectedOrden(row);
    setDetalle(null);
    setCantProgramadaReal("");
    setCantidadComponenteReal("");
    setIsLoadingDetalle(true);

    try {
      const res = await ordenCorteTelaService.porOrden(getOrdenValue(row));
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

  const handleNumericChange = (setter: (value: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === "" || NUMERIC_INPUT_REGEX.test(raw)) {
        setter(raw);
      }
    };

  const cantidadComponenteOriginal = detalle?.CANTIDADNECESARIAREALCO03 ?? 0;

  const cantProgramadaError =
    cantProgramadaReal !== "" &&
    detalle &&
    isFueraDeRango(parseFloat(cantProgramadaReal), detalle.CANTPROGRAMADA)
      ? "El valor está fuera de los rangos establecidos."
      : undefined;

  const cantidadComponenteError =
    cantidadComponenteReal !== "" &&
    detalle &&
    isFueraDeRango(parseFloat(cantidadComponenteReal), cantidadComponenteOriginal)
      ? "El valor está fuera de los rangos establecidos."
      : undefined;

  const isSubmitDisabled =
    !detalle ||
    !selectedOrden ||
    cantProgramadaReal === "" ||
    cantidadComponenteReal === "" ||
    !!cantProgramadaError ||
    !!cantidadComponenteError ||
    isSubmitting;

  const handleSolicitarAjuste = async () => {
    if (!detalle || !selectedOrden) return;

    const payload: InsertarPreNotificacionPayload = {
      orden: getOrdenValue(selectedOrden),
      cantidadInicialOrden: detalle.CANTPROGRAMADA,
      cantidadRealOrden: parseFloat(cantProgramadaReal),
      usuarioLog: user?.name ?? "",
      estado: "P",
      materialOrden: detalle.MATERIAL,
      nombreMaterialOrden: detalle.NOMBREMATERIAL,
      materialComponente: detalle.COMPONENTE,
      nombreMaterialComponente: detalle.NOMBRECOMPONENTE,
      cantidadInicialComponente: cantidadComponenteOriginal,
      cantidadRealComponente: parseFloat(cantidadComponenteReal),
    };

    setIsSubmitting(true);
    try {
      const res = await ordenCorteTelaService.insertarPreNotificacion(payload);
      if (res.insertado) {
        toast({
          title: "Solicitud enviada",
          description: "El ajuste se registró correctamente.",
          className: "bg-green-100 dark:bg-green-900 border-green-500",
        });
        setCantProgramadaReal("");
        setCantidadComponenteReal("");
        setSelectedOrden(null);
        setDetalle(null);
        await cargarOrdenes();
      } else {
        toast({
          title: "No se pudo registrar el ajuste",
          description: "La solicitud no fue insertada por el servidor.",
          variant: "destructive",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
      toast({
        title: "Error al enviar la solicitud",
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
                <PackageSearch className="mr-2 h-4 w-4" /> Órdenes Disponibles ({ordenes.length})
              </CardTitle>
              <input
                type="text"
                placeholder="Buscar por orden, material, componente..."
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
              title="Recargar Órdenes"
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
                No se encontraron órdenes en el rango de fechas seleccionado.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[380px] md:h-[calc(100vh-320px)] w-full">
              <RadioGroup
                value={getOrdenValue(selectedOrden)}
                onValueChange={(value) => {
                  const row = ordenes.find((o) => getOrdenValue(o) === value);
                  if (row) handleRowClick(row);
                }}
                aria-label="Lista de órdenes"
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
                      const ordenValue = getOrdenValue(row);
                      const isSelected = getOrdenValue(selectedOrden) === ordenValue;
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
                              value={ordenValue}
                              id={`sel-${ordenValue}-${index}`}
                              aria-label={`Seleccionar orden ${ordenValue}`}
                            />
                          </TableCell>
                          {COLUMNAS_LISTA.map((col) => (
                            <TableCell
                              key={col.key}
                              className={cn("px-2 py-1 whitespace-nowrap", col.className)}
                              title={String(row[col.key] ?? "")}
                            >
                              {String(row[col.key] ?? "")}
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

      {selectedOrden && (
        <Card className="overflow-hidden">
          <CardHeader className={cn("py-3", SHADE_A)}>
            <CardTitle className="text-base font-bold text-primary flex items-center">
              <ClipboardCheck className="mr-2 h-4 w-4" /> Orden seleccionada
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className={cn(SHADE_B, "px-3 py-2")}>
              <Input value={getOrdenValue(selectedOrden)} readOnly className="max-w-xs font-medium" />
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
                      <Label>Material</Label>
                      <Input value={detalle.MATERIAL ?? ""} readOnly />
                    </div>
                    <div>
                      <Label>Nombre Material</Label>
                      <Input value={detalle.NOMBREMATERIAL ?? ""} readOnly />
                    </div>
                    <div>
                      <Label>Cantidad Programada</Label>
                      <Input value={String(detalle.CANTPROGRAMADA ?? "")} readOnly />
                    </div>
                    <div>
                      <Label>Cantidad Entregada</Label>
                      <Input value={String(detalle.CANTENTREGADA ?? "")} readOnly />
                    </div>
                  </div>
                </div>

                <div className={cn(SHADE_B, "px-3 py-2")}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label>Componente</Label>
                      <Input value={detalle.COMPONENTE ?? ""} readOnly />
                    </div>
                    <div>
                      <Label>Nombre Componente</Label>
                      <Input value={detalle.NOMBRECOMPONENTE ?? ""} readOnly />
                    </div>
                    <div>
                      <Label>Cantidad Componente</Label>
                      <Input value={String(cantidadComponenteOriginal)} readOnly />
                    </div>
                  </div>
                </div>

                <div className={cn(SHADE_A, "px-3 py-2")}>
                  <h3 className="text-sm font-semibold mb-1">Ajuste solicitado</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="cantProgramadaReal">Cantidad Programada Real</Label>
                      <Input
                        id="cantProgramadaReal"
                        inputMode="decimal"
                        value={cantProgramadaReal}
                        onChange={handleNumericChange(setCantProgramadaReal)}
                        className={cn(
                          cantProgramadaError && "border-red-500 focus-visible:ring-red-500"
                        )}
                      />
                      {cantProgramadaError && (
                        <p className="text-sm text-red-500 mt-1">{cantProgramadaError}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="cantidadComponenteReal">Cantidad Componente Real</Label>
                      <Input
                        id="cantidadComponenteReal"
                        inputMode="decimal"
                        value={cantidadComponenteReal}
                        onChange={handleNumericChange(setCantidadComponenteReal)}
                        className={cn(
                          cantidadComponenteError && "border-red-500 focus-visible:ring-red-500"
                        )}
                      />
                      {cantidadComponenteError && (
                        <p className="text-sm text-red-500 mt-1">{cantidadComponenteError}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className={cn(SHADE_B, "px-3 py-2 flex justify-end")}>
                  <Button
                    onClick={handleSolicitarAjuste}
                    disabled={isSubmitDisabled}
                    className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                  >
                    {isSubmitting ? "Enviando..." : "Solicitar Ajuste"}
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

"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/user-context";
import type { Ingreso, Movimiento, MovimientoPorIngreso } from "@/types/interfaces";
import { ingresosService } from "@/services/ingresos.service";
import { movimientoService } from "@/services/movimiento.service";
import { detalleMovimientoService } from "@/services/detalleMovimiento.service";
import { servicioService } from "@/services/servicio.service";
import { formatDateForSQLServer } from "@/lib/integrations/muestreos-ddpp/datetime2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import IngresoForm from "./form";
import IngresosTable from "./table";

function formatFecha(value?: string | null): string {
  if (!value) return "—";
  const normalized = String(value).replace("T", " ").trim();
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
  );
  if (!match) return String(value);
  const [, y, m, d, hh, mm] = match;
  return `${d}/${m}/${y} ${hh}:${mm}`;
}

function formatNum(value: unknown): string {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

export default function IngresosContent() {
  const { toast } = useToast();
  const { user } = useUser();

  const [records, setRecords] = useState<Ingreso[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ingreso | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const [toDelete, setToDelete] = useState<Ingreso | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toDevolver, setToDevolver] = useState<Ingreso | null>(null);
  const [isDevolviendo, setIsDevolviendo] = useState(false);

  const [movimientosIngreso, setMovimientosIngreso] = useState<Ingreso | null>(
    null
  );
  const [movimientos, setMovimientos] = useState<MovimientoPorIngreso[]>([]);
  const [isLoadingMovimientos, setIsLoadingMovimientos] = useState(false);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await ingresosService.getAll();
      const data = (response.data || []).filter(
        (item) => !item.estado || item.estado === "A"
      );
      const sorted = [...data].sort(
        (a, b) => (b.codigo_ingreso ?? 0) - (a.codigo_ingreso ?? 0)
      );
      setRecords(sorted);

      if (sorted.length === 0) {
        setIsFormOpen(true);
        setEditing(null);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "No se pudo cargar los datos.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setIsFormOpen(true);
      setEditing(null);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [toast]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  const handleAddNew = () => {
    setEditing(null);
    setIsFormOpen(true);
  };

  const handleEdit = (record: Ingreso) => {
    setEditing(record);
    setIsFormOpen(true);
  };

  const handleSuccess = () => {
    void fetchRecords();
    setIsFormOpen(false);
    setEditing(null);
  };

  const handleCancel = () => {
    if (records.length > 0) {
      setIsFormOpen(false);
      setEditing(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await ingresosService.delete(toDelete.codigo_ingreso);
      toast({
        title: "Ingreso eliminado",
        description: `Se desactivó el ingreso #${toDelete.codigo_ingreso}.`,
      });
      setToDelete(null);
      await fetchRecords();
    } catch (error) {
      toast({
        title: "Error al eliminar",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar el ingreso.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Devolución por falla/defecto: siempre del ingreso completo.
   * Registra DEVOLUCION con cantidad = cantidad del ingreso y lo desactiva.
   */
  const handleConfirmDevolver = async () => {
    if (!toDevolver) return;
    setIsDevolviendo(true);
    try {
      const movs = await servicioService.getMovimientosPorIngreso(
        toDevolver.codigo_ingreso
      );
      const yaDevuelto = (movs.data || []).some(
        (m) =>
          String(m.tipo_movimiento ?? "")
            .trim()
            .toUpperCase() === "DEVOLUCION"
      );
      if (yaDevuelto) {
        toast({
          title: "Ya devuelto",
          description: `El ingreso #${toDevolver.codigo_ingreso} ya tiene una devolución registrada.`,
          variant: "destructive",
        });
        setToDevolver(null);
        return;
      }

      const cantidadTotal = String(toDevolver.cantidad ?? "").trim();
      if (!cantidadTotal || Number.isNaN(Number(cantidadTotal))) {
        toast({
          title: "Cantidad inválida",
          description: "El ingreso no tiene una cantidad válida para devolver.",
          variant: "destructive",
        });
        return;
      }

      const now = formatDateForSQLServer(new Date());
      const usuario = user?.name ?? "";

      const movPayload: Movimiento = {
        codigo_movimiento: 0,
        tipo_movimiento: "DEVOLUCION",
        cantidad_movimiento: cantidadTotal,
        cantidad_estimada: Number(cantidadTotal) || 0,
        cantidad_desperdicio: 0,
        fecha_movimiento: now,
        usuario_movimiento: usuario,
        estado: "A",
        fecha_modificacion: now,
        usuario_modificacion: usuario,
        codigo_ingreso: toDevolver.codigo_ingreso,
      };

      const movRes = await movimientoService.save(movPayload);
      const codigoMovimiento = movRes.data?.codigo_movimiento;
      if (!codigoMovimiento) {
        throw new Error("No se obtuvo el código del movimiento de devolución.");
      }

      await detalleMovimientoService.save({
        codigo_detalle_movimiento: 0,
        codigo_movimiento: codigoMovimiento,
        orden: "DEV-DEFECTO",
        cantidad_utilizada: Number(cantidadTotal) || 0,
        estado: "A",
        fecha_modificacion: now,
        usuario_modificacion: usuario,
      });

      await ingresosService.delete(toDevolver.codigo_ingreso);

      toast({
        title: "Ingreso devuelto",
        description: `Se registró la devolución total de ${cantidadTotal} ${toDevolver.unidades} (falla/defecto) y se desactivó el ingreso #${toDevolver.codigo_ingreso}.`,
      });
      setToDevolver(null);
      await fetchRecords();
    } catch (error) {
      toast({
        title: "Error al devolver",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo registrar la devolución.",
        variant: "destructive",
      });
    } finally {
      setIsDevolviendo(false);
    }
  };

  const handleViewMovimientos = async (record: Ingreso) => {
    setMovimientosIngreso(record);
    setMovimientos([]);
    setIsLoadingMovimientos(true);
    try {
      const res = await servicioService.getMovimientosPorIngreso(
        record.codigo_ingreso
      );
      setMovimientos(res.data || []);
    } catch (error) {
      toast({
        title: "Error al cargar movimientos",
        description:
          error instanceof Error
            ? error.message
            : "No se pudieron consultar los movimientos (¿SP creado?).",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMovimientos(false);
    }
  };

  const resumen = movimientos[0];
  const filasMovimiento = movimientos.filter(
    (row) => row.codigo_movimiento != null && row.codigo_movimiento !== ""
  );
  const showTable = hasFetched && !isFormOpen && records.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de ingresos a bodega</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Registra y consulta materiales ingresados a bodega para dar seguimiento
            a consumos, devoluciones (ingreso completo por falla/defecto),
            reposiciones y desperdicios.
          </p>
        </CardContent>
      </Card>

      {isFormOpen ? (
        <IngresoForm
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          canCancel={records.length > 0}
          initialData={editing}
        />
      ) : showTable ? (
        <IngresosTable
          records={records}
          isLoading={isLoading}
          onAddNew={handleAddNew}
          onEdit={handleEdit}
          onDelete={setToDelete}
          onDevolver={setToDevolver}
          onViewMovimientos={(r) => void handleViewMovimientos(r)}
        />
      ) : null}

      <Dialog
        open={!!movimientosIngreso}
        onOpenChange={(open) => {
          if (!open) {
            setMovimientosIngreso(null);
            setMovimientos([]);
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Movimientos · ingreso #{movimientosIngreso?.codigo_ingreso}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {movimientosIngreso?.codigo_material} · QR{" "}
              {movimientosIngreso?.qr_bmp || "—"}
            </DialogDescription>
          </DialogHeader>

          {resumen && (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">
                Ingreso: {formatNum(resumen.cantidad_ingreso)}{" "}
                {movimientosIngreso?.unidades}
              </Badge>
              <Badge variant="outline">
                Consumo: {formatNum(resumen.total_consumo)}
              </Badge>
              <Badge variant="outline">
                Devolución: {formatNum(resumen.total_devolucion)}
              </Badge>
              <Badge variant="outline">
                Reposición: {formatNum(resumen.total_reposicion)}
              </Badge>
              <Badge
                variant="secondary"
                className="font-semibold text-primary"
              >
                Disponible: {formatNum(resumen.disponible)}
              </Badge>
            </div>
          )}

          {isLoadingMovimientos ? (
            <div className="flex items-center justify-center gap-2 h-40 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Consultando SP...
            </div>
          ) : filasMovimiento.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No hay movimientos registrados para este ingreso.
            </p>
          ) : (
            <ScrollArea className="h-[360px] border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>Mov.</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Orden</TableHead>
                    <TableHead className="text-right">Utilizada</TableHead>
                    <TableHead className="text-right">Desperdicio</TableHead>
                    <TableHead className="text-right">Estimada</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filasMovimiento.map((row, idx) => (
                    <TableRow
                      key={`${row.codigo_movimiento ?? "x"}-${row.orden ?? idx}-${idx}`}
                    >
                      <TableCell className="font-mono text-xs">
                        {row.codigo_movimiento ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {row.tipo_movimiento || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.orden || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNum(
                          row.cantidad_utilizada ?? row.cantidad_movimiento
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNum(row.cantidad_desperdicio)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNum(row.cantidad_estimada)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatFecha(row.fecha_movimiento)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.usuario_movimiento || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ingreso?</AlertDialogTitle>
            <AlertDialogDescription>
              Se desactivará el ingreso #{toDelete?.codigo_ingreso} (material{" "}
              <span className="font-mono">{toDelete?.codigo_material}</span>
              ). Esta acción es un borrado lógico (estado = I).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!toDevolver}
        onOpenChange={(open) => {
          if (!open && !isDevolviendo) setToDevolver(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Devolver ingreso completo?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Por falla o defecto del material se devuelve{" "}
                  <strong>todo el ingreso</strong> #{toDevolver?.codigo_ingreso}
                  :
                </p>
                <p className="font-mono text-foreground">
                  {toDevolver?.codigo_material} · {toDevolver?.cantidad}{" "}
                  {toDevolver?.unidades}
                </p>
                <p>
                  Se registrará un movimiento <strong>DEVOLUCION</strong> por la
                  cantidad total y el ingreso quedará inactivo.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDevolviendo}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDevolver();
              }}
              disabled={isDevolviendo}
            >
              {isDevolviendo ? "Devolviendo..." : "Devolver todo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

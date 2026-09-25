"use client";

import { useState, useMemo } from "react";
import {
  PackagePlus,
  MoreHorizontal,
  Edit,
  Trash2,
  History,
  Undo2,
} from "lucide-react";
import type { Ingreso } from "@/types/interfaces";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_SIZE_OPTIONS = [10, 15, 20, 50];

function formatFecha(value?: string | null): string {
  if (!value) return "—";
  const normalized = value.replace("T", " ").trim();
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
  );
  if (!match) return value;
  const [, y, m, d, hh, mm] = match;
  return `${d}/${m}/${y} ${hh}:${mm}`;
}

interface IngresosTableProps {
  records: Ingreso[];
  isLoading: boolean;
  onAddNew: () => void;
  onEdit: (record: Ingreso) => void;
  onDelete: (record: Ingreso) => void;
  onViewMovimientos: (record: Ingreso) => void;
  /** Devolución total del ingreso (falla / defecto de material). */
  onDevolver: (record: Ingreso) => void;
}

export default function IngresosTable({
  records,
  isLoading,
  onAddNew,
  onEdit,
  onDelete,
  onViewMovimientos,
  onDevolver,
}: IngresosTableProps) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE_OPTIONS[0]);
  const [filter, setFilter] = useState("");

  const filteredRecords = useMemo(() => {
    if (!filter.trim()) return records;
    const f = filter.toLowerCase();
    return records.filter(
      (r) =>
        String(r.codigo_ingreso ?? "").toLowerCase().includes(f) ||
        (r.codigo_material?.toLowerCase().includes(f) || "") ||
        (r.bodega_origen?.toLowerCase().includes(f) || "") ||
        (r.bodega_destino?.toLowerCase().includes(f) || "") ||
        (r.qr_bmp?.toLowerCase().includes(f) || "") ||
        (r.usuario_ingreso?.toLowerCase().includes(f) || "")
    );
  }, [records, filter]);

  const totalRows = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredRecords.slice(start, start + rowsPerPage);
  }, [filteredRecords, page, rowsPerPage]);

  if (page > totalPages && totalPages > 0) setPage(totalPages);

  const renderSkeleton = () =>
    [...Array(5)].map((_, i) => (
      <TableRow key={i}>
        <TableCell>
          <Skeleton className="h-4 w-12" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-32" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-16" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-28" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-28" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-40" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-24" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-20" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-6 w-16 rounded-full" />
        </TableCell>
        <TableCell className="text-right">
          <Skeleton className="h-8 w-8 ml-auto" />
        </TableCell>
      </TableRow>
    ));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Listado de ingresos</CardTitle>
          <CardDescription>
            Materiales ingresados a bodega registrados en el sistema.
          </CardDescription>
        </div>
        <Button onClick={onAddNew}>
          <PackagePlus className="mr-2 h-4 w-4" />
          Añadir ingreso
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            className="border rounded px-3 py-2 w-full max-w-xs text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Filtrar por material, bodega, QR..."
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>QR</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? renderSkeleton()
                : paginatedRecords.map((record) => (
                    <TableRow key={record.codigo_ingreso}>
                      <TableCell className="font-medium">
                        {record.codigo_ingreso}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {record.codigo_material}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {record.cantidad} {record.unidades}
                      </TableCell>
                      <TableCell>{record.bodega_origen}</TableCell>
                      <TableCell>{record.bodega_destino}</TableCell>
                      <TableCell
                        className="max-w-[160px] truncate font-mono text-[11px]"
                        title={record.qr_bmp}
                      >
                        {record.qr_bmp || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatFecha(record.fecha_ingreso)}
                      </TableCell>
                      <TableCell>{record.usuario_ingreso || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            record.estado === "A" ? "default" : "destructive"
                          }
                          className={record.estado === "A" ? "bg-green-600" : ""}
                        >
                          {record.estado === "A" ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menú</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => onViewMovimientos(record)}
                            >
                              <History className="mr-2 h-4 w-4" />
                              Ver movimientos
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit(record)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDevolver(record)}>
                              <Undo2 className="mr-2 h-4 w-4" />
                              Devolver ingreso
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => onDelete(record)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
              {!isLoading && paginatedRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center">
                    No se encontraron ingresos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-end gap-4 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">Items per page:</span>
            <select
              className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
          <span className="text-sm">
            {totalRows === 0
              ? "0"
              : `${(page - 1) * rowsPerPage + 1} – ${Math.min(
                  page * rowsPerPage,
                  totalRows
                )} of ${totalRows}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              className="p-1 rounded disabled:opacity-50 hover:bg-gray-100"
              onClick={() => setPage(1)}
              disabled={page === 1}
              aria-label="Primera página"
            >
              &#x23ee;
            </button>
            <button
              className="p-1 rounded disabled:opacity-50 hover:bg-gray-100"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Página anterior"
            >
              &#x2039;
            </button>
            <button
              className="p-1 rounded disabled:opacity-50 hover:bg-gray-100"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Página siguiente"
            >
              &#x203a;
            </button>
            <button
              className="p-1 rounded disabled:opacity-50 hover:bg-gray-100"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              aria-label="Última página"
            >
              &#x23ed;
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

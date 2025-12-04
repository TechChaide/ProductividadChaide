"use client";

import { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { PackageSearch, AlertTriangle, RefreshCw } from "lucide-react";
import type { Order } from "@/types/order";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseISO } from "date-fns";

interface OrdersTableProps {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  onOrderSelect: (order: Order | null) => void;
  selectedOrderId: string | null | undefined;
  onRefresh: () => void;
  machines: string[];
  selectedMachine: string;
  onMachineChange: (value: string) => void;
  machineSelectDisabled?: boolean;
  notificaSAP: boolean;
}

export default function OrdersTable({
  orders,
  isLoading,
  error,
  onOrderSelect,
  selectedOrderId,
  onRefresh,
  machines,
  selectedMachine,
  onMachineChange,
  machineSelectDisabled = false,
  notificaSAP,
}: OrdersTableProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Estado para el filtro de búsqueda
  const [searchTerm, setSearchTerm] = useState("");

  // Filtrar las órdenes según el término de búsqueda
  const filteredOrders = orders.filter(order => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      order.orden?.toString().toLowerCase().includes(term) ||
      order.fecha?.toString().toLowerCase().includes(term) ||
      order.descripcionMaterial?.toLowerCase().includes(term) ||
      order.material?.toString().toLowerCase().includes(term)
    );
  });

  // Calcular la suma de los pendientes filtrados
  const totalPendiente = filteredOrders.reduce(
    (acc, order) => acc + (order.cantPendiente || 0),
    0
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const handleSelect = (orderId: string) => {
    const selected = orders.find((order) => order.orden === orderId);
    onOrderSelect(selected || null);
  };

  const renderContent = () => {
    if (isLoading && orders.length === 0) {
      return (
        <div className="space-y-2 p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 p-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-4 text-center text-destructive">
          <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
          <p>Error al cargar órdenes.</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      );
    }

    if (filteredOrders.length === 0 && !isLoading) {
      return (
        <div className="flex justify-center items-center h-[200px] p-4">
          <p className="text-muted-foreground">
            No hay órdenes disponibles para esta máquina o búsqueda.
          </p>
        </div>
      );
    }

    // const getDateColorClass = (dateString: string): string => {
    //   // Obtenemos la fecha de hoy y la normalizamos a medianoche para comparar solo el día
    //   const today = new Date();
    //   today.setHours(0, 0, 0, 0);

    //   // Hacemos lo mismo con la fecha de la orden
    //   const orderDate = new Date(dateString);
    //   orderDate.setHours(0, 0, 0, 0);

    //   // Comparamos y devolvemos la clase de Tailwind correspondiente
    //   if (orderDate < today) {
    //     return "text-red-500 font-semibold"; // Fecha pasada
    //   }
    //   if (orderDate.getTime() === today.getTime()) {
    //     return "text-green-600 font-semibold"; // Fecha de hoy
    //   }
    //   // Si no es pasada ni presente, es futura
    //   return "text-sky-600"; // Fecha futura
    // };

    const getDateColorClass = (dateString: string): string => {
      // 1. Obtenemos la fecha de HOY, pero normalizada a la medianoche UTC.
      const now = new Date();
      const todayUTC = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      );

      // 2. Hacemos lo mismo con la fecha de la orden para asegurar que también esté en medianoche UTC.
      const incomingDate = new Date(dateString);
      const orderDateUTC = new Date(
        Date.UTC(
          incomingDate.getUTCFullYear(),
          incomingDate.getUTCMonth(),
          incomingDate.getUTCDate()
        )
      );

      // 3. Comparamos los valores numéricos (timestamps) de las fechas UTC.
      if (orderDateUTC.getTime() < todayUTC.getTime()) {
        return "text-red-500 font-semibold"; // Fecha pasada
      }

      if (orderDateUTC.getTime() === todayUTC.getTime()) {
        return "text-green-600 font-semibold"; // Fecha de hoy
      }

      // Si no es pasada ni de hoy, es futura.
      return "text-sky-600 font-semibold"; // Fecha futura (le añadí el font-semibold para consistencia)
    };

    const getFecha = (fecha: string) => {
      const fech = new Date(fecha);

      // Usamos los métodos getUTC* para obtener los valores en UTC
      const anio = fech.getUTCFullYear();
      const mes = fech.getUTCMonth() + 1;
      const dia = fech.getUTCDate();

      const mesFormateado = String(mes).padStart(2, "0");
      const diaFormateado = String(dia).padStart(2, "0");

      return `${anio}-${mesFormateado}-${diaFormateado}`;
    };

    return (
      <ScrollArea className="h-[250px] w-full">
        <RadioGroup
          value={selectedOrderId || ""}
          onValueChange={handleSelect}
          aria-label="Lista de órdenes"
        >
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-[40px] px-2"></TableHead>
                <TableHead>Orden</TableHead>
                <TableHead>Fecha Orden</TableHead>
                <TableHead>Estación</TableHead>
                <TableHead>Nombre Material</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">
                  Pendiente
                  <span className="block text-xs font-semibold text-primary mt-1 flex items-center justify-end gap-1">
                    <span style={{fontSize: '16px', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}>
                      Σ
                    </span>
                    {totalPendiente.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow
                  key={order.orden}
                  className={`transition-colors duration-200 ease-in-out cursor-pointer ${
                    selectedOrderId === order.orden
                      ? "bg-secondary"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => handleSelect(order.orden)}
                  tabIndex={0}
                  onKeyDown={(e) =>
                    e.key === "Enter" || e.key === " "
                      ? handleSelect(order.orden)
                      : null
                  }
                  aria-selected={selectedOrderId === order.orden}
                >
                  <TableCell className="px-2">
                    <RadioGroupItem
                      value={order.orden}
                      id={`sel-${order.orden}`}
                      aria-label={`Seleccionar orden ${order.orden}`}
                    />
                  </TableCell>
                  <TableCell>{order.orden}</TableCell>
                  <TableCell className={getDateColorClass(order.fecha)}>
                    {getFecha(order.fecha)}
                  </TableCell>
                  <TableCell>{order.maquina}</TableCell>
                  <TableCell className="font-medium">
                    {order.descripcionMaterial}
                  </TableCell>
                  <TableCell className="font-medium">
                    {order.material}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {order.cantPendiente.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </RadioGroup>
      </ScrollArea>
    );
  };

  return (
    <Card className="shadow-lg w-full">
      <CardHeader className="relative">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-bold text-primary flex items-center">
              <PackageSearch className="mr-2 h-5 w-5" /> Órdenes Disponibles (
              {orders.length})
            </CardTitle>
            <input
              type="text"
              placeholder="Buscar por orden, fecha, material o nombre..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-80 rounded px-3 py-2 shadow focus:outline-none"
              style={{
                minWidth: '220px',
                border: '2px solid rgba(0, 85, 184, 0.5)',
                boxShadow: '0 0 0 2px rgba(0, 85, 184, 0.08)'
              }}
            />
          {/* Mostrar cantidad de filas filtradas a la derecha del input */}
          <span className="ml-2 text-xs text-muted-foreground font-semibold align-middle" style={{minWidth: '40px'}}>
            {filteredOrders.length} mostradas
          </span>
          {machines.length > 1 && (
              <Select
                value={selectedMachine}
                onValueChange={onMachineChange}
                disabled={machineSelectDisabled}
              >
                <SelectTrigger
                  className="w-[180px]"
                  disabled={machineSelectDisabled}
                >
                  <SelectValue placeholder="Filtrar por máquina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las máquinas</SelectItem>
                  {machines.map((machine) => (
                    <SelectItem key={machine} value={machine}>
                      {machine}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              title="Recargar Órdenes"
            >
              <RefreshCw
                className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
            <span
              title={notificaSAP ? "Esta estación notifica a SAP" : "Esta estación NO notifica a SAP"}
              className={`h-4 w-4 rounded-full ${
                notificaSAP ? "bg-green-500" : "bg-red-500"
              }`}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">{renderContent()}</CardContent>
    </Card>
  );
}

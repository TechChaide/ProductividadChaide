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
}: OrdersTableProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

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

    if (orders.length === 0 && !isLoading) {
      return (
        <div className="flex justify-center items-center h-[200px] p-4">
          <p className="text-muted-foreground">
            No hay órdenes disponibles para esta máquina.
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
                <TableHead className="text-right">Pendiente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
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
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg font-bold text-primary flex items-center">
            <PackageSearch className="mr-2 h-5 w-5" /> Órdenes Disponibles (
            {orders.length})
          </CardTitle>
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

        <div className="absolute top-4 right-4">
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
        </div>
      </CardHeader>
      <CardContent className="p-0">{renderContent()}</CardContent>
    </Card>
  );
}

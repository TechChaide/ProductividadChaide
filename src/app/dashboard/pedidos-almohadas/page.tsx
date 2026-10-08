"use client";
import Script from "next/script";
import { useState, useEffect, useCallback, useMemo } from "react";
// import { usePrinters } from "@/hooks/usePrinters"; // Ya no se necesita - imprime directo
// import { PrinterSelectModal } from "@/components/PrinterSelectModal"; // Ya no se necesita - imprime directo
import OrdersTable from "@/components/orders-table";
import SelectedOrderDisplayAlmoha from "@/components/selected-order-display";
import type { Order } from "@/types/order";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/context/user-context";
import type {
  AlmohadasNotificationHistoryItem,
  NotificationHistoryItem,
} from "@/context/user-context";
import { useToast } from "@/hooks/use-toast";
import { notificacionSAPService } from "@/services/notificacionSAP.service";
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
import type { NotificacionResponse } from "@/services/notificacionSAP.service";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, CheckCircle, XCircle, TriangleAlert, Printer, ArrowUpDown } from "lucide-react";
import { servicioService } from "@/services/servicio.service";
import type {
  OrdenProduccion,
  OrdenEmpleado,
  OrdenEmpleadoDecimal,
} from "@/types/interfaces";
import CollaboratorLoginModal from "./components/collaborator-login-modal";
import { ordenEmpleadoService } from "@/services/ordenEmpleado.service";
import { ordenEmpleadoDecimalService } from "@/services/ordenEmpleadoDecimal.service";
import { ordenEmpleadoPNCService } from "@/services/ordenEmpleadoPNC.service";
import { sesionService } from "@/services/sesion.service";
import { logOrdenesService } from "@/services/logOrdenesService";
import { json } from "stream/consumers";
import { unique } from "next/dist/build/utils";
import OrderSticker from "./components/order-sticker";
import { stringify } from "querystring";
import { set } from "date-fns";
import SelectedOrderDisplayAlmohadas from "@/components/selected-order-display-almohadas";
import OrdersTableAlmohadas from "@/components/orders-table-almohadas";
import { usePrinterIPs } from "@/hooks/usePrinterIPs";

// Tipado global para Zebra Browser Print
// declare global {
//   interface Window {
//     Zebra: any;
//     BrowserPrint: any; // el SDK crea var BrowserPrint en global
//   }
// }

export default function PedidosAlmohadasPage() {
  // Cargar IPs de impresión automáticamente al abrir la página
  const { printerIPs, isLoading: isPrinterIPsLoading } = usePrinterIPs();
  
  // Obtener parseEstaciones y demás del contexto al inicio del componente
  const { parseEstaciones } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [fabricatedQuantity, setFabricatedQuantity] = useState("");
  const [isNotifying, setIsNotifying] = useState(false);
  const [isPNC, setIsPNC] = useState(false);
  const {
    user,
    notificationHistoryAlmohadas,
    addNotificationToHistoryAlmohadas,
    orders,
    setOrders,
    isLoginModalOpen,
    setLoginModalOpen,
    activeSessions,
    estaciones,
    finishSession,
    collaborators,
    isLoading: isUserContextLoading,
    fetchActiveSessions,
  } = useUser();
  const { toast } = useToast();
  const [lastNotification, setLastNotification] =
    useState<NotificationHistoryItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<string>("all");
  // Nuevo: órdenes mostradas (filtradas) para no alterar la lógica original de fetchOrders
  const [displayedOrders, setDisplayedOrders] = useState<Order[]>([]);
  const [printErrorModal, setPrintErrorModal] = useState<{
    open: boolean;
    message: string;
  }>({ open: false, message: "" });
  const [failedLabels, setFailedLabels] = useState<EtiquetaPendienteImpresion[]>([]);
  const [isCheckingFailedLabels, setIsCheckingFailedLabels] = useState(false);
  const [isReprintingFailedLabels, setIsReprintingFailedLabels] = useState(false);
  const [failedLabelsQueryAvailable, setFailedLabelsQueryAvailable] = useState(true);

  type EtiquetaPendienteImpresion = {
    orden: string;
    paquete: number;
    unidades: number;
    Material: string;
    codigo_barras: string;
    NumPaquete: number;
    CodBarras: string;
    codigoEmpleado: string;
  };

  const delay = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  const cambiarEstadoEtiquetaConReintento = async (
    codigoBarras: string,
    estado: "T" | "F"
  ) => {
    let ultimoError: unknown = null;

    for (let intento = 1; intento <= 2; intento++) {
      try {
        await servicioService.cambiarEstadoCodigoDeBarras(codigoBarras, estado);
        return;
      } catch (error) {
        ultimoError = error;
        console.warn(
          `[PRINT ORDER] Fallo al cambiar estado ${estado} para ${codigoBarras} en intento ${intento}/2:`,
          error
        );
        if (intento < 2) {
          await delay(400);
        }
      }
    }

    throw ultimoError instanceof Error
      ? ultimoError
      : new Error(`No se pudo cambiar el estado a ${estado}`);
  };

  const imprimirEtiquetaPendiente = async (
    etiqueta: EtiquetaPendienteImpresion
  ): Promise<{ success: boolean; error?: unknown; statusSyncFailed?: boolean }> => {
    let ultimoError: unknown = null;
    let impresionExitosa = false;

    for (let intento = 1; intento <= 2; intento++) {
      try {
        console.log(
          `[PRINT ORDER] Enviando a imprimir paquete #${etiqueta.NumPaquete} (intento ${intento}/2)`
        );
        await handlePrintZPL(
          etiqueta.orden,
          etiqueta.NumPaquete.toString(),
          etiqueta.unidades.toString(),
          etiqueta.Material,
          etiqueta.CodBarras.toString(),
          etiqueta.codigoEmpleado
        );
        impresionExitosa = true;
        break;
      } catch (printError) {
        ultimoError = printError;
        console.warn(
          `[PRINT ORDER] Fallo impresión paquete #${etiqueta.NumPaquete} en intento ${intento}/2:`,
          printError
        );
        if (intento < 2) {
          await delay(500);
        }
      }
    }

    if (impresionExitosa) {
      try {
        await cambiarEstadoEtiquetaConReintento(etiqueta.CodBarras.toString(), "T");
        await delay(300);
        return { success: true };
      } catch (statusError) {
        return {
          success: false,
          error: statusError,
          statusSyncFailed: true,
        };
      }
    }

    try {
      await cambiarEstadoEtiquetaConReintento(etiqueta.CodBarras.toString(), "F");
    } catch (statusError) {
      console.warn(
        `[PRINT ORDER] No se pudo marcar como F el paquete #${etiqueta.NumPaquete}:`,
        statusError
      );
    }

    return { success: false, error: ultimoError };
  };

  const consultarEtiquetasFallidasPorOrden = useCallback(
    async (orden: string | null | undefined) => {
      if (!orden || !failedLabelsQueryAvailable) {
        setFailedLabels([]);
        return;
      }

      setIsCheckingFailedLabels(true);
      try {
        const response = await servicioService.consultarEtiquetasPorOrden(orden);
        const etiquetasFallidas = (response.data || [])
          .filter((item: any) => String(item.ESTADO || "").trim().toUpperCase() === "F")
          .map(
            (item: any): EtiquetaPendienteImpresion => ({
              orden: String(item.NUM_ORDEN || orden),
              paquete: Number(item.POSICION || 0),
              unidades: Number(item.UNIDADES_PROD || 0),
              Material: String(item.MATERIAL || item.COD_MATERIAL || selectedOrder?.descripcionMaterial || ""),
              codigo_barras: String(item.CODIGO_BARRAS || ""),
              NumPaquete: Number(item.POSICION || 0),
              CodBarras: String(item.CODIGO_BARRAS || ""),
              codigoEmpleado: String(item.CODIGO_EMP || user?.code || ""),
            })
          );

        setFailedLabels(etiquetasFallidas);
      } catch (error) {
        setFailedLabels([]);

        if ((error as { status?: number })?.status === 404) {
          console.warn(
            "[PRINT ORDER] La consulta de etiquetas por orden no está disponible en el backend desplegado todavía."
          );
          setFailedLabelsQueryAvailable(false);
          return;
        }

        toast({
          title: "Error al consultar etiquetas fallidas",
          description:
            error instanceof Error
              ? error.message
              : "No se pudo consultar el estado de las etiquetas de la orden.",
          variant: "destructive",
        });
      } finally {
        setIsCheckingFailedLabels(false);
      }
    },
    [failedLabelsQueryAvailable, selectedOrder?.descripcionMaterial, toast, user?.code]
  );

  const handleReprintFailedLabels = useCallback(async () => {
    if (!selectedOrder || failedLabels.length === 0) {
      return;
    }

    setIsReprintingFailedLabels(true);
    const etiquetasRecuperadas: EtiquetaPendienteImpresion[] = [];
    const etiquetasSiguenFallidas: EtiquetaPendienteImpresion[] = [];
    let huboErrorDeEstado = false;

    try {
      for (const etiqueta of failedLabels) {
        const resultado = await imprimirEtiquetaPendiente(etiqueta);
        if (resultado.success) {
          etiquetasRecuperadas.push(etiqueta);
        } else {
          etiquetasSiguenFallidas.push(etiqueta);
          if (resultado.statusSyncFailed) {
            huboErrorDeEstado = true;
          }
        }
      }

      setFailedLabels(etiquetasSiguenFallidas);

      if (etiquetasRecuperadas.length > 0) {
        toast({
          title: "Reimpresión finalizada",
          description: `Se reimprimieron ${etiquetasRecuperadas.length} etiqueta(s) fallidas de la orden ${selectedOrder.orden}.`,
          variant: "default",
        });
      }

      const pendientes = etiquetasSiguenFallidas.length;
      if (pendientes > 0) {
        toast({
          title: "Persisten etiquetas fallidas",
          description: `${pendientes} etiqueta(s) continúan en estado F para la orden ${selectedOrder.orden}.`,
          variant: "destructive",
        });
      }

      if (huboErrorDeEstado) {
        setPrintErrorModal({
          open: true,
          message:
            "Al menos una etiqueta se imprimió, pero no se pudo confirmar su cambio de estado a T en la base de datos.",
        });
      }

      if (etiquetasSiguenFallidas.length > 0 || huboErrorDeEstado) {
        await consultarEtiquetasFallidasPorOrden(selectedOrder.orden);
      }

      if (activeSessions.length > 0) {
        await finishSession(true);
        await fetchActiveSessions();
      }
    } finally {
      setIsReprintingFailedLabels(false);
    }
  }, [
    activeSessions.length,
    consultarEtiquetasFallidasPorOrden,
    failedLabels,
    fetchActiveSessions,
    finishSession,
    selectedOrder,
    toast,
  ]);

  const handlePrintZPL = async (
    orden: string,
    paquete: string,
    unidades: string,
    descripcionMaterial: string,
    codigoBarras: string,
    codEmpleado: string,
  ) => {
    try {
      // Obtener IP de impresión desde sessionStorage
      const printerIPsStr = sessionStorage.getItem('IP_impresion');
      const printerIPs = printerIPsStr ? JSON.parse(printerIPsStr) : [];
      const printerIP = printerIPs.length > 0 ? printerIPs[0] : undefined;

      const response = await fetch("/api/zebra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            orden: orden,
            paquete: paquete,
            unidades: unidades,
            descripcionMaterial: descripcionMaterial,
            codigoBarras: codigoBarras,
            codigoEmpleado: codEmpleado,
            printerIP: printerIP, // Enviar IP al backend
          },
        ]),
      });
      
      const payload = await response.json().catch(() => null);
      
      if (!response.ok || !payload) {
        throw new Error(payload?.error || "Error al procesar la impresión");
      }

      // Si el backend imprimió en red, mostrar mensaje de éxito
      if (payload.success) {
        console.log(`[PRINT SUCCESS] ✅ Paquete #${paquete} impreso en red (${unidades} unidades)`);
        toast({
          title: "✅ Etiqueta Impresa",
          description: `Paquete #${paquete} enviado a imprimir\nOrden: ${orden} | Unidades: ${unidades}\nImpresora: ${payload.printer}`,
          duration: 4000,
          variant: "default",
        });
        return;
      }

      // Si el backend devolvió ZPL, usar BrowserPrint
      const zplCode =
        payload.zpl || payload.ZPL || payload.data?.zpl || payload.data || "";
      if (!zplCode || typeof zplCode !== "string") {
        throw new Error("La respuesta no contiene ZPL válido");
      }

      const bp = (window as any).BrowserPrint || window.Zebra?.BrowserPrint;
      if (!bp) {
        throw new Error("BrowserPrint no detectado. Verifica el servicio.");
      }

      await new Promise<void>((resolve, reject) => {
        bp.getDefaultDevice(
          "printer",
          (printer: any, err: any) => {
            if (err) {
              console.warn("[PRINT] Error getDefaultDevice:", err);
              reject(new Error("No se pudo obtener la impresora por defecto."));
              return;
            }
            if (!printer) {
              reject(new Error("No se encontró impresora por defecto."));
              return;
            }
            printer.send(
              zplCode,
              () => {
                console.log(`[PRINT SUCCESS] ✅ Paquete #${paquete} enviado a imprimir correctamente (${unidades} unidades)`);
                toast({
                  title: "✅ Etiqueta Impresa",
                  description: `Paquete #${paquete} enviado a imprimir\nOrden: ${orden} | Unidades: ${unidades}`,
                  duration: 4000,
                  variant: "default",
                });
                resolve();
              },
              (sendErr: any) => {
                console.warn(`[PRINT ERROR] Error al imprimir paquete #${paquete}:`, sendErr);
                reject(
                  new Error(
                    `Error al imprimir paquete #${paquete}: ${sendErr?.message || sendErr || "Error desconocido"}`
                  )
                );
              }
            );
          },
          (devErr: any) => {
            console.warn("[PRINT] Error callback impresora:", devErr);
            reject(new Error("Error al resolver la impresora"));
          }
        );
      });
    } catch (e: any) {
      console.warn("[PRINT] Error controlado:", e);
      toast({
        title: "❌ Error de Impresión",
        description: e?.message || "Error de impresión desconocido",
        duration: 5000,
        variant: "destructive",
      });
      throw e;
    }
  };

  // Utilidad: extraer letra y nombre limpio de una estación tipo EST-X-Nombre
  const extraerLetraYNombre = useCallback((estacion: string) => {
    const sinPrefijo = estacion.replace(/^EST-/, "");
    const letraMatch = sinPrefijo.match(/^([A-Z])-(.+)$/);
    let letra: string | null = null;
    let nombreLimpio = sinPrefijo;
    if (letraMatch) {
      letra = letraMatch[1];
      nombreLimpio = letraMatch[2];
    }
    return { letra, nombreLimpio };
  }, []);

  // userStation primero para poder derivar letter después
  const userStation = useMemo(() => {
    if (
      isUserContextLoading ||
      !user?.ip_address ||
      !estaciones ||
      estaciones.length === 0
    ) {
      return null;
    }
    return estaciones.find((e) => e.direccion_ip === user.ip_address);
  }, [user?.ip_address, estaciones, isUserContextLoading]);

  const stationLetter = useMemo(() => {
    if (userStation?.nombre_estacion?.includes("EST-")) {
      const { letra } = extraerLetraYNombre(userStation.nombre_estacion);
      return letra || null;
    }
    return null;
  }, [userStation]);

  const filterOrdersByStationLetter = useCallback(
    (ordersList: Order[]): Order[] => {
      let list = ordersList;
      if (stationLetter) {
        const letter = stationLetter;
        list = list.filter((order) => {
          const acol = (order.acolchadora || "").toString().toUpperCase();
          const maq = (order.maquina || "").toString().toUpperCase();
          const target = letter.toUpperCase();
          return (
            acol === target ||
            maq === target ||
            acol.includes(target) ||
            maq.includes(target)
          );
        });
      }
      const unique = list.filter(
        (order, idx, self) =>
          idx === self.findIndex((o) => o.orden === order.orden)
      );
      return unique;
    },
    [stationLetter]
  );

  const filterAndSetOrders = useCallback(
    (ordersList: Order[]) => {
      const filtered = filterOrdersByStationLetter(ordersList);
      setOrders(filtered);
      return filtered;
    },
    [filterOrdersByStationLetter, setOrders]
  );

  // (extraerLetraYNombre ya definido arriba)

  // Variable global para controlar la notificación SAP
  const NOTIFICA_SAP = !!userStation?.notifica;

  let resultado: { letra: string | null; nombreLimpio: string } | undefined;
  if (userStation?.nombre_estacion.includes("EST-")) {
    resultado = extraerLetraYNombre(userStation?.nombre_estacion || "");
  }

  // Efecto: filtrar automáticamente las órdenes cada vez que cambian las órdenes crudas o la estación
  useEffect(() => {
    const applyStationFilter = () => {
      if (!orders || orders.length === 0) {
        setDisplayedOrders([]);
        return;
      }
      if (
        !userStation?.nombre_estacion ||
        !userStation.nombre_estacion.includes("EST-")
      ) {
        // Sin filtro por letra
        setDisplayedOrders(orders);
        return;
      }
      const { letra } = extraerLetraYNombre(userStation.nombre_estacion);
      if (!letra) {
        setDisplayedOrders(orders);
        return;
      }
      const upperLetter = letra.toUpperCase();
      const filtered = orders.filter((o) => {
        const acol = (o.acolchadora || "").toString().toUpperCase();
        const maq = (o.maquina || "").toString().toUpperCase();
        // Coincidencia flexible: contiene la letra o la comienza
        return acol.includes(upperLetter) || maq.includes(upperLetter);
      });
      // Eliminar duplicados por número de orden
      const unique = filtered.filter(
        (o, i, self) => i === self.findIndex((p) => p.orden === o.orden)
      );
      setDisplayedOrders(unique);
    };
    applyStationFilter();
  }, [orders, userStation]);

  const activeSessionOfCurrentUser = useMemo(() => {
    if (!userStation || !user?.code) return undefined;
    return activeSessions.find(
      (s) =>
        s.codigo_estacion === userStation.codigo_estacion &&
        s.codigo_operador === user.code &&
        s.tipo_evento === "beg" &&
        s.estado === "A"
    );
  }, [userStation, activeSessions, user?.code]);

  const isAnySessionActive = activeSessions.length > 0;

  const userMachines = useMemo(() => {
    if (!user?.machine) return [];
    const machines = user.machine.split("&").map((m) => m.trim());
    // Eliminar duplicados manteniendo el orden
    return [...new Set(machines)];
  }, [user?.machine]);

  console.log("User Machines:", userMachines);

  const fetchOrders = useCallback(
    async (isInitialFetch = false, machineFilter?: string) => {
      if (isInitialFetch) setIsLoading(true);
      setError(null);
      if (!user || !user.resp_ctrl_prod) {
        setError("Falta información del usuario o responsable.");
        if (isInitialFetch) setIsLoading(false);
        filterAndSetOrders([]);
        return;
      }

      try {
        const machineToFetch =
          machineFilter === "all" ? user.machine : machineFilter;

        const params = {
          maquinas: machineToFetch || "",
          usuarios: user.resp_ctrl_prod || "",
        };

        const response = await servicioService.getOrdenesAlmohadas(params);

        let allOrders: Order[] = (response.data || []).map(
          (item: OrdenProduccion) => ({
            id: item.Orden,
            material: item.Material,
            orden: item.Orden,
            fecha: item.Fecha,
            descripcionMaterial: item.Nombre,
            cantProgramada: item.CantProgramada,
            cantNotificada: item.CantNotificada,
            cantPendiente: item.CantProgramada - item.CantNotificada,
            acolchadora: item.Estacion,
            resp_ctrl_prod: item.RespCtrlProd,
            maquina: item.Maquina,
          })
        );

        // Si la estación del usuario contiene 'EST-', filtra las órdenes por la letra
        let filteredOrders = allOrders;
        if (
          userStation?.nombre_estacion &&
          userStation.nombre_estacion.includes("EST-")
        ) {
          const { letra } = extraerLetraYNombre(userStation.nombre_estacion);
          if (letra) {
            filteredOrders = allOrders.filter(
              (order) =>
                typeof order.acolchadora === "string" &&
                order.acolchadora.includes(letra)
            );
          }
        }

        // Usar filteredOrders para la tabla y el resto del flujo
        const uniqueOrders = filteredOrders.filter(
          (order, index, self) =>
            index === self.findIndex((o) => o.orden === order.orden)
        );

        const notificationSums = new Map<string, number>();
        notificationHistoryAlmohadas.forEach((item) => {
          if (item.success && item.type === "Notificación") {
            notificationSums.set(
              item.order,
              (notificationSums.get(item.order) || 0) + item.quantity
            );
          }
        });

        const adjustedOrders = uniqueOrders.map((order) => {
          const notifiedInSession = notificationSums.get(order.orden) || 0;
          // Si el backend ya refleja lo notificado en memoria, solo usa el valor del backend
          if (
            notifiedInSession > 0 &&
            order.cantNotificada < notifiedInSession
          ) {
            const newNotified = order.cantNotificada + notifiedInSession;
            return {
              ...order,
              cantNotificada: newNotified,
              cantPendiente: order.cantProgramada - newNotified,
            };
          }
          // Si el backend ya refleja lo notificado, no sumes nada extra
          return {
            ...order,
            cantPendiente: order.cantProgramada - order.cantNotificada,
          };
        });

        const finalOrders = filterOrdersByStationLetter(adjustedOrders);
        setOrders(finalOrders);
        //console.log("Órdenes ajustadas:", adjustedOrders);
        const currentSelectedOrder = JSON.parse(
          localStorage.getItem("selectedOrder") || "null"
        );

        if (currentSelectedOrder) {
          const orderInNewList = adjustedOrders.find(
            (o) => o.orden === currentSelectedOrder.orden
          );
          if (orderInNewList) {
            if (
              JSON.stringify(selectedOrder) !== JSON.stringify(orderInNewList)
            ) {
              setSelectedOrder(orderInNewList);
            }
          } else {
            setSelectedOrder(null);
            localStorage.removeItem("selectedOrder");
          }
        } else if (adjustedOrders.length > 0) {
          setSelectedOrder(adjustedOrders[0]);
          localStorage.setItem(
            "selectedOrder",
            JSON.stringify(adjustedOrders[0])
          );
        } else {
          setSelectedOrder(null);
          localStorage.removeItem("selectedOrder");
        }
      } catch (e) {
        const errorMessage =
          e instanceof Error ? e.message : "Ocurrió un error desconocido";
        setError(errorMessage);
        if (isInitialFetch) {
          toast({
            title: "Error al cargar órdenes",
            description: errorMessage,
            variant: "destructive",
          });
          filterAndSetOrders([]);
        }
      } finally {
        if (isInitialFetch) setIsLoading(false);
      }
    },
    [user, toast, setOrders, notificationHistoryAlmohadas, selectedOrder]
  );

  useEffect(() => {
    setIsClient(true);
    try {
      const storedOrder = localStorage.getItem("selectedOrder");
      if (storedOrder) {
        setSelectedOrder(JSON.parse(storedOrder));
      }
    } catch (e) {
      console.error("Failed to parse selected order from localStorage", e);
      localStorage.removeItem("selectedOrder");
    }
  }, []);

  useEffect(() => {
    if (!isUserContextLoading && user?.code !== "admin") {
      fetchOrders(true, selectedMachine);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isUserContextLoading, selectedMachine]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isAnySessionActive) {
        event.preventDefault();
        event.returnValue =
          "Tiene una sesión de trabajo activa. ¿Está seguro de que queire salir?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isAnySessionActive]);

  // const handleOrderSelect = (order: Order | null) => {
  //   setSelectedOrder(order);
  //   if (order) {
  //     localStorage.setItem("selectedOrder", JSON.stringify(order));
  //   } else {
  //     localStorage.removeItem("selectedOrder");
  //   }
  // };

  const handleOrderSelect = (order: Order | null) => {
    if (activeSessionOfCurrentUser) {
      toast({
        title: "Cambio de orden bloqueado",
        description:
          "No puede cambiar de orden mientras el trabajo está iniciado.",
        variant: "destructive",
      });
      return;
    }
    // Validar si el campo acolchadora contiene solo letras A-Z antes de guardar la orden seleccionada
    if (
      order &&
      typeof order.acolchadora === "string" &&
      /^[A-Z]+$/.test(order.acolchadora)
    ) {
      const estacionesArray = parseEstaciones(order.acolchadora);
      // Puedes guardar estacionesArray en el estado/contexto si lo necesitas
      //console.log(estacionesArray);
    }
    setSelectedOrder(order);
    if (order) {
      localStorage.setItem("selectedOrder", JSON.stringify(order));
      consultarEtiquetasFallidasPorOrden(order.orden);
    } else {
      localStorage.removeItem("selectedOrder");
      setFailedLabels([]);
    }
  };

  // --- NUEVA FUNCIÓN CON LÓGICA SEPARADA PARA OPERADOR Y COLABORADORES ---
  const handleNotification = async (type: "notify" | "pnc") => {
    if (!selectedOrder) {
      toast({
        title: "Error",
        description: "Por favor, seleccione una orden.",
        variant: "destructive",
      });
      return;
    }

    // Función para procesar formato nXm (n impresiones de m cantidad cada una)
    const procesarFormatoNxM = (input: string): number[] => {
      const nxmRegex = /^(\d+)[xX*](\d+)$/;
      const match = input.match(nxmRegex);
      
      if (match) {
        const n = parseInt(match[1]); // número de impresiones
        const m = parseFloat(match[2]); // cantidad por etiqueta
        
        if (n > 0 && m > 0) {
          return Array(n).fill(m); // genera n elementos con valor m
        }
      }
      return [];
    };

    // Procesar las cantidades (soporte para + y formato nXm)
    let quantities: number[] = [];
    
    if (fabricatedQuantity.includes("+")) {
      // Modo actual: separadas por +
      quantities = fabricatedQuantity
        .split("+")
        .map((q) => q.trim())
        .filter((q) => q !== "")
        .flatMap((q) => {
          // Verificar si es formato nXm
          const nxmResult = procesarFormatoNxM(q);
          if (nxmResult.length > 0) {
            return nxmResult;
          }
          // Si no es nXm, procesarlo como número normal
          const num = parseFloat(q);
          return isNaN(num) || num <= 0 ? [] : [num];
        });
    } else {
      // Verificar si es formato nXm individual
      const nxmResult = procesarFormatoNxM(fabricatedQuantity.trim());
      if (nxmResult.length > 0) {
        quantities = nxmResult;
      } else {
        // Formato simple: una sola cantidad
        const singleQty = parseFloat(fabricatedQuantity);
        quantities = isNaN(singleQty) || singleQty <= 0 ? [] : [singleQty];
      }
    }

    if (
      !fabricatedQuantity ||
      quantities.length === 0 ||
      quantities.some((q) => isNaN(q) || q <= 0)
    ) {
      toast({
        title: "Error",
        description:
          "Por favor, ingrese cantidades válidas. Formatos soportados: '10', '10+20', '3x5' (3 etiquetas de 5 unidades), '2X10+5' (mezcla de formatos).",
        variant: "destructive",
      });
      return;
    }

    const totalToNotify = quantities.reduce((acc, q) => acc + q, 0);
    const totalNotificada = selectedOrder.cantNotificada + totalToNotify;
    if (
      (type === "notify" || type === "pnc") &&
      totalNotificada > selectedOrder.cantProgramada
    ) {
      toast({
        title: "Cantidad excedida",
        description: `No puede notificar más de lo programado (${selectedOrder.cantProgramada}).`,
        variant: "destructive",
      });
      return;
    }

    if (!user || !user.Centro) {
      toast({
        title: "Error de usuario",
        description:
          "No se pudo obtener la información completa del responsable, centro o máquina.",
        variant: "destructive",
      });
      return;
    }

    setIsNotifying(type === "notify");
    setIsPNC(type === "pnc");

    let sapResponse: NotificacionResponse | null = null;
    let sapMessage = "";
    let isSuccess = false;
    // Declarar errorMessages para que esté disponible en todo el bloque
    let errorMessages: any[] = [];
    try {
      const params = {
        centro: user.Centro.toString(),
        responsable: selectedOrder.resp_ctrl_prod.toString(),
        orden: selectedOrder.orden.toString(),
        cantidad: type === "notify" ? totalToNotify : 0,
        cantidad_rechazada: type === "pnc" ? totalToNotify : 0,
      };

      if (NOTIFICA_SAP && type === "pnc") {
        let respuestaSOAP = {
          LcOMsg: "Notificación grabada, movimientos mercancía , erróneos",
          LcOTrama: "00",
        };
        let respuesta: NotificacionResponse = {
          message: "Notificación enviada y log guardado exitosamente.",
          dataEnviada: { trama: "trama de prueba" },
          respuestaSOAP: respuestaSOAP,
        };
        sapResponse = respuesta;
        console.log("Respuesta de SAP", sapResponse);
        sapResponse = await notificacionSAPService.notificarOrden(params);

        sapMessage = "Respuesta desconocida de SAP.";
        if (
          sapResponse &&
          sapResponse.respuestaSOAP &&
          sapResponse.respuestaSOAP.LcOMsg
        ) {
          sapMessage = sapResponse.respuestaSOAP.LcOMsg;
          if (
            sapMessage.toLowerCase().includes("notificación grabada") ||
            sapMessage
              .toLowerCase()
              .includes(
                "Conversion failed when converting date and/or time from character string"
              )
          ) {
            isSuccess = true;
          }
        }
      } else {
        // No se notifica a SAP, pero el proceso local debe continuar
        const tramaFinal = JSON.stringify(params);
        sapResponse = {
          message: "Pre-Notificación a Productividad Exitosa.",
          dataEnviada: {
            trama: tramaFinal,
          },
          respuestaSOAP: {
            LcOMsg:
              "Pre-notificación grabada, SIN movimientos de mercancía en SAP.",
            LcOTrama: "No Aplica",
          },
        };
        sapMessage = sapResponse.respuestaSOAP.LcOMsg;
        isSuccess = true;
      }

      let mashine: string = "";
      if (userStation?.nombre_estacion.includes("EST-")) {
        mashine = extraerLetraYNombre(
          userStation?.nombre_estacion
        ).nombreLimpio;
      } else {
        mashine = userStation?.nombre_estacion ?? selectedOrder.maquina;
      }

      // Declarar etiquetasAImprimir fuera del bloque para que esté disponible después
      let etiquetasAImprimir: EtiquetaPendienteImpresion[] = [];
      let etiquetasImpresasOk: typeof etiquetasAImprimir = [];
      let totalImpresoOk = 0;
      let estadoSyncError = false;

      if (type === "notify" && isSuccess && !selectedOrder.maquina.includes('HR-ESP-')) {
        let anyError = false;
        let hadNonRetryableErrors = false;
        let errorMessages = [];
        etiquetasAImprimir = [];
        etiquetasImpresasOk = [];
        totalImpresoOk = 0;
        let etiquetasFallidas: EtiquetaPendienteImpresion[] = [];
        
        ///////////////////////////////////////////////////////////////////////////
        // IMPRESIÓN SECUENCIAL PARA MANTENER ORDEN DE PAQUETES
        ///////////////////////////////////////////////////////////////////////////
        
        for (let i = 0; i < quantities.length; i++) {
          const qty = quantities[i];
          try {
            console.log(`[PRINT ORDER] Procesando etiqueta ${i + 1}/${quantities.length} con cantidad: ${qty}`);
            
            const response = await servicioService.generarCodigoDeBarras(
              selectedOrder.orden,
              qty,
              user.code,
              collaborators.map((c) => c.code).join(";"),
              mashine
            );
            const res = response.data[0];
            
            if (res.NumPaquete !== -1) {
              const etiquetaGenerada = {
                orden: selectedOrder.orden,
                paquete: res.NumPaquete,
                unidades: qty,
                Material: selectedOrder.descripcionMaterial,
                codigo_barras: res.CodBarras,
                NumPaquete: res.NumPaquete,
                CodBarras: res.CodBarras,
                codigoEmpleado: user.code,
              };
              etiquetasAImprimir.push(etiquetaGenerada);
              
              console.log(`[PRINT ORDER] Etiqueta ${i + 1}: Paquete #${res.NumPaquete}, Cantidad: ${qty}`);

              const printResult = await imprimirEtiquetaPendiente(etiquetaGenerada);

              if (printResult.success) {
                etiquetasImpresasOk.push(etiquetaGenerada);
                totalImpresoOk += qty;
              } else {
                anyError = true;
                if (printResult.statusSyncFailed) {
                  estadoSyncError = true;
                }
                etiquetasFallidas.push(etiquetaGenerada);
                errorMessages.push({
                  Cantidad: qty,
                  Mensaje:
                    printResult.error instanceof Error
                      ? printResult.error.message
                      : `No se pudo imprimir el paquete #${res.NumPaquete} tras 2 intentos`,
                });
                toast({
                  title: "Error de impresión",
                  description: `Paquete #${res.NumPaquete} no se imprimió tras 2 intentos. Quedó marcado como F.`,
                  variant: "destructive",
                });
              }
            }
            // Validar respuesta del backend
            if (
              response &&
              response.data &&
              Array.isArray(response.data) &&
              response.data.length > 0 &&
              response.data[0].NumPaquete === -1
            ) {
              anyError = true;
              hadNonRetryableErrors = true;
              errorMessages.push(
                {'Cantidad': qty, 'Mensaje': response.data[0].CodBarras},
              );
              toast({
                title: "Error al registrar producción e imprimir etiqueta",
                description: `Cantidad: ${qty}: ${response.data[0].CodBarras}`,
                variant: "destructive",
              });
            }
          } catch (err) {
            anyError = true;
            hadNonRetryableErrors = true;
            errorMessages.push({'Cantidad': qty, 'Mensaje': err instanceof Error ? err.message : "Error desconocido"});
            toast({
              title:
                "Error inesperado al registrar producción e imprimir etiqueta",
              description: `Cantidad ${qty}: ${
                err instanceof Error ? err.message : "Error desconocido"
              }`,
              variant: "destructive",
            });
          }
        }
        if (etiquetasFallidas.length > 0 && typeof window !== "undefined") {
          const reintentarFallidas = window.confirm(
            `Fallaron ${etiquetasFallidas.length} etiqueta(s) y quedaron en estado F. ¿Desea volver a imprimir solo esas etiquetas?`
          );

          if (reintentarFallidas) {
            const etiquetasSiguenFallidas: EtiquetaPendienteImpresion[] = [];

            for (const etiquetaFallida of etiquetasFallidas) {
              const retryResult = await imprimirEtiquetaPendiente(etiquetaFallida);

              if (retryResult.success) {
                etiquetasImpresasOk.push(etiquetaFallida);
                totalImpresoOk += etiquetaFallida.unidades;
              } else {
                if (retryResult.statusSyncFailed) {
                  estadoSyncError = true;
                }
                etiquetasSiguenFallidas.push(etiquetaFallida);
              }
            }

            etiquetasFallidas = etiquetasSiguenFallidas;

            if (etiquetasFallidas.length === 0) {
              toast({
                title: "Reimpresión exitosa",
                description: "Las etiquetas fallidas se reimprimieron correctamente y quedaron confirmadas.",
                variant: "default",
              });
            } else {
              toast({
                title: "Persisten fallos de impresión",
                description: `${etiquetasFallidas.length} etiqueta(s) permanecen en estado F después del reintento manual.`,
                variant: "destructive",
              });
            }
          }
        }

        anyError = hadNonRetryableErrors || etiquetasFallidas.length > 0;

        if (etiquetasImpresasOk.length > 0) {
          const totalEtiquetas = etiquetasImpresasOk.length;
          const totalUnidades = totalImpresoOk;
          const tiempoTotalEstimado = Math.max(1, Math.ceil((totalEtiquetas * 3) / 60));
          
          toast({
            title: anyError ? "Impresión completada con incidencias" : "🖨️ Impresión secuencial completada",
            description: anyError
              ? `Se imprimieron ${totalEtiquetas} etiqueta(s) (${totalUnidades} unidades). Las fallidas no se registrarán en la base.`
              : `Se imprimieron ${totalEtiquetas} etiqueta(s) en orden secuencial (${totalUnidades} unidades total). Tiempo estimado: ~${tiempoTotalEstimado} min.`,
            variant: "default",
            duration: 8000,
          });
        } else if (anyError) {
          toast({
            title: "Errores al imprimir etiquetas",
            description: "Ninguna etiqueta se imprimió correctamente. No se registrará producción.",
            variant: "destructive",
          });
        }

        if (estadoSyncError) {
          setPrintErrorModal({
            open: true,
            message:
              "Hubo etiquetas cuyo estado no se pudo sincronizar con la base de datos. Revisa esos registros antes de reintentar la impresión.",
          });
        }
      }

      if (isSuccess) {
        const totalRegistrable =
          type === "notify" && !selectedOrder.maquina.includes('HR-ESP-')
            ? totalImpresoOk
            : totalToNotify;

        if (type === "notify" && totalRegistrable <= 0) {
          setPrintErrorModal({
            open: true,
            message: "No se registró producción porque ninguna etiqueta se imprimió correctamente. Las etiquetas fallidas se omitieron después de 2 intentos.",
          });
          return;
        }

        const isDecimal = totalRegistrable % 1 !== 0;
        const getEcuadorDateTime = () => {
          const now = new Date();
          const utcHours = now.getUTCHours();
          now.setUTCHours(utcHours - 5);
          const year = now.getUTCFullYear();
          const month = String(now.getUTCMonth() + 1).padStart(2, "0");
          const day = String(now.getUTCDate()).padStart(2, "0");
          const hours = String(now.getUTCHours()).padStart(2, "0");
          const minutes = String(now.getUTCMinutes()).padStart(2, "0");
          const seconds = String(now.getUTCSeconds()).padStart(2, "0");
          const date = `${year}-${month}-${day}`;
          const time = `${hours}:${minutes}:${seconds}`;
          return { date, time, ecuadorTime: now };
        };
        const getTurno = (hour: number): string =>
          hour >= 7 && hour < 19 ? "DIURNO" : "NOCTURNO";
        const { date, time, ecuadorTime } = getEcuadorDateTime();
        const turno = getTurno(ecuadorTime.getHours());

        ////////////////////////////////////////////////////// 1. Guardar operador principal

        let machineToSave = mashine;
        if (mashine.startsWith("HR-")) {
          machineToSave = mashine; // HR- para operador principal
        }
        const userCenter = user.Centro || "";
        const commonData = {
          CODIGO_EMP: user.code,
          UNIDADES_PROD: totalRegistrable,
          FECHA: date,
          HORA: time,
          TURNO: turno,
          CENTRO: userCenter,
          CODIGO: `${userCenter}${selectedOrder.orden}${user.code}${"0".repeat(
            16
          )}`,
          MAQUINA: machineToSave,
          ID: 0,
        };
        const userData = isDecimal
          ? ({
              ...commonData,
              NUM_ORDEN: selectedOrder.orden,
            } as OrdenEmpleadoDecimal)
          : ({
              ...commonData,
              NUM_ORDEN: selectedOrder.orden,
            } as OrdenEmpleado);

        if (isDecimal && type === "notify") {
          await ordenEmpleadoDecimalService.save(userData as OrdenEmpleadoDecimal);
        } else if (!isDecimal && type === "notify") {
          await ordenEmpleadoService.save(userData as OrdenEmpleado);
        } else if (type === "pnc") {
          await ordenEmpleadoPNCService.save(userData as OrdenEmpleado);
        }

        ///////////////////////////////////////////////////// 2. Guardar colaboradores
        for (const collaborator of collaborators) {
          let collaboratorMachine = mashine;
          if (mashine.startsWith("HR-")) {
            collaboratorMachine = mashine.replace(/^HR-/, "PT-");
          }
          const collaboratorCenter =
            "Centro" in collaborator ? collaborator.Centro : user.Centro || "";
          const collaboratorData = {
            CODIGO_EMP: collaborator.code,
            UNIDADES_PROD: totalRegistrable,
            FECHA: date,
            HORA: time,
            TURNO: turno,
            CENTRO: collaboratorCenter,
            CODIGO: `${collaboratorCenter}${selectedOrder.orden}${
              collaborator.code
            }${"0".repeat(16)}`,
            MAQUINA: collaboratorMachine,
            ID: 0,
            NUM_ORDEN: selectedOrder.orden,
          };
          if (isDecimal && type === "notify") {
            await ordenEmpleadoDecimalService.save(
              collaboratorData as OrdenEmpleadoDecimal
            );
          } else if (!isDecimal && type === "notify") {
            await ordenEmpleadoService.save(collaboratorData as OrdenEmpleado);
          } else if (type === "pnc") {
            await ordenEmpleadoPNCService.save(
              collaboratorData as OrdenEmpleado
            );
          }
        }

        //Procedemos a imprimir la etiqueta
        //Paso 1

        // Guardar log de la orden antes de cerrar sesiones (solo para el operador principal)
        const now = new Date();
        const fecha_log = now.toISOString();
        const cantidad_entregada = type === "notify" ? totalRegistrable : 0;
        const cantidad_rechazada = type === "pnc" ? totalToNotify : 0;
        const logData = {
          codigo_log: 0,
          orden_log: selectedOrder.orden,
          codigo_empleado: user.code,
          codigo_equipo: selectedOrder.maquina,
          fecha_log,
          cantidad_entregada,
          cantidad_rechazada,
          cantidad_reproceso: 0,
          orden_reproceso: "",
        };

        try {
          await logOrdenesService.save(logData);
        } catch (logError) {
          toast({
            title: "Error al guardar log de orden",
            description:
              logError instanceof Error
                ? logError.message
                : "No se pudo guardar el log de la orden.",
            variant: "destructive",
          });
        }

        // Cerrar sesión de todos los usuarios (operador y colaboradores)
        const allUsersToNotify = [user, ...collaborators];
        const cierrePromises = allUsersToNotify
          .map((currentUser) => {
            const userCodeToClose = currentUser.code;
            if (userCodeToClose) {
              return sesionService
                .cerrarSesionUsuario(userCodeToClose)
                .then((cierreResponse) => {
                  console.log(
                    `Respuesta de cierre de sesión para ${userCodeToClose}:`,
                    cierreResponse
                  );
                })
                .catch((cierreError) => {
                  const cierreErrorMessage =
                    cierreError instanceof Error
                      ? cierreError.message
                      : `Error inesperado al cerrar la sesión para ${userCodeToClose}.`;
                  console.error(
                    `Error al cerrar la sesión para ${userCodeToClose}:`,
                    cierreError
                  );
                  toast({
                    title: "Advertencia de Cierre de Sesión",
                    description: cierreErrorMessage,
                    variant: "destructive",
                  });
                  return null;
                });
            } else {
              console.warn(
                "Código de empleado no disponible para cerrar sesión en uno de los usuarios."
              );
              return null;
            }
          })
          .filter((promise) => promise !== null);
        await Promise.all(cierrePromises);


        for (const item of (type === "notify" ? etiquetasImpresasOk : etiquetasAImprimir)) {
          const newHistoryItem: AlmohadasNotificationHistoryItem = {
            timestamp: new Date().toLocaleTimeString("es-EC", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            }),
            type: type === "notify" ? "Notificación" : "PNC",
            order: selectedOrder.orden,
            barcode: item.CodBarras,
            quantity: item.unidades,
            message: sapMessage,
            success: true,
          };
      
          setLastNotification(newHistoryItem);
          addNotificationToHistoryAlmohadas(newHistoryItem);
        }
        setIsModalOpen(true);

        const updatedOrders = orders.map((o) => {
          if (o.orden === selectedOrder.orden) {
            const newNotified =
              o.cantNotificada + (type === "notify" ? totalRegistrable : 0);
            return {
              ...o,
              cantNotificada: newNotified,
              cantPendiente: o.cantProgramada - newNotified,
            };
          }
          return o;
        });

        filterAndSetOrders(updatedOrders);
        const newlySelectedOrder =
          updatedOrders.find((o) => o.orden === selectedOrder.orden) || null;
        setSelectedOrder(newlySelectedOrder);
        if (newlySelectedOrder) {
          localStorage.setItem(
            "selectedOrder",
            JSON.stringify(newlySelectedOrder)
          );
        } else {
          localStorage.removeItem("selectedOrder");
        }
      } else {
        toast({
          title: "Error en Notificación SAP",
          description: sapMessage,
          variant: "destructive",
        });

        for (const item of errorMessages) {
          const newHistoryItem: AlmohadasNotificationHistoryItem = {
            timestamp: new Date().toLocaleTimeString("es-EC", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            }),
            type: type === "notify" ? "Notificación" : "PNC",
            order: selectedOrder.orden,
            barcode: `Fallo al guardar`,
            quantity: item['Cantidad'],
            message: sapMessage,
            success: false,
          };
          addNotificationToHistoryAlmohadas(newHistoryItem);
        }
      }

      if (activeSessionOfCurrentUser) {
        await finishSession(true);
        await fetchActiveSessions();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Ocurrió un error inesperado.";
      toast({
        title: "Error en la notificación",
        description: errorMessage,
        variant: "destructive",
      });

      if (selectedOrder && fabricatedQuantity) {
        const fechaCorta = new Date().toLocaleDateString("es-EC", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
        });
        const newHistoryItem: AlmohadasNotificationHistoryItem = {
          timestamp: new Date().toLocaleTimeString("es-EC", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }),
          type: type === "notify" ? "Notificación" : "PNC",
          order: selectedOrder.orden,
          barcode: `Fallo al guardar`,
          quantity: parseFloat(fabricatedQuantity),
          message: errorMessage,
          success: false,
        };
        addNotificationToHistoryAlmohadas(newHistoryItem);
      }
    } finally {
      setIsNotifying(false);
      setIsPNC(false);
    }
  };

  const handleCloseModal = async () => {
    setIsModalOpen(false);
    setFabricatedQuantity("");
    setLastNotification(null);
    await fetchOrders(true, selectedMachine);
  };

  const userStationNameText = useMemo(() => {
    if (isUserContextLoading) {
      return "Cargando Estación...";
    }
    if (userStation) {
      return userStation.nombre_estacion;
    }
    return "Estación no encontrada para esta IP.";
  }, [userStation, isUserContextLoading]);

  const [zebraSDKLoaded, setZebraSDKLoaded] = useState<boolean>(false);
  const [browserPrintError, setBrowserPrintError] = useState<string | null>(
    null
  );

  useEffect(() => {
    const check = () => {
      if (typeof window === "undefined") return;
      // Si sólo existe BrowserPrint (var global) lo asignamos a Zebra para mantener compatibilidad
      if (!window.Zebra && (window as any).BrowserPrint) {
        window.Zebra = { BrowserPrint: (window as any).BrowserPrint };
      }
      const loaded = !!(window.Zebra && window.Zebra.BrowserPrint);
      setZebraSDKLoaded(loaded);
      if (loaded && browserPrintError) setBrowserPrintError(null);
    };
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [browserPrintError]);

  if (!isClient) {
    return null;
  }

  return (
    <>
      <Script
        src="/zebra/BrowserPrint-3.1.250.min.js"
        strategy="beforeInteractive"
        onLoad={() => {
          // Intentar exponer BrowserPrint como Zebra.BrowserPrint si aún no existe
          if (typeof window !== "undefined") {
            try {
              if (!window.Zebra && (window as any).BrowserPrint) {
                window.Zebra = { BrowserPrint: (window as any).BrowserPrint };
              }
              console.log(
                "✅ BrowserPrint script cargado. window.BrowserPrint =",
                typeof window.BrowserPrint
              );
            } catch (e) {
              console.warn("No se pudo inicializar Zebra wrapper", e);
            }
          }
        }}
        onError={(e) => {
          console.error("❌ Error cargando BrowserPrint", e);
          setBrowserPrintError("No se pudo cargar el script BrowserPrint");
        }}
      />
      {/* Modal de resumen de notificación
      <button className="back" onClick={handlePrintZPL}>
        Imprimir ZPL
      </button>
      */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="w-full flex flex-col gap-4">
          <OrdersTableAlmohadas
            orders={displayedOrders}
            isLoading={isLoading}
            error={error}
            onOrderSelect={handleOrderSelect}
            selectedOrderId={selectedOrder?.orden}
            onRefresh={() => fetchOrders(false, selectedMachine)}
            machines={userMachines}
            selectedMachine={selectedMachine}
            onMachineChange={setSelectedMachine}
            machineSelectDisabled={!!activeSessionOfCurrentUser}
            notificaSAP={NOTIFICA_SAP}
          />
          <div className="grid grid-cols-12 gap-6 items-start w-full">
            <div className="col-span-12 lg:col-span-8 flex flex-col gap-2 width-80">
              <SelectedOrderDisplayAlmohadas order={selectedOrder} />
              <Card className="shadow-lg">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="font-bold text-lg text-foreground flex items-center gap-2">
                      {userStation?.nombre_estacion.includes("EST-")
                        ? extraerLetraYNombre(userStation?.nombre_estacion)
                            .nombreLimpio
                        : userStationNameText}
                      {/* Indicador de impresora de red */}
                      {printerIPs.length > 0 && (
                        <span className="inline-flex items-center gap-0.5" title={`Impresora de red configurada: ${printerIPs.join(', ')}`}>
                          <Printer className="h-5 w-5 text-green-600" />
                          <ArrowUpDown className="h-3 w-3 text-green-600 -ml-1" />
                        </span>
                      )}
                    </p>
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2 bg-[#0055b8] rounded-sm">
                        <Label
                          htmlFor="fabricatedQuantity"
                          className="font-semibold text-foreground text-white px-[5px]"
                        >
                          Cantidad
                        </Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          id="fabricatedQuantity"
                          value={fabricatedQuantity}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Permite escribir números, +, x, X, * mientras se escribe
                            // Estados intermedios permitidos: "3", "3+", "3x", "10+2", etc.
                            const regex = /^[\d+xX*]*$/;
                            if (val === "" || regex.test(val)) {
                              setFabricatedQuantity(val);
                            }
                          }}
                          className="w-34 h-12 text-center text-lg font-bold p-5"
                          placeholder="10 o 3x5 o 10+20"
                          disabled={isNotifying || isPNC || !selectedOrder}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground text-center">
                        <span>Formatos: 10 (simple) | 3x5 (3 etiquetas x 5 unidades) | 10+20 (suma)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedOrder && failedLabels.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          className="font-bold h-12 text-base px-6 border-amber-500 text-amber-700 hover:bg-amber-50"
                          onClick={handleReprintFailedLabels}
                          disabled={
                            isNotifying ||
                            isPNC ||
                            isReprintingFailedLabels ||
                            isCheckingFailedLabels
                          }
                        >
                          {isReprintingFailedLabels
                            ? "Reimprimiendo fallidas..."
                            : `REIMPRIMIR FALLIDAS (${failedLabels.length})`}
                        </Button>
                      )}
                      <Button
                        size="lg"
                        className="bg-green-600 hover:bg-green-700 text-white font-bold h-12 text-base px-6"
                        onClick={() => handleNotification("notify")}
                        disabled={
                          isNotifying ||
                          isPNC ||
                          !selectedOrder ||
                          !activeSessionOfCurrentUser
                        }
                      >
                        {isNotifying ? "Pre - Notificando..." : "PRE-NOTIFICAR"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="lg"
                        className="font-bold h-12 text-base px-6"
                        onClick={() => handleNotification("pnc")}
                        disabled={
                          isNotifying ||
                          isPNC ||
                          !selectedOrder ||
                          !!activeSessionOfCurrentUser
                        }
                      >
                        {isPNC ? "Enviando..." : "PNC"}
                        <span className="text-xs font-normal ml-1">
                          (Producto no conforme)
                        </span>
                      </Button>
                    </div>
                  </div>
                  {selectedOrder && !isCheckingFailedLabels && failedLabels.length === 0 && (
                    <div className="mt-3 text-sm text-muted-foreground">
                      No hay etiquetas fallidas pendientes para esta orden.
                    </div>
                  )}
                  {selectedOrder && isCheckingFailedLabels && (
                    <div className="mt-3 text-sm text-muted-foreground">
                      Consultando etiquetas fallidas de la orden seleccionada...
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            {selectedOrder && (
              <div className="col-span-12 lg:col-span-4 flex flex-col h-full">
                <div className="flex-1 flex">
                  <OrderSticker
                    order={selectedOrder}
                    className="w-full h-full"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {notificationHistoryAlmohadas.length > 0 && (
        <Card className="shadow-lg mt-1">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-primary flex items-center">
              <History className="mr-2 h-5 w-5" />
              Historial de Notificaciones Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 w-full pr-4">
              <div className="space-y-3">
                {notificationHistoryAlmohadas.map((item, index) => (
                  <div
                    key={index}
                    className="p-3 bg-muted/50 rounded-lg text-sm flex items-start gap-4"
                  >
                    <div className="flex-shrink-0 mt-1">
                      {item.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                    <div className="flex-grow grid grid-cols-5 gap-x-5 items-center">
                      <div className="font-semibold">
                        <p className="text-xs text-muted-foreground">Acción</p>
                        <p
                          className={`font-bold ${
                            item.type === "PNC"
                              ? "text-destructive"
                              : "text-foreground"
                          }`}
                        >
                          {item.type}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Hora</p>
                        <p>{item.timestamp}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Orden</p>
                        <p>{item.order}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Código de Barras
                        </p>
                        <p className="text-[10px]">
                          {item.barcode !== "Fallo al guardar"
                            ? item.barcode
                            : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Cantidad
                        </p>
                        <p className="font-bold">{item.quantity.toFixed(2)}</p>
                      </div>
                      <div className="col-span-4 text-xs text-muted-foreground font-mono mt-1">
                        <p>
                          <strong>Respuesta:</strong> {item.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
      <AlertDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <AlertDialogContent className="data-[state=closed]:animate-out data-[state=closed]:zoom-out-90 data-[state=closed]:slide-out-to-top-[25%]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
              Notificación Exitosa
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se ha procesado la siguiente operación:
            </AlertDialogDescription>
          </AlertDialogHeader>
          {lastNotification && (
            <div className="my-4 p-4 bg-muted rounded-lg space-y-2 text-sm text-foreground">
              <div className="flex justify-between">
                <span className="font-semibold">Acción:</span>
                <span
                  className={`font-bold ${
                    lastNotification.type === "PNC" ? "text-destructive" : ""
                  }`}
                >
                  {lastNotification.type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Orden:</span>
                <span>{lastNotification.order}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Cantidad:</span>
                <span className="font-bold">
                  {lastNotification.quantity.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Hora:</span>
                <span>{lastNotification.timestamp}</span>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleCloseModal}>
              Aceptar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CollaboratorLoginModal
        isOpen={isLoginModalOpen}
        onOpenChange={setLoginModalOpen}
      />

      <AlertDialog
        open={printErrorModal.open}
        onOpenChange={(open) =>
          setPrintErrorModal({ ...printErrorModal, open })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-destructive" />
              Error al Imprimir
            </AlertDialogTitle>
            <AlertDialogDescription>
              No se pudo completar la impresión de la etiqueta de prueba.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 p-4 bg-destructive/10 rounded-lg">
            <p className="text-sm text-foreground font-mono">
              {printErrorModal.message}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setPrintErrorModal({ open: false, message: "" })}
            >
              Cerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Indicador de estado del SDK Zebra */}
      <div
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 4,
        }}
      >
        <span
          title={
            zebraSDKLoaded
              ? "BrowserPrint listo"
              : browserPrintError || "BrowserPrint NO detectado"
          }
          style={{
            display: "inline-block",
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: zebraSDKLoaded ? "#16a34a" : "#dc2626",
            border: "2px solid #fff",
            boxShadow: "0 0 4px rgba(0,0,0,0.25)",
          }}
        />
        {!zebraSDKLoaded && (
          <span
            style={{
              fontSize: 10,
              color: "#dc2626",
              fontFamily: "monospace",
              background: "rgba(255,255,255,0.75)",
              padding: "2px 4px",
              borderRadius: 4,
            }}
          >
            {browserPrintError ? "Error script" : "No detectado"}
          </span>
        )}
      </div>
    </>
  );
}

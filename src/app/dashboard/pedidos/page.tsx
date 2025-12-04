"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import OrdersTable from "@/components/orders-table";
import SelectedOrderDisplay from "@/components/selected-order-display";
import type { Order } from "@/types/order";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/context/user-context";
import type { NotificationHistoryItem } from "@/context/user-context";
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
import { History, CheckCircle, XCircle, TriangleAlert } from "lucide-react";
import { servicioService } from "@/services/servicio.service";
import type {
  OrdenProduccion,
  OrdenEmpleado,
  OrdenEmpleadoDecimal,
} from "@/types/interfaces";
import CollaboratorLoginModal from "./components/collaborator-login-modal";
import { ordenEmpleadoService } from "@/services/ordenEmpleado.service";
import { ordenEmpleadoDecimalService } from "@/services/ordenEmpleadoDecimal.service";
import { sesionService } from "@/services/sesion.service";
import { logOrdenesService } from "@/services/logOrdenesService";
import { json } from "stream/consumers";
import { unique } from "next/dist/build/utils";

export default function PedidosPage() {
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
    notificationHistoryPedidos,
    addNotificationToHistoryPedidos,
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
        (order, idx, self) => idx === self.findIndex((o) => o.orden === order.orden)
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
      if (!userStation?.nombre_estacion || !userStation.nombre_estacion.includes("EST-")) {
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
      const filtered = orders.filter(o => {
        const acol = (o.acolchadora || "").toString().toUpperCase();
        const maq = (o.maquina || "").toString().toUpperCase();
        // Coincidencia flexible: contiene la letra o la comienza
        return acol.includes(upperLetter) || maq.includes(upperLetter);
      });
      // Eliminar duplicados por número de orden
      const unique = filtered.filter((o,i,self)=> i === self.findIndex(p=>p.orden === o.orden));
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

        const response = await servicioService.getOrdenes(params);

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
        notificationHistoryPedidos.forEach((item) => {
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
    [user, toast, setOrders, notificationHistoryPedidos, selectedOrder]
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
    } else {
      localStorage.removeItem("selectedOrder");
    }
  };


  // --- FUNCIÓN ORIGINAL ---
  /*
  const handleNotification = async (type: "notify" | "pnc") => {
    if (!selectedOrder) {
      toast({
        title: "Error",
        description: "Por favor, seleccione una orden.",
        variant: "destructive",
      });
      return;
    }

    const quantity = parseFloat(fabricatedQuantity);
    if (!fabricatedQuantity || isNaN(quantity) || quantity <= 0) {
      toast({
        title: "Error",
        description: "Por favor, ingrese una cantidad válida y positiva.",
        variant: "destructive",
      });
      return;
    }

    // Control para no notificar más de lo programado
    const totalNotificada = selectedOrder.cantNotificada + quantity;
    if (type === "notify" && totalNotificada > selectedOrder.cantProgramada) {
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
    try {
      const params = {
        centro: user.Centro.toString(),
        responsable: selectedOrder.resp_ctrl_prod.toString(),
        orden: selectedOrder.orden.toString(),
        cantidad: type === "notify" ? quantity : 0,
        cantidad_rechazada: type === "pnc" ? quantity : 0,
      };

      if (NOTIFICA_SAP) {
        sapResponse = await notificacionSAPService.notificarOrden(params);
        //console.log("Respuesta de SAP", sapResponse);
        sapMessage = "Respuesta desconocida de SAP.";
        if (
          sapResponse &&
          sapResponse.respuestaSOAP &&
          sapResponse.respuestaSOAP.LcOMsg
        ) {
          sapMessage = sapResponse.respuestaSOAP.LcOMsg;
          if (sapMessage.toLowerCase().includes("notificación grabada")) {
            isSuccess = true;
          }
        }
      } else {
        // No se notifica a SAP, pero el proceso local debe continuar
        const tramaFinal = JSON.stringify(params);
        sapResponse = {
          message: "Notificación a Productividad Exitosa.",
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

      if (isSuccess) {
        const allUsersToNotify = [user, ...collaborators];
        const isDecimal = quantity % 1 !== 0;
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
        let mashine: string = "";
        if (userStation?.nombre_estacion.includes("EST-")) {
          mashine = extraerLetraYNombre(
            userStation?.nombre_estacion
          ).nombreLimpio;
        } else {
          mashine = userStation?.nombre_estacion ?? selectedOrder.maquina;
        }
        const dataToSend = allUsersToNotify.map((currentUser) => {
          const userCode = currentUser.code;
          const userCenter =
            "Centro" in currentUser ? currentUser.Centro : user.Centro || "";
          const commonData = {
            CODIGO_EMP: userCode,
            UNIDADES_PROD: quantity,
            FECHA: date,
            HORA: time,
            TURNO: turno,
            CENTRO: userCenter,
            CODIGO: `${userCenter || ""}${
              selectedOrder.orden
            }${userCode}${"0".repeat(16)}`,
            MAQUINA: mashine,
            ID: 0,
          };
          return isDecimal
            ? ({
                ...commonData,
                NUM_ORDEN: selectedOrder.orden,
              } as OrdenEmpleadoDecimal)
            : ({
                ...commonData,
                NUM_ORDEN: selectedOrder.orden,
              } as OrdenEmpleado);
        });

        try {
          const promises = dataToSend.map((data) =>
            isDecimal
              ? ordenEmpleadoDecimalService.save(data as OrdenEmpleadoDecimal)
              : ordenEmpleadoService.save(data as OrdenEmpleado)
          );
          await Promise.all(promises);

          // Guardar log de la orden antes de cerrar sesiones
          const now = new Date();
          const fecha_log = now.toISOString();
          const cantidad_entregada = type === "notify" ? quantity : 0;
          const cantidad_rechazada = type === "pnc" ? quantity : 0;
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
        } catch (e) {
          const localSaveError =
            e instanceof Error
              ? e.message
              : "Error inesperado al guardar localmente.";
          console.error("Error saving employee order:", e);
          toast({
            title: "Advertencia de Guardado Local",
            description: localSaveError,
            variant: "destructive",
          });
        }

        const newHistoryItem: NotificationHistoryItem = {
          timestamp: new Date().toLocaleTimeString("es-EC", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }),
          type: type === "notify" ? "Notificación" : "PNC",
          order: selectedOrder.orden,
          quantity: quantity,
          message: sapMessage,
          success: true,
        };

        setLastNotification(newHistoryItem);
        addNotificationToHistory(newHistoryItem);
        setIsModalOpen(true);

        const updatedOrders = orders.map((o) => {
          if (o.orden === selectedOrder.orden) {
            const newNotified =
              o.cantNotificada + (type === "notify" ? quantity : 0);
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

        const newHistoryItem: NotificationHistoryItem = {
          timestamp: new Date().toLocaleTimeString("es-EC", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }),
          type: type === "notify" ? "Notificación" : "PNC",
          order: selectedOrder.orden,
          quantity: quantity,
          message: sapMessage,
          success: false,
        };
        addNotificationToHistory(newHistoryItem);
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
        const newHistoryItem: NotificationHistoryItem = {
          timestamp: new Date().toLocaleTimeString("es-EC", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }),
          type: type === "notify" ? "Notificación" : "PNC",
          order: selectedOrder.orden,
          quantity: parseFloat(fabricatedQuantity),
          message: errorMessage,
          success: false,
        };
        addNotificationToHistory(newHistoryItem);
      }
    } finally {
      setIsNotifying(false);
      setIsPNC(false);
    }
  };
  */

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

    const quantity = parseFloat(fabricatedQuantity);
    if (!fabricatedQuantity || isNaN(quantity) || quantity <= 0) {
      toast({
        title: "Error",
        description: "Por favor, ingrese una cantidad válida y positiva.",
        variant: "destructive",
      });
      return;
    }

    // Control para no notificar más de lo programado
    const totalNotificada = selectedOrder.cantNotificada + quantity;
    if (type === "notify" && totalNotificada > selectedOrder.cantProgramada) {
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
    try {
      const params = {
        centro: user.Centro.toString(),
        responsable: selectedOrder.resp_ctrl_prod.toString(),
        orden: selectedOrder.orden.toString(),
        cantidad: type === "notify" ? quantity : 0,
        cantidad_rechazada: type === "pnc" ? quantity : 0,
      };

      if (NOTIFICA_SAP) {
        sapResponse = await notificacionSAPService.notificarOrden(params);
        sapMessage = "Respuesta desconocida de SAP.";
        if (
          sapResponse &&
          sapResponse.respuestaSOAP &&
          sapResponse.respuestaSOAP.LcOMsg
        ) {
          sapMessage = sapResponse.respuestaSOAP.LcOMsg;
          if (sapMessage.toLowerCase().includes("notificación grabada") || sapMessage.toLowerCase().includes("Conversion failed when converting date and/or time from character string")) {
            isSuccess = true;
          }
        }
      } else {
        // No se notifica a SAP, pero el proceso local debe continuar
        const tramaFinal = JSON.stringify(params);
        sapResponse = {
          message: "Notificación a Productividad Exitosa.",
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

      if (isSuccess) {
        const isDecimal = quantity % 1 !== 0;
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
        let mashine: string = "";
        if (userStation?.nombre_estacion.includes("EST-")) {
          mashine = extraerLetraYNombre(
            userStation?.nombre_estacion
          ).nombreLimpio;
        } else {
          mashine = userStation?.nombre_estacion ?? selectedOrder.maquina;
        }

        // 1. Guardar operador principal
        let machineToSave = mashine;
        if (mashine.startsWith("HR-")) {
          machineToSave = mashine; // HR- para operador principal
        }
        const userCenter = user.Centro || "";
        const commonData = {
          CODIGO_EMP: user.code,
          UNIDADES_PROD: quantity,
          FECHA: date,
          HORA: time,
          TURNO: turno,
          CENTRO: userCenter,
          CODIGO: `${userCenter}${selectedOrder.orden}${user.code}${"0".repeat(16)}`,
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

        if (isDecimal) {
          await ordenEmpleadoDecimalService.save(userData as OrdenEmpleadoDecimal);
        } else {
          await ordenEmpleadoService.save(userData as OrdenEmpleado);
        }

        // 2. Guardar colaboradores
        for (const collaborator of collaborators) {
          let collaboratorMachine = mashine;
          if (mashine.startsWith("HR-")) {
            collaboratorMachine = mashine.replace(/^HR-/, "PT-");
          }
          const collaboratorCenter =
            "Centro" in collaborator ? collaborator.Centro : user.Centro || "";
          const collaboratorData = {
            CODIGO_EMP: collaborator.code,
            UNIDADES_PROD: quantity,
            FECHA: date,
            HORA: time,
            TURNO: turno,
            CENTRO: collaboratorCenter,
            CODIGO: `${collaboratorCenter}${selectedOrder.orden}${collaborator.code}${"0".repeat(16)}`,
            MAQUINA: collaboratorMachine,
            ID: 0,
            NUM_ORDEN: selectedOrder.orden,
          };
          if (isDecimal) {
            await ordenEmpleadoDecimalService.save(
              collaboratorData as OrdenEmpleadoDecimal
            );
          } else {
            await ordenEmpleadoService.save(collaboratorData as OrdenEmpleado);
          }
        }

        // Guardar log de la orden antes de cerrar sesiones (solo para el operador principal)
        const now = new Date();
        const fecha_log = now.toISOString();
        const cantidad_entregada = type === "notify" ? quantity : 0;
        const cantidad_rechazada = type === "pnc" ? quantity : 0;
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

        const newHistoryItem: NotificationHistoryItem = {
          timestamp: new Date().toLocaleTimeString("es-EC", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }),
          type: type === "notify" ? "Notificación" : "PNC",
          order: selectedOrder.orden,
          quantity: quantity,
          message: sapMessage,
          success: true,
        };

        setLastNotification(newHistoryItem);
        addNotificationToHistoryPedidos(newHistoryItem);
        setIsModalOpen(true);

        const updatedOrders = orders.map((o) => {
          if (o.orden === selectedOrder.orden) {
            const newNotified =
              o.cantNotificada + (type === "notify" ? quantity : 0);
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

        const newHistoryItem: NotificationHistoryItem = {
          timestamp: new Date().toLocaleTimeString("es-EC", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }),
          type: type === "notify" ? "Notificación" : "PNC",
          order: selectedOrder.orden,
          quantity: quantity,
          message: sapMessage,
          success: false,
        };
        addNotificationToHistoryPedidos(newHistoryItem);
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
        const newHistoryItem: NotificationHistoryItem = {
          timestamp: new Date().toLocaleTimeString("es-EC", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }),
          type: type === "notify" ? "Notificación" : "PNC",
          order: selectedOrder.orden,
          quantity: parseFloat(fabricatedQuantity),
          message: errorMessage,
          success: false,
        };
        addNotificationToHistoryPedidos(newHistoryItem);
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

  if (!isClient) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col h-full gap-4 m-px">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="w-full flex flex-col gap-4">
            <OrdersTable
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
            <SelectedOrderDisplay order={selectedOrder} />
          </div>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="font-bold text-lg text-foreground">
                {userStation?.nombre_estacion.includes("EST-")
                  ? extraerLetraYNombre(userStation?.nombre_estacion)
                      .nombreLimpio
                  : userStationNameText}
              </p>
              <div className="flex items-center gap-2 gap-2 bg-[#0055b8] rounded-sm">
                <Label
                  htmlFor="fabricatedQuantity"
                  className="font-semibold text-foreground text-white px-[5px]"
                >
                  Cantidad
                </Label>
                {/* <Input
                  type="number"
                  id="fabricatedQuantity"
                  value={fabricatedQuantity}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || /^[0-9]*$/.test(val)) {
                      setFabricatedQuantity(val);
                    }
                  }}
                  className="w-24 h-12 text-center text-lg font-bold"
                  placeholder="0"
                  disabled={
                    isNotifying ||
                    isPNC ||
                    !selectedOrder ||
                    !activeSessionOfCurrentUser
                  }
                /> */}

                <Input
                  type="text"
                  inputMode="decimal"
                  id="fabricatedQuantity"
                  value={fabricatedQuantity}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Nueva expresión regular: permite hasta dos decimales.
                    if (val === "" || /^\d*(\.\d{0,2})?$/.test(val)) {
                      setFabricatedQuantity(val);
                    }
                  }}
                  className="w-24 h-12 text-center text-lg font-bold p-5"
                  placeholder="0"
                  disabled={
                    isNotifying ||
                    isPNC ||
                    !selectedOrder ||
                    !activeSessionOfCurrentUser
                  }
                />
              </div>
              <div className="flex items-center gap-2">
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
                  {isNotifying ? "Notificando..." : "NOTIFICAR"}
                </Button>
                {/* <Button
                  variant="destructive"
                  size="lg"
                  className="font-bold h-12 text-base px-6"
                  onClick={() => handleNotification("pnc")}
                  disabled={
                    isNotifying ||
                    isPNC ||
                    !selectedOrder ||
                    !activeSessionOfCurrentUser
                  }
                >
                  {isPNC ? "Enviando..." : "PNC"}
                  <span className="text-xs font-normal ml-1">
                    (Producto no conforme)
                  </span>
                </Button> */}
              </div>
            </div>
          </CardContent>
        </Card>

        {notificationHistoryPedidos.length > 0 && (
          <Card className="shadow-lg mt-4">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-primary flex items-center">
                <History className="mr-2 h-5 w-5" />
                Historial de Notificaciones Recientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48 w-full pr-4">
                <div className="space-y-3">
                  {notificationHistoryPedidos.map((item, index) => (
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
                      <div className="flex-grow grid grid-cols-4 gap-x-4 gap-y-1 items-center">
                        <div className="font-semibold">
                          <p className="text-xs text-muted-foreground">
                            Acción
                          </p>
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
                            Cantidad
                          </p>
                          <p className="font-bold">
                            {item.quantity.toFixed(2)}
                          </p>
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
      </div>

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
    </>
  );
}

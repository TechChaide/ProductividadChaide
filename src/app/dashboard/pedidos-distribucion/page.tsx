"use client";
import { json } from "stream/consumers";
import { unique } from "next/dist/build/utils";
import OrderSticker from "./components/order-sticker";
import { stringify } from "querystring";
import { set } from "date-fns";
import SelectedOrderDisplayEmpty from "@/components/selected-order-display-empty";
import { Separator } from "@radix-ui/react-separator";
import {
  AlmohadasNotificationHistoryItem,
  AlmohadasNotificationHistoryPistoleadoItem,
  NotificationHistoryItem,
  useUser,
} from "@/context/user-context";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRef } from "react";
import { Order, OrderAlmohadas } from "@/types/order";
import { useToast } from "@/hooks/use-toast";
import {
  NotificacionResponse,
  notificacionSAPService,
} from "@/services/notificacionSAP.service";
import { servicioService } from "@/services/servicio.service";
import {
  OrdenEmpleado,
  OrdenEmpleadoDecimal,
  OrdenProduccion,
} from "@/types/interfaces";
import { ordenEmpleadoPNCService } from "@/services/ordenEmpleadoPNC.service";
import { ordenEmpleadoDecimalService } from "@/services/ordenEmpleadoDecimal.service";
import { ordenEmpleadoService } from "@/services/ordenEmpleado.service";
import { sesionService } from "@/services/sesion.service";
import Image from "next/image";
import {
  Barcode,
  QrCode,
  ScanBarcode,
  ScanQrCode,
  Tag,
  Tags,
  History,
  CheckCircle,
  XCircle,
  Printer,
  ArrowUpDown,
} from "lucide-react";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import {
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialog,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CollaboratorLoginModal from "./components/collaborator-login-modal";
import { logOrdenesService } from "@/services/logOrdenesService";
import { usePrinterIPs } from "@/hooks/usePrinterIPs";

export default function PedidosDistribucionPage() {
  // Cargar IPs de impresión automáticamente al abrir la página
  const { printerIPs, isLoading: isPrinterIPsLoading } = usePrinterIPs();
  
  // Ref para el input de código de barras
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Efecto para mantener el foco en el input
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  });
  // Estado para el modal flotante de OrderSticker
  const [expandedStickerOrder, setExpandedStickerOrder] =
    useState<OrderAlmohadas | null>(null);
  const [expandedStickerBarcode, setExpandedStickerBarcode] =
    useState<string>("");
  const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);
  // Obtener parseEstaciones y demás del contexto al inicio del componente
  const { parseEstaciones } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [fabricatedQuantity, setFabricatedQuantity] = useState("");
  const [isNotifying, setIsNotifying] = useState(false);
  const [isPNC, setIsPNC] = useState(false);
  // Estado para el input de código de barras
  const [barcodeInput, setBarcodeInput] = useState("");
  // Estado para bloquear el escaneo durante procesamiento
  const [isProcessingLabel, setIsProcessingLabel] = useState(false);
  
  // Cola de etiquetas pendientes de procesar (ahora agrupadas por orden)
  const [labelQueue, setLabelQueue] = useState<any[]>([]);
  const isProcessingQueueRef = useRef(false);
  const queueTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Evita que dos "processNext" corran en paralelo
  const queueProcessLockRef = useRef(false);
  
  // Tracking de etiqueta actualmente en proceso (evitar duplicados)
  const currentProcessingBarcodeRef = useRef<string | null>(null);
  
  // Timeout de seguridad para liberar el bloqueo si algo falla (15 segundos)
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Diccionario para agrupar etiquetas por orden antes de notificar
  const orderGroupTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Función para agregar guión medio después del octavo carácter si falta
  const agregarGuionSiNecesario = (codigo: string): string => {
    // Si ya contiene guión, no hacer nada
    if (codigo.includes('-')) {
      return codigo;
    }
    
    // Si tiene al menos 9 caracteres y son todos números, agregar guión después del 8vo
    if (codigo.length >= 9 && /^\d+$/.test(codigo)) {
      const corregido = codigo.substring(0, 8) + '-' + codigo.substring(8);
      console.log(`[BARCODE FIX] Agregando guión: "${codigo}" → "${corregido}"`);
      return corregido;
    }
    
    // Si no cumple criterios, devolver original
    return codigo;
  };

  // Expresión regular: formato [0-9]*-[0-9]* (números-guión-números)
  const barcodeRegex = /^[0-9]*-?[0-9]*$/;
  const {
    user,
    notificationHistoryPistoleado,
    addNotificationToHistoryPistoleado,
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

  // Estado para la información de la etiqueta leída
  const [scannedLabel, setScannedLabel] = useState<any | null>(null);

  // Estado para el modal de pistoleado con agrupación por orden
  const [isPistoleoModalOpen, setIsPistoleoModalOpen] = useState(false);
  const [pistoleoData, setPistoleoData] = useState<{
    [orderNumber: string]: {
      etiquetas: any[];
      validas: number;
      invalidas: number;
      yaProcesadas: number;
    };
  }>({});

  // Calcular estadísticas globales
  const estadisticasGlobales = useMemo(() => {
    let totalValidas = 0;
    let totalYaProcesadas = 0;
    let totalInvalidas = 0;
    let totalEtiquetas = 0;
    let ordenesConEtiquetas = 0;

    Object.values(pistoleoData).forEach(orderData => {
      totalValidas += orderData.etiquetas.filter(e => e.estado === "valida").length;
      totalYaProcesadas += orderData.etiquetas.filter(e => e.estado === "yaProcesada").length;
      totalInvalidas += orderData.etiquetas.filter(e => e.estado === "invalida").length;
      totalEtiquetas += orderData.etiquetas.length;
      if (orderData.etiquetas.length > 0) ordenesConEtiquetas++;
    });

    return {
      totalValidas,
      totalYaProcesadas,
      totalInvalidas,
      totalEtiquetas,
      ordenesConEtiquetas
    };
  }, [pistoleoData]);

  // Función para detectar si el usuario está en un dispositivo móvil/tablet
  const isMobileOrTablet = () => {
    if (typeof window === 'undefined') return false;
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    return /android|iPad|iPhone|iPod/i.test(userAgent);
  };

  // Función para imprimir directamente a impresora de red (192.168.205.47)
  // Compatible con PC (BrowserPrint) y Tablets (API endpoint)
  const handlePrintToNetworkPrinter = async (
    orden: string,
    paquete: string,
    unidades: string,
    descripcionMaterial: string,
    codigoBarras: string,
    codEmpleado: string
  ) => {
    try {
      console.log('[NETWORK PRINT] Iniciando impresión en red...');
      const PRINTER_IP = '192.168.205.47';
      const PRINTER_PORT = 9100;
      
      // DETECTAR SI ES TABLET O MÓVIL - Usar API endpoint del servidor
      if (isMobileOrTablet()) {
        console.log('[NETWORK PRINT] 📱 Dispositivo móvil/tablet detectado - Usando API endpoint');
        
        toast({
          title: "📱 Imprimiendo desde tablet...",
          description: "Enviando a impresora de red",
          duration: 2000,
        });
        
        // Llamar al endpoint que hace la impresión en el servidor
        const response = await fetch("/api/zebra-network", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orden: orden,
            paquete: paquete,
            unidades: unidades,
            descripcionMaterial: descripcionMaterial,
            codigoBarras: codigoBarras,
            codigoEmpleado: codEmpleado,
          }),
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          console.log('[NETWORK PRINT] ✓ Impresión exitosa desde tablet');
          toast({
            title: "✅ Impresión exitosa",
            description: `Etiqueta enviada a ${PRINTER_IP}\nOrden: ${orden} | Unidades: ${unidades}`,
            duration: 3000,
            variant: "default",
          });
        } else {
          throw new Error(result.error || "Error al imprimir desde tablet");
        }
        
        return;
      }
      
      // PC/DESKTOP - Intentar usar BrowserPrint primero
      console.log('[NETWORK PRINT] 💻 PC detectado - Intentando BrowserPrint');
      
      const bp = (window as any).BrowserPrint || window.Zebra?.BrowserPrint;
      
      if (!bp) {
        console.log('[NETWORK PRINT] BrowserPrint no disponible, usando API endpoint');
        
        // Fallback: Usar el endpoint del servidor
        const response = await fetch("/api/zebra-network", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orden: orden,
            paquete: paquete,
            unidades: unidades,
            descripcionMaterial: descripcionMaterial,
            codigoBarras: codigoBarras,
            codigoEmpleado: codEmpleado,
          }),
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          toast({
            title: "✓ Impresión en red exitosa",
            description: `Etiqueta enviada a ${PRINTER_IP}\nOrden: ${orden} | Unidades: ${unidades}`,
            duration: 3000,
            variant: "default",
          });
        } else {
          throw new Error(result.error || "Error al imprimir");
        }
        
        return;
      }
      
      // BrowserPrint está disponible - Obtener código ZPL primero
      const zplResponse = await fetch("/api/zebra", {
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
          },
        ]),
      });
      
      const payload = await zplResponse.json().catch(() => null);
      if (!zplResponse.ok || !payload) {
        throw new Error(payload?.error || "Error al obtener ZPL del servidor");
      }
      
      const zplCode = payload.zpl || payload.ZPL || payload.data?.zpl || payload.data || "";
      if (!zplCode || typeof zplCode !== "string") {
        throw new Error("La respuesta no contiene ZPL válido");
      }
      
      // Usar BrowserPrint para enviar a la impresora
      bp.getLocalDevices(
        (devices: any[]) => {
          console.log('[NETWORK PRINT] Dispositivos disponibles:', devices);
          
          // Buscar impresora en red o usar la primera disponible
          let networkPrinter = devices.find((d: any) => 
            d.connection && (
              d.connection.includes(PRINTER_IP) || 
              d.connection.includes('network') ||
              d.connection.includes('tcp')
            )
          );
          
          if (!networkPrinter && devices.length > 0) {
            networkPrinter = devices[0];
            console.log('[NETWORK PRINT] Usando primera impresora disponible:', networkPrinter.name);
          }
          
          if (networkPrinter) {
            console.log('[NETWORK PRINT] Impresora seleccionada:', networkPrinter.name);
            networkPrinter.send(
              zplCode,
              () => {
                console.log('[NETWORK PRINT] ✓ Impresión exitosa');
                toast({
                  title: "✓ Impresión en red exitosa",
                  description: `Etiqueta enviada a ${PRINTER_IP}\nOrden: ${orden} | Unidades: ${unidades}`,
                  duration: 3000,
                  variant: "default",
                });
              },
              (err: any) => {
                console.error('[NETWORK PRINT] Error al enviar:', err);
                toast({
                  title: "Error de impresión en red",
                  description: `No se pudo enviar a ${PRINTER_IP}: ${err?.message || err}`,
                  duration: 4000,
                  variant: "destructive",
                });
              }
            );
          } else {
            throw new Error('No se encontraron impresoras disponibles');
          }
        },
        (err: any) => {
          console.error('[NETWORK PRINT] Error obteniendo dispositivos:', err);
          toast({
            title: "Error",
            description: "No se pudieron obtener las impresoras disponibles",
            variant: "destructive",
            duration: 3000,
          });
        },
        'printer'
      );
      
    } catch (e: any) {
      console.error('[NETWORK PRINT] Error general:', e);
      toast({
        title: "Error de impresión en red",
        description: e?.message || "Error desconocido",
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  const handlePrintZPL = async (
    orden: string,
    paquete: string,
    unidades: string,
    descripcionMaterial: string,
    codigoBarras: string,
    codEmpleado: string
  ) => {
    try {
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
          },
        ]),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        throw new Error(payload?.error || "Error al obtener ZPL del servidor");
      }
      const zplCode =
        payload.zpl || payload.ZPL || payload.data?.zpl || payload.data || "";
      if (!zplCode || typeof zplCode !== "string") {
        throw new Error("La respuesta no contiene ZPL válido");
      }
      //console.log('[PRINT] ZPL recibido:', zplCode.substring(0, 120) + '...');

      const bp = (window as any).BrowserPrint || window.Zebra?.BrowserPrint;
      if (!bp) {
        alert("BrowserPrint no detectado. Verifica el servicio.");
        return;
      }

      bp.getDefaultDevice(
        "printer",
        (printer: any, err: any) => {
          if (err) {
            console.error("[PRINT] Error getDefaultDevice:", err);
            alert("No se pudo obtener la impresora por defecto.");
            return;
          }
          if (!printer) {
            alert("No se encontró impresora por defecto.");
            return;
          }
          //console.log('[PRINT] Impresora detectada:', printer.name, printer.connection);
          printer.send(
            zplCode,
            () => {
              //console.log('[PRINT] Envío exitoso');
              //alert('Etiqueta enviada a imprimir');
              toast({
                title: "Impresión exitosa",
                description:
                  "Etiqueta enviada a imprimir: \n [ Unidades: " +
                  unidades +
                  " Orden: " +
                  orden +
                  " ]\n",
                duration: 3000,
                variant: "default",
              });
            },
            (sendErr: any) => {
              //console.error('[PRINT] Falló el envío:', sendErr);
              //alert('Error al enviar a la impresora: ' + (sendErr?.message || sendErr));
              toast({
                title: "Error de impresión",
                description:
                  "No se pudo enviar la etiqueta a imprimir: \n [ Unidades: " +
                  unidades +
                  " Orden: " +
                  orden +
                  " ]\n",
                duration: 3000,
                variant: "destructive",
              });
            }
          );
        },
        (devErr: any) => {
          console.error("[PRINT] Error callback impresora:", devErr);
          alert("Error al resolver la impresora");
        }
      );
    } catch (e: any) {
      console.error("[PRINT] Error general:", e);
      alert("Error impresión: " + (e?.message || e));
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
  const NOTIFICA_SAP = true;

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
        notificationHistoryPistoleado.forEach((item) => {
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
    [user, toast, setOrders, notificationHistoryPistoleado, selectedOrder]
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

  // Eliminado: No consultar órdenes al entrar al formulario

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

  // Cleanup: limpiar timers cuando el componente se desmonte
  useEffect(() => {
    return () => {
      if (queueTimerRef.current) {
        clearTimeout(queueTimerRef.current);
      }
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

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

  // --- FUNCIÓN PARA PROCESAR NOTIFICACIONES EN BATCH AGRUPADAS POR ORDEN ---
  const processBatchNotifications = async () => {
    if (isProcessingLabel) {
      console.warn("⚠️ Ya hay un procesamiento batch en curso");
      return;
    }

    setIsProcessingLabel(true);
    console.log("🚀 Iniciando procesamiento batch de etiquetas");

    try {
      // Obtener y limpiar la cola
      const currentQueue = [...labelQueue];
      setLabelQueue([]); // Limpiar cola inmediatamente

      if (currentQueue.length === 0) {
        console.log("✅ Cola vacía, nada que procesar");
        return;
      }

      // Agrupar etiquetas por número de orden
      const orderGroups: { [orderNumber: string]: any[] } = {};
      
      for (const item of currentQueue) {
        const label = item.labelData;
        const orderNumber = 
          label?.NUM_ORDEN ??
          label?.NUMERO_ORDEN ??
          label?.ORDEN ??
          label?.orden ??
          label?.num_orden ??
          label?.NUM_ORD ??
          label?.NumOrden ??
          label?.NUM?.toString();

        if (orderNumber) {
          if (!orderGroups[orderNumber]) {
            orderGroups[orderNumber] = [];
          }
          orderGroups[orderNumber].push(item);
        } else {
          console.error("❌ Etiqueta sin número de orden:", label);
        }
      }

      console.log("📊 Grupos de órdenes:", Object.keys(orderGroups).map(order => `${order}: ${orderGroups[order].length} etiquetas`));

      // Procesar cada grupo de orden
      for (const [orderNumber, items] of Object.entries(orderGroups)) {
        await processOrderGroup(orderNumber, items);
      }

      toast({
        title: "✅ Procesamiento completado",
        description: `Se procesaron ${currentQueue.length} etiquetas en ${Object.keys(orderGroups).length} orden(es)`,
        variant: "default",
        duration: 3000,
      });

    } catch (error) {
      console.error("❌ Error en procesamiento batch:", error);
      toast({
        title: "Error en procesamiento batch",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsProcessingLabel(false);
      console.log("🔓 Procesamiento batch finalizado");
    }
  };

  // --- FUNCIÓN PARA PROCESAR UN GRUPO DE ETIQUETAS DE LA MISMA ORDEN ---
  const processOrderGroup = async (orderNumber: string, items: any[]) => {
    console.log(`📦 Procesando orden ${orderNumber} con ${items.length} etiquetas`);

    try {
      // Obtener información de la orden desde el servicio
      const respuestaOrden: any = await servicioService.getOrdenPPH(String(orderNumber));
      console.log("Respuesta Orden PPH:", respuestaOrden);

      const selectedOrder = respuestaOrden.data[0];
      if (!selectedOrder) {
        throw new Error("No se pudo recuperar la orden desde el servicio");
      }

      // Calcular cantidad total sumando todas las etiquetas del grupo
      let totalQuantity = 0;
      const labelDetails: any[] = [];

      for (const item of items) {
        const label = item.labelData;
        const quantity = parseFloat(label?.UNIDADES_PROD ?? "0");
        
        if (quantity && !isNaN(quantity) && quantity > 0) {
          totalQuantity += quantity;
          labelDetails.push({
            barcode: label.CODIGO_BARRAS || label.codigoBarras || "No definido",
            paquete: String(label.POSICION ?? label.paquete ?? label.NumPaquete ?? label.NUM_PAQUETE ?? "").trim() || undefined,
            quantity: quantity,
          });
        }
      }

      console.log(`💰 Cantidad total para orden ${orderNumber}: ${totalQuantity}`);

      if (totalQuantity <= 0) {
        throw new Error("No se pudo calcular la cantidad total");
      }

      if (!user || !user.Centro) {
        throw new Error("No se pudo obtener la información del usuario");
      }

      // Determinar tipo de notificación (asumimos todas del mismo tipo)
      const type = items[0]?.type || "notify";

      // Preparar parámetros para SAP (UN SOLO POST con cantidad total)
      const params = {
        centro: user.Centro.toString(),
        responsable: selectedOrder.RespCtrlProd.toString(),
        orden: selectedOrder.Orden.toString(),
        cantidad: type === "notify" ? totalQuantity : 0,
        cantidad_rechazada: type === "pnc" ? totalQuantity : 0,
      };

      const params2 = {
        maquinaSel: selectedOrder.Maquina.toString(),
      };

      console.log("📤 Parámetros de notificación SAP (BATCH):", params);

      // 1. NOTIFICAR A SAP (UN SOLO POST)
      let sapResponse: NotificacionResponse | null = null;
      let sapMessage = "";
      let isSuccess = false;

      if (NOTIFICA_SAP) {
        //   const tramaFinal = JSON.stringify(params);
        //   sapResponse = {
        //   message: "Notificación a Productividad Exitosa.",
        //   dataEnviada: { trama: tramaFinal },
        //   respuestaSOAP: {
        //     LcOMsg: "Pre-notificación grabada, SIN locamercancía en SAP.",
        //     LcOTrama: "No Aplica",
        //   },
        // };
        sapResponse = await notificacionSAPService.notificarOrden(params);
        sapMessage = "Respuesta desconocida de SAP.";
        
        if (sapResponse && sapResponse.respuestaSOAP && sapResponse.respuestaSOAP.LcOMsg) {
          sapMessage = sapResponse.respuestaSOAP.LcOMsg;
          
          if (
            sapMessage.toLowerCase().includes("notificación grabada") ||
            sapMessage.toLowerCase().includes("Conversion failed when converting date and/or time from character string")
          ) {
            isSuccess = true;
            console.log("✅ Notificación SAP exitosa:", sapMessage);
          }
        }
      } else {
        // Modo de prueba sin SAP
        const tramaFinal = JSON.stringify(params);
        sapResponse = {
          message: "Notificación a Productividad Exitosa.",
          dataEnviada: { trama: tramaFinal },
          respuestaSOAP: {
            LcOMsg: "Pre-notificación grabada, SIN movimientos de mercancía en SAP.",
            LcOTrama: "No Aplica",
          },
        };
        sapMessage = sapResponse.respuestaSOAP.LcOMsg;
        isSuccess = true;
      }

      if (!isSuccess) {
        throw new Error(`Error en SAP: ${sapMessage}`);
      }

      // 1.5. MARCAR ETIQUETAS COMO PROCESADAS EN EL BACKEND
      console.log("🔄 Marcando etiquetas como procesadas en el backend...");
      for (const item of items) {
        const label = item.labelData;
        const barcode = label.CODIGO_BARRAS || label.codigoBarras;
        try {
          await servicioService.codigoDeBarrasReader(barcode);
          console.log(`✅ Etiqueta ${barcode} marcada como procesada en backend`);
        } catch (error) {
          console.error(`⚠️ Error al marcar etiqueta ${barcode} como procesada:`, error);
          // No lanzar error aquí para no detener el flujo, ya se notificó a SAP exitosamente
        }
      }

      // 2. GUARDAR EN ORDEN_EMPLEADO / ORDEN_EMPLEADO_DECIMAL (UN POST CON CANTIDAD TOTAL)
      const isDecimal = totalQuantity % 1 !== 0;
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

      const getTurno = (hour: number): string => hour >= 7 && hour < 19 ? "DIURNO" : "NOCTURNO";
      const { date, time, ecuadorTime } = getEcuadorDateTime();
      const turno = getTurno(ecuadorTime.getHours());
      
      let mashine: string = "";
      if (userStation?.nombre_estacion.includes("EST-")) {
        mashine = extraerLetraYNombre(userStation?.nombre_estacion).nombreLimpio;
      } else {
        mashine = userStation?.nombre_estacion ?? selectedOrder.maquina;
      }

      // Guardar operador principal (UN SOLO POST con cantidad total)
      let machineToSave = mashine;
      if (mashine.startsWith("HR-")) {
        machineToSave = mashine;
      }
      
      const userCenter = user.Centro || "";
      const commonData = {
        CODIGO_EMP: user.code,
        UNIDADES_PROD: totalQuantity,
        FECHA: date,
        HORA: time,
        TURNO: turno,
        CENTRO: userCenter,
        CODIGO: `${userCenter}${params.orden}${user.code}${"0".repeat(16)}`,
        MAQUINA: machineToSave,
        ID: 0,
      };

      const userData = isDecimal
        ? ({ ...commonData, NUM_ORDEN: params.orden } as OrdenEmpleadoDecimal)
        : ({ ...commonData, NUM_ORDEN: params.orden } as OrdenEmpleado);

      if (isDecimal) {
        await ordenEmpleadoDecimalService.save(userData as OrdenEmpleadoDecimal);
      } else {
        await ordenEmpleadoService.save(userData as OrdenEmpleado);
      }

      // Guardar colaboradores (UN POST por colaborador con cantidad total)
      for (const collaborator of collaborators) {
        let collaboratorMachine = mashine;
        if (mashine.startsWith("HR-")) {
          collaboratorMachine = mashine.replace("HR-", "HRC-");
        }
        
        const collaboratorCenter = "Centro" in collaborator ? collaborator.Centro : user.Centro || "";
        const collaboratorData = {
          CODIGO_EMP: collaborator.code,
          UNIDADES_PROD: totalQuantity,
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
          await ordenEmpleadoDecimalService.save(collaboratorData as OrdenEmpleadoDecimal);
        } else {
          await ordenEmpleadoService.save(collaboratorData as OrdenEmpleado);
        }
      }

      // 3. GUARDAR LOG (UN POST con cantidad total)
      const now = new Date();
      const fecha_log = now.toISOString();
      const cantidad_entregada = type === "notify" ? totalQuantity : 0;
      const cantidad_rechazada = type === "pnc" ? totalQuantity : 0;
      
      const logData = {
        codigo_log: 0,
        orden_log: params.orden,
        codigo_empleado: user.code,
        codigo_equipo: params2.maquinaSel,
        fecha_log,
        cantidad_entregada,
        cantidad_rechazada,
        cantidad_reproceso: 0,
        orden_reproceso: "",
      };

      try {
        await logOrdenesService.save(logData);
      } catch (logError) {
        console.error("Error al guardar log:", logError);
      }

      // 4. AGREGAR AL HISTORIAL (una entrada por cada etiqueta del grupo)
      for (const labelDetail of labelDetails) {
        const historyItem: AlmohadasNotificationHistoryPistoleadoItem = {
          timestamp: new Date().toLocaleTimeString("es-EC", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }),
          type: type === "notify" ? "Notificación" : "PNC",
          order: selectedOrder.orden,
          quantity: labelDetail.quantity,
          message: `✅ Procesado en batch (${items.length} etiquetas, total: ${totalQuantity.toFixed(2)})`,
          success: true,
          barcode: labelDetail.barcode,
          paquete: labelDetail.paquete,
        };
        addNotificationToHistoryPistoleado(historyItem);
      }

      // 5. ACTUALIZAR ÓRDENES
      const updatedOrders = orders.map((o) => {
        if (o.orden === selectedOrder.orden) {
          const newNotified = o.cantNotificada + (type === "notify" ? totalQuantity : 0);
          return {
            ...o,
            cantNotificada: newNotified,
            cantPendiente: o.cantProgramada - newNotified,
          };
        }
        return o;
      });

      filterAndSetOrders(updatedOrders);

      console.log(`✅ Orden ${orderNumber} procesada exitosamente`);

    } catch (error) {
      console.error(`❌ Error procesando orden ${orderNumber}:`, error);
      
      // Agregar al historial como error
      for (const item of items) {
        const label = item.labelData;
        const errorItem: AlmohadasNotificationHistoryPistoleadoItem = {
          timestamp: new Date().toLocaleTimeString("es-EC", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }),
          type: item.type === "notify" ? "Notificación" : "PNC",
          order: orderNumber,
          quantity: parseFloat(label?.UNIDADES_PROD ?? "0"),
          message: error instanceof Error ? error.message : "Error desconocido",
          success: false,
          barcode: label?.CODIGO_BARRAS || label?.codigoBarras || "No definido",
          paquete: String(label?.POSICION ?? label?.paquete ?? "").trim() || undefined,
        };
        addNotificationToHistoryPistoleado(errorItem);
      }

      toast({
        title: `Error en orden ${orderNumber}`,
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  // --- FUNCIÓN PARA AGREGAR ETIQUETAS AL MODAL DE PISTOLEADO ---
  const handleNotification = async (type: "notify" | "pnc", labelData?: any) => {
    console.log("📥 Agregando etiqueta al modal de pistoleado", labelData);
    
    // VERIFICACIÓN PREVIA: Consultar backend para verificar estado actual
    const barcode = labelData?.CODIGO_BARRAS || labelData?.codigoBarras;
    if (barcode) {
      try {
        console.log(`🔍 [VERIFICACIÓN PREVIA] Consultando estado de etiqueta ${barcode}...`);
        const verificacion = await servicioService.codigoDeBarrasReaderC(barcode);
        
        if (verificacion && verificacion.data && verificacion.data.length > 0) {
          const labelActualizado = verificacion.data[0];
          const mensajeEstado = labelActualizado.MensajeEstado?.toLowerCase() || "";
          
          // Si la etiqueta YA FUE PROCESADA, bloquear inmediatamente
          if (mensajeEstado.includes("ya procesada") || 
              mensajeEstado.includes("ya leida") || 
              mensajeEstado.includes("previamente")) {
            console.warn(`🚫 [VERIFICACIÓN PREVIA] Etiqueta ${barcode} YA PROCESADA - BLOQUEANDO AGREGADO`);
            toast({
              title: "⚠️ Etiqueta ya procesada",
              description: `La etiqueta ${barcode} ya fue procesada previamente y no se agregará al modal`,
              variant: "destructive",
              duration: 3000,
            });
            return; // SALIR SIN AGREGAR AL MODAL
          }
          
          // Actualizar labelData con la información más reciente del backend
          labelData = { ...labelData, ...labelActualizado };
          console.log(`✅ [VERIFICACIÓN PREVIA] Etiqueta ${barcode} verificada como válida`);
        }
      } catch (error) {
        console.error(`❌ Error en verificación previa de etiqueta ${barcode}:`, error);
      }
    }
    
    // Abrir modal si no está abierto
    if (!isPistoleoModalOpen) {
      console.log("🔓 Abriendo modal de pistoleado");
      setIsPistoleoModalOpen(true);
    }
    
    // Extraer número de orden
    const orderNumber =
      labelData?.NUM_ORDEN ??
      labelData?.NUMERO_ORDEN ??
      labelData?.ORDEN ??
      labelData?.orden ??
      labelData?.num_orden ??
      labelData?.NUM_ORD ??
      labelData?.NumOrden ??
      labelData?.NUM?.toString();

    console.log("📦 Número de orden extraído:", orderNumber);

    if (!orderNumber || orderNumber === "N/A") {
      // Si no hay número de orden o es N/A, usar el código de barras como identificador
      const fallbackOrderNumber = labelData?.CODIGO_BARRAS || labelData?.codigoBarras || "INVALIDA-" + Date.now();
      console.log("⚠️ Usando identificador alternativo:", fallbackOrderNumber);
      
      // Marcar como inválida automáticamente
      setPistoleoData(prev => {
        const orderData = prev[fallbackOrderNumber] || {
          etiquetas: [],
          validas: 0,
          invalidas: 0,
          yaProcesadas: 0,
        };

        const newEtiquetas = [...orderData.etiquetas, { ...labelData, estado: "invalida", type }];
        const invalidasCount = newEtiquetas.filter(e => e.estado === "invalida").length;
        
        const newData = {
          etiquetas: newEtiquetas,
          validas: 0,
          invalidas: invalidasCount,
          yaProcesadas: 0,
        };

        setTimeout(() => {
          toast({
            title: "Etiqueta inválida agregada",
            description: "Esta etiqueta no tiene orden asociada",
            variant: "destructive",
            duration: 1500,
          });
        }, 0);

        return {
          ...prev,
          [fallbackOrderNumber]: newData,
        };
      });

      // Abrir modal si no está abierto
      if (!isPistoleoModalOpen) {
        setIsPistoleoModalOpen(true);
      }
      
      return;
    }

    // Determinar estado de la etiqueta
    let estado: "valida" | "invalida" | "yaProcesada" = "valida";
    if (labelData?.MensajeEstado) {
      const mensaje = labelData.MensajeEstado.toLowerCase();
      console.log("🔍 Detectando estado de etiqueta:", {
        mensajeOriginal: labelData.MensajeEstado,
        mensajeLower: mensaje
      });
      
      if (mensaje.includes("ya procesada") || mensaje.includes("ya leida") || mensaje.includes("previamente")) {
        estado = "yaProcesada";
        console.log("⚠️ Etiqueta detectada como YA PROCESADA");
      } else if (mensaje.includes("no encontrada") || mensaje.includes("no existe")) {
        estado = "invalida";
        console.log("❌ Etiqueta detectada como INVÁLIDA");
      } else {
        console.log("✅ Etiqueta detectada como VÁLIDA");
      }
    }

    // Agregar etiqueta al pistoleoData
    setPistoleoData(prev => {
      const orderData = prev[orderNumber] || {
        etiquetas: [],
        validas: 0,
        invalidas: 0,
        yaProcesadas: 0,
      };

      // VERIFICACIÓN DE DUPLICADOS: Revisar en TODAS las órdenes del pistoleoData
      const barcode = labelData?.CODIGO_BARRAS || labelData?.codigoBarras || "";
      
      // Buscar en toda la memoria temporal (todas las órdenes)
      let isDuplicateGlobal = false;
      let ordenDuplicada = "";
      
      for (const [orden, data] of Object.entries(prev)) {
        const existeEnEstaOrden = data.etiquetas.some(
          (e) => (e.CODIGO_BARRAS || e.codigoBarras) === barcode
        );
        if (existeEnEstaOrden) {
          isDuplicateGlobal = true;
          ordenDuplicada = orden;
          break;
        }
      }

      if (isDuplicateGlobal) {
        console.warn(`🚫 [DUPLICADO BLOQUEADO] Etiqueta ${barcode} ya existe en orden ${ordenDuplicada}`);
        // Mostrar toast fuera del setState
        setTimeout(() => {
          toast({
            title: "⚠️ Etiqueta duplicada",
            description: `Esta etiqueta ya fue escaneada en la orden ${ordenDuplicada}`,
            variant: "destructive",
            duration: 3000,
          });
        }, 0);
        return prev;
      }
      
      console.log(`✅ [DUPLICADO OK] Etiqueta ${barcode} no existe en memoria temporal`);

      // Agregar etiqueta con su estado
      const newEtiquetas = [...orderData.etiquetas, { ...labelData, estado, type }];
      
      console.log("🔍 Analizando etiquetas para contadores:", {
        totalEtiquetas: newEtiquetas.length,
        estados: newEtiquetas.map(e => ({ 
          barcode: e.CODIGO_BARRAS || e.codigoBarras, 
          estado: e.estado,
          tipoEstado: typeof e.estado,
          esYaProcesada: e.estado === "yaProcesada",
          esYaProcesadaStrict: e.estado === "yaProcesada",
          valorExacto: JSON.stringify(e.estado)
        }))
      });
      
      // Actualizar contadores
      const validasCount = newEtiquetas.filter(e => e.estado === "valida").length;
      const invalidasCount = newEtiquetas.filter(e => e.estado === "invalida").length;
      const yaProcesadasCount = newEtiquetas.filter(e => e.estado === "yaProcesada").length;
      
      console.log("📊 Contadores calculados:", {
        validas: validasCount,
        invalidas: invalidasCount,
        yaProcesadas: yaProcesadasCount
      });
      
      const newData = {
        etiquetas: newEtiquetas,
        validas: validasCount,
        invalidas: invalidasCount,
        yaProcesadas: yaProcesadasCount,
      };

      const updatedData = {
        ...prev,
        [orderNumber]: newData,
      };

      console.log("📊 Estado actualizado de pistoleoData:", {
        ordenesTotal: Object.keys(updatedData).length,
        ordenes: Object.keys(updatedData),
        detalleOrden: newData
      });

      // Mostrar toast fuera del setState
      setTimeout(() => {
        toast({
          title: "Etiqueta agregada al modal",
          description: `Orden ${orderNumber}: ${newData.validas} válidas, ${newData.yaProcesadas} procesadas, ${newData.invalidas} inválidas`,
          variant: "default",
          duration: 1500,
        });
      }, 0);

      return updatedData;
    });
  };

  // --- FUNCIÓN PARA NOTIFICAR TODAS LAS ÓRDENES AGRUPADAS ---
  const handleNotificarTodo = async () => {
    console.log("🚀 Notificando todas las órdenes agrupadas");
    setIsProcessingLabel(true);

    try {
      // Procesar cada orden del pistoleoData
      for (const [orderNumber, orderData] of Object.entries(pistoleoData)) {
        // FILTRO 1: Solo procesar etiquetas válidas (primera barrera)
        const etiquetasValidas = orderData.etiquetas.filter(e => e.estado === "valida");
        
        console.log(`🔍 [FILTRO 1] Orden ${orderNumber}:`, {
          totalEtiquetas: orderData.etiquetas.length,
          etiquetasValidas: etiquetasValidas.length,
          etiquetasFiltradas: orderData.etiquetas.length - etiquetasValidas.length
        });
        
        if (etiquetasValidas.length > 0) {
          // FILTRO 2: Verificar nuevamente cada etiqueta antes de procesar
          const etiquetasVerificadas: any[] = [];
          
          for (const etiqueta of etiquetasValidas) {
            const barcode = etiqueta.CODIGO_BARRAS || etiqueta.codigoBarras;
            try {
              // Verificar en backend que la etiqueta no haya sido procesada
              const verificacion = await servicioService.codigoDeBarrasReaderC(barcode);
              
              if (verificacion && verificacion.data && verificacion.data.length > 0) {
                const labelVerificado = verificacion.data[0];
                const mensajeEstado = labelVerificado.MensajeEstado?.toLowerCase() || "";
                
                // Solo agregar si NO está procesada
                if (!mensajeEstado.includes("ya procesada") && 
                    !mensajeEstado.includes("ya leida") && 
                    !mensajeEstado.includes("previamente")) {
                  etiquetasVerificadas.push(etiqueta);
                  console.log(`✅ [FILTRO 2] Etiqueta ${barcode} verificada como NO procesada`);
                } else {
                  console.warn(`⚠️ [FILTRO 2] Etiqueta ${barcode} YA PROCESADA - BLOQUEADA`);
                  toast({
                    title: "Etiqueta omitida",
                    description: `${barcode} ya fue procesada previamente`,
                    variant: "default",
                    duration: 2000,
                  });
                }
              }
            } catch (error) {
              console.error(`❌ Error verificando etiqueta ${barcode}:`, error);
            }
          }
          
          console.log(`🔍 [FILTRO 2] Orden ${orderNumber}:`, {
            etiquetasValidas: etiquetasValidas.length,
            etiquetasVerificadas: etiquetasVerificadas.length,
            etiquetasBloqueadas: etiquetasValidas.length - etiquetasVerificadas.length
          });
          
          if (etiquetasVerificadas.length > 0) {
            await processOrderGroup(orderNumber, etiquetasVerificadas.map(e => ({ type: e.type || "notify", labelData: e })));
          } else {
            console.warn(`⚠️ Orden ${orderNumber}: Todas las etiquetas fueron bloqueadas por doble verificación`);
            toast({
              title: "Orden omitida",
              description: `Orden ${orderNumber}: Todas las etiquetas ya fueron procesadas`,
              variant: "default",
              duration: 3000,
            });
          }
        }
      }

      // Cerrar modal y limpiar datos
      setIsPistoleoModalOpen(false);
      setPistoleoData({});

      toast({
        title: "✅ Notificación completada",
        description: "Todas las órdenes fueron notificadas exitosamente",
        variant: "default",
        duration: 3000,
      });
    } catch (error) {
      console.error("❌ Error en notificación:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsProcessingLabel(false);
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

  // Monitorear cambios en pistoleoData
  useEffect(() => {
    const ordenesCount = Object.keys(pistoleoData).length;
    console.log("🔄 pistoleoData actualizado:", {
      ordenesTotal: ordenesCount,
      ordenes: Object.keys(pistoleoData),
      modalAbierto: isPistoleoModalOpen
    });
  }, [pistoleoData, isPistoleoModalOpen]);

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
      <Card>
        <CardHeader className="p-0 mt-1">
          <div className="p-2 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-lg font-semibold">
                Pistoleado de Etiquetas
              </span>
              <span className="block text-sm font-normal flex items-center gap-2">
                {userStationNameText}
                {/* Indicador de impresora de red */}
                {printerIPs.length > 0 && (
                  <span className="inline-flex items-center gap-0.5" title={`Impresora de red configurada: ${printerIPs.join(', ')}`}>
                    <Printer className="h-4 w-4 text-green-600" />
                    <ArrowUpDown className="h-2.5 w-2.5 text-green-600 -ml-0.5" />
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* Botón de prueba de impresión en red */}
              <button
                onClick={() => {
                  handlePrintToNetworkPrinter(
                    "TEST-001",
                    "1",
                    "10",
                    "PRUEBA IMPRESORA RED",
                    "TEST001-1",
                    user?.code || "000"
                  );
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium shadow-sm"
                title="Probar impresión en impresora de red 192.168.205.47"
              >
                <Printer className="h-4 w-4" />
                Probar Impresora Red
              </button>
              {NOTIFICA_SAP && (
                <span
                  style={{
                    width: 15,
                    height: 15,
                    background: "#22c55e",
                    borderRadius: "50%",
                    display: "inline-block",
                    paddingRight: "15px",
                  }}
                  title="SAP activado"
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Estadísticas Globales - Siempre visible */}
          <Card className="mb-4 border-l-4 border-l-blue-500 bg-gradient-to-r from-slate-50 to-white shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Tags className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 font-medium">RESUMEN GENERAL</p>
                    <p className="text-sm text-slate-900 font-semibold">
                      {estadisticasGlobales.ordenesConEtiquetas} {estadisticasGlobales.ordenesConEtiquetas === 1 ? 'Orden' : 'Órdenes'} • {estadisticasGlobales.totalEtiquetas} {estadisticasGlobales.totalEtiquetas === 1 ? 'Etiqueta' : 'Etiquetas'}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="text-center px-4 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
                    <p className="text-2xl font-bold text-emerald-700">{estadisticasGlobales.totalValidas}</p>
                    <p className="text-xs text-emerald-600 font-medium">Válidas</p>
                  </div>
                  
                  <div className="text-center px-4 py-2 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-2xl font-bold text-amber-700">{estadisticasGlobales.totalYaProcesadas}</p>
                    <p className="text-xs text-amber-600 font-medium">Ya Procesadas</p>
                  </div>
                  
                  <div className="text-center px-4 py-2 bg-rose-50 rounded-lg border border-rose-200">
                    <p className="text-2xl font-bold text-rose-700">{estadisticasGlobales.totalInvalidas}</p>
                    <p className="text-xs text-rose-600 font-medium">Inválidas</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-1 width-full p-0 no-border shadow-none">
            <CardContent className="p-1 flex items-center justify-center">
              <ScanBarcode className="inline-block mr-2 h-5 w-5" />

              <input
                type="text"
                placeholder={isProcessingLabel ? "⏳ Procesando..." : "Escanear código (auto-corrección activa)"}
                className="border p-2 rounded w-[35%]"
                value={barcodeInput}
                onChange={(e) => {
                  const val = e.target.value;
                  // Permite solo números y máximo un guión medio
                  if (val === "" || barcodeRegex.test(val)) {
                    setBarcodeInput(val);
                  }
                }}
                ref={barcodeInputRef}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && barcodeInput.trim() !== "") {
                    try {
                      // Corregir el código de barras agregando guión si falta
                      const codigoCorregido = agregarGuionSiNecesario(barcodeInput.trim());
                      
                      // Si se corrigió el código, mostrar notificación
                      if (codigoCorregido !== barcodeInput.trim()) {
                        toast({
                          title: "🔧 Código Corregido",
                          description: `Se agregó guión medio: ${codigoCorregido}`,
                          variant: "default",
                          duration: 2000,
                        });
                      }
                      
                      const response =
                        await servicioService.codigoDeBarrasReaderC(
                          codigoCorregido
                        );
                      // console.log(
                      //   "Respuesta de codigoDeBarrasReaderC:",
                      //   response
                      // );
                      if (
                        response &&
                        response.data &&
                        response.data.length > 0
                      ) {
                        const label = response.data[0];
                        setScannedLabel(label);
                        
                        // Debug: verificar que label tenga POSICION
                        console.log("📦 [DEBUG LABEL]", {
                          label,
                          tienePOSICION: 'POSICION' in label,
                          valorPOSICION: label.POSICION,
                          tipoPOSICION: typeof label.POSICION
                        });

                        // Verificar si la etiqueta ya fue procesada antes
                        if (
                          label.MensajeEstado &&
                          typeof label.MensajeEstado === "string"
                        ) {
                          const mensaje = label.MensajeEstado;
                          const mensajeLower = mensaje.toLowerCase();
                          
                          if (mensajeLower.includes("etiqueta ya procesada".toLowerCase())) {
                            // Etiqueta ya procesada, agregar al modal
                            addNotificationToHistoryPistoleado({
                              timestamp: new Date().toLocaleTimeString("es-EC", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                                hour12: false,
                              }),
                              type: "Lectura",
                              order: label.NUM_ORDEN || "",
                              barcode: label.CODIGO_BARRAS || label.CodBarras || barcodeInput.trim(),
                              quantity: label.UNIDADES_PROD || 0,
                              message: mensaje,
                              success: true,
                              paquete: label.POSICION?.toString() ?? label.paquete?.toString() ?? (label.NumPaquete !== undefined ? String(label.NumPaquete) : undefined),
                            });
                            
                            // MODO PRUEBAS: Agregar al modal aunque esté procesada
                            // IMPORTANTE: Asegurar que MensajeEstado esté presente en el label
                            const labelConMensaje = { ...label, MensajeEstado: mensaje };
                            console.log("🚨 Enviando etiqueta YA PROCESADA al modal:", labelConMensaje);
                            handleNotification("notify", labelConMensaje);
                            setBarcodeInput("");
                            return;
                          } else if (mensajeLower.includes("etiqueta no encontrada".toLowerCase())) {
                            // Etiqueta no encontrada, agregar al modal
                            addNotificationToHistoryPistoleado({
                              timestamp: new Date().toLocaleTimeString("es-EC", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                                hour12: false,
                              }),
                              type: "Lectura",
                              order: label.NUM_ORDEN || "",
                              barcode: label.CODIGO_BARRAS || label.CodBarras || barcodeInput.trim(),
                              quantity: label.UNIDADES_PROD || 0,
                              message: mensaje,
                              success: false,
                              paquete: label.POSICION?.toString() ?? label.paquete?.toString() ?? (label.NumPaquete !== undefined ? String(label.NumPaquete) : undefined),
                            });
                            
                            // MODO PRUEBAS: Agregar al modal aunque sea inválida
                            // IMPORTANTE: Asegurar que MensajeEstado esté presente en el label
                            const labelConMensaje = { ...label, MensajeEstado: mensaje };
                            console.log("🚨 Enviando etiqueta NO ENCONTRADA al modal:", labelConMensaje);
                            handleNotification("notify", labelConMensaje);
                            setBarcodeInput("");
                            return;
                          }
                        }

                        // Debug: verificar label antes de llamar handleNotification
                        console.log("📦 [DEBUG ANTES DE NOTIFICAR]", {
                          label,
                          POSICION: label.POSICION,
                          esNumero: typeof label.POSICION === 'number'
                        });

                        // Etiqueta válida y no procesada, enviar a notificar
                        handleNotification("notify", label);
                      } else {
                        // Etiqueta no encontrada en la base de datos
                        setScannedLabel(null);
                        
                        // Crear un objeto de etiqueta inválida para el modal
                        const invalidLabel = {
                          CODIGO_BARRAS: codigoCorregido,
                          NUM_ORDEN: "N/A",
                          UNIDADES_PROD: 0,
                          MensajeEstado: "Etiqueta no encontrada en el sistema",
                          MATERIAL: "Desconocido",
                          MAQUINA: "N/A",
                        };
                        
                        // Agregar al historial
                        addNotificationToHistoryPistoleado({
                          timestamp: new Date().toLocaleTimeString("es-EC", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: false,
                          }),
                          type: "Lectura",
                          order: "N/A",
                          barcode: codigoCorregido,
                          quantity: 0,
                          message: "Etiqueta no encontrada en el sistema",
                          success: false,
                        });
                        
                        // Agregar al modal como inválida
                        console.log("🚨 Enviando etiqueta NO ENCONTRADA (sin datos) al modal:", invalidLabel);
                        handleNotification("notify", invalidLabel);
                      }
                    } catch (err) {
                      setScannedLabel(null);
                      console.error(
                        "Error al consultar el estado de la etiqueta:",
                        err
                      );
                    }
                    setBarcodeInput("");
                  }
                }}
              />

              {/* Indicador de cola de procesamiento */}
              {labelQueue.length > 0 && (
                <div className="ml-4 flex items-center gap-2 px-3 py-2 bg-blue-100 rounded-lg border border-blue-300">
                  <div className="flex items-center gap-1">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                    <span className="text-sm font-semibold text-blue-700">
                      En cola: {labelQueue.length}
                    </span>
                  </div>
                </div>
              )}

              {/* {userStationNameText === "Etiqueta procesada con exito" && (
                <label className="ml-4 font-semibold text-green-600">
                  {userStationNameText}
                </label>
                )}
                {userStationNameText === "Etiqueta ya leida previamente, no registrada" && (
                <label className="ml-4 font-semibold text-yellow-600">
                  {userStationNameText}
                </label>
                )}
                {userStationNameText === "Etiqueta no encontrada" && (
                <label className="ml-4 font-semibold text-red-600">
                  {userStationNameText}
                </label>
                )}
                {userStationNameText !== "Etiqueta procesada con exito" &&
                userStationNameText !== "Etiqueta ya leida previamente, no registrada" &&
                userStationNameText !== "Etiqueta no encontrada" && (
                  <label className="ml-4 font-semibold foreground text-green-600">
                    waiting for scan...
                  </label>
                )} */}
            </CardContent>
          </Card>

          <Card className="mt-1">
            {/* <CardHeader>Caja de Detalles</CardHeader> */}
            <CardContent className="p-1">
              {scannedLabel ? (
                <div className="flex flex-col lg:flex-row gap-4 w-full">
                  <div className="w-full">
                    <SelectedOrderDisplayEmpty
                      order={{
                        id: scannedLabel.ID?.toString() || "",
                        material:
                          scannedLabel.COD_MATERIAL ||
                          scannedLabel.MATERIAL ||
                          "",
                        cod_material: scannedLabel.COD_MATERIAL || "",
                        orden: scannedLabel.NUM_ORDEN || "",
                        num_orden: scannedLabel.NUM_ORDEN || "",
                        fecha: scannedLabel.FECHA || "",
                        hora: scannedLabel.HORA || "",
                        descripcionMaterial:
                          scannedLabel.MATERIAL ||
                          scannedLabel.descripcionMaterial ||
                          "",
                        cantProgramada: scannedLabel.UNIDADES_PROD || 0,
                        unidades: scannedLabel.UNIDADES_PROD || 0,
                        cantNotificada: 0,
                        cantPendiente: 0,
                        acolchadora: scannedLabel.MAQUINA || "",
                        resp_ctrl_prod: scannedLabel.RESPCTRLPROD || "",
                        maquina: scannedLabel.MAQUINA || "",
                        centro: scannedLabel.CENTRO || "",
                        codigo_barras: scannedLabel.CODIGO_BARRAS || "",
                        departamento: scannedLabel.DEPARTAMENTO || "",
                      }}
                      MensajeEstado={scannedLabel.MensajeEstado}
                    />
                  </div>
                  {/* Modal flotante para OrderSticker expandido */}
                  <AlertDialog
                    open={isStickerModalOpen}
                    onOpenChange={setIsStickerModalOpen}
                  >
                    <AlertDialogContent className="max-w-2xl w-full flex flex-col items-center justify-center">
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Detalle de la Etiqueta
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Visualización ampliada de la etiqueta seleccionada.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      {expandedStickerOrder && (
                        <OrderSticker
                          order={expandedStickerOrder}
                          codigoBarras={expandedStickerBarcode}
                          className="w-full h-full scale-110"
                        />
                      )}
                      <AlertDialogAction
                        onClick={() => setIsStickerModalOpen(false)}
                      >
                        Cerrar
                      </AlertDialogAction>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : (
                <div className="w-full flex flex-row items-center gap-8 py-1">
                  <div
                    style={{
                      minWidth: 120,
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <Image
                      src="/img/Chide.svg"
                      width={64}
                      height={64}
                      alt="Escaneo de Etiqueta"
                    />
                  </div>

                  <div className="flex-grow flex">
                    <div
                      className="rounded-xl shadow-lg p-10 flex flex-col items-center justify-center w-full"
                      style={{ background: "#0055b8", minWidth: 320 }}
                    >
                      {/* <h2 className="text-white text-2xl font-bold mb-2">Escanee una etiqueta</h2> */}
                      <div className="flex ">
                        <ScanBarcode className="h-10 w-10 text-white mr-2" />
                        <Tags className="h-10 w-10 text-white" />
                        <QrCode className="h-10 w-10 text-white ml-2" />
                      </div>
                      <div className="flex ">
                        <Tag className="h-10 w-10 text-white mr-2" />
                        <ScanQrCode className="h-10 w-10 text-white mr-2" />
                        <Barcode className="h-10 w-10 text-white" />
                      </div>
                      <p className="text-white text-[12px]">
                        Por favor, escanee una etiqueta para mostrar la
                        información.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
      {notificationHistoryPistoleado.length > 0 && (
        <Card
          className="shadow-lg mt-1"
          style={{ maxHeight: 350, overflow: "hidden" }}
        >
          <CardHeader>
            <CardTitle className="text-lg font-bold text-primary flex items-center">
              <History className="mr-2 h-5 w-5" />
              Historial de Notificaciones Recientes
            </CardTitle>
          </CardHeader>
          <CardContent
            style={{ maxHeight: 260, overflowY: "auto", paddingRight: 12 }}
          >
            <div className="space-y-3">
              {notificationHistoryPistoleado.map((item, index) => {
                if (item.type === "Lectura") {
                  let color = "#0055b8";
                  let Icon = null;
                  if (item.success) {
                    Icon = require("lucide-react").CircleCheckBig;
                  } else {
                    color = "#dc2626";
                    Icon = require("lucide-react").Bug;
                  }
                  return (
                    <div
                      key={index}
                      className="p-3 rounded-lg text-sm flex items-start gap-4"
                      style={{ background: color + "22" }}
                    >
                      <div className="flex-shrink-0 mt-1">
                        {Icon && <Icon className="h-5 w-5" style={{ color }} />}
                      </div>
                      <div className="flex-grow grid grid-cols-6 gap-x-5 items-center">
                        <div className="font-semibold">
                          <p className="text-xs text-muted-foreground">
                            Acción
                          </p>
                          <p className="font-bold" style={{ color }}>
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
                          <p className="text-[10px]">{item.barcode}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Cantidad
                          </p>
                          <p className="font-bold">
                            {item.quantity.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Paquete
                          </p>
                          <p className="font-bold">{item.paquete ?? "-"}</p>
                        </div>
                        <div className="col-span-5 text-xs text-muted-foreground font-mono mt-1">
                          <p>
                            <strong>Respuesta:</strong> {item.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
                // Resto de notificaciones normales
                return (
                  <div
                    key={index}
                    className="p-3 bg-muted/50 rounded-lg text-sm flex items-start gap-4"
                  >
                    <div className="flex-shrink-0 mt-1">
                      {item.success ? (
                        <CheckCircle className="h-5 w-5 text-green500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                    <div className="flex-grow grid grid-cols-6 gap-x-5 items-center">
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
                      <div>
                        <p className="text-xs text-muted-foreground">Paquete</p>
                        <p className="font-bold">{item.paquete ?? "-"}</p>
                      </div>
                      <div className="col-span-5 text-xs text-muted-foreground font-mono mt-1">
                        <p>
                          <strong>Respuesta:</strong> {item.message}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Pistoleado - Agrupación de Etiquetas */}
      <AlertDialog open={isPistoleoModalOpen} onOpenChange={setIsPistoleoModalOpen}>
        <AlertDialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-primary">
              📋 Etiquetas Escaneadas - Agrupadas por Orden ({Object.keys(pistoleoData).length} {Object.keys(pistoleoData).length === 1 ? 'orden' : 'órdenes'})
            </AlertDialogTitle>
            <AlertDialogDescription>
              Revisa las etiquetas escaneadas antes de notificar. Las cantidades se sumarán por orden.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-6 mt-4">
            {Object.keys(pistoleoData).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay etiquetas escaneadas aún. Comienza a escanear para verlas aquí.
              </div>
            ) : (
              Object.entries(pistoleoData).map(([orderNumber, orderData]) => {
                // DEBUG: Ver el estado de cada etiqueta
                console.log(`🔍 [MODAL RENDER] Orden ${orderNumber}:`, {
                  totalEtiquetas: orderData.etiquetas.length,
                  etiquetasConEstado: orderData.etiquetas.map(e => ({
                    barcode: e.CODIGO_BARRAS || e.codigoBarras,
                    estado: e.estado,
                    mensajeEstado: e.MensajeEstado
                  }))
                });
                
                // Calcular contadores directamente de las etiquetas
                const validasCount = orderData.etiquetas.filter(e => e.estado === "valida").length;
                const yaProcesadasCount = orderData.etiquetas.filter(e => e.estado === "yaProcesada").length;
                const invalidasCount = orderData.etiquetas.filter(e => e.estado === "invalida").length;
                
                console.log(`📊 [MODAL RENDER] Contadores calculados para orden ${orderNumber}:`, {
                  validas: validasCount,
                  yaProcesadas: yaProcesadasCount,
                  invalidas: invalidasCount
                });
                
                return (
                  <Card key={orderNumber} className="border border-slate-200 shadow-sm overflow-hidden">
                    <CardHeader className="from-slate-50 to-slate-100 border-b border-slate-200 pb-4">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-xl flex items-center gap-2">
                          <span className="text-slate-600">Orden:</span>
                          <span className="text-blue-600 font-bold">{orderNumber}</span>
                        </CardTitle>
                        <div className="flex gap-3 text-sm">
                          <span className="px-4 py-1.5 bg-green-200 text-green-700 border border-green-200 rounded-lg font-medium shadow-sm">
                            ✓ Válidas: <span className="font-bold">{validasCount}</span>
                          </span>
                          <span className="px-4 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg font-medium shadow-sm">
                            ⟳ Ya Procesadas: <span className="font-bold">{yaProcesadasCount}</span>
                          </span>
                          <span className="px-4 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg font-medium shadow-sm">
                            ✕ Inválidas: <span className="font-bold">{invalidasCount}</span>
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200">
                          <th className="px-4 py-3 text-left text-slate-700 font-semibold">#</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-semibold">Código de Barras</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-semibold">Cantidad</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-semibold">Paquete</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-semibold">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orderData.etiquetas.map((etiqueta, index) => {
                          const barcode = etiqueta.CODIGO_BARRAS || etiqueta.codigoBarras || "-";
                          const quantity = etiqueta.UNIDADES_PROD || 0;
                          const paquete = etiqueta.POSICION?.toString() || etiqueta.paquete?.toString() || "-";
                          
                          let rowClass = "bg-white hover:bg-emerald-50/50";
                          let badgeClass = "bg-emerald-100 text-emerald-700 border-emerald-300";
                          let estadoTexto = "✓ Válida";
                          
                          if (etiqueta.estado === "yaProcesada") {
                            badgeClass = "bg-amber-100 text-amber-700 border-amber-300";
                            estadoTexto = "⟳ Ya Procesada";
                          } else if (etiqueta.estado === "invalida") {
                            badgeClass = "bg-rose-100 text-rose-700 border-rose-300";
                            estadoTexto = "✕ Inválida";
                          }
                          
                          return (
                            <tr key={index} className={`transition-colors ${rowClass}`}>
                              <td className="px-4 py-3 text-slate-600 font-medium">{index + 1}</td>
                              <td className="px-4 py-3 font-mono text-xs text-slate-700">{barcode}</td>
                              <td className="px-4 py-3 font-bold text-slate-900">{quantity}</td>
                              <td className="px-4 py-3 text-slate-700">{paquete}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${badgeClass}`}>
                                  {estadoTexto}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="from-slate-100 to-slate-50 border-t-2 border-slate-300">
                        <tr>
                          <td colSpan={2} className="px-4 py-4 text-right text-slate-700 font-semibold text-base">
                            TOTAL A NOTIFICAR:
                          </td>
                          <td className="px-4 py-4 text-blue-600 text-2xl font-bold">
                            {orderData.etiquetas
                              .filter(e => e.estado === "valida")
                              .reduce((sum, e) => sum + (parseFloat(e.UNIDADES_PROD) || 0), 0)
                              .toFixed(2)}
                          </td>
                          <td colSpan={2} className="px-4 py-4 text-slate-500 text-xs italic">
                            (Solo etiquetas válidas)
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
                );
              })
            )}
          </div>

          <AlertDialogFooter className="mt-6">
            <button
              onClick={() => {
                setIsPistoleoModalOpen(false);
                setPistoleoData({});
              }}
              className="px-4 py-2 border rounded-lg hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              onClick={handleNotificarTodo}
              disabled={isProcessingLabel || Object.keys(pistoleoData).length === 0}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
            >
              {isProcessingLabel ? "⏳ Notificando..." : "✅ Notificar Todas las Órdenes"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Login de Colaboradores */}
      <CollaboratorLoginModal
        isOpen={isLoginModalOpen}
        onOpenChange={setLoginModalOpen}
      />
      
    </>
  );
}

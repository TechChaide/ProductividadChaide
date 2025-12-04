"use client";
import React from "react";
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
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type {
  EtiquetaPlastificado,
  OrdenReimpresion,
  EtiquetaPistoleadaItem,
} from "@/types/interfaces";
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
import { LogReimpresionesService } from "@/services/log_reimpresiones.service";
import type { LogReimpresiones } from "@/types/interfaces";
import OrderStickerColchonesSimple from "./components/order-sticker";
import { usePrinterIPs } from "@/hooks/usePrinterIPs";

export default function ImpresionNLPage() {
  // Cargar IPs de impresión automáticamente al abrir la página
  const { printerIPs, isLoading: isPrinterIPsLoading } = usePrinterIPs();
  
  const [ordenesReimpresion, setOrdenesReimpresion] = useState<
    OrdenReimpresion[]
  >([]);
  const [ordenesReimpresionLoading, setOrdenesReimpresionLoading] =
    useState(false);
  const [ordenesReimpresionError, setOrdenesReimpresionError] = useState<
    string | null
  >(null);
  const [ordenReimpresionSeleccionada, setOrdenReimpresionSeleccionada] =
    useState<OrdenReimpresion | null>(null);
  // Estado para guardar los logs de reimpresiones de la orden consultada
  const [logsReimpresionActual, setLogsReimpresionActual] = useState<any[]>([]);
  // Límite de reimpresiones desde .env.local
  const limiteReimpresiones = 1;
  // ...
  // Ref para el input de código de barras
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Efecto para mantener el foco en el input
  useEffect(() => {
    const focusInput = () => {
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    };

    // Foco inicial
    focusInput();

    // Mantener foco cuando se hace click fuera
    const handleClickOutside = () => {
      setTimeout(focusInput, 10);
    };

    // Mantener foco cuando se cambia de ventana
    const handleWindowFocus = () => {
      setTimeout(focusInput, 10);
    };

    document.addEventListener('click', handleClickOutside);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);
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
  const [ordenInput, setOrdenInput] = useState("");
  const [lastSearchedOrden, setLastSearchedOrden] = useState<string>("");
  // Estado para checkboxes de selección múltiple
  const [selectedOrdenes, setSelectedOrdenes] = useState<string[]>([]);

  // Expresión regular: solo números y máximo un guión medio
  const ordenRegex = /^[\d-]*$/;
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

  // Estado para el historial de etiquetas pistoleadas
  const [etiquetasPistoleadas, setEtiquetasPistoleadas] = useState<
    EtiquetaPistoleadaItem[]
  >([]);

  // Estado para la etiqueta seleccionada en vista previa
  const [etiquetaPreviewSeleccionada, setEtiquetaPreviewSeleccionada] =
    useState<EtiquetaPistoleadaItem | null>(null);

  // Estado para el modal de reimpresión
  const [modalReimpresion, setModalReimpresion] = useState<{
    open: boolean;
    etiqueta: EtiquetaPlastificado | null;
    codigoQR: string;
    impresionesActuales: number;
  }>({
    open: false,
    etiqueta: null,
    codigoQR: "",
    impresionesActuales: 0,
  });

  // Estado para la cantidad de etiquetas a imprimir
  const [cantidadAImprimir, setCantidadAImprimir] = useState<number>(1);

  // Función para limpiar el historial de etiquetas pistoleadas
  const limpiarHistorialEtiquetas = () => {
    setEtiquetasPistoleadas([]);
    setEtiquetaPreviewSeleccionada(null);
  };

  // Efecto para mantener foco después de operaciones
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [etiquetasPistoleadas, ordenInput]);

  // Función auxiliar para comparar si dos etiquetas son idénticas
  const sonEtiquetasIdenticas = (etiqueta1: any, etiqueta2: EtiquetaPlastificado): boolean => {
    return (
      etiqueta1.NUM_CABECERA === etiqueta2.NUM_CABECERA &&
      etiqueta1.Etiqueta_Material === etiqueta2.Etiqueta_Material &&
      etiqueta1.Largo === etiqueta2.Largo &&
      etiqueta1.Ancho === etiqueta2.Ancho &&
      etiqueta1.Alto === etiqueta2.Alto &&
      etiqueta1.Clase === etiqueta2.Clase &&
      etiqueta1.Tipo === etiqueta2.Tipo
    );
  };

  // Función para filtrar logs de una etiqueta específica
  const filtrarLogsDeEtiqueta = (logs: any[], etiquetaData: EtiquetaPlastificado): any[] => {
    return logs.filter((log: any) => {
      try {
        if (!log.parametros) return false;
        
        const parametrosLog = typeof log.parametros === 'string' 
          ? JSON.parse(log.parametros) 
          : log.parametros;
        
        return sonEtiquetasIdenticas(parametrosLog, etiquetaData);
      } catch (parseError) {
        console.warn("[LOGS] Error al parsear parámetros del log:", parseError);
        return false;
      }
    });
  };

  // Función para verificar logs y determinar si se puede reimprimir
  const verificarReimpresion = async ( QR: string, orden: string, etiquetaData: EtiquetaPlastificado): Promise<boolean> => {
    try {
      const logsResponse = await LogReimpresionesService.getLogImpresionesPorCodigoBarrasF(QR);
      
      if (logsResponse && Array.isArray(logsResponse.data)) {
        // Filtrar logs que corresponden exactamente a esta etiqueta
        const logsDeEstaEtiqueta = filtrarLogsDeEtiqueta(logsResponse.data, etiquetaData);

        const impresionesExistentes = logsDeEstaEtiqueta.length;
        
        console.log(`[LOGS] Total logs encontrados: ${logsResponse.data.length}, logs de esta etiqueta: ${impresionesExistentes}`);
        
        if (impresionesExistentes >= limiteReimpresiones) {
          toast({
            title: "Límite de reimpresiones alcanzado",
            description: `Esta etiqueta ya ha sido impresa ${impresionesExistentes} veces (límite: ${limiteReimpresiones})`,
            variant: "destructive",
            duration: 4000,
          });
          return false;
        }
        
        if (impresionesExistentes > 0) {
          // Mostrar modal para seleccionar cantidad
          setModalReimpresion({
            open: true,
            etiqueta: etiquetaData,
            codigoQR: QR,
            impresionesActuales: impresionesExistentes,
          });
          setCantidadAImprimir(1); // Default a 1
          return false; // No proceder automáticamente, esperar selección del usuario
        }
        
        return true; // Primera impresión, proceder normalmente
      }
      
      return true; // Sin logs, proceder normalmente
    } catch (error) {
      console.warn("[LOGS] Error al verificar reimpresiones:", error);
      return true; // En caso de error, proceder normalmente
    }
  };

  // Función para confirmar la reimpresión desde el modal
  const confirmarReimpresion = async () => {
    if (modalReimpresion.etiqueta && cantidadAImprimir > 0 && cantidadAImprimir <= 2) {
      const etiqueta = modalReimpresion.etiqueta;
      
      await handlePrintZPL(
        modalReimpresion.codigoQR,
        etiqueta.Garantia?.toString() || "",
        etiqueta.Tipo?.toString() || "",
        etiqueta.Clase?.toString() || "",
        etiqueta.Largo?.toString() || "",
        etiqueta.Ancho?.toString() || "",
        etiqueta.Alto?.toString() || "",
        etiqueta.Etiqueta_Material?.toString() || "",
        new Date().getMonth().toString(),
        etiqueta.Etiqueta_CodigoAntiguo?.toString() || "",
        etiqueta,
        cantidadAImprimir
      );
    }
    
    // Cerrar modal
    setModalReimpresion({
      open: false,
      etiqueta: null,
      codigoQR: "",
      impresionesActuales: 0,
    });
    setCantidadAImprimir(1);
    
    // Restaurar foco al input después de un breve delay
    setTimeout(() => {
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    }, 100);
  };

  const handlePrintZPL = async (
    QR: string,
    garantia: string,
    tipo: string,
    clase: string,
    largo: string,
    ancho: string,
    alto: string,
    nombreProducto: string,
    mes: string,
    EMPRESA: string,
    Objeto: EtiquetaPlastificado | null,
    cantidadCopias: number = 2
  ) => {
    let impresionExitosa = false;
    let logGuardado = false;
    let mensajeError = "";

    try {
      // Obtener la IP de la impresora de red si está disponible
      const printerIP = printerIPs && printerIPs.length > 0 ? printerIPs[0] : undefined;
      
      console.log(`[ETIQUETAS-NL] Iniciando impresión - Impresora de red: ${printerIP || 'No disponible'}`);

      const requestBody: any = {
        QR: QR,
        garantia: garantia,
        tipo: tipo,
        clase: clase,
        largo: largo,
        ancho: ancho,
        alto: alto,
        nombreProducto: nombreProducto,
        mes: mes,
        EMPRESA: EMPRESA,
      };

      // Si hay impresora de red disponible, agregarla al payload
      if (printerIP) {
        requestBody.printerIP = printerIP;
        console.log(`[ETIQUETAS-NL] Usando impresora de red: ${printerIP}`);
      }

      const response = await fetch("/api/zebra-ny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([requestBody]),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        throw new Error(payload?.error || "Error al obtener ZPL del servidor");
      }

      // Si hay éxito en impresión de red, procesar respuesta
      if (payload.success && printerIP) {
        console.log(`[ETIQUETAS-NL] Impresión en red exitosa: ${payload.printer}`);
        
        impresionExitosa = true;
        toast({
          title: "Impresión en red exitosa",
          description: `Etiqueta enviada a la impresora de red ${printerIP} (${cantidadCopias} ${cantidadCopias === 1 ? 'copia' : 'copias'}): \n [ Producto: ${nombreProducto}, \n Dimensiones: ${largo}cm x ${ancho}cm x ${alto}cm ]`,
          duration: 3000,
          variant: "default",
        });

        // Guardar log de reimpresión en la base de datos
        if (Objeto && user?.code) {
          try {
            const logData: any = {
              codigo_log: "0",
              orden: Objeto.NUM_CABECERA,
              paquete: 1,
              parametros: JSON.stringify({
                ...Objeto,
                copiasImpresas: cantidadCopias,
                fechaImpresion: new Date().toISOString(),
                codigo_barras: QR,
                impresoraRed: printerIP,
              }),
              estado: "A",
              usuario_reimpresion: user.code,
            };
            await LogReimpresionesService.save(logData);
            logGuardado = true;
            console.log(`[LOG] Reimpresión en red registrada correctamente (${cantidadCopias} ${cantidadCopias === 1 ? 'copia' : 'copias'})`);
          } catch (logError: any) {
            console.error("[LOG] Error al guardar log de reimpresión:", logError);
            mensajeError = "Impresión exitosa pero no se pudo registrar el log.";
            toast({
              title: "Advertencia",
              description: mensajeError,
              duration: 3000,
              variant: "destructive",
            });
          }
        }
        return;
      }

      // Si no hay impresión de red, usar ZPL con BrowserPrint
      const zplCode =
        payload.zpl || payload.ZPL || payload.data?.zpl || payload.data || "";
      if (!zplCode || typeof zplCode !== "string") {
        throw new Error("La respuesta no contiene ZPL válido");
      }

      console.log('[ETIQUETAS-NL] Usando BrowserPrint para impresión local');

      const bp = (window as any).BrowserPrint || window.Zebra?.BrowserPrint;
      if (!bp) {
        mensajeError = "BrowserPrint no detectado. Verifica el servicio.";
        throw new Error(mensajeError);
      }

      // Promesa para manejar la impresión
      const imprimirEtiqueta = () => {
        return new Promise<void>((resolve, reject) => {
          bp.getDefaultDevice(
            "printer",
            (printer: any, err: any) => {
              if (err) {
                console.error("[PRINT] Error getDefaultDevice:", err);
                reject(
                  new Error("No se pudo obtener la impresora por defecto.")
                );
                return;
              }
              if (!printer) {
                reject(new Error("No se encontró impresora por defecto."));
                return;
              }

              // Imprimir el número especificado de veces
              let impresionesCompletadas = 0;
              const totalImpresiones = cantidadCopias;

              const enviarImpresion = () => {
                printer.send(
                  zplCode,
                  () => {
                    impresionesCompletadas++;
                    console.log(
                      `[PRINT] Impresión ${impresionesCompletadas}/${totalImpresiones} completada`
                    );

                    if (impresionesCompletadas === totalImpresiones) {
                      resolve();
                    } else {
                      // Pequeño delay entre impresiones
                      setTimeout(enviarImpresion, 300);
                    }
                  },
                  (sendErr: any) => {
                    reject(
                      new Error(
                        "Error al enviar a la impresora: " +
                          (sendErr?.message || sendErr)
                      )
                    );
                  }
                );
              };

              enviarImpresion();
            },
            (devErr: any) => {
              console.error("[PRINT] Error callback impresora:", devErr);
              reject(new Error("Error al resolver la impresora"));
            }
          );
        });
      };

      // Ejecutar la impresión
      await imprimirEtiqueta();
      impresionExitosa = true;

      toast({
        title: "Impresión exitosa",
        description:
          `Etiquetas enviadas a imprimir (${cantidadCopias} ${cantidadCopias === 1 ? 'copia' : 'copias'}): \n [ Producto: ` +
          nombreProducto +
          ", \n Dimensiones: " +
          largo +
          "cm x" +
          ancho +
          "cm x" +
          alto +
          "cm ]\n",
        duration: 3000,
        variant: "default",
      });

      // Guardar log de reimpresión en la base de datos (solo un log para ambas impresiones)
      if (Objeto && user?.code) {
        try {
          const logData: any = {
            codigo_log: "0",
            orden: Objeto.NUM_CABECERA,
            paquete: 1,
            parametros: JSON.stringify({
              ...Objeto,
              copiasImpresas: cantidadCopias,
              fechaImpresion: new Date().toISOString(),
              codigo_barras: QR,
            }),
            estado: "A",
            usuario_reimpresion: user.code,
          };
          await LogReimpresionesService.save(logData);
          logGuardado = true;
          console.log(`[LOG] Reimpresión registrada correctamente (${cantidadCopias} ${cantidadCopias === 1 ? 'copia' : 'copias'})`);
        } catch (logError: any) {
          console.error("[LOG] Error al guardar log de reimpresión:", logError);
          mensajeError = "Impresión exitosa pero no se pudo registrar el log.";
          toast({
            title: "Advertencia",
            description: mensajeError,
            duration: 3000,
            variant: "destructive",
          });
        }
      }
    } catch (e: any) {
      console.error("[PRINT] Error general:", e);
      mensajeError = e?.message || e;
      toast({
        title: "Error de impresión",
        description: "Error al imprimir etiqueta: " + mensajeError,
        duration: 3000,
        variant: "destructive",
      });
    } finally {
      // Actualizar la etiqueta pistoleada existente con los resultados de la impresión
      if (Objeto) {
        setEtiquetasPistoleadas((prev) => {
          const nuevasEtiquetas = [...prev];
          const indiceEtiqueta = nuevasEtiquetas.findIndex(
            (e) => e.codigoQR === QR
          );

          if (indiceEtiqueta !== -1) {
            // Actualizar la etiqueta existente
            nuevasEtiquetas[indiceEtiqueta] = {
              ...nuevasEtiquetas[indiceEtiqueta],
              impresionExitosa: impresionExitosa,
              logGuardado: logGuardado,
              message: impresionExitosa
                ? `Etiqueta impresa correctamente (${cantidadCopias} ${cantidadCopias === 1 ? 'copia' : 'copias'})` +
                  (logGuardado ? " - Log guardado" : " - Sin log")
                : mensajeError,
            };
          } else {
            // Si no existe, crear una nueva (caso de fallo)
            const nuevaEtiquetaPistoleada: EtiquetaPistoleadaItem = {
              timestamp: new Date().toLocaleTimeString(),
              codigoQR: QR,
              etiqueta_material: Objeto.Etiqueta_Material || "N/A",
              clase: Objeto.Clase || "N/A",
              dimensiones: {
                largo: Objeto.Largo || "N/A",
                ancho: Objeto.Ancho || "N/A",
                alto: Objeto.Alto || "N/A",
              },
              success: impresionExitosa,
              message: impresionExitosa
                ? `Etiqueta impresa correctamente (${cantidadCopias} ${cantidadCopias === 1 ? 'copia' : 'copias'})`
                : mensajeError,
              etiquetaCompleta: Objeto,
              impresionExitosa: impresionExitosa,
              logGuardado: logGuardado,
            };
            nuevasEtiquetas.unshift(nuevaEtiquetaPistoleada);
          }

          return nuevasEtiquetas;
        });
      }
    }
  };

  // Función auxiliar para validar si un paquete ya ha sido reimpreso
  const paqueteYaFueReimpreso = (
    numOrden: string,
    numeroPaquete: number
  ): boolean => {
    if (logsReimpresionActual.length === 0) {
      return false;
    }

    // Buscar si existe un log para esta orden y paquete
    return logsReimpresionActual.some((log: any) => {
      return log.orden === numOrden && log.paquete === numeroPaquete;
    });
  };

  // Función para contar cuántas veces ha sido reimpreso un paquete
  const contarReimpresionesPaquete = (
    numOrden: string,
    numeroPaquete: number
  ): number => {
    if (logsReimpresionActual.length === 0) {
      return 0;
    }

    return logsReimpresionActual.filter((log: any) => {
      return log.orden === numOrden && log.paquete === numeroPaquete;
    }).length;
  };

  // Función para validar si se ha superado el límite de reimpresiones
  const paqueteExcedioLimite = (
    numOrden: string,
    numeroPaquete: number
  ): boolean => {
    const cantidadReimpresiones = contarReimpresionesPaquete(
      numOrden,
      numeroPaquete
    );
    return cantidadReimpresiones > limiteReimpresiones;
  };

  const handleReimprimirEtiquetas = async () => {
    if (selectedOrdenes.length === 0) {
      toast({
        title: "Sin selección",
        description: "Selecciona al menos una orden para reimprimir.",
        variant: "default",
      });
      return;
    }

    // Obtener el código de empleado del user del localStorage
    let userCode = "";
    try {
      const userFromStorage = localStorage.getItem("user");
      if (userFromStorage) {
        const userObj = JSON.parse(userFromStorage);
        userCode = userObj.code || "";
      }
    } catch (e) {
      console.error("Error al obtener user del localStorage:", e);
    }

    // Iterar sobre cada orden seleccionada
    for (const codigoBarras of selectedOrdenes) {
      const ordenObj = ordenesReimpresion.find(
        (o) => o.CODIGO_BARRAS === codigoBarras
      );
      if (!ordenObj) continue;

      // Validar si se ha superado el límite de reimpresiones
      if (paqueteExcedioLimite(ordenObj.NUM_ORDEN, ordenObj.POSICION)) {
        const cantidadReimpresiones = contarReimpresionesPaquete(
          ordenObj.NUM_ORDEN,
          ordenObj.POSICION
        );
        toast({
          title: "Límite de reimpresiones excedido",
          description: `Etiqueta reimpresa más de ${limiteReimpresiones} veces (${cantidadReimpresiones} reimpresiones), omitiendo. Paquete: ${ordenObj.POSICION} Orden: ${ordenObj.NUM_ORDEN}`,
          duration: 4000,
          variant: "destructive",
        });
        console.warn(
          `[LIMIT] Paquete ${ordenObj.POSICION} de la orden ${ordenObj.NUM_ORDEN} ha excedido el límite de reimpresiones (${cantidadReimpresiones} > ${limiteReimpresiones})`
        );
        continue; // Saltar a la siguiente orden
      }

      // Validar si el paquete ya ha sido reimpreso (pero sin exceder límite)
      const yaFueReimpreso = paqueteYaFueReimpreso(
        ordenObj.NUM_ORDEN,
        ordenObj.POSICION
      );

      if (yaFueReimpreso) {
        const cantidadReimpresiones = contarReimpresionesPaquete(
          ordenObj.NUM_ORDEN,
          ordenObj.POSICION
        );
        console.warn(
          `[VALIDATE] Paquete ${ordenObj.POSICION} de la orden ${ordenObj.NUM_ORDEN} ya fue reimpreso (${cantidadReimpresiones}/${limiteReimpresiones})`
        );
      }

      // Llamar a handlePrintZPL con los datos de la orden
      // await handlePrintZPL(
      //   ordenObj.NUM_ORDEN,
      //   ordenObj.POSICION?.toString() || "0",
      //   ordenObj.CANTIDAD?.toString() || "0",
      //   ordenObj.MATERIAL,
      //   codigoBarras,
      //   userCode,
      //   ordenObj
      // );

      // Agregar un pequeño delay entre impresiones
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    toast({
      title: "Proceso completado",
      description: `Se procesaron ${selectedOrdenes.length} órdenes para reimprimir.`,
      variant: "default",
    });

    // Limpiar selección después de completar
    setSelectedOrdenes([]);
  };

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
      {/* Vista previa de la última etiqueta pistoleada - Solo se muestra si hay etiquetas */}
      {etiquetasPistoleadas.length > 0 && (etiquetaPreviewSeleccionada ||
        (etiquetasPistoleadas.length > 0 &&
          etiquetasPistoleadas[0].success)) && (
        <div className="flex flex-col items-center justify-center w-full mb-4">
          <div className="mb-2">
            <h3 className="text-sm font-medium text-gray-600 text-center">
              {etiquetaPreviewSeleccionada ||
              (etiquetasPistoleadas.length > 0 ? etiquetasPistoleadas[0] : null)
                ? `Etiqueta Seleccionada (${
                    (etiquetaPreviewSeleccionada || etiquetasPistoleadas[0])
                      .timestamp
                  })`
                : ""}
            </h3>
            {(etiquetaPreviewSeleccionada ||
              (etiquetasPistoleadas.length > 0
                ? etiquetasPistoleadas[0]
                : null)) && (
              <div className="flex justify-center mt-1">
                {(() => {
                  const etiqueta =
                    etiquetaPreviewSeleccionada || etiquetasPistoleadas[0];
                  return etiqueta.success && etiqueta.impresionExitosa ? (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Procesada Exitosamente
                    </span>
                  ) : etiqueta.success ? (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Leída - Pendiente Impresión
                    </span>
                  ) : (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full flex items-center">
                      <XCircle className="w-3 h-3 mr-1" />
                      Error en Procesamiento
                    </span>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="w-full max-w-[800px] flex justify-center">
            <div className="transform scale-90">
              {(() => {
                const etiquetaParaPreview =
                  etiquetaPreviewSeleccionada ||
                  (etiquetasPistoleadas.length > 0
                    ? etiquetasPistoleadas[0]
                    : null);
                return (
                  <OrderStickerColchonesSimple
                    //order={order}
                    codigoBarras={
                      etiquetaParaPreview ? etiquetaParaPreview.codigoQR : ""
                    }
                    añosGarantia={
                      etiquetaParaPreview
                        ? parseInt(
                            etiquetaParaPreview.etiquetaCompleta.Garantia ||
                              "10"
                          )
                        : 10
                    }
                    tipo={
                      etiquetaParaPreview
                        ? etiquetaParaPreview.etiquetaCompleta.Tipo || "IV"
                        : "IV"
                    }
                    clase={
                      etiquetaParaPreview ? etiquetaParaPreview.clase : "E"
                    }
                    dimensiones={{
                      ancho: etiquetaParaPreview
                        ? parseInt(etiquetaParaPreview.dimensiones.ancho) || 160
                        : 160,
                      largo: etiquetaParaPreview
                        ? parseInt(etiquetaParaPreview.dimensiones.largo) || 200
                        : 200,
                      alto: etiquetaParaPreview
                        ? parseInt(etiquetaParaPreview.dimensiones.alto) || 30
                        : 30,
                    }}
                    producto={
                      etiquetaParaPreview
                        ? etiquetaParaPreview.etiqueta_material
                        : ""
                    }
                    empresa={
                      etiquetaParaPreview
                        ? etiquetaParaPreview.etiquetaCompleta.Etiqueta_CodigoAntiguo?.toString() || "CHAIDE"
                        : "CHAIDE"
                    }
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}
      <Card>
        <CardHeader className="p-0 mt-1">
          <div className="p-2 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-lg font-semibold">
                Impresión de Etiquetas Plástificado
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
        </CardHeader>
        <CardContent>
          <Card className="mt-5 width-full p-0 no-border shadow-none">
            <CardContent className="p-3 flex items-center justify-center">
              <ScanBarcode className="inline-block mr-2 h-5 w-5" />

              <input
                type="text"
                placeholder="Buscar etiqueta..."
                className="border p-2 rounded w-[35%]"
                value={ordenInput}
                onChange={(e) => {
                  const val = e.target.value;
                  // Permite solo números y máximo un guión medio
                  if (val === "" || ordenRegex.test(val)) {
                    setOrdenInput(val);
                  }
                }}
                ref={barcodeInputRef}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && ordenInput.trim() !== "") {
                    setLastSearchedOrden(ordenInput.trim());
                    try {
                      // Primero intentar consultar por reimpresión (órdenes existentes)
                      const response =
                        await servicioService.getReimpresionPlastificado(
                          ordenInput.trim()
                        );
                      if (
                        response &&
                        response.data &&
                        Array.isArray(response.data) &&
                        response.data.length > 0
                      ) {
                        console.log(
                          "[REIMPRESION] Órdenes recuperadas:",
                          response.data
                        );

                        // Crear la etiqueta pistoleada directamente
                        const etiquetaData = response.data[0];
                        const nuevaEtiquetaPistoleada: EtiquetaPistoleadaItem =
                          {
                            timestamp: new Date().toLocaleTimeString(),
                            codigoQR: ordenInput.trim(),
                            etiqueta_material:
                              etiquetaData.Etiqueta_Material?.toString() || "",
                            clase: etiquetaData.Clase?.toString() || "",
                            dimensiones: {
                              largo: etiquetaData.Largo?.toString() || "",
                              ancho: etiquetaData.Ancho?.toString() || "",
                              alto: etiquetaData.Alto?.toString() || "",
                            },
                            success: true,
                            message: "Etiqueta leída correctamente",
                            etiquetaCompleta: etiquetaData,
                            impresionExitosa: false,
                            logGuardado: false,
                          };

                        // Agregar al historial de etiquetas pistoleadas
                        setEtiquetasPistoleadas((prev) => [
                          nuevaEtiquetaPistoleada,
                          ...prev,
                        ]);

                        // Establecer como etiqueta de vista previa automáticamente
                        setEtiquetaPreviewSeleccionada(nuevaEtiquetaPistoleada);

                        // Verificar reimpresiones antes de proceder
                        const puedeImprimir = await verificarReimpresion(ordenInput.trim(), etiquetaData.NUM_CABECERA, etiquetaData);
                        
                        if (puedeImprimir) {
                          // Proceder con la impresión automáticamente (primera vez)
                          await handlePrintZPL(
                            ordenInput.trim(),
                            etiquetaData.Garantia?.toString() || "",
                            etiquetaData.Tipo?.toString() || "",
                            etiquetaData.Clase?.toString() || "",
                            etiquetaData.Largo?.toString() || "",
                            etiquetaData.Ancho?.toString() || "",
                            etiquetaData.Alto?.toString() || "",
                            etiquetaData.Etiqueta_Material?.toString() || "",
                            (new Date().getMonth() + 1).toString(),
                            etiquetaData.Etiqueta_CodigoAntiguo?.toString() || "",
                            etiquetaData,
                            2 // Primera impresión siempre 2 copias
                          );
                        }

                        // Recuperar los logs de reimpresiones para esta orden
                        try {
                          const logsResponse =
                            await LogReimpresionesService.getLogImpresionesPorCodigoBarrasF(
                              ordenInput.trim()
                            );
                          // Validar que la respuesta tenga data y sea un array
                          if (
                            logsResponse &&
                            Array.isArray(logsResponse.data)
                          ) {
                            if (logsResponse.data.length > 0) {
                              setLogsReimpresionActual(logsResponse.data);
                            } else {
                              // Si viene vacío, inicializar con array vacío
                              setLogsReimpresionActual([]);
                            }
                          } else {
                            // Si no es array, inicializar con vacío
                            setLogsReimpresionActual([]);
                          }
                        } catch (logErr: any) {
                          console.warn(
                            "[LOGS] Error al recuperar logs de reimpresión:",
                            logErr
                          );
                          setLogsReimpresionActual([]);
                        }
                      } else {
                        // Si no se encuentra en reimpresión, crear una etiqueta con error
                        const etiquetaError: EtiquetaPistoleadaItem = {
                          timestamp: new Date().toLocaleTimeString(),
                          codigoQR: ordenInput.trim(),
                          etiqueta_material: "No encontrado",
                          clase: "N/A",
                          dimensiones: {
                            largo: "N/A",
                            ancho: "N/A",
                            alto: "N/A",
                          },
                          success: false,
                          message: "No se encontraron datos para esta etiqueta",
                          etiquetaCompleta: {} as EtiquetaPlastificado,
                          impresionExitosa: false,
                          logGuardado: false,
                        };

                        setEtiquetasPistoleadas((prev) => [
                          etiquetaError,
                          ...prev,
                        ]);
                        setEtiquetaPreviewSeleccionada(etiquetaError);
                        setOrdenesReimpresion([]);
                        setLogsReimpresionActual([]);
                        setOrdenesReimpresionError(
                          "No se encontraron órdenes para reimpresión."
                        );
                      }
                    } catch (err: any) {
                      // Crear etiqueta con error de consulta
                      const etiquetaError: EtiquetaPistoleadaItem = {
                        timestamp: new Date().toLocaleTimeString(),
                        codigoQR: ordenInput.trim(),
                        etiqueta_material: "Error de consulta",
                        clase: "N/A",
                        dimensiones: {
                          largo: "N/A",
                          ancho: "N/A",
                          alto: "N/A",
                        },
                        success: false,
                        message:
                          err?.message ||
                          "Error al consultar órdenes de reimpresión.",
                        etiquetaCompleta: {} as EtiquetaPlastificado,
                        impresionExitosa: false,
                        logGuardado: false,
                      };

                      setEtiquetasPistoleadas((prev) => [
                        etiquetaError,
                        ...prev,
                      ]);
                      setEtiquetaPreviewSeleccionada(etiquetaError);
                      setOrdenesReimpresion([]);
                      setLogsReimpresionActual([]);
                      setOrdenesReimpresionError(
                        err?.message ||
                          "Error al consultar órdenes de reimpresión."
                      );
                    } finally {
                      setOrdenesReimpresionLoading(false);
                      setOrdenInput("");
                    }
                  }
                }}
              />
            </CardContent>
          </Card>

          {/* Historial de Etiquetas Pistoleadas */}
          {etiquetasPistoleadas.length > 0 && (
            <Card className="mt-6 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-primary flex items-center">
                    <Tag className="mr-2 h-5 w-5" />
                    Historial de Etiquetas Pistoleadas
                    <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {etiquetasPistoleadas.length}
                    </span>
                  </CardTitle>

                  {/* <button
                    onClick={limpiarHistorialEtiquetas}
                    className="text-xs bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 rounded-md transition-colors"
                    title="Limpiar historial"
                  >
                    Limpiar
                  </button> */}
                </div>
              </CardHeader>
              <CardContent
                style={{ maxHeight: 400, overflowY: "auto", paddingRight: 12 }}
              >
                <div className="space-y-3">
                  {etiquetasPistoleadas.map((etiqueta, index) => {
                    const isSuccess =
                      etiqueta.success && etiqueta.impresionExitosa;
                    const bgColor = isSuccess ? "#22c55e22" : "#dc262622";
                    const iconColor = isSuccess ? "#22c55e" : "#dc2626";
                    const Icon = isSuccess ? CheckCircle : XCircle;

                    return (
                      <div
                        key={index}
                        className={`p-4 rounded-lg text-sm border cursor-pointer transition-all hover:shadow-md ${
                          etiquetaPreviewSeleccionada === etiqueta
                            ? "ring-2 ring-blue-400 bg-blue-50"
                            : ""
                        }`}
                        style={{
                          backgroundColor:
                            etiquetaPreviewSeleccionada === etiqueta
                              ? "#eff6ff"
                              : bgColor,
                          borderColor:
                            etiquetaPreviewSeleccionada === etiqueta
                              ? "#3b82f6"
                              : iconColor + "44",
                        }}
                        onClick={() => {
                          setEtiquetaPreviewSeleccionada(
                            etiquetaPreviewSeleccionada === etiqueta
                              ? null
                              : etiqueta
                          );
                        }}
                        title="Click para ver en vista previa"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 mt-1">
                            <Icon
                              className="h-6 w-6"
                              style={{ color: iconColor }}
                            />
                          </div>

                          <div className="flex-grow">
                            <div className="grid grid-cols-6 gap-x-4 items-start mb-3">
                              <div>
                                <div className="text-xs text-muted-foreground font-semibold">
                                  Hora
                                </div>
                                <div className="font-bold">
                                  {etiqueta.timestamp}
                                </div>
                              </div>

                              <div>
                                <div className="text-xs text-muted-foreground font-semibold">
                                  Código QR
                                </div>
                                <div className="font-mono text-xs px-2 py-1 rounded">
                                  {etiqueta.codigoQR}
                                </div>
                              </div>

                              <div>
                                <div className="text-xs text-muted-foreground font-semibold">
                                  Material
                                </div>
                                <div className="font-medium text-xs">
                                  {etiqueta.etiqueta_material}
                                </div>
                              </div>

                              <div>
                                <div className="text-xs text-muted-foreground font-semibold">
                                  Clase
                                </div>
                                <div className="font-bold  text-blue-800 px-2 py-1 rounded">
                                  {etiqueta.clase}
                                </div>
                              </div>

                              <div>
                                <div className="text-xs text-muted-foreground font-semibold">
                                  Dimensiones
                                </div>
                                <div className="font-mono text-xs">
                                  {etiqueta.dimensiones.largo} ×{" "}
                                  {etiqueta.dimensiones.ancho} ×{" "}
                                  {etiqueta.dimensiones.alto} cm
                                </div>
                              </div>

                              {/* <div className="flex flex-col items-end">
                                <div className="flex gap-1 mb-1">
                                  {etiquetaPreviewSeleccionada === etiqueta && (
                                    <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded font-bold">
                                      EN VISTA
                                    </span>
                                  )}
                                  {etiqueta.success && (
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                      Leída
                                    </span>
                                  )}
                                  {etiqueta.impresionExitosa && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                      2 Copias
                                    </span>
                                  )}
                                  {etiqueta.logGuardado && (
                                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                      Log
                                    </span>
                                  )}
                                </div>
                              </div> */}
                            </div>

                            <div className="text-xs text-muted-foreground font-mono">
                              <div>
                                <strong>Estado:</strong> {etiqueta.message}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabla de órdenes de reimpresión */}
          {ordenesReimpresionLoading && (
            <div className="w-full flex justify-center items-center py-4">
              Cargando órdenes de reimpresión...
            </div>
          )}
          {ordenesReimpresionError && !ordenesReimpresionLoading && etiquetasPistoleadas.length === 0 && (
            <Card className="mt-6 border-yellow-300">
              <CardContent className="p-1">
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
                      alt="Orden No Encontrada"
                    />
                  </div>

                  <div className="flex-grow flex">
                    <div
                      className="rounded-xl shadow-lg p-10 flex flex-col items-center justify-center w-full"
                      style={{ background: "#f59e0b", minWidth: 320 }}
                    >
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
                      <p className="text-white text-[12px] text-center">
                        No se encontraron etiquetas para la orden ingresada{" "}
                        <br />
                        <span className="font-bold text-base">
                          {lastSearchedOrden}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {ordenesReimpresion.length > 0 && !ordenesReimpresionLoading && (
            <div className="overflow-x-auto my-6">
              <div className="flex items-center align-middle mb-0">
                <button
                  className="flex bg-red-600 text-white px-4 py-2 rounded mb-4 hover:bg-red-700 disabled:opacity-50"
                  onClick={handleReimprimirEtiquetas}
                  disabled={selectedOrdenes.length === 0}
                >
                  <Printer className="h-5 w-5 mr-2" />
                  Reimprimir etiquetas
                </button>

                <div className="m-5">
                  <h4>Órdenes seleccionadas: {selectedOrdenes.length}</h4>
                </div>
              </div>
              <table className="min-w-full rounded-xl overflow-hidden shadow border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="px-4 py-2 font-semibold text-left">
                      <input
                        type="checkbox"
                        checked={
                          selectedOrdenes.length === ordenesReimpresion.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOrdenes(
                              ordenesReimpresion.map((o) => o.CODIGO_BARRAS)
                            );
                          } else {
                            setSelectedOrdenes([]);
                          }
                        }}
                        aria-label="Seleccionar todas"
                      />
                    </th>
                    <th className="px-4 py-2 font-semibold text-left">
                      Paquete
                    </th>
                    <th className="px-4 py-2 font-semibold text-left">Fecha</th>
                    <th className="px-4 py-2 font-semibold text-left">Hora</th>
                    <th className="px-4 py-2 font-semibold text-left">Orden</th>
                    <th className="px-4 py-2 font-semibold text-left">
                      Cantidad
                    </th>
                    <th className="px-4 py-2 font-semibold text-left">
                      Material
                    </th>
                    <th className="px-4 py-2 font-semibold text-left">
                      Descripción
                    </th>
                    <th className="px-4 py-2 font-semibold text-left">
                      Departamento
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ordenesReimpresion.map((orden, idx) => {
                    let status = "";
                    let statusColor = "";
                    if (orden.CANTIDAD > 0) {
                      status = "Disponible";
                      statusColor =
                        "bg-green-100 text-green-700 border-green-400";
                    } else {
                      status = "Sin stock";
                      statusColor = "bg-red-100 text-red-700 border-red-400";
                    }
                    const isExpanded =
                      ordenReimpresionSeleccionada?.CODIGO_BARRAS ===
                      orden.CODIGO_BARRAS;
                    const checked = selectedOrdenes.includes(
                      orden.CODIGO_BARRAS
                    );
                    const bloqueado = paqueteExcedioLimite(
                      orden.NUM_ORDEN,
                      orden.POSICION
                    );
                    return (
                      <React.Fragment key={orden.CODIGO_BARRAS}>
                        <tr
                          className={`transition ${
                            bloqueado
                              ? "opacity-50 cursor-not-allowed bg-gray-100"
                              : "cursor-pointer"
                          } ${
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                          } hover:bg-blue-50 ${
                            !bloqueado && isExpanded
                              ? "ring-2 ring-blue-400"
                              : ""
                          }`}
                        >
                          <td className="px-4 py-2 border-b border-gray-200">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={bloqueado}
                              onChange={(e) => {
                                if (!bloqueado) {
                                  if (e.target.checked) {
                                    setSelectedOrdenes((prev) => [
                                      ...prev,
                                      orden.CODIGO_BARRAS,
                                    ]);
                                  } else {
                                    setSelectedOrdenes((prev) =>
                                      prev.filter(
                                        (c) => c !== orden.CODIGO_BARRAS
                                      )
                                    );
                                  }
                                }
                              }}
                              aria-label={`Seleccionar orden ${orden.NUM_ORDEN}`}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td
                            className="px-4 py-2 border-b border-gray-200"
                            onClick={() => {
                              if (!bloqueado) {
                                setOrdenReimpresionSeleccionada(
                                  isExpanded ? null : orden
                                );
                              }
                            }}
                          >
                            {orden.POSICION}
                          </td>
                          <td
                            className="px-4 py-2 border-b border-gray-200"
                            onClick={() => {
                              if (!bloqueado) {
                                setOrdenReimpresionSeleccionada(
                                  isExpanded ? null : orden
                                );
                              }
                            }}
                          >
                            {orden.FECHA
                              ? new Date(orden.FECHA).toLocaleDateString()
                              : ""}
                          </td>
                          <td
                            className="px-4 py-2 border-b border-gray-200"
                            onClick={() => {
                              if (!bloqueado) {
                                setOrdenReimpresionSeleccionada(
                                  isExpanded ? null : orden
                                );
                              }
                            }}
                          >
                            {orden.HORA}
                          </td>
                          <td
                            className="px-4 py-2 border-b border-gray-200 font-mono font-semibold"
                            onClick={() => {
                              if (!bloqueado) {
                                setOrdenReimpresionSeleccionada(
                                  isExpanded ? null : orden
                                );
                              }
                            }}
                          >
                            {orden.NUM_ORDEN}
                          </td>
                          <td
                            className="px-4 py-2 border-b border-gray-200 text-center font-bold"
                            onClick={() => {
                              if (!bloqueado) {
                                setOrdenReimpresionSeleccionada(
                                  isExpanded ? null : orden
                                );
                              }
                            }}
                          >
                            {orden.CANTIDAD}
                          </td>
                          <td
                            className="px-4 py-2 border-b border-gray-200 font-mono"
                            onClick={() => {
                              if (!bloqueado) {
                                setOrdenReimpresionSeleccionada(
                                  isExpanded ? null : orden
                                );
                              }
                            }}
                          >
                            {orden.COD_MATERIAL}
                          </td>
                          <td
                            className="px-4 py-2 border-b border-gray-200"
                            onClick={() => {
                              if (!bloqueado) {
                                setOrdenReimpresionSeleccionada(
                                  isExpanded ? null : orden
                                );
                              }
                            }}
                          >
                            {orden.MATERIAL}
                          </td>
                          <td
                            className="px-4 py-2 border-b border-gray-200"
                            onClick={() => {
                              if (!bloqueado) {
                                setOrdenReimpresionSeleccionada(
                                  isExpanded ? null : orden
                                );
                              }
                            }}
                          >
                            {orden.DEPARTAMENTO}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td
                              colSpan={10}
                              className="bg-blue-50 border-b border-blue-200 p-4"
                            >
                              <div className="flex justify-center">
                                <OrderStickerColchonesSimple
                                  //order={order}
                                  codigoBarras="20010521-251027170331084805"
                                  añosGarantia={10}
                                  tipo="IV"
                                  clase="E"
                                  dimensiones={{
                                    ancho: 160,
                                    largo: 200,
                                    alto: 30,
                                  }}
                                  producto="PRODUCTO EJEMPLO"
                                  empresa="CHAIDE"
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!ordenesReimpresionLoading &&
            !ordenesReimpresionError &&
            ordenesReimpresion.length === 0 && 
            etiquetasPistoleadas.length === 0 && (
              <Card className="mt-6">
                <CardContent className="p-1">
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
                          Por favor, ingrese una orden para mostrar las
                          etiquetas asociadas.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          {/* Fin tabla órdenes reimpresión */}
          {notificationHistoryPistoleado.length > 0 && etiquetasPistoleadas.length === 0 && (
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
                            {Icon && (
                              <Icon className="h-5 w-5" style={{ color }} />
                            )}
                          </div>
                          <div className="flex-grow grid grid-cols-6 gap-x-5 items-center">
                            <div className="font-semibold">
                              <div className="text-xs text-muted-foreground">
                                Acción
                              </div>
                              <div className="font-bold" style={{ color }}>
                                {item.type}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">
                                Hora
                              </div>
                              <div>{item.timestamp}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">
                                Orden
                              </div>
                              <div>{item.order}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">
                                Código de Barras
                              </div>
                              <div className="text-[10px]">{item.barcode}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">
                                Cantidad
                              </div>
                              <div className="font-bold">
                                {item.quantity.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">
                                Paquete
                              </div>
                              <div className="font-bold">{item.paquete ?? "-"}</div>
                            </div>
                            <div className="col-span-5 text-xs text-muted-foreground font-mono mt-1">
                              <div>
                                <strong>Respuesta:</strong> {item.message}
                              </div>
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
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-destructive" />
                          )}
                        </div>
                        <div className="flex-grow grid grid-cols-6 gap-x-5 items-center">
                          <div className="font-semibold">
                            <div className="text-xs text-muted-foreground">
                              Acción
                            </div>
                            <div
                              className={`font-bold ${
                                item.type === "PNC"
                                  ? "text-destructive"
                                  : "text-foreground"
                              }`}
                            >
                              {item.type}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Hora
                            </div>
                            <div>{item.timestamp}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Orden
                            </div>
                            <div>{item.order}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Código de Barras
                            </div>
                            <div className="text-[10px]">
                              {item.barcode !== "Fallo al guardar"
                                ? item.barcode
                                : ""}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Cantidad
                            </div>
                            <div className="font-bold">
                              {item.quantity.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Paquete
                            </div>
                            <div className="font-bold">{item.paquete ?? "-"}</div>
                          </div>
                          <div className="col-span-5 text-xs text-muted-foreground font-mono mt-1">
                            <div>
                              <strong>Respuesta:</strong> {item.message}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Modal de Reimpresión */}
      <AlertDialog 
        open={modalReimpresion.open} 
        onOpenChange={(open) => {
          if (!open) {
            setModalReimpresion({
              open: false,
              etiqueta: null,
              codigoQR: "",
              impresionesActuales: 0,
            });
            setCantidadAImprimir(1);
            // Restaurar foco después de cerrar modal
            setTimeout(() => {
              if (barcodeInputRef.current) {
                barcodeInputRef.current.focus();
              }
            }, 100);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <Printer className="mr-2 h-5 w-5 text-orange-500" />
              Reimpresión de Etiqueta
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="text-sm text-yellow-800">
                    <strong>QR:</strong> {modalReimpresion.codigoQR}
                  </div>
                  <div className="text-sm text-yellow-800">
                    <strong>Impresiones actuales:</strong> {modalReimpresion.impresionesActuales} de {limiteReimpresiones}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    ¿Cuántas etiquetas desea imprimir?
                  </label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setCantidadAImprimir(1)}
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                        cantidadAImprimir === 1
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      1 copia
                    </button>
                    <button
                      onClick={() => setCantidadAImprimir(2)}
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                        cantidadAImprimir === 2
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      2 copias
                    </button>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <button
              onClick={() => {
                setModalReimpresion({
                  open: false,
                  etiqueta: null,
                  codigoQR: "",
                  impresionesActuales: 0,
                });
                setCantidadAImprimir(1);
                // Restaurar foco después de cancelar
                setTimeout(() => {
                  if (barcodeInputRef.current) {
                    barcodeInputRef.current.focus();
                  }
                }, 100);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <AlertDialogAction
              onClick={confirmarReimpresion}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Imprimir {cantidadAImprimir} {cantidadAImprimir === 1 ? 'copia' : 'copias'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

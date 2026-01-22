"use client";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useUser, NotificationHistoryItem } from "@/context/user-context";
import type {
  EtiquetaPlastificado,
  OrdenReimpresion,
  EtiquetaPistoleadaItem,
  OrdenProduccion,
} from "@/types/interfaces";
import { Order, OrderAlmohadas } from "@/types/order";
import { useToast } from "@/hooks/use-toast";
import { servicioService } from "@/services/servicio.service";
import { ScanBarcode, Play, Square, Printer } from "lucide-react";
import {
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialog,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ElementsTable from "@/components/ui/ElementsTable";
import CollaboratorLoginModal from "./components/collaborator-login-modal";
import OrderStickerCambioPlastico from "./components/order-sticker";
import { sesionService } from "@/services/sesion.service";
import { logCambioPlasticosService } from "@/services/logCambioPlastico.service";

export default function CambiosPlasticosPage() {
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
  const [barcodeValue, setBarcodeValue] = useState<string>("");
  const [primerValor, setPrimerValor] = useState<any>({});
  // Refs y estado para sincronizar altura de columnas
  const rightColumnRef = useRef<HTMLDivElement>(null);
  const [rightColumnHeight, setRightColumnHeight] = useState<number>(0);
  // Efecto para mantener el foco en el input
  useEffect(() => {
    const focusInput = () => {
      // Solo enfocar si no hay otro elemento de input enfocado
      const activeElement = document.activeElement;
      const isOtherInputFocused = activeElement && 
        (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA");
      
      if (!isOtherInputFocused && barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    };

    // Foco inicial
    focusInput();

    // Mantener foco cuando se hace click fuera (pero no en otros inputs)
    const handleClickOutside = () => {
      setTimeout(focusInput, 10);
    };

    // Mantener foco cuando se cambia de ventana
    const handleWindowFocus = () => {
      setTimeout(focusInput, 10);
    };

    document.addEventListener("click", handleClickOutside);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("click", handleClickOutside);
      window.removeEventListener("focus", handleWindowFocus);
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
  const [trabajoIniciado, setTrabajoIniciado] = useState<boolean>(false);
  // Estado para el input de código de barras
  const [ordenInput, setOrdenInput] = useState("");
  const [lastSearchedOrden, setLastSearchedOrden] = useState<string>("");
  // Estado para checkboxes de selección múltiple
  const [selectedOrdenes, setSelectedOrdenes] = useState<string[]>([]);
  
  // Estado para el tipo de cambio de plástico
  const [tipoCambio, setTipoCambio] = useState<"DOBLE PLASTICO" | "REPROCESO">("DOBLE PLASTICO");

  // Expresión regular: 8 dígitos, guión medio, y al menos 1 dígito más
  // Patrón: xxxxxxxx-yyyy... (donde x e y son dígitos)
  const ordenRegex = /^(\d{0,8})(-)?(\d*)$/;
  
  // Función para validar si el código es válido (formato correcto)
  const isValidBarcodeFormat = (value: string): boolean => {
    if (value === "") return true; // Permite cadena vacía mientras se escribe
    // Validar que tenga 8 dígitos, luego guión, luego al menos 1 dígito
    const fullPattern = /^\d{8}-\d+$/;
    return fullPattern.test(value);
  };

  // Función para formatear automáticamente el código de barras
  // Si tiene más de 8 dígitos sin guión, agrega el guión automáticamente
  const formatBarcodeInput = (value: string): string => {
    // Remover caracteres que no sean dígitos ni guiones
    let cleaned = value.replace(/[^\d-]/g, "");
    
    // Si tiene 9 o más dígitos sin guión, insertar guión después del 8vo dígito
    const digitsOnly = cleaned.replace(/-/g, "");
    if (digitsOnly.length > 8 && !cleaned.includes("-")) {
      // Insertar guión después del octavo dígito
      cleaned = digitsOnly.slice(0, 8) + "-" + digitsOnly.slice(8);
    }
    
    return cleaned;
  };
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
    areaProcessControls,
    fetchActiveSessions,
  } = useUser();
  const { toast } = useToast();
  const [lastNotification, setLastNotification] =
    useState<NotificationHistoryItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<string>("all");
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
  const [selectedMaterials, setSelectedMaterials] = useState<any[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [savedLogs, setSavedLogs] = useState<any[]>([]);
  const [isJustRegistered, setIsJustRegistered] = useState<boolean>(false);
  const [solicitante, setSolicitante] = useState<string>("");

  // Función para limpiar el historial de etiquetas pistoleadas
  const limpiarHistorialEtiquetas = () => {
    setEtiquetasPistoleadas([]);
    setEtiquetaPreviewSeleccionada(null);
  };

  // Stubs mínimos para mantener la tabla funcionando (sin lógica de impresión)
  const paqueteExcedioLimite = (
    numOrden: string,
    numeroPaquete: number
  ): boolean => {
    return false;
  };

  const handleReimprimirEtiquetas = async () => {
    // Intencionalmente vacío: no reimprime en esta versión mínima
  };

  // Efecto para mantener foco después de operaciones
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  // Función auxiliar para comparar si dos etiquetas son idénticas
  const sonEtiquetasIdenticas = (
    etiqueta1: any,
    etiqueta2: EtiquetaPlastificado
  ): boolean => {
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
  const filtrarLogsDeEtiqueta = (
    logs: any[],
    etiquetaData: EtiquetaPlastificado
  ): any[] => {
    return logs.filter((log: any) => {
      try {
        if (!log.parametros) return false;

        const parametrosLog =
          typeof log.parametros === "string"
            ? JSON.parse(log.parametros)
            : log.parametros;

        return sonEtiquetasIdenticas(parametrosLog, etiquetaData);
      } catch (parseError) {
        console.warn("[LOGS] Error al parsear parámetros del log:", parseError);
        return false;
      }
    });
  };

  // Formatea segundos (number) a HH:mm:ss
  const formatSecondsToHHMMSS = (secs: number | string | undefined): string => {
    if (secs === undefined || secs === null || secs === "") return "00:00:00";
    const s = typeof secs === 'string' ? Number(secs) : secs;
    if (Number.isNaN(s) || !isFinite(s)) return String(secs);
    const total = Math.floor(s);
    const hh = String(Math.floor(total / 3600)).padStart(2, '0');
    const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const ss = String(total % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
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
    [filterOrdersByStationLetter]
  );

  // (extraerLetraYNombre ya definido arriba)

  // Variable global para controlar la notificación SAP
  const NOTIFICA_SAP = !!userStation?.notifica;

  let resultado: { letra: string | null; nombreLimpio: string } | undefined;
  if (userStation?.nombre_estacion.includes("EST-")) {
    resultado = extraerLetraYNombre(userStation?.nombre_estacion || "");
  }

  // No necesitamos este useEffect porque fetchOrders ya filtra y setOrders
  // La tabla automáticamente usa lo que setOrders haya asignado

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

  const isSessionActiveOnAnotherStation = useMemo(() => {
    if (!user?.code || !userStation) return false;
    return activeSessions.some(
      (s) =>
        s.codigo_operador === user.code &&
        s.codigo_estacion !== userStation.codigo_estacion &&
        s.tipo_evento === "beg" &&
        s.estado === "A"
    );
  }, [activeSessions, user?.code, userStation]);

  const handleStartSession = async () => {
    if (!user || !userStation) {
      toast({
        title: "Error",
        description: "Falta información de Usuario o Estación para iniciar.",
        variant: "destructive",
      });
      return;
    }

    // Para cambios de plástico no asociamos la sesión a una orden ni a un AreaControl
    const allUsers = [user, ...collaborators];

    // Deactivate existing sessions for these users
    try {
      for (const currentUser of allUsers) {
        const sessionsResponse = await sesionService.getByCodigoOperador(
          currentUser!.code
        );
        const activeUserSessions = (sessionsResponse.data || []).filter(
          (s: any) => s.estado === "A" && s.tipo_evento === "beg"
        );
        const deactivationPromises = activeUserSessions.map((session: any) =>
          sesionService.delete(session.codigo_sesion)
        );
        await Promise.all(deactivationPromises);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "No se pudo desactivar las sesiones anteriores.";
      toast({
        title: "Error de Limpieza",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }

    const sessionPromises = allUsers.map((currentUser) => {
      const newSessionData: any = {
        codigo_sesion: 0,
        codigo_estacion: userStation.codigo_estacion,
        codigo_rcp: null,
        codigo_operador: currentUser.code,
        tipo_evento: "beg",
        estado: "A",
        fecha_evento: new Date().toISOString(),
      };
      return sesionService.save(newSessionData);
      // Sesión sintética para pruebas (no persiste en el backend)
      // const syntheticSession = {
      //   data: {
      //     ...newSessionData,
      //     // generar id sintético
      //     codigo_sesion: Math.floor(Math.random() * 1000000) + 1,
      //   },
      // };
      // return Promise.resolve(syntheticSession as any);
    });

    try {
      await Promise.all(sessionPromises);
      await fetchActiveSessions();
      // registrar hora de inicio de trabajo
      setSessionStartTime(Date.now());
      // resetear el flag de registro
      setIsJustRegistered(false);
      toast({
        title: "Éxito",
        description: `Sesión iniciada para ${allUsers.length} persona(s) en la estación ${userStation.nombre_estacion}.`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "No se pudo iniciar la sesión para todos los usuarios.";
      toast({
        title: "Error al iniciar sesión",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Función para ejecutar la búsqueda de etiqueta
  const executeSearch = async (codigo: string) => {
    if (!codigo.trim()) return;
    
    const formattedCodigo = formatBarcodeInput(codigo.trim());
    
    // Validar que el código tenga el formato correcto
    if (!isValidBarcodeFormat(formattedCodigo)) {
      toast({
        title: "Formato inválido",
        description: "El código debe tener el formato: 8 números, guión, y más números (ejemplo: 12345678-1)",
        variant: "destructive",
      });
      return;
    }
    
    setLastSearchedOrden(formattedCodigo);
    setOrdenesReimpresionLoading(true);
    setOrdenesReimpresionError(null);
    // Resetear flag para mostrar cards en nueva búsqueda
    setIsJustRegistered(false);
    try {
      const response = await servicioService.getReimpresionPlastificado(formattedCodigo);
      if (response && Array.isArray(response.data) && response.data.length > 0) {
        setOrdenesReimpresion(response.data);
      } else {
        setOrdenesReimpresion([]);
        setOrdenesReimpresionError("No se encontraron resultados para la búsqueda");
      }
    } catch (error: any) {
      setOrdenesReimpresion([]);
      setOrdenesReimpresionError(error?.message || "Error al buscar la etiqueta");
    } finally {
      setOrdenesReimpresionLoading(false);
      setOrdenInput("");
    }
  };

  const handleFinishSession = async () => {
    if (!activeSessionOfCurrentUser) {
      toast({
        title: "Error",
        description: "No hay una sesión activa en esta estación para finalizar.",
        variant: "destructive",
      });
      return;
    }

    // Validar que solicitante no esté vacío
    if (!solicitante.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa el nombre del solicitante.",
        variant: "destructive",
      });
      return;
    }

    // Validar que haya al menos un material seleccionado
    if (!selectedMaterials || selectedMaterials.length === 0) {
      toast({
        title: "Error",
        description: "Por favor selecciona al menos un material para el cambio.",
        variant: "destructive",
      });
      return;
    }

    // Primero: guardar log de cambio de plástico
    let tiempoEmpleadoSegundos = 0;
    let tiempoEmpleadoStr = "00:00:00";
    try {
      const identificacion_producto = barcodeValue || "";
      const nombre_producto = (primerValor && primerValor.NOMBRE) || "";
      const fecha_cambio = new Date().toISOString();

      const operador = user?.code || "";
      const colaboradoresStr = (collaborators || []).map((c: any) => c.code).join("&");
      // Preferir el nombre de estación obtenido por IP (userStation.nombre_estacion).
      // Si no existe, fallback a `selectedMachine` (puede ser 'all' o vacío).
      const estacionVal = userStation?.nombre_estacion || selectedMachine || "";

      // Calcular tiempo empleado: guardamos los segundos transcurridos (float)
      if (sessionStartTime) {
        const diffMs = Date.now() - sessionStartTime;
        const segundosFloat = diffMs / 1000; // puede contener fracción
        tiempoEmpleadoSegundos = Number(segundosFloat.toFixed(2));

        const totalSeconds = Math.floor(segundosFloat);
        const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
        const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
        const ss = String(totalSeconds % 60).padStart(2, "0");
        tiempoEmpleadoStr = `${hh}:${mm}:${ss}`;
      }

      // Crear un registro por cada material seleccionado
      const savePromises = (selectedMaterials || []).map((material: any) => {
        const payload = {
          codigo_log_cp: 0,
          identificacion_producto,
          nombre_producto,
          material_fert: material.FERT || "",
          fecha_cambio,
          material_cambio: material.HALB_N1 || "",
          material_cambio_nombre: material.HALB_N1N || "",
          material_cambio_cantidad: material.CantidadItem || 0,
          material_cambio_unidad: material.HALB_N1_Unidad || "",
          solicitante: solicitante.trim(),
          operador,
          colaboradores: colaboradoresStr,
          estacion: estacionVal,
          tiempo_empleado: tiempoEmpleadoSegundos,
          estado: "A",
          tipo_cambio: tipoCambio,
        };
        return logCambioPlasticosService.save(payload);
      });

      // Ejecutar todas las promesas de guardado
      await Promise.all(savePromises);
      
      // guardar registros localmente como exitosos (incluye formato hh:mm:ss para UI)
      const newEntries = (selectedMaterials || []).map((material: any) => ({
        codigo_log_cp: 0,
        identificacion_producto,
        nombre_producto,
        material_fert: material.FERT || "",
        fecha_cambio,
        material_cambio: material.HALB_N1 || "",
        material_cambio_nombre: material.HALB_N1N || "",
        material_cambio_cantidad: material.CantidadItem || 0,
        material_cambio_unidad: material.HALB_N1_Unidad || "",
        solicitante: solicitante.trim(),
        operador,
        colaboradores: colaboradoresStr,
        estacion: estacionVal,
        tiempo_empleado: tiempoEmpleadoSegundos,
        estado: "A",
        tipo_cambio: tipoCambio,
        saved: true,
        tiempo_empleado_hhmmss: tiempoEmpleadoStr,
      }));
      const existing = JSON.parse(localStorage.getItem("logCambioPlasticosHistory") || "[]");
      existing.unshift(...newEntries);
      localStorage.setItem("logCambioPlasticosHistory", JSON.stringify(existing));
      setSavedLogs(existing);

      // mostrar toast de confirmación
      toast({
        title: "Éxito",
        description: "Cambio de plástico registrado correctamente.",
      });
      
      // limpiar estados
      setIsJustRegistered(true);
      setSolicitante("");
      setSelectedMaterials([]);
    } catch (err: any) {
      // guardar intentos fallidos en historial local (marcados como no guardados)
      if (selectedMaterials && selectedMaterials.length > 0) {
        const failedEntries = (selectedMaterials || []).map((material: any) => ({
          codigo_log_cp: 0,
          identificacion_producto: barcodeValue || "",
          nombre_producto: (primerValor && primerValor.NOMBRE) || "",
          material_fert: material.FERT || "",
          fecha_cambio: new Date().toISOString(),
          material_cambio: material.HALB_N1 || "",
          material_cambio_nombre: material.HALB_N1N || "",
          material_cambio_cantidad: material.CantidadItem || 0,
          material_cambio_unidad: material.HALB_N1_Unidad || "",
          solicitante: solicitante.trim(),
          operador: user?.code || "",
          colaboradores: (collaborators || []).map((c: any) => c.code).join("&"),
          estacion: userStation?.nombre_estacion || selectedMachine || "",
          tiempo_empleado: tiempoEmpleadoSegundos,
          estado: "A",
          tipo_cambio: tipoCambio,
          saved: false,
          error: err?.message || "Error desconocido",
          tiempo_empleado_hhmmss: tiempoEmpleadoStr,
        }));
        const existingFail = JSON.parse(localStorage.getItem("logCambioPlasticosHistory") || "[]");
        existingFail.unshift(...failedEntries);
        localStorage.setItem("logCambioPlasticosHistory", JSON.stringify(existingFail));
        setSavedLogs(existingFail);
      }

      toast({
        title: "Error al guardar log",
        description: err?.message || "No se pudo guardar el registro de cambio.",
        variant: "destructive",
      });
      return; // no cerrar sesiones si falla el guardado
    }

    // Luego: finalizar sesiones
    await finishSession();
  };

  // Cargar historial guardado desde localStorage al montar
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("logCambioPlasticosHistory") || "[]");
      setSavedLogs(Array.isArray(stored) ? stored : []);
    } catch (e) {
      setSavedLogs([]);
    }
  }, []);

  const clearSavedLogs = () => {
    localStorage.removeItem("logCambioPlasticosHistory");
    setSavedLogs([]);
  };

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
        setOrders([]);
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

        const notificationSums = new Map<string, number>();
        notificationHistoryPistoleado.forEach((item) => {
          if (item.success && item.type === "Notificación") {
            notificationSums.set(
              item.order,
              (notificationSums.get(item.order) || 0) + item.quantity
            );
          }
        });

        const adjustedOrders = allOrders.map((order) => {
          const notifiedInSession = notificationSums.get(order.orden) || 0;
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
          return {
            ...order,
            cantPendiente: order.cantProgramada - order.cantNotificada,
          };
        });

        // Eliminar duplicados localmente
        const uniqueOrders = adjustedOrders.filter(
          (order, index, self) =>
            index === self.findIndex((o) => o.orden === order.orden)
        );

        setOrders(uniqueOrders);

        const currentSelectedOrder = JSON.parse(
          localStorage.getItem("selectedOrder") || "null"
        );

        if (currentSelectedOrder) {
          const orderInNewList = uniqueOrders.find(
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
        } else if (uniqueOrders.length > 0) {
          setSelectedOrder(uniqueOrders[0]);
          localStorage.setItem(
            "selectedOrder",
            JSON.stringify(uniqueOrders[0])
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
          setOrders([]);
        }
      } finally {
        if (isInitialFetch) setIsLoading(false);
      }
    },
    [user, toast, notificationHistoryPistoleado, selectedOrder]
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
  }, []);

  const rightVisible = ordenesReimpresion && ordenesReimpresion.length > 0;

  useEffect(() => {
    if (ordenesReimpresion && ordenesReimpresion.length > 0) {
      setPrimerValor(ordenesReimpresion[0]);
    } else {
      setPrimerValor({});
    }
  }, [ordenesReimpresion]);

  // Efecto para medir altura de la columna derecha
  useEffect(() => {
    const measureRightColumn = () => {
      if (rightColumnRef.current) {
        const height = rightColumnRef.current.offsetHeight;
        setRightColumnHeight(height);
      }
    };

    if (rightVisible) {
      // Medir después de que el DOM se actualice
      setTimeout(measureRightColumn, 100);
      // Remedir en caso de cambios de tamaño
      window.addEventListener('resize', measureRightColumn);
      return () => window.removeEventListener('resize', measureRightColumn);
    }
  }, [rightVisible]);

  if (!isClient) {
    return null;
  }

  return (
    <>
      <div className="grid grid-cols-7 gap-4" style={{ maxHeight: "calc(100vh - 100px)", overflow: "hidden" }}>
        <div className={(rightVisible && !isJustRegistered) ? "col-span-4" : "col-span-7"}>
          <div className="flex flex-col gap-2" style={{ maxHeight: rightColumnHeight > 0 ? `${rightColumnHeight}px` : "calc(100vh - 100px)" }}>
            {/*Inicio sección de busqueda de QRs*/}
            <Card className="m-3">
              <CardHeader className="p-0 mt-1">
                <div className="p-0 m-1 flex flex-col items-start justify-between">
                  <div className="flex flex-col ">
                    <span className="text-lg font-semibold">
                      Cambio de Plásticos
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="block text-[10px] font-normal">
                        {userStationNameText}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Card className="mt-0 w-full p-0 no-border shadow-none">
                  <CardContent className="p-0 flex items-center justify-center">
                    <ScanBarcode className="inline-block mr-2 h-5 w-5" />

                    <input
                      type="text"
                      placeholder="Buscar etiqueta (xxxxxxxx-yyyy...)..."
                      className="border p-1 rounded w-[35%]"
                      value={ordenInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Formatear automáticamente: agrega guión si falta
                        const formatted = formatBarcodeInput(val);
                        // Valida el formato mientras se escribe
                        if (formatted === "" || ordenRegex.test(formatted)) {
                          setOrdenInput(formatted);
                          setBarcodeValue(formatted);
                          
                          // Auto-ejecutar búsqueda si el formato es válido y completo
                          if (isValidBarcodeFormat(formatted)) {
                            executeSearch(formatted);
                          }
                        }
                      }}
                      ref={barcodeInputRef}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && ordenInput.trim() !== "") {
                          executeSearch(ordenInput.trim());
                        }
                      }}
                    />
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
            {/*Fin sección de busqueda de QRs*/}
            {!isJustRegistered && (
            <>
            {/*Inicio sección de busqueda de información de QR de busqueda*/}
            {rightVisible && (
              <Card className="m-2">
                <CardContent className="p-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="col-span-2">
                    {ordenesReimpresion.length > 0 &&
                      !ordenesReimpresionLoading &&
                      (() => {
                        const primera: any = ordenesReimpresion[0];
                        return (
                          <div className="mb-2">
                            <div className="text-sm font-bold text-yellow-500 break-words p-0">
                              QR: {barcodeValue}
                            </div>
                            <div className="flex flex-row gap-4 items-center p-0">
                              <div className="text-lg font-bold text-sky-700 break-words">
                                Material: {primera.CODIGO}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Orden: {primera.NUM_CABECERA}
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground mt-0">
                              Descripción del Material
                            </div>
                            <div className="font-semibold">
                              {primera.NOMBRE}
                            </div>

                            <div className="grid grid-cols-2 gap-0 mt-0 text-sm text-muted-foreground">
                              <div>
                                Garantía:{" "}
                                <span className="font-medium text-foreground">
                                  {primera.Garantia}
                                </span>
                              </div>
                              <div>
                                Código Antiguo:{" "}
                                <span className="font-medium text-foreground">
                                  {primera.Etiqueta_CodigoAntiguo}
                                </span>
                              </div>
                              <div>
                                Dimensiones:{" "}
                                <span className="font-mono">
                                  {primera.Ancho} x {primera.Largo} x{" "}
                                  {primera.Alto} cm
                                </span>
                              </div>
                              <div>
                                Peso:{" "}
                                <span className="font-medium">
                                  {primera.PesoKg} kg
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                  </div>
                  <div className="col-span-1 flex flex-col items-end space-y-2">
                    <div className="w-44">
                      {!activeSessionOfCurrentUser ? (
                        <Button
                          onClick={handleStartSession}
                          disabled={isSessionActiveOnAnotherStation}
                          className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Iniciar Trabajo
                        </Button>
                      ) : null}
                    </div>

                    <div className="w-44">
                      <Button
                        onClick={handleFinishSession}
                        disabled={!activeSessionOfCurrentUser}
                        className="w-full bg-green-500 hover:bg-green-600 text-black"
                      >
                        <Square className="mr-2 h-4 w-4" />
                        Registrar cambio
                      </Button>
                    </div>

                    {/* Radio buttons para tipo de cambio + Input Solicitante */}
                    <div className={`w-full pt-4 border-t ${activeSessionOfCurrentUser ? 'opacity-50' : ''}`}>
                      <div className="flex gap-6">
                        {/* Radio buttons */}
                        <div className="flex-shrink-0">
                          <p className="text-sm font-medium text-gray-700 mb-3">Tipo de cambio:</p>
                          <div className="space-y-2">
                            <label className={`flex items-center ${activeSessionOfCurrentUser ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                              <input
                                type="radio"
                                name="tipoCambio"
                                value="DOBLE PLASTICO"
                                checked={tipoCambio === "DOBLE PLASTICO"}
                                onChange={(e) => setTipoCambio(e.target.value as "DOBLE PLASTICO" | "REPROCESO")}
                                disabled={!!activeSessionOfCurrentUser}
                                className="w-4 h-4 text-blue-600"
                              />
                              <span className="ml-2 text-sm text-gray-700">Doble Plástico</span>
                            </label>
                            <label className={`flex items-center ${activeSessionOfCurrentUser ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                              <input
                                type="radio"
                                name="tipoCambio"
                                value="REPROCESO"
                                checked={tipoCambio === "REPROCESO"}
                                onChange={(e) => setTipoCambio(e.target.value as "DOBLE PLASTICO" | "REPROCESO")}
                                disabled={!!activeSessionOfCurrentUser}
                                className="w-4 h-4 text-blue-600"
                              />
                              <span className="ml-2 text-sm text-gray-700">Reproceso</span>
                            </label>
                          </div>
                        </div>
                        
                        {/* Input para solicitante */}
                        <div className="flex-1 min-w-0">
                          <label className="text-sm font-medium text-gray-700 mb-2 block">
                            Solicitante *
                          </label>
                          <input
                            type="text"
                            placeholder="Nombre del solicitante"
                            value={solicitante}
                            onChange={(e) => setSolicitante(e.target.value)}
                            disabled={!!activeSessionOfCurrentUser}
                            className={`w-full px-3 py-2 border rounded-md text-sm ${
                              solicitante.trim() 
                                ? 'border-gray-300 bg-white' 
                                : 'border-red-300 bg-red-50'
                            } ${
                              activeSessionOfCurrentUser 
                                ? 'cursor-not-allowed opacity-50' 
                                : 'focus:outline-none focus:ring-2 focus:ring-blue-500'
                            }`}
                          />
                          {!solicitante.trim() && (
                            <p className="text-xs text-red-600 mt-1">Campo requerido</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {/*Inicio sección de busqueda de información de QR de busqueda*/}
            {/* Inicio card para la tabla de elementos (debajo del card de controles) */}
            {rightVisible && (
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  minHeight: 0,
                  maxHeight: "100%",
                }}
              >
                <Card className="m-2 mb-4">
                  <CardTitle className="m-2 text-lg font-semibold">Receta del Producto</CardTitle>
                  <CardContent className="p-0">
                    <Card className="m-2">
                      <CardContent className="p-4">
                        {/* Pasamos qrResponse basado en el primer elemento de ordenesReimpresion si existe */}
                        {ordenesReimpresion && ordenesReimpresion.length > 0 ? (
                          <ElementsTable
                            qrResponse={{
                              CODIGO: (ordenesReimpresion[0].CODIGO || "")
                                .toString()
                                .split("-")[0],
                              CIUDAD:
                                (ordenesReimpresion[0] as any).CIUDAD ||
                                (ordenesReimpresion[0] as any).Ciudad ||
                                "",
                            }}
                            onSelectionChange={(items) => setSelectedMaterials(items)}
                          />
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            No hay elementos del QR para consultar
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              </div>
            )}
            {/* Fin card para la tabla de elementos (debajo del card de controles) */}
            </>
            )}
          </div>
        </div>

        {rightVisible && !isJustRegistered && (
          <div ref={rightColumnRef} className="col-span-3 flex justify-center items-start" style={{ maxHeight: "calc(100vh - 100px)", overflow: "auto" }}>
            <div className="transform origin-top p-4 rounded-lg shadow-lg">
              {" "}
              <OrderStickerCambioPlastico
                codigoBarras={barcodeValue}
                añosGarantia={primerValor.Garantia || "N/A"}
                tipo={primerValor.Tipo || "N/A"}
                clase={primerValor.Clase || "N/A"}
                dimensiones={{
                  ancho: primerValor.Ancho || "",
                  largo: primerValor.Largo || "",
                  alto: primerValor.Alto || "",
                }}
                producto={primerValor.Etiqueta_Material || "No encontrado"}
                empresa={primerValor.Etiqueta_CodigoAntiguo || "CHAIDE"}
                tapa={
                  (primerValor.Tapa_Tela1 != "No Aplica"
                    ? primerValor.Tapa_Tela1
                    : "") +
                  (primerValor.Tapa_Tela2 != "No Aplica"
                    ? " - " + primerValor.Tapa_Tela2
                    : "") +
                  (primerValor.Tapa_Tela3 != "No Aplica"
                    ? " - " + primerValor.Tapa_Tela3
                    : "")
                }
                banda={
                  (primerValor.Tela_Banda1 != "No Aplica"
                    ? primerValor.Tela_Banda1
                    : "") +
                  (primerValor.Tela_Banda2 != "No Aplica"
                    ? " - " + primerValor.Tela_Banda2
                    : "") +
                  (primerValor.Tela_Banda3 != "No Aplica"
                    ? " - " + primerValor.Tela_Banda3
                    : "")
                }
                tela_tapa={
                  (primerValor.Tela_Tapa1 != "No Aplica"
                    ? primerValor.Tela_Tapa1
                    : "") +
                  (primerValor.Tela_Tapa2 != "No Aplica"
                    ? " - " + primerValor.Tela_Tapa2
                    : "") +
                  (primerValor.Tela_Tapa3 != "No Aplica"
                    ? " - " + primerValor.Tela_Tapa3
                    : "")
                }
                aislante={
                  primerValor.Aislante != "NA"
                    ? primerValor.Aislante
                    : "No Aplica"
                }
                lamina_textil={
                  (primerValor.Lamina3 ? primerValor.Lamina3 : "") ||
                  (primerValor.Lamina4 ? " - " + primerValor.Lamina4 : "") ||
                  (primerValor.Lamina5 ? " - " + primerValor.Lamina5 : "")
                }
                numero_resortes={primerValor.Resortes || ""}
                peso_maximo_individual={
                  primerValor.PesoLb + "Lb / " + primerValor.PesoKg + "Kg" || ""
                }
                espuma_banda={primerValor.Lamina_Banda || ""}
                espuma_tapa={primerValor.Lamina_Tapa || ""}
                R1={primerValor.Espuma || ""}
                R2={primerValor.Lamina1 || ""}
                R3={primerValor.Lamina2 || ""}
                LOTE={primerValor.NUM_CABECERA || "No definido"}
              />
            </div>
          </div>
        )}
      </div>

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
                    <strong>Impresiones actuales:</strong>{" "}
                    {modalReimpresion.impresionesActuales} de{" "}
                    {limiteReimpresiones}
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
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      1 copia
                    </button>
                    <button
                      onClick={() => setCantidadAImprimir(2)}
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                        cantidadAImprimir === 2
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      2 copias
                    </button>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>

      <CollaboratorLoginModal
        isOpen={isLoginModalOpen}
        onOpenChange={setLoginModalOpen}
      />

      {/* Historial de registros de cambio de plástico - Solo si hay eventos */}
      {savedLogs.length > 0 && (
        <div className="mt-6 mx-4 mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 11H7v2h2v-2zm0-4H7v2h2V7zm4 4h-2v2h2v-2zm0-4h-2v2h2V7z" />
            </svg>
            Historial de Cambios de Plástico
          </h3>
          
          <div className="space-y-3">
            {Object.entries(
              savedLogs.reduce((acc: any, log: any) => {
                const qr = log.identificacion_producto;
                if (!acc[qr]) {
                  acc[qr] = [];
                }
                acc[qr].push(log);
                return acc;
              }, {})
            ).map(([qr, logs]: [string, any]) => {
              const firstLog = logs[0];
              const allSaved = logs.every((l: any) => l.saved);
              const anySaved = logs.some((l: any) => l.saved);
              
              return (
                <div key={qr} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${allSaved ? 'bg-green-200' : anySaved ? 'bg-yellow-200' : 'bg-red-200'}`}>
                        {allSaved ? (
                          <svg className="w-4 h-4 text-green-700" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-red-700" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-bold ${allSaved ? 'text-green-700' : anySaved ? 'text-yellow-700' : 'text-red-700'}`}>
                          {allSaved ? 'Todos Registrados' : anySaved ? 'Parcialmente Guardado' : 'Error'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {logs.length} {logs.length === 1 ? 'material' : 'materiales'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(firstLog.fecha_cambio).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm text-blue-900 font-semibold mb-2">
                        QR: {qr}
                      </div>
                      <div className="flex gap-3 text-xs">
                        <div className="flex-[35%]">
                          <span className="text-gray-600 text-xs">Producto:</span>
                          <div className="font-medium truncate">{firstLog.nombre_producto}</div>
                        </div>
                        <div className="flex-[35%]">
                          <span className="text-gray-600 text-xs">Materiales ({logs.length}):</span>
                          <div className="font-medium text-xs">
                            {logs.map((log: any, idx: number) => (
                              <div key={idx} className="truncate">
                                {log.material_cambio_nombre || log.material_cambio || 'N/A'}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex-[15%]">
                          <span className="text-gray-600 text-xs">Tiempo:</span>
                          <div className="font-medium">
                            {firstLog.tiempo_empleado_hhmmss
                              ? firstLog.tiempo_empleado_hhmmss
                              : formatSecondsToHHMMSS(firstLog.tiempo_empleado)}
                          </div>
                        </div>
                        <div className="flex-[15%]">
                          <span className="text-gray-600 text-xs">Estación:</span>
                          <div className="font-medium truncate">{firstLog.estacion}</div>
                        </div>
                        <div className="flex-auto">
                          <span className="text-gray-600 text-xs">Tipo Cambio:</span>
                          <div className="font-medium">{firstLog.tipo_cambio || 'N/A'}</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Registrado: {new Date(firstLog.fecha_cambio).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

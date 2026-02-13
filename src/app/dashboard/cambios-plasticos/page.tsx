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
import { authService } from "@/services/authService";
import { ScanBarcode, Play, Square, Printer, X, Trash2 } from "lucide-react";
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

// Interfaz para etiquetas en la lista de trabajo
interface EtiquetaTrabajo {
  id: string; // ID único para la lista
  codigoBarras: string;
  fechaHoraAgregado: Date;
  tipoCambio: "DOBLE PLASTICO" | "REPROCESO";
  datosEtiqueta: OrdenReimpresion;
  materialesSeleccionados: any[];
  registrado: boolean;
}

export default function CambiosPlasticosPage() {
  // ==================== NUEVOS ESTADOS PARA EL FLUJO ====================
  // Lista de etiquetas escaneadas pendientes de registro
  const [etiquetasTrabajo, setEtiquetasTrabajo] = useState<EtiquetaTrabajo[]>([]);
  // ID de la etiqueta seleccionada actualmente (sincronizada con etiquetasTrabajo)
  const [etiquetaSeleccionadaId, setEtiquetaSeleccionadaId] = useState<string | null>(null);
  // Etiqueta seleccionada derivada del array actual (siempre sincronizada)
  const etiquetaSeleccionada = useMemo(() => 
    etiquetasTrabajo.find(e => e.id === etiquetaSeleccionadaId) || null,
    [etiquetasTrabajo, etiquetaSeleccionadaId]
  );
  // Modo múltiple activo por defecto
  const [modoMultiple, setModoMultiple] = useState<boolean>(true);
  // Solicitante global para todos los registros
  const [solicitante, setSolicitante] = useState<string>("");
  // Nombre verificado del solicitante desde el servidor
  const [solicitanteNombreVerificado, setSolicitanteNombreVerificado] = useState<string>("");
  const [isValidatingSolicitante, setIsValidatingSolicitante] = useState(false);
  // ======================================================================

  const [ordenesReimpresionLoading, setOrdenesReimpresionLoading] = useState(false);
  const [ordenesReimpresionError, setOrdenesReimpresionError] = useState<string | null>(null);
  // Estado para evitar doble-click en registrar (para UI)
  const [registrandoEtiquetaId, setRegistrandoEtiquetaId] = useState<string | null>(null);
  // REF para bloqueo INMEDIATO y SINCRÓNICO - esto es crítico para evitar múltiples guardados
  const registrandoRef = useRef<string | null>(null);
  
  // Ref para el input de código de barras
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [ordenInput, setOrdenInput] = useState("");

  // Función para enfocar el input de código de barras
  const focusBarcodeInput = useCallback(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  const { parseEstaciones } = useUser();
  const [isClient, setIsClient] = useState(false);

  // Expresión regular para validación
  const ordenRegex = /^(\d{0,8})(-)?(\d*)$/;
  
  const isValidBarcodeFormat = (value: string): boolean => {
    if (value === "") return true;
    const fullPattern = /^\d{8}-\d+$/;
    return fullPattern.test(value);
  };

  const formatBarcodeInput = (value: string): string => {
    // Primero: extraer solo dígitos y el primer separador que encontremos después de 8 dígitos
    // Ej: "https://...?code=20010521'251027170331084805" → "20010521-251027170331084805"
    
    // Extraer todo lo que no sea dígito ni caracteres especiales usados como separadores
    let digits = value.replace(/[^\d\-\'\,\.\;\:\|\/]/g, "");
    
    // Si tenemos 9+ dígitos, encontrar dónde está el separador y normalizar a guión
    const match = digits.match(/^(\d{8})[\D](.+)$/);
    if (match) {
      // Encontró 8 dígitos + separador + más contenido
      return match[1] + "-" + match[2].replace(/\D/g, "");
    }
    
    // Si no hay separador detectado, insertar uno después del 8vo dígito si hay más dígitos
    const cleanedDigits = digits.replace(/[^\d]/g, "");
    if (cleanedDigits.length > 8) {
      return cleanedDigits.slice(0, 8) + "-" + cleanedDigits.slice(8);
    }
    
    return cleanedDigits;
  };

  const {
    user,
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

  const [selectedMachine, setSelectedMachine] = useState<string>("all");
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [savedLogs, setSavedLogs] = useState<any[]>([]);

  // Formatea segundos a HH:mm:ss
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

  const userStation = useMemo(() => {
    if (isUserContextLoading || !user?.ip_address || !estaciones || estaciones.length === 0) {
      return null;
    }
    return estaciones.find((e) => e.direccion_ip === user.ip_address);
  }, [user?.ip_address, estaciones, isUserContextLoading]);

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

  // Efecto para mantener el foco en el input SIEMPRE cuando hay sesión activa
  useEffect(() => {
    if (!activeSessionOfCurrentUser) return;

    const focusInput = () => {
      // Solo permitir que el input de solicitante tenga foco temporalmente
      const activeElement = document.activeElement;
      const isSolicitanteInput = activeElement?.getAttribute?.('data-solicitante-input') === 'true';
      
      // Si es el input de solicitante, NO interferir
      if (isSolicitanteInput) {
        return;
      }
      
      // Si no es el input de solicitante ni el barcode, forzar foco al barcode input
      if (barcodeInputRef.current && activeElement !== barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    };

    // Enfocar inmediatamente
    focusInput();

    // Re-enfocar después de cualquier click (con pequeño delay para permitir acciones)
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Si es el input de solicitante, NO hacer nada
      if (target.getAttribute?.('data-solicitante-input') === 'true') {
        return;
      }
      
      // No interferir con botones, checkboxes, radios
      const isInteractiveElement = 
        target.tagName === 'BUTTON' || 
        target.tagName === 'INPUT' ||
        target.closest('button') ||
        target.closest('[role="button"]');
      
      if (!isInteractiveElement) {
        setTimeout(focusInput, 10);
      } else if (target.tagName !== 'INPUT') {
        // Solo re-enfocar si no es un input (como el del solicitante)
        setTimeout(focusInput, 100);
      }
    };

    // Re-enfocar cuando la ventana recupera el foco
    const handleWindowFocus = () => {
      setTimeout(focusInput, 50);
    };

    // Re-enfocar periódicamente para asegurar que siempre tenga foco
    // pero SOLO si no estamos en el input del solicitante
    const intervalId = setInterval(() => {
      const activeElement = document.activeElement;
      const isSolicitanteInput = activeElement?.getAttribute?.('data-solicitante-input') === 'true';
      
      // Si estamos en el solicitante, no hacer nada
      if (isSolicitanteInput) {
        return;
      }
      
      if (barcodeInputRef.current && activeElement !== barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    }, 500);

    document.addEventListener("click", handleClick);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("focus", handleWindowFocus);
      clearInterval(intervalId);
    };
  }, [activeSessionOfCurrentUser]);

  // Re-enfocar el input cuando cambia la lista de etiquetas (después de agregar/eliminar)
  useEffect(() => {
    if (activeSessionOfCurrentUser) {
      // Pequeño delay para que React termine de renderizar
      setTimeout(focusBarcodeInput, 50);
    }
  }, [etiquetasTrabajo.length, activeSessionOfCurrentUser, focusBarcodeInput]);

  // ==================== FUNCIONES PRINCIPALES ====================

  // Iniciar sesión automáticamente
  const handleStartSession = async () => {
    // Validar que el solicitante esté lleno
    if (!solicitante.trim()) {
      toast({
        title: "Solicitante requerido",
        description: "Por favor ingresa el nombre del solicitante antes de iniciar trabajo.",
        variant: "destructive",
      });
      return false;
    }

    if (!user || !userStation) {
      toast({
        title: "Error",
        description: "Falta información de Usuario o Estación para iniciar.",
        variant: "destructive",
      });
      return false;
    }

    const allUsers = [user, ...collaborators];

    // Desactivar sesiones existentes
    try {
      for (const currentUser of allUsers) {
        const sessionsResponse = await sesionService.getByCodigoOperador(currentUser!.code);
        const activeUserSessions = (sessionsResponse.data || []).filter(
          (s: any) => s.estado === "A" && s.tipo_evento === "beg"
        );
        const deactivationPromises = activeUserSessions.map((session: any) =>
          sesionService.delete(session.codigo_sesion)
        );
        await Promise.all(deactivationPromises);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No se pudo desactivar las sesiones anteriores.";
      toast({
        title: "Error de Limpieza",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
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
    });

    try {
      await Promise.all(sessionPromises);
      await fetchActiveSessions();
      setSessionStartTime(Date.now());
      toast({
        title: "Éxito",
        description: `Sesión iniciada para ${allUsers.length} persona(s).`,
      });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No se pudo iniciar la sesión.";
      toast({
        title: "Error al iniciar sesión",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    }
  };

  // Buscar y agregar etiqueta a la lista
  const executeSearch = async (codigo: string) => {
    if (!codigo.trim()) return;
    
    // Validar que el solicitante esté lleno
    if (!solicitante.trim()) {
      toast({
        title: "Solicitante requerido",
        description: "Por favor ingresa el nombre del solicitante antes de escanear.",
        variant: "destructive",
      });
      setOrdenInput("");
      return;
    }
    
    const formattedCodigo = formatBarcodeInput(codigo.trim());
    console.log("🔍 SCAN DEBUG - Código original:", codigo);
    console.log("🔍 SCAN DEBUG - Código formateado:", formattedCodigo);
    
    if (!isValidBarcodeFormat(formattedCodigo)) {
      toast({
        title: "Formato inválido",
        description: "El código debe tener el formato: 8 números, guión, y más números (ejemplo: 12345678-1)",
        variant: "destructive",
      });
      return;
    }

    // Verificar si ya existe en la lista
    const yaExiste = etiquetasTrabajo.some(e => e.codigoBarras === formattedCodigo && !e.registrado);
    if (yaExiste) {
      toast({
        title: "Etiqueta duplicada",
        description: "Esta etiqueta ya está en la lista de trabajo.",
        variant: "destructive",
      });
      setOrdenInput("");
      return;
    }
    
    setOrdenesReimpresionLoading(true);
    setOrdenesReimpresionError(null);

    try {
      console.log("🔍 SCAN DEBUG - Llamando API con:", formattedCodigo);
      const response = await servicioService.getReimpresionPlastificado(formattedCodigo);
      console.log("🔍 SCAN DEBUG - Respuesta API:", response);
      console.log("🔍 SCAN DEBUG - Datos completos:", response?.data);
      
      if (response && Array.isArray(response.data) && response.data.length > 0) {
        const datosEtiqueta = response.data[0];
        console.log("🔍 SCAN DEBUG - Primer registro de datos:", datosEtiqueta);
        console.log("🔍 SCAN DEBUG - Campos importantes:");
        console.log("  - Garantia:", datosEtiqueta.Garantia);
        console.log("  - Tipo:", datosEtiqueta.Tipo);
        console.log("  - Clase:", datosEtiqueta.Clase);
        console.log("  - Ancho:", datosEtiqueta.Ancho);
        console.log("  - Largo:", datosEtiqueta.Largo);
        console.log("  - Alto:", datosEtiqueta.Alto);
        
        // Validar que haya sesión activa antes de agregar etiquetas
        if (!activeSessionOfCurrentUser) {
          toast({
            title: "Sesión requerida",
            description: "Debes iniciar trabajo antes de escanear etiquetas.",
            variant: "destructive",
          });
          setOrdenesReimpresionLoading(false);
          return;
        }

        // Crear nueva etiqueta de trabajo
        const nuevaEtiqueta: EtiquetaTrabajo = {
          id: `${formattedCodigo}-${Date.now()}`,
          codigoBarras: formattedCodigo,
          fechaHoraAgregado: new Date(),
          tipoCambio: "DOBLE PLASTICO",
          datosEtiqueta: datosEtiqueta,
          materialesSeleccionados: [],
          registrado: false,
        };

        setEtiquetasTrabajo(prev => [nuevaEtiqueta, ...prev]);
        setEtiquetaSeleccionadaId(nuevaEtiqueta.id);

        toast({
          title: "Etiqueta agregada",
          description: `Se agregó ${formattedCodigo} a la lista de trabajo.`,
        });
      } else {
        setOrdenesReimpresionError("No se encontraron resultados para la búsqueda");
        toast({
          title: "No encontrado",
          description: "No se encontró información para este código.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setOrdenesReimpresionError(error?.message || "Error al buscar la etiqueta");
      toast({
        title: "Error",
        description: error?.message || "Error al buscar la etiqueta",
        variant: "destructive",
      });
    } finally {
      setOrdenesReimpresionLoading(false);
      setOrdenInput("");
      // Re-enfocar el input inmediatamente después de la búsqueda
      setTimeout(focusBarcodeInput, 10);
    }
  };

  // Actualizar tipo de cambio de una etiqueta
  const actualizarTipoCambio = (etiquetaId: string, nuevoTipo: "DOBLE PLASTICO" | "REPROCESO") => {
    setEtiquetasTrabajo(prev => 
      prev.map(e => e.id === etiquetaId ? { ...e, tipoCambio: nuevoTipo } : e)
    );
  };

  // Actualizar materiales seleccionados de una etiqueta
  const actualizarMateriales = (etiquetaId: string, materiales: any[]) => {
    setEtiquetasTrabajo(prev => 
      prev.map(e => e.id === etiquetaId ? { ...e, materialesSeleccionados: materiales } : e)
    );
  };

  // Registrar cambio de una etiqueta individual
  const registrarCambioEtiqueta = async (etiqueta: EtiquetaTrabajo) => {
    // BLOQUEO INMEDIATO SINCRÓNICO - verificar y bloquear en la misma línea
    // Esto es crítico porque el ref se actualiza inmediatamente, no como useState
    if (registrandoRef.current === etiqueta.id) {
      console.log('⚠️ BLOQUEADO: Ya se está registrando esta etiqueta:', etiqueta.id);
      return;
    }
    // Bloquear INMEDIATAMENTE con el ref (síncrono)
    registrandoRef.current = etiqueta.id;
    // También actualizar el estado para la UI
    setRegistrandoEtiquetaId(etiqueta.id);

    // Validar solicitante
    if (!solicitante.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa el nombre del solicitante.",
        variant: "destructive",
      });
      registrandoRef.current = null;
      setRegistrandoEtiquetaId(null);
      return;
    }

    // Validar materiales seleccionados
    if (!etiqueta.materialesSeleccionados || etiqueta.materialesSeleccionados.length === 0) {
      toast({
        title: "Error",
        description: "Por favor selecciona al menos un material para el cambio.",
        variant: "destructive",
      });
      registrandoRef.current = null;
      setRegistrandoEtiquetaId(null);
      return;
    }

    let tiempoEmpleadoSegundos = 0;
    let tiempoEmpleadoStr = "00:00:00";

    try {
      const identificacion_producto = etiqueta.codigoBarras;
      const nombre_producto = (etiqueta.datosEtiqueta as any).NOMBRE || etiqueta.datosEtiqueta.MATERIAL || "";
      const fecha_cambio = new Date().toISOString();
      const operador = user?.code || "";
      const colaboradoresStr = (collaborators || []).map((c: any) => c.code).join("&");
      const estacionVal = userStation?.nombre_estacion || selectedMachine || "";

      // Calcular tiempo desde que se agregó la etiqueta
      const diffMs = Date.now() - etiqueta.fechaHoraAgregado.getTime();
      const segundosFloat = diffMs / 1000;
      tiempoEmpleadoSegundos = Number(segundosFloat.toFixed(2));

      const totalSeconds = Math.floor(segundosFloat);
      const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      const ss = String(totalSeconds % 60).padStart(2, "0");
      tiempoEmpleadoStr = `${hh}:${mm}:${ss}`;

      // Crear un registro por cada material seleccionado
      const savePromises = etiqueta.materialesSeleccionados.map((material: any) => {
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
          tipo_cambio: etiqueta.tipoCambio,
        };
        return logCambioPlasticosService.save(payload);
      });

      await Promise.all(savePromises);

      // Guardar en historial local
      const newEntries = etiqueta.materialesSeleccionados.map((material: any) => ({
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
        tipo_cambio: etiqueta.tipoCambio,
        saved: true,
        tiempo_empleado_hhmmss: tiempoEmpleadoStr,
      }));

      const existing = JSON.parse(localStorage.getItem("logCambioPlasticosHistory") || "[]");
      existing.unshift(...newEntries);
      localStorage.setItem("logCambioPlasticosHistory", JSON.stringify(existing));
      setSavedLogs(existing);

      // Marcar etiqueta como registrada y remover de la lista
      setEtiquetasTrabajo(prev => prev.filter(e => e.id !== etiqueta.id));
      
      // Si era la etiqueta seleccionada, limpiar selección
      if (etiquetaSeleccionadaId === etiqueta.id) {
        setEtiquetaSeleccionadaId(null);
      }

      toast({
        title: "Éxito",
        description: "Cambio de plástico registrado correctamente.",
      });

      // Verificar si quedan etiquetas pendientes
      const etiquetasPendientes = etiquetasTrabajo.filter(e => e.id !== etiqueta.id);
      if (etiquetasPendientes.length === 0) {
        // Cerrar sesión automáticamente
        await finishSession();
        setSessionStartTime(null);
        toast({
          title: "Sesión finalizada",
          description: "No hay más etiquetas pendientes. La sesión ha sido cerrada.",
        });
      }

    } catch (err: any) {
      toast({
        title: "Error al guardar",
        description: err?.message || "No se pudo guardar el registro de cambio.",
        variant: "destructive",
      });
    } finally {
      // Siempre limpiar el bloqueo - tanto el ref como el estado
      registrandoRef.current = null;
      setRegistrandoEtiquetaId(null);
    }
  };

  // Eliminar etiqueta de la lista sin registrar
  const eliminarEtiqueta = async (etiquetaId: string) => {
    setEtiquetasTrabajo(prev => prev.filter(e => e.id !== etiquetaId));
    
    if (etiquetaSeleccionadaId === etiquetaId) {
      setEtiquetaSeleccionadaId(null);
    }

    // Verificar si quedan etiquetas pendientes
    const etiquetasPendientes = etiquetasTrabajo.filter(e => e.id !== etiquetaId);
    if (etiquetasPendientes.length === 0 && activeSessionOfCurrentUser) {
      await finishSession();
      setSessionStartTime(null);
      toast({
        title: "Sesión finalizada",
        description: "No hay más etiquetas. La sesión ha sido cerrada.",
      });
    }
  };

  // Validar solicitante cuando el input pierde el foco
  const handleValidateSolicitante = async (value: string) => {
    // Si el valor está vacío, no validar
    if (!value.trim()) {
      setSolicitanteNombreVerificado("");
      return;
    }

    setIsValidatingSolicitante(true);
    try {
      // Llamar al método loginColaborador para verificar si el usuario existe
      const response = await authService.loginColaborador(value.trim());

      // Validar si la respuesta tiene un objeto AuthResponse válido con user.ficha
      if (!response?.user?.ficha) {
        toast({
          title: "Error",
          description: "El solicitante no existe o la respuesta del servidor es inválida.",
          variant: "destructive",
        });
        setSolicitante("");
        setSolicitanteNombreVerificado("");
        return;
      }

      // Verificar si ficha tiene un mensaje de error (cast a any porque puede venir en la respuesta de error)
      const ficha = response.user.ficha as any;
      if (ficha.Mensaje) {
        toast({
          title: "Solicitante inválido",
          description: ficha.Mensaje,
          variant: "destructive",
        });
        setSolicitante("");
        setSolicitanteNombreVerificado("");
        return;
      }

      // Verificar si ficha tiene los campos requeridos (CODIGO y NOMBRE)
      if (!ficha.CODIGO || !ficha.NOMBRE) {
        toast({
          title: "Error",
          description: "El solicitante no tiene información completa en el sistema.",
          variant: "destructive",
        });
        setSolicitante("");
        setSolicitanteNombreVerificado("");
        return;
      }

      // Si llega aquí, el solicitante es válido - guardar el nombre verificado
      const nombreVerificado = ficha.NOMBRE;
      setSolicitanteNombreVerificado(nombreVerificado);
      
      toast({
        title: "Solicitante válido",
        description: `${nombreVerificado} ha sido verificado correctamente.`,
      });

    } catch (error: any) {
      // Si hay error, mostrar el mensaje de error en toast
      const errorMessage = error?.message || "No se pudo verificar el solicitante.";
      toast({
        title: "Error al validar",
        description: errorMessage,
        variant: "destructive",
      });
      setSolicitante("");
      setSolicitanteNombreVerificado("");
    } finally {
      setIsValidatingSolicitante(false);
    }
  };

  // Cargar historial desde localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("logCambioPlasticosHistory") || "[]");
      setSavedLogs(Array.isArray(stored) ? stored : []);
    } catch (e) {
      setSavedLogs([]);
    }
  }, []);

  // Cargar etiquetas pendientes desde localStorage al montar
  useEffect(() => {
    try {
      const storedEtiquetas = localStorage.getItem("etiquetasPendientes");
      const storedSeleccionadaId = localStorage.getItem("etiquetaSeleccionadaId");
      
      if (storedEtiquetas) {
        const parsed = JSON.parse(storedEtiquetas);
        // Convertir fechas de strings a Date objects
        const etiquetasRecuperadas = parsed.map((e: any) => ({
          ...e,
          fechaHoraAgregado: new Date(e.fechaHoraAgregado)
        }));
        setEtiquetasTrabajo(etiquetasRecuperadas);
        
        // Recuperar ID de etiqueta seleccionada si existe
        if (storedSeleccionadaId) {
          const seleccionadaId = JSON.parse(storedSeleccionadaId);
          const existe = etiquetasRecuperadas.some((e: any) => e.id === seleccionadaId);
          if (existe) {
            setEtiquetaSeleccionadaId(seleccionadaId);
          }
        }
      }
    } catch (e) {
      console.warn("Error cargando etiquetas desde localStorage:", e);
    }
  }, []);

  // Guardar etiquetas pendientes en localStorage cuando cambian
  useEffect(() => {
    if (etiquetasTrabajo.length > 0 || activeSessionOfCurrentUser) {
      try {
        localStorage.setItem("etiquetasPendientes", JSON.stringify(etiquetasTrabajo));
      } catch (e) {
        console.warn("Error guardando etiquetas en localStorage:", e);
      }
    }
  }, [etiquetasTrabajo]);

  // Guardar ID de etiqueta seleccionada cuando cambia
  useEffect(() => {
    if (etiquetaSeleccionadaId) {
      try {
        localStorage.setItem("etiquetaSeleccionadaId", JSON.stringify(etiquetaSeleccionadaId));
      } catch (e) {
        console.warn("Error guardando ID de etiqueta seleccionada en localStorage:", e);
      }
    }
  }, [etiquetaSeleccionadaId]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Protección contra recarga/cierre de página cuando hay sesión activa o etiquetas pendientes
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (activeSessionOfCurrentUser || etiquetasTrabajo.length > 0) {
        event.preventDefault();
        event.returnValue = "Tienes una sesión activa o etiquetas pendientes. ¿Estás seguro de que quieres salir?";
        return event.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [activeSessionOfCurrentUser, etiquetasTrabajo.length]);

  const userStationNameText = useMemo(() => {
    if (isUserContextLoading) return "Cargando Estación...";
    if (userStation) return userStation.nombre_estacion;
    return "Estación no encontrada para esta IP.";
  }, [userStation, isUserContextLoading]);

  // Mostrar la lista si hay etiquetas o hay sesión activa
  const mostrarLista = etiquetasTrabajo.length > 0;

  if (!isClient) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-100px)]">
        {/* Header con búsqueda y controles */}
        <Card className="m-3 flex-shrink-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              {/* Izquierda: Título y búsqueda */}
              <div className="flex items-center gap-4 flex-1">
                <div className="flex flex-col">
                  <span className="text-lg font-semibold">Cambio de Plásticos</span>
                  <span className="text-xs text-muted-foreground">{userStationNameText}</span>
                </div>
                
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <ScanBarcode className="h-5 w-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar etiqueta (xxxxxxxx-yyyy...)..."
                    className="border p-2 rounded flex-1"
                    value={ordenInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOrdenInput(val);
                    }}
                    ref={barcodeInputRef}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && ordenInput.trim() !== "") {
                        const formattedCodigo = formatBarcodeInput(ordenInput.trim());
                        if (isValidBarcodeFormat(formattedCodigo)) {
                          executeSearch(formattedCodigo);
                        }
                      }
                    }}
                    disabled={ordenesReimpresionLoading}
                  />
                  {ordenesReimpresionLoading && (
                    <span className="text-sm text-muted-foreground">Buscando...</span>
                  )}
                </div>
              </div>

              {/* Centro: Solicitante */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Solicitante *</label>
                  <input
                    type="text"
                    placeholder="Nombre del solicitante"
                    value={solicitante}
                    onChange={(e) => setSolicitante(e.target.value)}
                    data-solicitante-input="true"
                    onBlur={async (e) => {
                      // Validar el solicitante cuando se sale del input
                      await handleValidateSolicitante(e.target.value);
                      
                      // Re-enfocar el barcode input cuando se sale del solicitante
                      if (activeSessionOfCurrentUser) {
                        setTimeout(focusBarcodeInput, 50);
                      }
                    }}
                    disabled={isValidatingSolicitante}
                    className={`px-3 py-2 border rounded-md text-sm w-48 ${
                      isValidatingSolicitante ? 'opacity-50 cursor-wait' : ''
                    } ${
                      solicitante.trim() ? 'border-gray-300' : 'border-red-300 bg-red-50'
                    }`}
                  />
                </div>
                {solicitanteNombreVerificado && (
                  <div className="text-xs text-green-700 font-medium ml-20">
                    ✓ {solicitanteNombreVerificado}
                  </div>
                )}
              </div>

              {/* Derecha: Modo múltiple y botón */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={modoMultiple}
                    onChange={(e) => setModoMultiple(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium">Modo Múltiple</span>
                </label>

                {!activeSessionOfCurrentUser ? (
                  <Button
                    onClick={handleStartSession}
                    disabled={isSessionActiveOnAnotherStation}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Iniciar Trabajo
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-100 rounded-md">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-green-700">Sesión Activa</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contenido principal */}
        <div className="flex-1 flex gap-4 mx-3 mb-3 overflow-hidden">
          {/* Lista de etiquetas escaneadas - Izquierda */}
          {mostrarLista && (
            <div className="w-1/2 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {etiquetasTrabajo.map((etiqueta) => (
                  <Card 
                    key={etiqueta.id}
                    className={`cursor-pointer transition-all ${
                      etiquetaSeleccionadaId === etiqueta.id 
                        ? 'ring-2 ring-blue-500 border-blue-500' 
                        : 'hover:border-blue-300'
                    }`}
                    onClick={() => setEtiquetaSeleccionadaId(etiqueta.id)}
                  >
                    <CardContent className="p-4">
                      {/* Header de la etiqueta */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="text-sm font-bold text-yellow-600 mb-1">
                            QR: {etiqueta.codigoBarras}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-sky-700">
                              Material: {(etiqueta.datosEtiqueta as any).CODIGO || etiqueta.datosEtiqueta.COD_MATERIAL}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              Orden: {(etiqueta.datosEtiqueta as any).NUM_CABECERA || etiqueta.datosEtiqueta.NUM_ORDEN}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            eliminarEtiqueta(etiqueta.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          title="Eliminar de la lista"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Descripción del material */}
                      <div className="text-xs text-muted-foreground">Descripción del Material</div>
                      <div className="font-semibold text-sm mb-2">{(etiqueta.datosEtiqueta as any).NOMBRE || etiqueta.datosEtiqueta.MATERIAL}</div>

                      {/* Detalles en grid */}
                      <div className="grid grid-cols-2 gap-1 text-xs mb-3">
                        <div>
                          <span className="text-muted-foreground">Garantía: </span>
                          <span className="font-medium">{(etiqueta.datosEtiqueta as any).Garantia || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Código Antiguo: </span>
                          <span className="font-medium">{(etiqueta.datosEtiqueta as any).Etiqueta_CodigoAntiguo || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Dimensiones: </span>
                          <span className="font-mono">
                            {(etiqueta.datosEtiqueta as any).Ancho || 0} x {(etiqueta.datosEtiqueta as any).Largo || 0} x {(etiqueta.datosEtiqueta as any).Alto || 0} cm
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Peso: </span>
                          <span className="font-medium">{(etiqueta.datosEtiqueta as any).PesoKg || 0} kg</span>
                        </div>
                      </div>

                      {/* Tipo de cambio y botón registrar */}
                      <div className="flex items-center justify-between pt-3 border-t">
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-600">Tipo de cambio:</span>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`tipoCambio-${etiqueta.id}`}
                              checked={etiqueta.tipoCambio === "DOBLE PLASTICO"}
                              onChange={() => actualizarTipoCambio(etiqueta.id, "DOBLE PLASTICO")}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm">Doble Plástico</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`tipoCambio-${etiqueta.id}`}
                              checked={etiqueta.tipoCambio === "REPROCESO"}
                              onChange={() => actualizarTipoCambio(etiqueta.id, "REPROCESO")}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm">Reproceso</span>
                          </label>
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            registrarCambioEtiqueta(etiqueta);
                          }}
                          disabled={registrandoEtiquetaId === etiqueta.id}
                          className="bg-green-500 hover:bg-green-600 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          size="sm"
                        >
                          {registrandoEtiquetaId === etiqueta.id ? "Registrando..." : "Registrar cambio"}
                        </Button>
                      </div>

                      {/* Hora de agregado */}
                      <div className="text-xs text-muted-foreground mt-2">
                        Agregado: {etiqueta.fechaHoraAgregado.toLocaleTimeString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Preview de etiqueta seleccionada - Derecha */}
          {mostrarLista && etiquetaSeleccionada && (
            <div className="w-1/2 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-2">
                {/* Sticker preview - reducido para mostrar tabla */}
                <div className="flex justify-center mb-0">
                  <div className="origin-top">
                    <OrderStickerCambioPlastico
                      codigoBarras={etiquetaSeleccionada.codigoBarras}
                      añosGarantia={Number((etiquetaSeleccionada.datosEtiqueta as any).Garantia) || 0}
                      tipo={(etiquetaSeleccionada.datosEtiqueta as any).Tipo || "N/A"}
                      clase={(etiquetaSeleccionada.datosEtiqueta as any).Clase || "N/A"}
                      dimensiones={{
                        ancho: Number((etiquetaSeleccionada.datosEtiqueta as any).Ancho) || 0,
                        largo: Number((etiquetaSeleccionada.datosEtiqueta as any).Largo) || 0,
                        alto: Number((etiquetaSeleccionada.datosEtiqueta as any).Alto) || 0,
                      }}
                      producto={(etiquetaSeleccionada.datosEtiqueta as any).Etiqueta_Material || "No encontrado"}
                      empresa={(etiquetaSeleccionada.datosEtiqueta as any).Etiqueta_CodigoAntiguo || "CHAIDE"}
                      tapa={
                        ((etiquetaSeleccionada.datosEtiqueta as any).Tapa_Tela1 !== "No Aplica"
                          ? (etiquetaSeleccionada.datosEtiqueta as any).Tapa_Tela1
                          : "") +
                        ((etiquetaSeleccionada.datosEtiqueta as any).Tapa_Tela2 !== "No Aplica"
                          ? " - " + (etiquetaSeleccionada.datosEtiqueta as any).Tapa_Tela2
                          : "") +
                        ((etiquetaSeleccionada.datosEtiqueta as any).Tapa_Tela3 !== "No Aplica"
                          ? " - " + (etiquetaSeleccionada.datosEtiqueta as any).Tapa_Tela3
                          : "")
                      }
                      banda={
                        ((etiquetaSeleccionada.datosEtiqueta as any).Tela_Banda1 !== "No Aplica"
                          ? (etiquetaSeleccionada.datosEtiqueta as any).Tela_Banda1
                          : "") +
                        ((etiquetaSeleccionada.datosEtiqueta as any).Tela_Banda2 !== "No Aplica"
                          ? " - " + (etiquetaSeleccionada.datosEtiqueta as any).Tela_Banda2
                          : "") +
                        ((etiquetaSeleccionada.datosEtiqueta as any).Tela_Banda3 !== "No Aplica"
                          ? " - " + (etiquetaSeleccionada.datosEtiqueta as any).Tela_Banda3
                          : "")
                      }
                      tela_tapa={
                        ((etiquetaSeleccionada.datosEtiqueta as any).Tela_Tapa1 !== "No Aplica"
                          ? (etiquetaSeleccionada.datosEtiqueta as any).Tela_Tapa1
                          : "") +
                        ((etiquetaSeleccionada.datosEtiqueta as any).Tela_Tapa2 !== "No Aplica"
                          ? " - " + (etiquetaSeleccionada.datosEtiqueta as any).Tela_Tapa2
                          : "") +
                        ((etiquetaSeleccionada.datosEtiqueta as any).Tela_Tapa3 !== "No Aplica"
                          ? " - " + (etiquetaSeleccionada.datosEtiqueta as any).Tela_Tapa3
                          : "")
                      }
                      aislante={
                        (etiquetaSeleccionada.datosEtiqueta as any).Aislante !== "NA"
                          ? (etiquetaSeleccionada.datosEtiqueta as any).Aislante
                          : "No Aplica"
                      }
                      lamina_textil={
                        ((etiquetaSeleccionada.datosEtiqueta as any).Lamina3 || "") +
                        ((etiquetaSeleccionada.datosEtiqueta as any).Lamina4 ? " - " + (etiquetaSeleccionada.datosEtiqueta as any).Lamina4 : "") +
                        ((etiquetaSeleccionada.datosEtiqueta as any).Lamina5 ? " - " + (etiquetaSeleccionada.datosEtiqueta as any).Lamina5 : "")
                      }
                      numero_resortes={(etiquetaSeleccionada.datosEtiqueta as any).Resortes || ""}
                      peso_maximo_individual={
                        (etiquetaSeleccionada.datosEtiqueta as any).PesoLb + "Lb / " + (etiquetaSeleccionada.datosEtiqueta as any).PesoKg + "Kg" || ""
                      }
                      espuma_banda={(etiquetaSeleccionada.datosEtiqueta as any).Lamina_Banda || ""}
                      espuma_tapa={(etiquetaSeleccionada.datosEtiqueta as any).Lamina_Tapa || ""}
                      R1={(etiquetaSeleccionada.datosEtiqueta as any).Espuma || ""}
                      R2={(etiquetaSeleccionada.datosEtiqueta as any).Lamina1 || ""}
                      R3={(etiquetaSeleccionada.datosEtiqueta as any).Lamina2 || ""}
                      LOTE={(etiquetaSeleccionada.datosEtiqueta as any).NUM_CABECERA || etiquetaSeleccionada.datosEtiqueta.NUM_ORDEN || "No definido"}
                    />
                  </div>
                </div>

                {/* Tabla de materiales */}
                <Card className="mx-2">
                  <CardHeader className="py-2 px-4">
                    <CardTitle className="text-sm font-semibold">Materiales a Cambiar</CardTitle>
                    <div className="text-xs text-muted-foreground">
                      CODIGO: {((etiquetaSeleccionada.datosEtiqueta as any).CODIGO || etiquetaSeleccionada.datosEtiqueta.COD_MATERIAL || "N/A").toString().split("-")[0]} | 
                      CIUDAD: {(etiquetaSeleccionada.datosEtiqueta as any).CIUDAD || (etiquetaSeleccionada.datosEtiqueta as any).Ciudad || "N/A"}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <ElementsTable
                      key={etiquetaSeleccionada.id}
                      qrResponse={{
                        CODIGO: ((etiquetaSeleccionada.datosEtiqueta as any).CODIGO || etiquetaSeleccionada.datosEtiqueta.COD_MATERIAL || "").toString().split("-")[0],
                        CIUDAD: (etiquetaSeleccionada.datosEtiqueta as any).CIUDAD || (etiquetaSeleccionada.datosEtiqueta as any).Ciudad || "",
                      }}
                      selectedItems={etiquetaSeleccionada.materialesSeleccionados}
                      onSelectionChange={(items) => actualizarMateriales(etiquetaSeleccionada.id, items)}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Estado vacío cuando no hay etiquetas */}
          {!mostrarLista && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <ScanBarcode className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Escanea una etiqueta para comenzar</p>
                <p className="text-sm">Las etiquetas escaneadas aparecerán aquí</p>
              </div>
            </div>
          )}
        </div>

        {/* Historial de registros */}
        {savedLogs.length > 0 && (
          <div className="mx-3 mb-3 flex-1 min-h-0 flex flex-col">
            <Card className="flex-1 flex flex-col min-h-0">
              <CardHeader className="py-2 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 11H7v2h2v-2zm0-4H7v2h2V7zm4 4h-2v2h2v-2zm0-4h-2v2h2V7z" />
                    </svg>
                    Historial de Cambios de Plástico
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      localStorage.removeItem("logCambioPlasticosHistory");
                      setSavedLogs([]);
                    }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Limpiar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-4">
                  {Object.entries(
                    savedLogs.reduce((acc: any, log: any) => {
                      const qr = log.identificacion_producto;
                      if (!acc[qr]) acc[qr] = [];
                      acc[qr].push(log);
                      return acc;
                    }, {})
                  ).slice(0, 10).map(([qr, logs]: [string, any]) => {
                    const firstLog = logs[0];
                    const allSaved = logs.every((l: any) => l.saved);
                    const fechaRegistro = new Date(firstLog.fecha_cambio);
                    
                    return (
                      <div key={qr} className="border rounded-lg p-4 bg-gray-10">
                        {/* Encabezado con estado */}
                        <div className="flex items-center gap-3 mb-3 pb-3 border-b">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 ${allSaved ? 'bg-green-100' : 'bg-red-100'}`}>
                            {allSaved ? (
                              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            )}
                          </span>
                          <div>
                            <div className="font-bold text-sm text-gray-900">
                              {allSaved ? '✓ Todos Registrados' : '✗ Error al guardar'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {logs.length} material{logs.length !== 1 ? 'es' : ''} · {fechaRegistro.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>

                        {/* QR */}
                        <div className="text-sm font-mono text-blue-700 mb-2">QR: {qr}</div>

                        {/* Producto y detalles en grid */}
                        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                          <div>
                            <span className="font-semibold text-gray-700">Producto:</span>
                            <div className="text-gray-600">{firstLog.nombre_producto}</div>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700">Materiales ({logs.length}):</span>
                            <div className="text-gray-600 text-xs">
                              {logs.map((log: any, idx: number) => (
                                <div key={idx}>{log.material_cambio_nombre || log.material_cambio}</div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700">Tiempo:</span>
                            <div className="text-gray-600">{firstLog.tiempo_empleado_hhmmss || formatSecondsToHHMMSS(firstLog.tiempo_empleado)}</div>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700">Estación:</span>
                            <div className="text-gray-600">{firstLog.estacion}</div>
                          </div>
                        </div>

                        {/* Tipo de cambio y fecha registrada */}
                        <div className="grid grid-cols-2 gap-4 text-xs border-t pt-2 text-gray-600">
                          <div>
                            <span className="font-semibold">Tipo Cambio:</span> {firstLog.tipo_cambio}
                          </div>
                          <div className="text-right">
                            <span className="font-semibold">Registrado:</span> {fechaRegistro.toLocaleDateString()}, {fechaRegistro.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <CollaboratorLoginModal
        isOpen={isLoginModalOpen}
        onOpenChange={setLoginModalOpen}
      />
    </>
  );
}

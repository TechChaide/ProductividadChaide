"use client";
// Utilidad para saber si un departamento es de tipo "ALMOHADAS"
export function isAlmohadasDepartment(department?: string): boolean {
  if (!department) return false;
  const dep = department.toUpperCase();
  return dep.includes("ALMOHADAS") || dep.includes("TECNOLOGIA");
}

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import type { Order } from "@/types/order";
import type {
  Estacion,
  AreaProcessControl,
  Sesion,
  Linea,
  Ficha,
} from "@/types/interfaces";
import { estacionService } from "@/services/estacion.service";
import { areaProcessControlService } from "@/services/areaProcessControl.service";
import { lineaService } from "@/services/linea.service";
import { sesionService } from "@/services/sesion.service";
import { authService } from "@/services/authService";
import { useToast } from "@/hooks/use-toast";

interface User {
  name: string;
  code: string;
  imageUrl?: string;
  machine?: string;
  department?: string;
  resp_ctrl_prod?: string;
  Centro?: string;
  ip_address?: string;
}

// Now Collaborator stores the full Ficha
export interface Collaborator extends Ficha {
  name: string;
  code: string;
}

export interface Operador {
  CODIGO: string;
  NOMBRE: string;
}

export type NotificationType = "Notificación" | "PNC" | "Reproceso" | "Lectura";

export interface NotificationHistoryItem {
  timestamp: string;
  type: NotificationType;
  order: string;
  quantity: number;
  message: string;
  success: boolean;
}

export interface AlmohadasNotificationHistoryItem {
  timestamp: string;
  type: NotificationType;
  order: string;
  barcode: string;
  quantity: number;
  message: string;
  success: boolean;
}

export interface AlmohadasNotificationHistoryPistoleadoItem {
  timestamp: string;
  type: NotificationType;
  order: string;
  barcode: string;
  quantity: number;
  message: string;
  success: boolean;
  paquete?: string;
}

interface UserContextType {
  user: User | null;
  isLoading: boolean;

  notificationHistoryPedidos: NotificationHistoryItem[];
  addNotificationToHistoryPedidos: (item: NotificationHistoryItem) => void;

  notificationHistoryAlmohadas: AlmohadasNotificationHistoryItem[];
  addNotificationToHistoryAlmohadas: (item: AlmohadasNotificationHistoryItem) => void;

  notificationHistoryPistoleado: AlmohadasNotificationHistoryPistoleadoItem[];
  addNotificationToHistoryPistoleado: (item: AlmohadasNotificationHistoryPistoleadoItem) => void;

  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  collaborators: Collaborator[];
  addCollaborator: (collaboratorFicha: Ficha) => void;
  removeCollaborator: (code: string) => void;
  isLoginModalOpen: boolean;
  setLoginModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  login: (userData: User, token: string, ficha: Ficha) => void;
  logout: () => void;
  estaciones: Estacion[];
  areaProcessControls: AreaProcessControl[];
  lineas: Linea[];
  activeSessions: Sesion[];
  operadores: Operador[];
  fetchActiveSessions: () => Promise<void>;
  finishSession: (silent?: boolean) => Promise<void>;
  fetchAllOperatorNames: (sessions: Sesion[]) => Promise<void>;
  finishSessionsForStation: (stationId: number) => Promise<void>;
  isWorkSessionActive: boolean;
  parseEstaciones: (estacionStr: string) => { mnemonico_estacion: string; notifica: boolean }[];
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  // Convierte una cadena de estaciones en un array de objetos con notifica true solo en el último
  const parseEstaciones = (estacionStr: string) => {
    const arr = estacionStr.split("");
    return arr.map((mnemonico, idx) => ({
      mnemonico_estacion: mnemonico,
      notifica: idx === arr.length - 1
    }));
  };

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationHistoryPedidos, setNotificationHistoryPedidos] = useState<NotificationHistoryItem[]>([]);
  const [notificationHistoryAlmohadas, setNotificationHistoryAlmohadas] = useState<AlmohadasNotificationHistoryItem[]>([]);
  const [notificationHistoryPistoleado, setNotificationHistoryPistoleado] = useState<AlmohadasNotificationHistoryPistoleadoItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);

  const [estaciones, setEstaciones] = useState<Estacion[]>([]);
  const [areaProcessControls, setAreaProcessControls] = useState<AreaProcessControl[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [activeSessions, setActiveSessions] = useState<Sesion[]>([]);
  const { toast } = useToast();

  // Derivado en tiempo real de activeSessions: se actualiza inmediatamente
  // después de cada llamada a fetchActiveSessions(), sin necesidad de recargar la página.
  const isWorkSessionActive = useMemo(() => {
    if (!user) return false;
    const filteredCollaborators = collaborators.filter(c => !isAlmohadasDepartment(c.DEPARTAMENTO));
    const userCodes = [user.code, ...filteredCollaborators.map(c => c.code)];
    return activeSessions.some(
      (session) =>
        session.tipo_evento === "beg" &&
        session.estado === "A" &&
        userCodes.includes(session.codigo_operador)
    );
  }, [activeSessions, user, collaborators]);

  // Bloquear cierre/refresco del navegador cuando hay sesión de trabajo activa
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isWorkSessionActive) {
        event.preventDefault();
        event.returnValue =
          "Tiene una sesión de trabajo activa. Debe finalizar el trabajo antes de cerrar el aplicativo.";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isWorkSessionActive]);

  const fetchActiveSessions = useCallback(async () => {
    try {
      const response = await sesionService.getAll();
      const allSessions = response.data || [];
      const sessionMap = new Map<string, Sesion>();

      // Sort sessions by date to ensure we process them in order
      allSessions.sort(
        (a, b) =>
          new Date(a.fecha_evento).getTime() -
          new Date(b.fecha_evento).getTime()
      );

      allSessions.forEach((session) => {
        const key = `${session.codigo_operador}-${session.codigo_estacion}`;
        // If it's a 'beg' event, add/update the session in the map
        if (session.tipo_evento === "beg" && session.estado === "A") {
          sessionMap.set(key, session);
        }
        // If it's an 'fh' event, remove the corresponding 'beg' session
        else if (session.tipo_evento === "fh") {
          sessionMap.delete(key);
        }
      });

    const currentActiveSessions = Array.from(sessionMap.values());
      setActiveSessions(currentActiveSessions);
    } catch (error) {
      console.error("Failed to fetch sessions", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las sesiones activas.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const fetchAllOperatorNames = useCallback(
    async (sessions: Sesion[]) => {
      const existingOperatorMap = new Map<string, string>();
      operadores.forEach((op) => existingOperatorMap.set(op.CODIGO, op.NOMBRE));

      const uniqueOperatorCodes = [
        ...new Set(sessions.map((s) => s.codigo_operador)),
      ];
      const codesToFetch = uniqueOperatorCodes.filter(
        (code) => !existingOperatorMap.has(code)
      );

      if (codesToFetch.length === 0) return;

      try {
        const operatorPromises = codesToFetch.map((code) =>
          authService.loginColaborador(code).catch((e) => {
            console.warn(`Could not fetch info for operator ${code}:`, e);
            return null; // Return null on failure to not break Promise.all
          })
        );
        const results = await Promise.all(operatorPromises);

        const newOperators = results
          .filter((res): res is Exclude<typeof res, null> => res !== null) // Filter out failed requests
          .map((res) => ({
            CODIGO: res.user.ficha.CODIGO,
            NOMBRE: res.user.ficha.NOMBRE,
          }));

        setOperadores((prev) => {
          const updatedMap = new Map(prev.map((op) => [op.CODIGO, op]));
          newOperators.forEach((op) => updatedMap.set(op.CODIGO, op));
          return Array.from(updatedMap.values());
        });
      } catch (error) {
        console.error("Failed to fetch operator names:", error);
        toast({
          title: "Advertencia",
          description:
            "No se pudieron cargar los nombres de algunos operarios.",
          variant: "destructive",
        });
      }
    },
    [operadores, toast]
  );

  const fetchMasterData = useCallback(async () => {
    try {
      const [areaProcessRes, lineasRes, estacionesRes] = await Promise.all([
        areaProcessControlService.getAll(),
        lineaService.getAll(),
        estacionService.getAll(), // Also fetch stations here for admin/reload cases
      ]);
      setAreaProcessControls(areaProcessRes.data || []);
      setLineas(lineasRes.data || []);

      // Prioritize stations from localStorage if available (from login)
      const storedEstaciones = localStorage.getItem("estaciones");
      if (storedEstaciones) {
        setEstaciones(JSON.parse(storedEstaciones));
      } else {
        setEstaciones(estacionesRes.data || []);
      }

      await fetchActiveSessions();
    } catch (error) {
      console.error("Failed to fetch master data", error);
      toast({
        title: "Error de Carga",
        description:
          "No se pudieron cargar los datos maestros de la aplicación.",
        variant: "destructive",
      });
    }
  }, [fetchActiveSessions, toast]);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      let initialUser: User | null = null;
      try {
        const storedUser = localStorage.getItem("user");
        const token = localStorage.getItem("token");

        if (storedUser && token) {
          initialUser = JSON.parse(storedUser);
          setUser(initialUser);

          // Load other data from local storage
          const storedCollaborators = localStorage.getItem("collaborators");
          if (storedCollaborators)
            setCollaborators(JSON.parse(storedCollaborators));

          const storedHistoryPedidos = localStorage.getItem("notificationHistoryPedidos");
          if (storedHistoryPedidos) setNotificationHistoryPedidos(JSON.parse(storedHistoryPedidos));
          const storedHistoryAlmohadas = localStorage.getItem("notificationHistoryAlmohadas");
          if (storedHistoryAlmohadas) setNotificationHistoryAlmohadas(JSON.parse(storedHistoryAlmohadas));
          const storedHistoryPistoleado = localStorage.getItem("notificationHistoryPistoleado");
          if (storedHistoryPistoleado) setNotificationHistoryPistoleado(JSON.parse(storedHistoryPistoleado));

          await fetchMasterData(); // Fetch all data on reload
        }
      } catch (error) {
        console.error("Failed to parse data from localStorage", error);
        localStorage.clear();
      } finally {
        setIsLoading(false);
      }
    };
    initialize();
  }, [fetchMasterData]);

  const login = async (userData: User, token: string, ficha: Ficha) => {
    setIsLoading(true);
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", token);

    // Clear previous session data
  setNotificationHistoryPedidos([]);
  localStorage.removeItem("notificationHistoryPedidos");
  setNotificationHistoryAlmohadas([]);
  localStorage.removeItem("notificationHistoryAlmohadas");
  setNotificationHistoryPistoleado([]);
  localStorage.removeItem("notificationHistoryPistoleado");
    setOrders([]);
    setCollaborators([]);
    localStorage.removeItem("collaborators");
    setActiveSessions([]);

    // Fetch master data needed for the session
    await fetchMasterData();

    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    setNotificationHistoryPedidos([]);
    setNotificationHistoryAlmohadas([]);
    setNotificationHistoryPistoleado([]);
    setOrders([]);
    setCollaborators([]);
    setActiveSessions([]);
    setLineas([]);
    setEstaciones([]);
    setAreaProcessControls([]);
    setOperadores([]);
    
    // Limpiar localStorage y sessionStorage
    localStorage.clear();
    sessionStorage.clear();
  };

  const processSessionEnd = async (sessionsToEnd: Sesion[]) => {
    const operations = sessionsToEnd.map(async (begSession) => {
      // 1. Create the 'fh' (finish) record
      const finishSessionData: Partial<Sesion> = {
        codigo_sesion: 0,
        codigo_estacion: begSession.codigo_estacion,
        codigo_rcp: begSession.codigo_rcp,
        codigo_operador: begSession.codigo_operador,
        tipo_evento: "fh",
        estado: "A", // The 'fh' record itself is active
        fecha_evento: new Date().toISOString(),
      };
      await sesionService.save(finishSessionData);

      // 2. Deactivate the original 'beg' record
      await sesionService.delete(begSession.codigo_sesion);
    });

    await Promise.all(operations);
  };

  // const finishSession = async (silent = false) => {
  //   if (!user?.ip_address) return;
  //   const userStation = estaciones.find(e => e.direccion_ip === user.ip_address);
  //   if (!userStation) {
  //       if (!silent) toast({ title: "Error", description: "No se pudo identificar la estación de trabajo actual.", variant: "destructive" });
  //       return;
  //   }

  //   const activeSessionsOnStation = activeSessions.filter(s => s.codigo_estacion === userStation.codigo_estacion);
  //   if (activeSessionsOnStation.length === 0) {
  //       if (!silent) toast({ title: "Información", description: "No hay una sesión activa para finalizar.", variant: "default" });
  //       return;
  //   }

  //   try {
  //       const promises = activeSessionsOnStation.map(session => {
  //           const closingEvent: Partial<Sesion> = {
  //               codigo_sesion: 0,
  //               codigo_estacion: session.codigo_estacion,
  //               codigo_rcp: session.codigo_rcp,
  //               codigo_operador: session.codigo_operador,
  //               tipo_evento: 'fh',
  //               estado: 'A',
  //               fecha_evento: new Date().toISOString(),
  //           };
  //           return sesionService.save(closingEvent);
  //       });

  //       await Promise.all(promises);
  //       await fetchActiveSessions();
  //       if (!silent) toast({ title: "Éxito", description: `Sesión finalizada para ${activeSessionsOnStation.length} persona(s).` });
  //   } catch (error) {
  //       const errorMessage = error instanceof Error ? error.message : 'No se pudo finalizar la sesión.';
  //       if (!silent) toast({ title: "Error al finalizar sesión", description: errorMessage, variant: "destructive" });
  //   }
  // };

  const finishSession = async (silent = false) => {
    if (!user?.ip_address) return;
    const userStation = estaciones.find(
      (e) => e.direccion_ip === user.ip_address
    );
    if (!userStation) {
      if (!silent)
        toast({
          title: "Error",
          description: "No se pudo identificar la estación de trabajo actual.",
          variant: "destructive",
        });
      return;
    }

    const activeSessionsOnStation = activeSessions.filter(
      (s) => s.codigo_estacion === userStation.codigo_estacion
    );
    if (activeSessionsOnStation.length === 0) {
      if (!silent)
        toast({
          title: "Información",
          description: "No hay una sesión activa para finalizar.",
          variant: "default",
        });
      return;
    }

    //console.log("Iniciando finalización de sesiones para estación:", userStation.nombre_estacion);

    try {
      await processSessionEnd(activeSessionsOnStation);
      await fetchActiveSessions();
      if (!silent)
        toast({
          title: "Éxito",
          description: `Sesión finalizada para ${activeSessionsOnStation.length} persona(s).`,
        });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "No se pudo finalizar la sesión.";
      if (!silent)
        toast({
          title: "Error al finalizar sesión",
          description: errorMessage,
          variant: "destructive",
        });
    }
  };

  const finishSessionsForStation = async (stationId: number) => {
    const activeSessionsOnStation = activeSessions.filter(
      (s) => s.codigo_estacion === stationId
    );

    if (activeSessionsOnStation.length === 0) {
      toast({
        title: "Información",
        description: "No hay sesiones activas en esta estación para finalizar.",
        variant: "default",
      });
      return;
    }

    //console.log("Iniciando finalización de sesiones para estación desde metodo 2 ID:", activeSessionsOnStation);

    //console.log("Iniciando finalización de sesiones para estación desdemetodo 2 ID:", stationId);

    try {
      const promises = activeSessionsOnStation.map((session) => {
        const closingEvent: Partial<Sesion> = {
          codigo_sesion: 0,
          codigo_estacion: session.codigo_estacion,
          codigo_rcp: session.codigo_rcp,
          codigo_operador: session.codigo_operador,
          tipo_evento: "fh",
          estado: "A",
          fecha_evento: new Date().toISOString(),
        };
        return sesionService.save(closingEvent);
      });

      await Promise.all(promises);

      const cierrePromises = activeSessionsOnStation.map((codigo) =>
        sesionService.delete(codigo.codigo_sesion).catch((error) => {
          // Manejo de error
        })
      );

      await Promise.all(cierrePromises);

      await fetchActiveSessions();
      const stationName =
        estaciones.find((e) => e.codigo_estacion === stationId)
          ?.nombre_estacion || `ID ${stationId}`;
      toast({
        title: "Éxito",
        description: `Sesiones finalizadas en ${stationName}.`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "No se pudieron finalizar las sesiones.";
      toast({
        title: "Error al finalizar",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const addNotificationToHistoryPedidos = (item: NotificationHistoryItem) => {
    setNotificationHistoryPedidos((prevHistory) => {
      const newHistory = [item, ...prevHistory].slice(0, 25);
      localStorage.setItem("notificationHistoryPedidos", JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const addNotificationToHistoryAlmohadas = (item: AlmohadasNotificationHistoryItem) => {
    setNotificationHistoryAlmohadas((prevHistory) => {
      const newHistory = [item, ...prevHistory].slice(0, 256);
      localStorage.setItem("notificationHistoryAlmohadas", JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const addNotificationToHistoryPistoleado = (item: AlmohadasNotificationHistoryPistoleadoItem) => {
    setNotificationHistoryPistoleado((prevHistory) => {
      const newHistory = [item, ...prevHistory].slice(0, 256);
      localStorage.setItem("notificationHistoryPistoleado", JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const addCollaborator = (collaboratorFicha: Ficha) => {
    const newCollaborator: Collaborator = {
      ...collaboratorFicha,
      name: collaboratorFicha.NOMBRE,
      code: collaboratorFicha.CODIGO,
    };
    setCollaborators((prev) => {
      const newCollaborators = [
        ...prev.filter((c) => c.code !== newCollaborator.code),
        newCollaborator,
      ];
      localStorage.setItem("collaborators", JSON.stringify(newCollaborators));
      return newCollaborators;
    });
    setOperadores((prev) => [
      ...prev.filter((op) => op.CODIGO !== newCollaborator.code),
      { CODIGO: newCollaborator.code, NOMBRE: newCollaborator.name },
    ]);
  };

  const removeCollaborator = (code: string) => {
    setCollaborators((prev) => {
      const newCollaborators = prev.filter((c) => c.code !== code);
      localStorage.setItem("collaborators", JSON.stringify(newCollaborators));
      return newCollaborators;
    });
    setOperadores((prev) => prev.filter((op) => op.CODIGO !== code));
  };

  const contextValue = {
  user,
  isLoading,
  login,
  logout,
  notificationHistoryPedidos,
  addNotificationToHistoryPedidos,
  notificationHistoryAlmohadas,
  addNotificationToHistoryAlmohadas,
  notificationHistoryPistoleado,
  addNotificationToHistoryPistoleado,
  orders,
  setOrders,
  collaborators,
  addCollaborator,
  removeCollaborator,
  isLoginModalOpen,
  setLoginModalOpen,
  estaciones,
  areaProcessControls,
  lineas,
  activeSessions,
  operadores,
  fetchActiveSessions,
  finishSession,
  fetchAllOperatorNames,
  finishSessionsForStation,
  isWorkSessionActive,
  parseEstaciones,
  };

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

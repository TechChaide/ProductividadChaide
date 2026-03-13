"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, AlertCircle, StopCircle, Lock, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sesionService } from "@/services/sesion.service";
import { useUser } from "@/context/user-context";
import { cn } from "@/lib/utils";
import type { Sesion } from "@/types/interfaces";

export default function SesionManualContent() {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const { user, estaciones, activeSessions, fetchActiveSessions, collaborators } = useUser();

    // Identificar la estación del usuario por IP
    const userStation = useMemo(() => {
        if (!user?.ip_address || !estaciones) return null;
        return estaciones.find((e) => e.direccion_ip === user.ip_address);
    }, [user?.ip_address, estaciones]);

    // Verificar si ya hay una sesión activa para este usuario en esta estación
    const hasActiveSession = useMemo(() => {
        if (!user?.code || !userStation) return false;
        // Buscamos una sesión de inicio (tipo_evento "beg") activa para este operador en esta estación
        return activeSessions.some(
            (s) =>
                s.codigo_operador === user.code &&
                s.codigo_estacion === userStation.codigo_estacion &&
                s.tipo_evento === "beg" &&
                s.estado === "A"
        );
    }, [activeSessions, user?.code, userStation]);

    const handleIniciaTrabajo = async () => {
        // Validaciones preventivas
        if (!user?.code) {
            toast({
                title: "Usuario no identificado",
                description: "No se encontró el código de usuario. Por favor, re-inicia sesión.",
                variant: "destructive",
            });
            return;
        }

        if (!userStation) {
            toast({
                title: "Estación no identificada",
                description: `No se identificó estación para la IP: ${user.ip_address || 'desconocida'}.`,
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);
        try {
            const sessionData: Partial<Sesion> = {
                codigo_sesion: 0,
                codigo_estacion: userStation.codigo_estacion,
                codigo_rcp: null as any, // The API accepts null when no RCP is specified
                codigo_operador: user.code,
                tipo_evento: "beg", // beg = inicio
                estado: "A",
                fecha_evento: new Date().toISOString(),
            };

            console.log("Enviando datos de sesión:", sessionData);

            await sesionService.save(sessionData);

            // Iniciar sesión para cada colaborador cargado
            for (const collaborator of collaborators) {
                const collaboratorSessionData: Partial<Sesion> = {
                    codigo_sesion: 0,
                    codigo_estacion: userStation.codigo_estacion,
                    codigo_rcp: null as any,
                    codigo_operador: collaborator.code,
                    tipo_evento: "beg",
                    estado: "A",
                    fecha_evento: new Date().toISOString(),
                };
                await sesionService.save(collaboratorSessionData);
            }

            // Forzamos actualización del estado global
            await fetchActiveSessions();

            const totalPersonas = 1 + collaborators.length;
            toast({
                title: "Sesión Iniciada",
                description: `Trabajo iniciado en ${userStation.nombre_estacion} para ${totalPersonas} persona(s).`,
            });
        } catch (error: any) {
            console.error("Error al iniciar sesión manual:", error);
            toast({
                title: "Error al registrar",
                description: error.message || "Ocurrió un fallo en el servidor al intentar abrir la sesión.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleTerminaTrabajo = async () => {
        if (!user?.code || !userStation) return;

        // Find the specific active session to end
        const activeSessionToClose = activeSessions.find(
            (s) =>
                s.codigo_operador === user.code &&
                s.codigo_estacion === userStation.codigo_estacion &&
                s.tipo_evento === "beg" &&
                s.estado === "A"
        );

        if (!activeSessionToClose) {
            toast({
                title: "Error",
                description: "No se encontró una sesión activa para cerrar.",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);
        try {
            // 1. Create the 'fh' (finish) record
            const finishSessionData: Partial<Sesion> = {
                codigo_sesion: 0,
                codigo_estacion: activeSessionToClose.codigo_estacion,
                codigo_rcp: activeSessionToClose.codigo_rcp,
                codigo_operador: activeSessionToClose.codigo_operador,
                tipo_evento: "fh",
                estado: "A", // The 'fh' record itself is active
                fecha_evento: new Date().toISOString(),
            };
            await sesionService.save(finishSessionData);

            // 2. Deactivate the original 'beg' record
            await sesionService.delete(activeSessionToClose.codigo_sesion);

            // 3. Cerrar sesión de cada colaborador cargado
            for (const collaborator of collaborators) {
                const collaboratorActiveSession = activeSessions.find(
                    (s) =>
                        s.codigo_operador === collaborator.code &&
                        s.tipo_evento === "beg" &&
                        s.estado === "A"
                );
                if (collaboratorActiveSession) {
                    const finishCollaboratorData: Partial<Sesion> = {
                        codigo_sesion: 0,
                        codigo_estacion: collaboratorActiveSession.codigo_estacion,
                        codigo_rcp: collaboratorActiveSession.codigo_rcp,
                        codigo_operador: collaboratorActiveSession.codigo_operador,
                        tipo_evento: "fh",
                        estado: "A",
                        fecha_evento: new Date().toISOString(),
                    };
                    await sesionService.save(finishCollaboratorData);
                    await sesionService.delete(collaboratorActiveSession.codigo_sesion);
                }
            }

            await fetchActiveSessions();
            const totalPersonas = 1 + collaborators.length;
            toast({
                title: "Sesión Finalizada",
                description: `Jornada de trabajo terminada correctamente para ${totalPersonas} persona(s).`,
            });
        } catch (error: any) {
            console.error("Error al cerrar sesión manual:", error);
            toast({
                title: "Error al finalizar",
                description: error.message || "Ocurrió un fallo en el servidor al intentar cerrar la sesión.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="flex-1 flex items-center justify-center min-h-[450px]">
            <CardContent className="flex flex-col items-center justify-center p-12">
                <Button
                    onClick={hasActiveSession ? handleTerminaTrabajo : handleIniciaTrabajo}
                    disabled={isLoading}
                    className={cn(
                        "w-72 h-72 rounded-full flex flex-col gap-4 text-2xl font-bold transition-all duration-300 transform hover:scale-105 shadow-2xl border-8",
                        hasActiveSession
                            ? "bg-red-600 hover:bg-red-700 text-white border-red-500/20 active:scale-95"
                            : "bg-green-600 hover:bg-green-700 text-white border-green-500/20 active:scale-95"
                    )}
                >
                    {hasActiveSession ? (
                        <StopCircle className={cn("w-24 h-24", isLoading && "animate-pulse")} />
                    ) : (
                        <PlayCircle className={cn("w-24 h-24", isLoading && "animate-pulse")} />
                    )}
                    {isLoading ? "Procesando..." : hasActiveSession ? "Termina Trabajo" : "Inicia Trabajo"}
                </Button>

                <div className="mt-8 flex flex-col items-center gap-2">
                    <p className="text-muted-foreground text-center max-w-sm">
                        {hasActiveSession
                            ? "Tu sesión de trabajo está activa en este momento. Presiona el botón rojo para finalizarla."
                            : "Presiona el botón para iniciar tu jornada laboral."}
                    </p>

                    {userStation && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/10 rounded-full text-blue-700 dark:text-blue-300 text-sm font-medium mt-4">
                            <AlertCircle className="w-4 h-4" />
                            Estación Detectada: {userStation.nombre_estacion}
                        </div>
                    )}

                    {!userStation && user && (
                        <div className="text-red-500 text-xs mt-2 font-medium">
                            ⚠️ IP {user.ip_address} no asociada a ninguna estación.
                        </div>
                    )}

                    {collaborators.length > 0 && (
                        <div className="flex flex-col gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg text-green-800 dark:text-green-300 text-sm mt-4 max-w-sm w-full">
                            <div className="flex items-center gap-2 font-semibold">
                                <Users className="w-4 h-4 shrink-0" />
                                Colaboradores incluidos ({collaborators.length}):
                            </div>
                            <ul className="space-y-1 pl-6 list-disc">
                                {collaborators.map((c) => (
                                    <li key={c.code} className="text-xs">
                                        <span className="font-medium">{c.name}</span>
                                        {c.DEPARTAMENTO && (
                                            <span className="text-green-600 dark:text-green-400 ml-1 capitalize">
                                                — {c.DEPARTAMENTO.toLowerCase()}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {hasActiveSession && (
                        <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-300 text-sm mt-4 max-w-sm w-full">
                            <Lock className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>
                                <strong>No puedes salir del aplicativo</strong> mientras el trabajo esté iniciado. Finaliza la sesión primero para poder cerrar o salir.
                            </span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

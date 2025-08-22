import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { FileText, Play, Square, TriangleAlert } from "lucide-react";
import type { Order } from "@/types/order";
import { useUser } from "@/context/user-context";
import { sesionService } from "@/services/sesion.service";
import { useToast } from "@/hooks/use-toast";
import type { Sesion } from "@/types/interfaces";
import { useMemo } from "react";

interface SelectedOrderDisplayProps {
  order: Order | null;
}

export default function SelectedOrderDisplay({
  order,
}: SelectedOrderDisplayProps) {
  const {
    user,
    collaborators,
    areaProcessControls,
    activeSessions,
    fetchActiveSessions,
    estaciones,
    finishSession,
  } = useUser();
  const { toast } = useToast();

  const userStation = useMemo(() => {
    if (!user?.ip_address || estaciones.length === 0) return null;
    return estaciones.find((e) => e.direccion_ip === user.ip_address);
  }, [user?.ip_address, estaciones]);

  const activeSessionOnThisStation = useMemo(() => {
    if (!userStation || !user?.code) return undefined;
    return activeSessions.find(
      (s) =>
        s.codigo_estacion === userStation.codigo_estacion &&
        s.codigo_operador === user.code &&
        s.tipo_evento === "beg" &&
        s.estado === "A"
    );
  }, [userStation, activeSessions, user?.code]);

  const formatNumber = (num: number) =>
    num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const isSessionActiveOnAnotherStation = useMemo(() => {
    if (!user?.code || !userStation) return false;
    // Busca si el usuario tiene una sesión activa en otra estación
    return activeSessions.some(
      (s) =>
        s.codigo_operador === user.code &&
        s.codigo_estacion !== userStation.codigo_estacion &&
        s.tipo_evento === "beg" &&
        s.estado === "A"
    );
  }, [activeSessions, user?.code, userStation]);
  const areaControlForOrder = areaProcessControls.find(
    (a) => a.resp_ctrl_prod.trim() === order?.resp_ctrl_prod?.trim()
  );

  const handleStartSession = async () => {
    if (!order || !user || !userStation) {
      toast({
        title: "Error",
        description:
          "Falta información de Orden, Usuario o Estación para iniciar.",
        variant: "destructive",
      });
      return;
    }

    const areaControl = areaProcessControls.find(
      (a) => a.resp_ctrl_prod.trim() === order.resp_ctrl_prod.trim()
    );
    if (!areaControl) {
      toast({
        title: "Error de Configuración",
        description: `No se encontró el Area Process Control para "${order.resp_ctrl_prod}".`,
        variant: "destructive",
      });
      return;
    }

    const allUsers = [user, ...collaborators];

    // --- Deactivation Logic ---
    try {
      for (const currentUser of allUsers) {
        const sessionsResponse = await sesionService.getByCodigoOperador(
          currentUser.code
        );
        const activeUserSessions = (sessionsResponse.data || []).filter(
          (s) => s.estado === "A" && s.tipo_evento === "beg"
        );
        // Use the delete service which performs a logical deactivation
        const deactivationPromises = activeUserSessions.map((session) =>
          sesionService.delete(session.codigo_sesion)
        );
        await Promise.all(deactivationPromises);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "No se pudo desactivar las sesiones anteriores.";
      toast({
        title: "Error de Limpieza",
        description: errorMessage,
        variant: "destructive",
      });
      return; // Stop if we can't clean up old sessions
    }
    // --- End Deactivation Logic ---


    const sessionPromises = allUsers.map((currentUser) => {
      const newSessionData: Partial<Sesion> = {
        codigo_sesion: 0,
        codigo_estacion: userStation.codigo_estacion,
        codigo_rcp: areaControl.codigo_rcp,
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
      toast({
        title: "Éxito",
        description: `Sesión iniciada para ${allUsers.length} persona(s) en la estación ${userStation.nombre_estacion}.`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "No se pudo iniciar la sesión para todos los usuarios.";
      toast({
        title: "Error al iniciar sesión",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleFinishSession = async () => {
    if (!activeSessionOnThisStation) {
      toast({
        title: "Error",
        description:
          "No hay una sesión activa en esta estación para finalizar.",
        variant: "destructive",
      });
      return;
    }
    await finishSession();
  };

  if (!order) {
    return (
      <Card className="shadow-lg w-full flex-1">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-primary flex items-center">
            <FileText className="mr-2 h-5 w-5" /> Detalle de Selección
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[150px] text-muted-foreground">
            <p>Seleccione una orden para ver los detalles.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg w-full transition-all duration-300 ease-in-out flex-1">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-bold text-primary flex items-center">
              <FileText className="mr-2 h-5 w-5" /> Material: {order.material}
            </CardTitle>
            <CardDescription>
              Orden #{order.orden} - Estación de Orden: {order.maquina || "N/A"}
            </CardDescription>
          </div>
          <div>
            <h3 className="text-xs font-medium text-muted-foreground">
              Descripción del Material
            </h3>
            <p className="font-medium">{order.descripcionMaterial}</p>
          </div>
          <div className="flex justify-end gap-2">
            {!activeSessionOnThisStation ? (
              <Button
                onClick={handleStartSession}
                disabled={isSessionActiveOnAnotherStation}
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
              >
                <Play className="mr-2 h-4 w-4" />
                Iniciar Trabajo
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* <div>
          <h3 className="text-xs font-medium text-muted-foreground">
            Descripción del Material
          </h3>
          <p className="font-medium">{order.descripcionMaterial}</p>
        </div> */}
        <Separator />
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <h3 className="text-xs font-medium text-muted-foreground">
              Programada
            </h3>
            <p className="text-lg font-bold">
              {formatNumber(order.cantProgramada)}
            </p>
          </div>
          <div>
            <h3 className="text-xs font-medium text-muted-foreground">
              Notificada
            </h3>
            <p className="text-lg font-bold">
              {formatNumber(order.cantNotificada)}
            </p>
          </div>
          <div>
            <h3 className="text-xs font-medium text-muted-foreground">
              Pendiente
            </h3>
            <p className="text-lg font-bold text-destructive">
              {formatNumber(order.cantPendiente)}
            </p>
          </div>
        </div>

        {isSessionActiveOnAnotherStation && (
          <p className="text-xs text-destructive text-center pt-2 flex items-center justify-center gap-1">
            <TriangleAlert className="h-4 w-4" />
            Hay una sesión activa en otra estación. Finalícela antes de iniciar
            una nueva.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

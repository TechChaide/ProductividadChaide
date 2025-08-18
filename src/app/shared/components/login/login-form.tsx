"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/user-context";
import { authService } from "@/services/authService";
import { estacionService } from "@/services/estacion.service";
import { sesionService } from "@/services/sesion.service";
import type { Ficha, Sesion, User } from "@/types/interfaces";
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

// Ya no se necesita el componente Image aquí si no se muestra en el login
// import Image from 'next/image';

export default function LoginForm() {
  // Botón de prueba para logOrdenesService.save
  // Función para cerrar sesión activa y continuar login
  const handleConfirmCloseSession = async () => {
    if (!activeSessionToClose || !loginArgs) return;
    try {
      await sesionService.delete(activeSessionToClose.codigo_sesion);
      toast({
        title: "Sesión Anterior Cerrada",
        description: "Se ha cerrado la sesión activa anterior.",
      });
      await proceedWithLogin(loginArgs.userData, loginArgs.token, loginArgs.ficha);
    } catch (error) {
      toast({
        title: "Error al cerrar sesión",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo cerrar la sesión anterior.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setShowSessionAlert(false);
      setActiveSessionToClose(null);
      setLoginArgs(null);
    }
  };
  const router = useRouter();
  const { toast } = useToast();
  const { login } = useUser();
  const [employeeCode, setEmployeeCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Estados para manejar el diálogo de sesión activa
  const [showSessionAlert, setShowSessionAlert] = useState(false);
  const [activeSessionToClose, setActiveSessionToClose] =
    useState<Sesion | null>(null);
  const [loginArgs, setLoginArgs] = useState<{
    userData: User;
    token: string;
    ficha: Ficha;
  } | null>(null);

  const proceedWithLogin = async (
    userData: User,
    token: string,
    ficha: Ficha
  ) => {
    try {
      const estacionesResponse = await estacionService.getAll();
      localStorage.setItem(
        "estaciones",
        JSON.stringify(estacionesResponse.data || [])
      );
    } catch (stationError) {
      toast({
        title: "Error al cargar configuración",
        description: "No se pudieron cargar las estaciones.",
        variant: "destructive",
      });
    }
    login(userData, token, ficha);
    router.push("/dashboard/pedidos");
  };

  const handleOperatorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    e.preventDefault();
    // Validación sencilla: solo números positivos
    if (!employeeCode || !/^[0-9]+$/.test(employeeCode) || parseInt(employeeCode, 10) <= 0) {
      toast({
        title: "Código inválido",
        description: "Ingrese solo números positivos en el código de empleado.",
        variant: "destructive"
      });
      return;
    }
    setIsLoading(true);

    try {
      const ipResponse = await fetch("/api/ip");
      if (!ipResponse.ok) {
        throw new Error("No se pudo obtener la dirección IP.");
      }
      const { ip } = await ipResponse.json();

      const regexIp = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/;
      const match = ip.match(regexIp);
      const ipLimpia = match ? match[0] : null;

      console.log("Ip recuperada", ipLimpia);

      const authResponse = await authService.login(
        employeeCode,
        "192.168.205.128"
        //ipLimpia
      ); 

      if (authResponse && authResponse.user && authResponse.user.ficha) {
        const { ficha } = authResponse.user;
        const { token } = authResponse;
        const userData: User = {
          name: ficha.NOMBRE,
          code: ficha.CODIGO,
          machine: ficha.maquina,
          department: ficha.DEPARTAMENTO,
          resp_ctrl_prod: ficha.resp_ctrl_prod,
          Centro: ficha.Centro,
          imageUrl: `/api/user-photo/${ficha.CODIGO}`,
          ip_address: "192.168.205.128",
          //ip_address: ipLimpia,
        };

        const sessionsResponse = await sesionService.getByCodigoOperador(
          employeeCode
        );

        console.log("Sesiones activas", sessionsResponse);

        const activeUserSessions = sessionsResponse.data || [];

        console.log("Sesiones activas user", activeUserSessions);

        if (activeUserSessions.length > 0) {
          // Si hay sesión activa, guarda los datos para usarlos después y muestra la alerta
          setLoginArgs({ userData, token, ficha });
          setActiveSessionToClose(activeUserSessions[0]);
          setShowSessionAlert(true);
        } else {
          // Si no hay sesión, inicia sesión directamente
          await proceedWithLogin(userData, token, ficha);
        }
      } else {
        toast({
          title: "Error de Autenticación",
          description: "Código de empleado no encontrado.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error de Conexión",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo conectar con el servidor.",
        variant: "destructive",
      });
    } finally {
      if (!showSessionAlert) {
        // Solo detiene la carga si no se muestra una alerta
        setIsLoading(false);
      }
    }
  };

  // Nueva función para el login de administrador
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validación simple para usuario y contraseña
    if (username === "adminChaide" && password === "adminChaide") {
      const adminData: User = {
        name: "Admin User",
        code: "admin",
        machine: "N/A",
        department: "Administration",
        resp_ctrl_prod: "ADMIN_RESP",
        Centro: "ADMIN_CENTRO",
      };
      const mockFicha: Ficha = {
        CODIGO: "admin",
        NOMBRE: "Admin User",
        DEPARTAMENTO: "Administration",
        codigo_rcp: 0,
        resp_ctrl_prod: "ADMIN_RESP",
        estado: "A",
        maquina: "N/A",
        mac_address: "N/A",
        Centro: "ADMIN_CENTRO",
        direccion_ip: "N/A",
      };
      login(adminData, "mock-admin-token", mockFicha);
      router.push("/dashboard");
    } else {
      toast({
        title: "Error de inicio de sesión",
        description: "Usuario o contraseña incorrectos.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
  <Card className="w-full max-w-sm shadow-xl border">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center gap-2 mb-2">
            <img
              src="/img/Chide.svg"
              alt="Luna Creciente Logo"
              width={64}
              height={64}
            />
            <CardTitle className="text-2xl font-bold text-foreground">
              Órdenes
            </CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">Inicio de Sesión</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="operator" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="operator">Operario</TabsTrigger>
              <TabsTrigger value="admin">Administración</TabsTrigger>
            </TabsList>

            <TabsContent value="operator">
              <form onSubmit={handleOperatorLogin} className="space-y-6 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="employeeCode">Código de Empleado</Label>
                  <Input
                    id="employeeCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Ingrese su código"
                    value={employeeCode}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Solo permite números positivos
                      if (/^[0-9]*$/.test(val)) {
                        setEmployeeCode(val);
                      }
                    }}
                    onPaste={(e) => {
                      const paste = e.clipboardData.getData('text');
                      if (!/^[0-9]+$/.test(paste)) {
                        e.preventDefault();
                      }
                    }}
                    required
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Verificando..." : "Ingresar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="admin">
              <form onSubmit={handleAdminLogin} className="space-y-6 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Usuario</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Ingresar
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={showSessionAlert} onOpenChange={setShowSessionAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sesión Activa Detectada</AlertDialogTitle>
            <AlertDialogDescription>
              Hemos detectado que ya tiene una sesión de trabajo activa en otra
              estación. ¿Desea cerrar la sesión anterior para poder iniciar una
              nueva aquí?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsLoading(false);
                setShowSessionAlert(false);
                setActiveSessionToClose(null);
                setLoginArgs(null);
              }}
            >
              No, cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCloseSession}>
              Sí, cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

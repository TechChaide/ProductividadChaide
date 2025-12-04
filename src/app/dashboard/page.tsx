
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/user-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { menuService } from "@/services/menu.service";
import { environment } from "@/environments/environments.prod";
import * as LucideIcons from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MetricasSesionesCard } from "@/components/metricas-sesiones-card";

type MenuNode = {
  codigo_menu: number;
  codigo_padre: number | null;
  nombre: string;
  icono: string;
  path: string;
  estado: string;
  codigo_aplicacion: string;
  children?: MenuNode[];
};

export default function DashboardPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemsPerView = 3;

  useEffect(() => {
    if (isLoading) return;

    const cargarMenu = async () => {
      try {
        const usuarioCodigo = sessionStorage.getItem("usuario_codigo");
        const codigoAplicacion = environment.nombreAplicacion || "APP_MENU_RESERVA";

        if (!usuarioCodigo || !codigoAplicacion) {
          setMenuLoading(false);
          return;
        }

        // Obtener perfiles del usuario
        const profileRes = await menuService.getUserProfiles(usuarioCodigo);
        const tipoUsuarioObj = (profileRes?.data as { Tipo_usuario?: any })?.Tipo_usuario || {};
        const usuarioPerfiles = Object.values(tipoUsuarioObj).map((tu: any) => tu.codigo_tipo_usuario);

        // Obtener perfiles de la aplicación
        const appProfilesRes = await menuService.getAplicationProfiles(codigoAplicacion);
        const appPerfiles = (appProfilesRes?.data || []).map((ap: any) => ap.codigo_tipo_usuario);

        // Encontrar coincidencias
        const perfilesMatch = usuarioPerfiles.filter((codigo: any) => appPerfiles.includes(codigo));

        // Obtener menús para cada perfil
        const menusRes = await Promise.all(
          perfilesMatch.map((codigoTipoUsuario: any) =>
            menuService.getMenuByCodigoTipoUsuario(codigoTipoUsuario)
          )
        );

        // Combinar menús
        let allMenus: MenuNode[] = [];
        menusRes.forEach((res) => {
          if (res.data) {
            allMenus.push(res.data as MenuNode);
          } else if (res && typeof res === "object" && (res as any).codigo_menu) {
            allMenus.push(res as any);
          }
        });

        // Filtrar menús activos y obtener items navegables
        const items = getAllNavigableItems(allMenus);
        setMenuItems(items);
      } catch (error) {
        console.error("Error cargando menú:", error);
      } finally {
        setMenuLoading(false);
      }
    };

    cargarMenu();
  }, [isLoading]);

  const getAllNavigableItems = (nodes: MenuNode[]): any[] => {
    const items: any[] = [];

    const traverse = (node: MenuNode) => {
      // Crear botón si el path es válido (no "." ni "|")
      if (node.path && node.path !== "." && node.path !== "|" && node.estado === "A") {
        const IconComp = (LucideIcons as Record<string, any>)[node.icono] || (LucideIcons as Record<string, any>)["Shield"];
        items.push({
          nombre: node.nombre,
          icono: IconComp,
          path: node.path,
        });
      }

      // Procesar hijos
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => traverse(child));
      }
    };

    // Procesar todos los nodos raíz
    const activeNodes = filterActive(nodes);
    activeNodes.forEach((node) => traverse(node));
    return items;
  };

  const handlePrev = () => {
    setCurrentIndex(Math.max(0, currentIndex - 1));
  };

  const handleNext = () => {
    setCurrentIndex(Math.min(menuItems.length - itemsPerView, currentIndex + 1));
  };

  const filterActive = (nodes: MenuNode[]): MenuNode[] => {
    return nodes
      .filter((node) => node.estado === "A")
      .map((node) => ({
        ...node,
        children: node.children ? filterActive(node.children) : undefined,
      }));
  };

  // Show the dashboard
  return (
    <div className="space-y-6">
      {/* Título Dashboard */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bienvenido al panel de usuario, {user?.name || "Usuario"}.
        </p>
      </div>

      {/* Sección de Menú */}
      <Card>
        <CardHeader>
          <CardTitle>Opciones Disponibles</CardTitle>
          <CardDescription>
            Selecciona una opción para comenzar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {menuLoading ? (
            <div className="text-sm text-gray-600">Cargando opciones...</div>
          ) : menuItems.length > 0 ? (
            <div className="space-y-4">
              {/* Carrusel */}
              <div className="relative flex items-center gap-4">
                {/* Botón anterior */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="flex-shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Contenedor de cards */}
                <div className="flex-1 overflow-hidden">
                  <div className="flex gap-4 transition-transform duration-300" style={{ transform: `translateX(-${currentIndex * (100 / itemsPerView)}%)` }}>
                    {menuItems.map((item, index) => {
                      const IconComp = item.icono;
                      return (
                        <div key={index} className="flex-shrink-0 w-1/3">
                          <Card
                            onClick={() => router.push(environment.basePath + item.path)}
                            className="cursor-pointer hover:shadow-lg transition-shadow h-full"
                          >
                            <CardContent className="flex flex-col items-center justify-center gap-3 pt-6 h-full py-8">
                              {IconComp && <IconComp className="h-8 w-8" />}
                              <span className="font-medium text-center text-sm">{item.nombre}</span>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Botón siguiente */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNext}
                  disabled={currentIndex >= menuItems.length - itemsPerView}
                  className="flex-shrink-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Indicadores de puntos */}
              <div className="flex justify-center gap-2">
                {Array.from({ length: Math.ceil(menuItems.length / itemsPerView) }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index * itemsPerView)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      Math.floor(currentIndex / itemsPerView) === index ? "bg-primary w-6" : "bg-gray-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p>No hay opciones disponibles.</p>
          )}
        </CardContent>
      </Card>

      {/* Sección de Métricas en Card */}
      <Card>
        <CardHeader>
          <CardTitle>Métricas de Sesión</CardTitle>
          <CardDescription>
            Información sobre tus sesiones de trabajo por estación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MetricasSesionesCard />
        </CardContent>
      </Card>
    </div>
  );
}

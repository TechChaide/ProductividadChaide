"use client";
import React, { useEffect, useState } from "react";
import { environment } from "@/environments/environments.prod";
import {
  useSidebar,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar-new";
import { menuService } from "@/services/menu.service";
import { usePathname } from "next/navigation";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import * as LucideIcons from "lucide-react";
import { ChevronsUpDown } from "lucide-react";
import { Toast } from "@radix-ui/react-toast";
import router, { useRouter } from "next/navigation";

function toRecursiveItems(nodes: MenuNode[]): any[] {
  return nodes.map((n) => {
    // Buscar el icono por nombre en LucideIcons
    const IconComp =
      (LucideIcons as Record<string, any>)[n.icono] ||
      (LucideIcons as Record<string, any>)["Shield"];
    const hasChildren = !!(n.children && n.children.length);
    const isRoot = n.path === ".";
    const isBranch = n.path === "|";
    // Los elementos raíz y branch también pueden ser navegables si tienen un path válido
    // Solo excluir de navegación si el path está vacío o es undefined
    const isNavigable =
      !!n.path && n.path !== "" && n.path !== "." && n.path !== "|";
    const children = hasChildren ? toRecursiveItems(n.children!) : undefined;

    return {
      label: n.nombre,
      icon: IconComp,
      path: isNavigable ? n.path : undefined,
      children,
      // Incluir información adicional para debugging
      codigo_menu: n.codigo_menu,
      originalPath: n.path,
      isRoot,
      isBranch,
    };
  });
}

const RecursiveMenu = ({
  items,
  level = 0,
}: {
  items: any[];
  level?: number;
}) => {
  const sidebar = useSidebar();
  const isCollapsed =
    (sidebar as any)?.isCollapsed ?? (sidebar as any)?.collapsed ?? false;
  const pathname = usePathname();

  if (items.length === 0) return null;
  return (
    <div
      className="w-full"
      style={{ paddingLeft: level > 0 && !isCollapsed ? "1rem" : "0" }}
    >
      {items.map((item, index) => (
        <Collapsible
          key={index}
          className={isCollapsed ? "w-full flex justify-center" : "w-full"}
          defaultOpen
        >
          {item.children ? (
            <>
              <CollapsibleTrigger
                className={
                  isCollapsed
                    ? "w-10 h-10 flex items-center justify-center rounded-md hover:bg-primary-foreground/10"
                    : "w-full"
                }
                title={isCollapsed ? item.label : undefined}
              >
                <div
                  className={
                    isCollapsed
                      ? "flex items-center justify-center"
                      : "flex items-center justify-between w-full p-2 rounded-md hover:bg-primary/80"
                  }
                >
                  <div
                    className={
                      isCollapsed
                        ? "flex items-center"
                        : "flex items-center gap-2"
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    {!isCollapsed && <span>{item.label}</span>}
                  </div>
                  {!isCollapsed && <ChevronsUpDown className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
              {!isCollapsed && (
                <CollapsibleContent>
                  <RecursiveMenu items={item.children} level={level + 1} />
                </CollapsibleContent>
              )}
            </>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton
                href={environment.basePath + (item.path || "#")}
                active={(() => {
                  if (!item.path || !pathname) return false;
                  const base = environment.basePath || "";
                  const current = pathname.startsWith(base)
                    ? pathname.slice(base.length) || "/"
                    : pathname;
                  const normalize = (p: string) =>
                    p.endsWith("/") && p !== "/" ? p.slice(0, -1) : p;
                  const cur = normalize(current);
                  const target = normalize(item.path);
                  return cur === target || cur.startsWith(`${target}/`);
                })()}
                className={
                  isCollapsed
                    ? "h-10 w-10 justify-center"
                    : "justify-start pl-4 h-9"
                }
                title={isCollapsed ? item.label : undefined}
              >
                {item.icon && (
                  <item.icon
                    className={isCollapsed ? "h-5 w-5" : "h-4 w-4 mr-2"}
                  />
                )}
                {!isCollapsed && item.label}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </Collapsible>
      ))}
    </div>
  );
};

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

function filterActive(nodes: MenuNode[]): MenuNode[] {
  // Filtra los nodos activos (por ejemplo, estado === 'A')
  return nodes
    .filter((node) => node.estado === "A")
    .map((node) => ({
      ...node,
      children: node.children ? filterActive(node.children) : undefined,
    }));
}

function combineMenus(menus: MenuNode[]): MenuNode[] {
  if (!menus || menus.length === 0) return [];

  const menuMap = new Map<number, MenuNode>();

  menus.forEach((menu) => {
    if (!menu || !menu.codigo_menu) {
      return;
    }

    const existingMenu = menuMap.get(menu.codigo_menu);

    if (existingMenu) {
      // Si el menú ya existe, combinar los children
      const existingChildren = existingMenu.children || [];
      const newChildren = menu.children || [];

      // Combinar children recursivamente
      const allChildren = [...existingChildren, ...newChildren];
      const combinedChildren =
        allChildren.length > 0 ? combineMenus(allChildren) : undefined;

      // Actualizar el menú existente con los children combinados
      menuMap.set(menu.codigo_menu, {
        ...existingMenu,
        children:
          combinedChildren && combinedChildren.length > 0
            ? combinedChildren
            : undefined,
      });
    } else {
      // Si es un menú nuevo, agregarlo al mapa
      menuMap.set(menu.codigo_menu, {
        ...menu,
        children:
          menu.children && menu.children.length > 0
            ? combineMenus(menu.children)
            : undefined,
      });
    }
  });

  return Array.from(menuMap.values());
}

export function DynamicSidebarMenu() {
  // Initialize required states
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [menuLoading, setMenuLoading] = useState<boolean>(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [showNoProfileToast, setShowNoProfileToast] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    const usuarioCodigo =
      typeof window !== "undefined"
        ? sessionStorage.getItem("usuario_codigo")
        : null;
    const codigoAplicacion = environment.nombreAplicacion || "APP_MENU_RESERVA";

    async function cargarMenu() {
      let menuMostrado: any[] = [];
      let huboError = false;
      setMenuLoading(true);
      setMenuError(null);
      // console.log(
      //   "Cargando menú para usuario:",
      //   usuarioCodigo,
      //   "y aplicación:",
      //   codigoAplicacion
      // );

      if (usuarioCodigo && codigoAplicacion) {
        try {
          //console.log("Solicitando perfiles de usuario...");
          const profileRes = await menuService.getUserProfiles(usuarioCodigo);
          setUserProfile(profileRes);
          //console.log("Respuesta perfiles usuario:", profileRes);
          const tipoUsuarioObj =
            (profileRes?.data as { Tipo_usuario?: any })?.Tipo_usuario || {};
          const usuarioPerfiles = Object.values(tipoUsuarioObj).map(
            (tu: any) => tu.codigo_tipo_usuario
          );
          //console.log("Perfiles del usuario:", usuarioPerfiles);
          //console.log("Solicitando perfiles de aplicación...");
          const appProfilesRes = await menuService.getAplicationProfiles(
            codigoAplicacion
          );
          //console.log("Respuesta perfiles aplicación:", appProfilesRes);
          const appPerfiles = (appProfilesRes?.data || []).map(
            (ap: any) => ap.codigo_tipo_usuario
          );
          //console.log("Perfiles de la aplicación:", appPerfiles);
          const perfilesMatch = usuarioPerfiles.filter((codigo: any) =>
            appPerfiles.includes(codigo)
          );
          //console.log("Perfiles que hacen match:", perfilesMatch);
          //console.log("Solicitando menús para perfiles match...");
          const menusRes = await Promise.all(
            perfilesMatch.map((codigoTipoUsuario: any) =>
              menuService.getMenuByCodigoTipoUsuario(codigoTipoUsuario)
            )
          );
          //console.log("Respuestas de menús por perfil:", menusRes);
          let allMenus: MenuNode[] = [];
          menusRes.forEach((res) => {
            if (res.data) {
              allMenus.push(res.data as MenuNode);
            } else if (
              res &&
              typeof res === "object" &&
              (res as any).codigo_menu
            ) {
              allMenus.push(res as any);
            }
          });
          //console.log("Menús combinados antes de filtrar:", allMenus);
          const combinedMenus = combineMenus(allMenus);
          //console.log("Menús combinados:", combinedMenus);
          const activeMenus = filterActive(combinedMenus);
          //console.log("Menús activos:", activeMenus);
          const recursiveMenus = toRecursiveItems(activeMenus);
          //console.log("Menú recursivo final:", recursiveMenus);
          if (recursiveMenus.length > 0) {
            menuMostrado = recursiveMenus;
          }
        } catch (err) {
          console.error("Error en recuperación de menú propio:", err);
          huboError = true;
        }
      }

      // Si no hay menú propio, intentar cargar el de super-admin
      if (menuMostrado.length === 0) {
        try {
          if (typeof window !== "undefined") {
            sessionStorage.setItem("showNoProfileToast", "1");
          }
          router.push("/");
        } catch (err) {
          console.error("Error en recuperación de menú super-admin:", err);
          huboError = true;
        }
      }

      setMenuItems(menuMostrado);
      setMenuLoading(false);
      // Control de acceso: si no hay menú, bloquear y mostrar toast
      try {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            "menu_has_items",
            menuMostrado && menuMostrado.length > 0 ? "true" : "false"
          );
          window.dispatchEvent(new Event("menu-items-updated"));
        }
      } catch {}
      if (menuMostrado.length === 0 || huboError) {
        setMenuError("No tienes acceso a esta aplicación.");
        setShowNoProfileToast(true);
      }
    }
    cargarMenu();
  }, []);

  useEffect(() => {
    if (!menuLoading && menuItems.length === 0 && !menuError) {
      router.push("/");
    }
  }, [menuLoading, menuItems, menuError, router]);

  return (
    <SidebarMenu>
      {menuLoading && (
        <div className="text-xs text-white/70 px-2 py-1">Cargando menú...</div>
      )}
      {!menuLoading && menuError && (
        <div className="text-xs text-red-200 px-2 py-1">{menuError}</div>
      )}
      {!menuLoading && !menuError && menuItems.length > 0 && (
        <RecursiveMenu items={menuItems} />
      )}
      {!menuLoading && !menuError && menuItems.length === 0 && (
        <div className="text-xs text-white/60 px-2 py-1">
          Sin opciones de menú
        </div>
      )}
    </SidebarMenu>
  );
}

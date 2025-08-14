
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, TestTube2, Home, ClipboardList, Settings, LogOut, Users, UserCog, PlusCircle, UserMinus, SlidersHorizontal, Building, Waypoints, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
  Sidebar as SidebarPrimitive,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/context/user-context";
import type { Collaborator } from "@/context/user-context";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMemo, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";


const getInitials = (name: string) => {
    if (!name) return "";
    const names = name.split(' ');
    if (names.length > 1) {
        const firstInitial = names[0]?.[0] || '';
        const secondInitial = names[1]?.[0] || '';
        return `${firstInitial}${secondInitial}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}


const UserMenuItem = () => {
    const { user, logout, activeSessions, estaciones } = useUser();
    const router = useRouter();
    const { state } = useSidebar();
    const { toast } = useToast();

    const userStation = useMemo(() => {
        if (!user?.ip_address || estaciones.length === 0) return null;
        return estaciones.find(e => e.direccion_ip === user.ip_address);
    }, [user?.ip_address, estaciones]);

    const activeSessionOnThisStation = useMemo(() => {
        if (!userStation) return undefined;
        return activeSessions.find(s => s.codigo_estacion === userStation.codigo_estacion);
    }, [userStation, activeSessions]);


    const handleLogout = () => {
        if (user?.code !== 'admin' && activeSessionOnThisStation) {
            toast({
                title: "Sesión de Trabajo Activa",
                description: "Debe finalizar la sesión de trabajo actual antes de poder salir.",
                variant: "destructive",
            });
            return;
        }
        logout();
        router.push('/');
    };
    
    if (state === 'collapsed') {
        return (
            <div className="flex justify-center items-center py-2">
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Avatar className="h-9 w-9 cursor-pointer">
                            {user?.imageUrl && <AvatarImage src={user.imageUrl} alt={user.name || 'User'} />}
                            <AvatarFallback className="bg-white text-primary font-bold">
                                {user?.name ? getInitials(user.name) : <Users className="h-5 w-5" />}
                            </AvatarFallback>
                        </Avatar>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                        <p>{user?.name}</p>
                        <p>{user?.department}</p>
                    </TooltipContent>
                 </Tooltip>
            </div>
        )
    }

    const nameParts = user?.name?.split(' ') || [];
    const firstNames = nameParts.slice(0, 2).join(' ');
    const lastNames = nameParts.slice(2).join(' ');

    return (
        <div className="p-3 rounded-md bg-white/20">
            <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.imageUrl} alt={user?.name || 'User'} />
                    <AvatarFallback className="bg-white text-primary font-bold">
                        {user?.name ? getInitials(user.name) : <Users className="h-5 w-5" />}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                    <div className="text-sm font-semibold text-white">
                        <p>{firstNames}</p>
                        <p>{lastNames}</p>
                    </div>
                    {user?.department && (
                       <p className="text-xs text-white/70 capitalize">{user.department.toLowerCase()}</p>
                    )}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={handleLogout} title="Salir">
                    <LogOut className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}

const CollaboratorItem = ({ collaborator }: { collaborator: Collaborator }) => {
    const { removeCollaborator, activeSessions } = useUser();
    const { state } = useSidebar();
    const isAnySessionActive = activeSessions.length > 0;


    if (state === 'collapsed') {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Avatar className="h-9 w-9 cursor-pointer border-2 border-white/50">
                        <AvatarFallback className="bg-accent text-accent-foreground font-bold text-sm">
                            {getInitials(collaborator.name)}
                        </AvatarFallback>
                    </Avatar>
                </TooltipTrigger>
                <TooltipContent side="right">
                    <p>{collaborator.name}</p>
                    <p>{collaborator.department}</p>
                    <Button 
                        variant="destructive" 
                        size="sm" 
                        className="mt-2" 
                        onClick={() => removeCollaborator(collaborator.code)}
                        disabled={isAnySessionActive}
                    >
                        Eliminar
                    </Button>
                </TooltipContent>
            </Tooltip>
        );
    }
    
    const nameParts = collaborator.name.split(' ');
    const firstNames = nameParts.slice(0, 2).join(' ');
    const lastNames = nameParts.slice(2).join(' ');
    
    return (
        <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-primary-foreground/10 w-full">
            <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-white text-primary font-bold">
                    {getInitials(collaborator.name)}
                </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
                 <div className="text-sm font-semibold text-white">
                    <p>{firstNames}</p>
                    <p>{lastNames}</p>
                </div>
                {collaborator.department && (
                    <p className="text-xs text-white/70 capitalize">{collaborator.department.toLowerCase()}</p>
                )}
            </div>
             <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-white hover:bg-white/20" 
                onClick={() => removeCollaborator(collaborator.code)} 
                title="Eliminar Colaborador"
                disabled={isAnySessionActive}
            >
                <UserMinus className="h-4 w-4" />
            </Button>
        </div>
    );
};


export default function Sidebar() {
  const pathname = usePathname();
  const { state, toggleSidebar } = useSidebar();
  const { user, collaborators, setLoginModalOpen, activeSessions } = useUser();
  const [isParamsOpen, setIsParamsOpen] = useState(false);
  const isAnySessionActive = activeSessions.length > 0;

  const isOperator = user?.code !== 'admin';
  const isActive = (path: string) => pathname.startsWith(path);
  
  useEffect(() => {
    if (isActive('/dashboard/parametros')) {
      setIsParamsOpen(true);
    }
  }, [pathname]);

  return (
    <SidebarPrimitive
      variant="sidebar"
      collapsible="icon"
      className="bg-primary text-primary-foreground"
    >
        <div className="flex h-full flex-col">
            <SidebarHeader className="h-14 flex items-center justify-center">
                {state === 'expanded' ? (
                    <img
                        src="/img/logo_chaide.svg"
                        alt="Chaide Logo"
                        className="h-8"
                        data-ai-hint="logo text"
                    />
                ) : (
                    <img
                        src="/img/Chide.svg"
                        alt="Chaide Logo"
                        className="h-8"
                        data-ai-hint="logo icon"
                    />
                )}
            </SidebarHeader>

            <SidebarContent className="p-2">
                <SidebarMenu>
                    {!isOperator && (
                      <SidebarMenuItem>
                          <SidebarMenuButton 
                              href="/dashboard" 
                              isActive={pathname === '/dashboard'} 
                              tooltip="Dashboard"
                              className="data-[active=true]:bg-white data-[active=true]:text-primary bg-primary text-primary-foreground hover:bg-white/90 hover:text-primary"
                          >
                              <Home />
                              <span className="group-data-[collapsible=icon]:hidden">Dashboard</span>
                          </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    {isOperator && (
                      <SidebarMenuItem>
                          <SidebarMenuButton 
                              href="/dashboard/pedidos" 
                              isActive={isActive('/dashboard/pedidos')} 
                              tooltip="Pedidos"
                              className="data-[active=true]:bg-white data-[active=true]:text-primary bg-primary text-primary-foreground hover:bg-white/90 hover:text-primary"
                          >
                              <ClipboardList />
                              <span className="group-data-[collapsible=icon]:hidden">Pedidos</span>
                          </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    {!isOperator && (
                        <SidebarMenuItem data-open={isParamsOpen ? "true" : "false"}>
                            <SidebarMenuButton
                                onClick={() => setIsParamsOpen(prev => !prev)}
                                isActive={isActive('/dashboard/parametros')}
                                className="data-[active=true]:bg-white data-[active=true]:text-primary bg-primary text-primary-foreground hover:bg-white/90 hover:text-primary"
                            >
                                <SlidersHorizontal />
                                <span className="group-data-[collapsible=icon]:hidden">Parámetros</span>
                            </SidebarMenuButton>
                            <SidebarMenuSub>
                                <SidebarMenuSubItem>
                                    <SidebarMenuSubButton href="/dashboard/parametros/area-process-control" isActive={isActive('/dashboard/parametros/area-process-control')} className="data-[active=true]:bg-white data-[active=true]:text-primary bg-primary text-primary-foreground hover:bg-white/90 hover:text-primary">
                                        <Building className="mr-2"/> Area Process Control
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                                <SidebarMenuSubItem>
                                    <SidebarMenuSubButton href="/dashboard/parametros/estaciones" isActive={isActive('/dashboard/parametros/estaciones')} className="data-[active=true]:bg-white data-[active=true]:text-primary bg-primary text-primary-foreground hover:bg-white/90 hover:text-primary">
                                        <Waypoints className="mr-2"/> Estaciones
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                                <SidebarMenuSubItem>
                                    <SidebarMenuSubButton href="/dashboard/parametros/lineas" isActive={isActive('/dashboard/parametros/lineas')} className="data-[active=true]:bg-white data-[active=true]:text-primary bg-primary text-primary-foreground hover:bg-white/90 hover:text-primary">
                                        <Waypoints className="mr-2"/> Líneas
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                                 <SidebarMenuSubItem>
                                    <SidebarMenuSubButton href="/dashboard/parametros/sesiones" isActive={isActive('/dashboard/parametros/sesiones')} className="data-[active=true]:bg-white data-[active=true]:text-primary bg-primary text-primary-foreground hover:bg-white/90 hover:text-primary">
                                        <History className="mr-2"/> Sesiones
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                            </SidebarMenuSub>
                        </SidebarMenuItem>
                    )}
                </SidebarMenu>
            </SidebarContent>
            
            <div className="flex-1 flex flex-col justify-end items-center py-4">
                {state === 'expanded' && (!isOperator || collaborators.length <= 3) && (
                    <Avatar className="h-24 w-24 border-4 border-white">
                        <AvatarImage src={user?.imageUrl} alt={user?.name || 'User'} />
                        <AvatarFallback className="bg-white text-primary">
                            <Users className="h-12 w-12" />
                        </AvatarFallback>
                    </Avatar>
                )}
            </div>

            <Separator className="bg-primary-foreground/20" />
            
            <div className="p-2">
                <UserMenuItem />
            </div>

            {isOperator && (
                <>
                    <Separator className="bg-primary-foreground/20" />
                    <div className="p-2 flex flex-col gap-2">
                        <ScrollArea className="w-full" style={{ maxHeight: 'calc(100vh - 500px)' }}>
                           <div className={`flex flex-col gap-2 ${state === 'collapsed' ? 'items-center' : ''}`}>
                                {collaborators.map(c => <CollaboratorItem key={c.code} collaborator={c} />)}
                            </div>
                        </ScrollArea>

                         {state === 'expanded' ? (
                            <Button 
                                variant="ghost" 
                                className="w-full text-primary-foreground hover:bg-white/10 mt-2" 
                                onClick={() => setLoginModalOpen(true)}
                                disabled={isAnySessionActive}
                            >
                                <PlusCircle className="mr-2" /> Añadir Colaborador
                            </Button>
                        ) : (
                             <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="text-primary-foreground hover:bg-white/10 mx-auto mt-2" 
                                        onClick={() => setLoginModalOpen(true)}
                                        disabled={isAnySessionActive}
                                    >
                                        <PlusCircle />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">Añadir Colaborador</TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                </>
            )}

            <SidebarFooter className="p-2 border-t border-primary-foreground/20 mt-auto">
                <Button variant="ghost" className="w-full justify-center text-primary-foreground hover:bg-white/10" onClick={toggleSidebar}>
                    {state === 'expanded' ? <ChevronLeft /> : <ChevronRight />}
                    <span className="sr-only">Toggle Sidebar</span>
                </Button>
            </SidebarFooter>
        </div>
    </SidebarPrimitive>
  );
}

    
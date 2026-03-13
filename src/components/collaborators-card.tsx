"use client";

import { useSidebar } from "@/components/ui/sidebar-new";
import { useUser } from "@/context/user-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PlusCircle, UserMinus, Users } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { isAlmohadasDepartment } from "@/context/user-context";
import { useToast } from "@/hooks/use-toast";

const getInitials = (name: string) => {
  if (!name) return "C";
  const names = name.split(" ");
  if (names.length > 1) {
    const firstInitial = names[0]?.[0] || "";
    const secondInitial = names[1]?.[0] || "";
    return `${firstInitial}${secondInitial}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const UserMenuItem = () => {
  const { user, logout, activeSessions, estaciones, isWorkSessionActive } = useUser();
  const { isCollapsed } = useSidebar();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = () => {
    if (user?.code !== 'admin' && isWorkSessionActive) {
      toast({
        title: "Sesión de Trabajo Activa",
        description: "Debe finalizar el trabajo antes de salir del aplicativo.",
        variant: "destructive",
      });
      return;
    }
    logout();
    router.push("/");
  };

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Avatar className="h-9 w-9 cursor-pointer border-2 border-white/50">
            {user?.imageUrl && (
              <AvatarImage src={user.imageUrl} alt={user.name || "User"} />
            )}
            <AvatarFallback className="bg-white text-primary font-bold">
              {user?.name ? (
                getInitials(user.name)
              ) : (
                <Users className="h-5 w-5" />
              )}
            </AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-primary text-primary-foreground">
          <div className="space-y-2">
            <div>
              <p className="font-semibold">{user?.name}</p>
              {user?.department && (
                <p className="text-xs capitalize">{user.department.toLowerCase()}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-primary-foreground hover:bg-white/20"
              onClick={handleLogout}
            >
              <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Salir
            </Button>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  const nameParts = user?.name?.split(" ") || [];
  const firstNames = nameParts.slice(0, 2).join(" ");
  const lastNames = nameParts.slice(2).join(" ");

  return (
    <div className="p-3 rounded-md bg-white/20">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={user?.imageUrl} alt={user?.name || "User"} />
          <AvatarFallback className="bg-white text-primary font-bold">
            {user?.name ? (
              getInitials(user.name)
            ) : (
              <Users className="h-5 w-5" />
            )}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 overflow-hidden">
          <div className="text-sm font-semibold text-white">
            <p>{firstNames}</p>
            <p>{lastNames}</p>
          </div>
          {user?.department && (
            <p className="text-xs text-white/70 capitalize">
              {user.department.toLowerCase()}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-white/20"
          onClick={handleLogout}
          title="Salir"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </Button>
      </div>
    </div>
  );
};

const CollaboratorItem = ({ collaborator }: any) => {
  const { removeCollaborator, activeSessions, collaborators } = useUser();
  const { isCollapsed } = useSidebar();

  const isCollaboratorSessionActive = (code: string) =>
    activeSessions.some(
      (s: any) =>
        s.codigo_operador === code &&
        s.tipo_evento === "beg" &&
        s.estado === "A"
    );

  const allSessionsActive = useMemo(() => {
    if (collaborators.length === 0) return false;
    if (collaborators.some((c: any) => isAlmohadasDepartment(c.DEPARTAMENTO)))
      return false;
    return collaborators.every((c: any) =>
      isCollaboratorSessionActive(c.code)
    );
  }, [collaborators, activeSessions]);

  if (isCollapsed) {
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
          <p>{collaborator.DEPARTAMENTO}</p>
          <Button
            variant="destructive"
            size="sm"
            className="mt-2"
            onClick={() => removeCollaborator(collaborator.code)}
            disabled={allSessionsActive}
          >
            Eliminar
          </Button>
        </TooltipContent>
      </Tooltip>
    );
  }

  const name = collaborator.name || "Sin nombre";
  const nameParts = name.split(" ");
  const firstNames = nameParts.slice(0, 2).join(" ");
  const lastNames = nameParts.slice(2).join(" ");
  const departamento = collaborator.DEPARTAMENTO || "Sin departamento";

  const activeTextClass = isCollaboratorSessionActive(collaborator.code)
    ? "text-orange-200 font-bold"
    : "text-white";

  return (
    <div className="flex items-center gap-3 p-3 rounded-md w-full bg-primary-foreground/10">
      <Avatar className="h-9 w-9">
        <AvatarFallback className="bg-white text-primary font-bold">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 overflow-hidden">
        <div className={`text-sm font-semibold ${activeTextClass}`}>
          <p>{firstNames}</p>
          <p>{lastNames}</p>
        </div>
        <p className="text-xs text-white/70 capitalize">
          {departamento.toLowerCase()}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-white hover:bg-white/20"
        onClick={() => removeCollaborator(collaborator.code)}
        title="Eliminar Colaborador"
        disabled={allSessionsActive}
      >
        <UserMinus className="h-4 w-4" />
      </Button>
    </div>
  );
};

export function CollaboratorsCard() {
  const { isCollapsed } = useSidebar();
  const { user, collaborators, setLoginModalOpen, activeSessions, logout, isWorkSessionActive } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const handleSalir = () => {
    if (user?.code !== 'admin' && isWorkSessionActive) {
      toast({
        title: "Sesión de Trabajo Activa",
        description: "Debe finalizar el trabajo antes de salir del aplicativo.",
        variant: "destructive",
      });
      return;
    }
    logout();
    router.push("/");
  };

  const isOperator = user?.code !== "admin";

  const isCollaboratorSessionActive = (code: string) =>
    activeSessions.some(
      (s: any) =>
        s.codigo_operador === code &&
        s.tipo_evento === "beg" &&
        s.estado === "A"
    );

  const allSessionsActive = useMemo(() => {
    if (collaborators.length === 0) return false;
    if (collaborators.some((c: any) => isAlmohadasDepartment(c.DEPARTAMENTO)))
      return false;
    return collaborators.every((c: any) =>
      isCollaboratorSessionActive(c.code)
    );
  }, [collaborators, activeSessions]);

  if (!isOperator) {
    return null;
  }

  return (
    <TooltipProvider>
      {isCollapsed ? (
        <div className="flex flex-col items-center gap-3 py-2">
          {/* Foto del usuario grande colapsada */}
          <div className="flex flex-col items-center">
            {user?.imageUrl ? (
              <Avatar className="h-10 w-10 cursor-pointer border-2 border-white/50">
                <AvatarImage src={user.imageUrl} alt={user?.name || "User"} />
                <AvatarFallback className="bg-white text-primary font-bold text-sm">
                  {user?.name ? getInitials(user.name) : <Users className="h-5 w-5" />}
                </AvatarFallback>
              </Avatar>
            ) : (
              <Avatar className="h-10 w-10 cursor-pointer border-2 border-white/50">
                <AvatarFallback className="bg-white text-primary font-bold text-sm">
                  {user?.name ? getInitials(user.name) : <Users className="h-5 w-5" />}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          {/* Colaboradores */}
          <ScrollArea className="w-10 h-20">
            <div className="flex flex-col items-center gap-2 p-1">
              {collaborators.map((c: any) => (
                <CollaboratorItem key={c.code} collaborator={c} />
              ))}
            </div>
          </ScrollArea>

          {/* Botón Añadir Colaborador */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-white/10"
                onClick={() => setLoginModalOpen(true)}
                disabled={allSessionsActive}
              >
                <PlusCircle className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Añadir Colaborador
            </TooltipContent>
          </Tooltip>

          {/* Botón Salir */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={handleSalir}
                title="Salir"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Salir
            </TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col-reverse gap-3">
          {/* Colaboradores - abajo, empujan hacia arriba */}
          <div className="w-full flex flex-col-reverse gap-3 overflow-y-auto">
            {collaborators
              .filter((c: any) => c && c.code && c.name)
              .map((c: any) => (
                <CollaboratorItem key={c.code} collaborator={c} />
              ))}
          </div>

          {/* Botón Añadir Colaborador */}
          <Button
            variant="ghost"
            className="w-full text-primary-foreground hover:bg-white/10"
            onClick={() => setLoginModalOpen(true)}
            disabled={allSessionsActive}
          >
            <PlusCircle className="mr-2" /> Añadir Colaborador
          </Button>

          {/* Usuario principal */}
          <UserMenuItem />

          {/* Foto del usuario grande */}
          <div className="flex flex-col items-center py-2">
            {user?.imageUrl ? (
              <Avatar className="h-24 w-24">
                <AvatarImage src={user.imageUrl} alt={user?.name || "User"} />
                <AvatarFallback className="bg-white text-primary font-bold text-lg">
                  {user?.name ? getInitials(user.name) : <Users className="h-8 w-8" />}
                </AvatarFallback>
              </Avatar>
            ) : null}
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}

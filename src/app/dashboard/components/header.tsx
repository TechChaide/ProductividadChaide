
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Settings, LogOut } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser, isAlmohadasDepartment } from "@/context/user-context";
import { useToast } from "@/hooks/use-toast";

export default function Header() {
  const router = useRouter();
  const { user, logout, activeSessions, estaciones } = useUser();
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
    // Permitir logout si es admin o si es de ALMOHADAS/TECNOLOGIA aunque tenga sesión activa
    if (
      user?.code !== 'admin' &&
      activeSessionOnThisStation &&
      !isAlmohadasDepartment(user?.department)
    ) {
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

  const getInitials = (name: string) => {
    if (!name) return "";
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  return (
    <header className="flex h-14 w-full items-center justify-end bg-primary px-4 text-primary-foreground sm:px-6">
      <div className="relative flex-initial md:grow-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-9 w-9 cursor-pointer">
                {user?.imageUrl && <AvatarImage src={user.imageUrl} alt={user.name || 'User'} />}
                <AvatarFallback className="bg-white text-primary font-bold">
                  {user?.name ? getInitials(user.name) : '..'}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{user?.name || 'Mi Cuenta'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('#')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Salir</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </div>
    </header>
  );
}

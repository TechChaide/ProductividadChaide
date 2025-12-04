"use client";
import { useAuth } from '@/hooks/use-auth';
import { useSidebar } from '@/components/ui/sidebar-new';

import { LogOut } from "lucide-react";
import clsx from "clsx";

export function DashboardUserInfo() {
  const { authData, logout, isLoading, isAuthenticated } = useAuth();
  const { isCollapsed } = useSidebar();
  const departamento = authData?.departamento || "";
  const nombre = authData?.nombre || "Usuario";

  // Obtener iniciales del primer nombre y primer apellido
  let iniciales = "U";
  if (authData?.nombre) {
    const partes = authData.nombre.split(" ");
    if (partes.length >= 2) {
      iniciales = `${partes[0][0]}${partes[1][0]}`.toUpperCase();
    } else {
      iniciales = partes[0][0].toUpperCase();
    }
  }

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-full bg-[#1976d2] w-10 h-10 flex items-center justify-center">
          <span className="text-white font-bold text-lg">{iniciales}</span>
        </div>
        {isAuthenticated && (
          <button
            onClick={logout}
            className="rounded-full bg-[#1976d2] w-10 h-10 flex items-center justify-center hover:bg-[#1565c0]"
            title="Cerrar sesión"
          >
            <LogOut className="h-5 w-5 text-white" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "w-full flex items-center justify-between rounded-lg bg-[#1976d2] p-3",
        "shadow-sm"
      )}
    >
      <div className="flex flex-col items-start overflow-hidden">
        <span className="font-semibold text-white text-sm leading-tight break-words max-w-full">
          {nombre}
        </span>
        <span className="text-xs text-white/70">
          {departamento}
        </span>
      </div>
      {isAuthenticated && (
        <button
          onClick={logout}
          className="text-white hover:bg-white/10 rounded-full p-1"
          title="Cerrar sesión"
        >
          <LogOut className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

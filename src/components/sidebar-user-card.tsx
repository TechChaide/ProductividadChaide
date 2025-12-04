"use client";

import { useSidebar } from "@/components/ui/sidebar-new";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Users } from "lucide-react";

export function SidebarUserCard() {
  const { isCollapsed } = useSidebar();
  const { authData } = useAuth();

  const nombre = authData?.nombre || "Usuario";
  const codigo = authData?.codigo || "";
  const imageUrl = codigo ? `/api/user-photo/${codigo}` : null;

  // Obtener iniciales
  let iniciales = "U";
  if (nombre) {
    const partes = nombre.split(" ");
    if (partes.length >= 2) {
      iniciales = `${partes[0][0]}${partes[1][0]}`.toUpperCase();
    } else {
      iniciales = partes[0][0].toUpperCase();
    }
  }

  if (isCollapsed) {
    return null;
  }

  // En modo expandido, mostrar solo la foto grande (sin card de información)
  return (
    <Avatar className="h-24 w-24 border-4 border-white">
      {imageUrl && <AvatarImage src={imageUrl} alt={nombre} />}
      <AvatarFallback className="bg-white text-primary">
        <Users className="h-12 w-12" />
      </AvatarFallback>
    </Avatar>
  );
}

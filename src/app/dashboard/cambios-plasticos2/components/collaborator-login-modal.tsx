"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { useUser } from '@/context/user-context';
import { authService } from '@/services/authService';
import type { Ficha } from '@/types/interfaces';

interface CollaboratorLoginModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CollaboratorLoginModal({ isOpen, onOpenChange }: CollaboratorLoginModalProps) {
  const [collaboratorCode, setCollaboratorCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, collaborators, addCollaborator } = useUser();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collaboratorCode) {
      toast({ title: "Error", description: "Por favor ingrese un código.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const response = await authService.loginColaborador(collaboratorCode);
      if (response && response.user && response.user.ficha) {
        const { ficha }: { ficha: Ficha } = response.user;

        // Validación: Si la ficha no tiene código o nombre, es inválida
        if (!ficha.CODIGO || !ficha.NOMBRE) {
          toast({
            title: "Colaborador no válido",
            description: "Colaborador no registrado o inactivo.",
            variant: "destructive",
          });
          setCollaboratorCode('');
          return;
        }

        // Validation: Check if the collaborator is the main user
        if (user && user.code === ficha.CODIGO) {
          toast({
            title: "Error",
            description: "No puede añadirse a sí mismo como colaborador.",
            variant: "destructive",
          });
          setCollaboratorCode('');
          return;
        }

        // Validation: Check if collaborator is already in the list
        if (collaborators.some(c => c.code === ficha.CODIGO)) {
           toast({
            title: "Colaborador Duplicado",
            description: `${ficha.NOMBRE} ya se encuentra en la sesión de trabajo.`,
            variant: "destructive",
          });
          setCollaboratorCode('');
          return;
        }

        // Validación: Verificar si el colaborador tiene sesión activa
        try {
          const sesionResponse = await import('@/services/sesion.service').then(m => m.sesionService.getByCodigoOperador(ficha.CODIGO));
          const sesionesActivas = (sesionResponse.data || []).filter(s => s.tipo_evento === "beg" && s.estado === "A");
          console.log("Sesiones activas encontradas:", sesionesActivas.length);
          const departamento = (ficha.DEPARTAMENTO || "").toUpperCase();
          console.log("Departamento del colaborador:", departamento);
          const isAlmohadas = departamento.includes("ALMOHADAS") || departamento.includes("TECNOLOGIA");
          if (sesionesActivas.length > 0 && !isAlmohadas) {
            toast({
              title: "Colaborador con sesión activa",
              description: `${ficha.NOMBRE} ya tiene una sesión activa y no puede ser añadido.`,
              variant: "destructive",
            });
            setCollaboratorCode('');
            return;
          }
        } catch (error) {
          toast({
            title: "Error al verificar sesión",
            description: error instanceof Error ? error.message : "No se pudo verificar la sesión del colaborador.",
            variant: "destructive",
          });
          setCollaboratorCode('');
          return;
        }

        // Pass the entire 'ficha' object to the context
        addCollaborator(ficha);

        toast({
          title: "Colaborador Añadido",
          description: `${ficha.NOMBRE} ha sido añadido a la sesión.`,
        });
        setCollaboratorCode('');
        onOpenChange(false); // Close modal on success
      } else {
        // Si la respuesta no tiene ficha válida, mostrar error y no agregar
        toast({
          title: "Error al agregar colaborador",
          description: response?.message || "Colaborador no registrado o inactivo.",
          variant: "destructive",
        });
        setCollaboratorCode('');
      }
    } catch (error) {
      toast({
        title: "Error de inicio de sesión",
        description: error instanceof Error ? error.message : "No se pudo conectar con el servidor.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleLogin}>
          <DialogHeader>
            <DialogTitle>Añadir Colaborador</DialogTitle>
            <DialogDescription>
              Ingrese el código del colaborador para añadirlo a la sesión de trabajo actual.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="collaboratorCode" className="text-right">
                Código
              </Label>
              <Input
                id="collaboratorCode"
                value={collaboratorCode}
                onChange={(e) => setCollaboratorCode(e.target.value)}
                placeholder="Ej: EMP001"
                className="col-span-3"
                disabled={isLoading}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCollaboratorCode('');
                onOpenChange(false);
              }}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Cargando..." : "Añadir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

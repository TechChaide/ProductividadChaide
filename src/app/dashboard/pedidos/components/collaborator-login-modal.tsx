
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

        // Pass the entire 'ficha' object to the context
        addCollaborator(ficha);

        toast({
          title: "Colaborador Añadido",
          description: `${ficha.NOMBRE} ha sido añadido a la sesión.`,
        });
        setCollaboratorCode('');
        onOpenChange(false); // Close modal on success
      } else {
        toast({
          title: "Error de inicio de sesión",
          description: "Respuesta inesperada del servidor.",
          variant: "destructive",
        });
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
                className="col-span-3"
                placeholder="Código de empleado"
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Verificando...' : 'Añadir'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

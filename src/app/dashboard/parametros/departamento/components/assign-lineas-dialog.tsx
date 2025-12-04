"use client";

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { Departamento, Linea, LineaDepartamento } from '@/types/interfaces';
import { lineaService } from '@/services/linea.service';
import { lineaDepartamentoService } from '@/services/lineaDepartamento.service';
import { useUser } from '@/context/user-context';

// Formato de fecha compatible con SQL Server DATETIME
const formatDateForSQLServer = (date: Date): string => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
};

interface AssignLineasDialogProps {
  departamento: Departamento | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function AssignLineasDialog({ 
  departamento, 
  open, 
  onOpenChange,
  onSuccess 
}: AssignLineasDialogProps) {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [selectedLineas, setSelectedLineas] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();

  useEffect(() => {
    if (open && departamento) {
      loadLineas();
    }
  }, [open, departamento]);

  const loadLineas = async () => {
    if (!departamento) return;
    
    setIsLoading(true);
    try {
      // Cargar todas las líneas activas
      const lineasResponse = await lineaService.getAll();
      const todasLineas = lineasResponse.data?.filter(l => l.estado === 'A') || [];
      
      // Cargar las líneas ya asignadas a este departamento
      const asignacionesResponse = await lineaDepartamentoService.getByDepartamento(departamento.codigo_departamento);
      console.log('Asignaciones Response:', asignacionesResponse);
      console.log('Departamento:', departamento.codigo_departamento);
      
      // Filtrar solo las asignaciones activas y extraer los códigos de línea
      const lineasAsignadas = asignacionesResponse.data
        ?.filter(ld => ld.estado === 'A')
        .map(ld => ld.codigo_linea) || [];
      
      console.log('Líneas asignadas:', lineasAsignadas);
      
      setLineas(todasLineas);
      setSelectedLineas(lineasAsignadas);
    } catch (error) {
      console.error('Error al cargar líneas:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las líneas.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleLinea = (codigoLinea: number) => {
    setSelectedLineas(prev => 
      prev.includes(codigoLinea)
        ? prev.filter(id => id !== codigoLinea)
        : [...prev, codigoLinea]
    );
  };

  const handleSave = async () => {
    if (!departamento) return;
    
    setIsSaving(true);
    try {
      // Obtener asignaciones actuales
      const asignacionesResponse = await lineaDepartamentoService.getByDepartamento(departamento.codigo_departamento);
      const asignacionesActuales = asignacionesResponse.data || [];
      
      // Determinar qué agregar y qué eliminar
      const lineasActuales = asignacionesActuales.map(a => a.codigo_linea);
      const lineasAgregar = selectedLineas.filter(l => !lineasActuales.includes(l));
      const asignacionesEliminar = asignacionesActuales.filter(a => !selectedLineas.includes(a.codigo_linea));
      
      // Crear nuevas asignaciones (sin usuario_modificacion ni fecha_modificacion)
      for (const codigoLinea of lineasAgregar) {
        await lineaDepartamentoService.save({
          codigo_linea_departamento: 0,
          codigo_departamento: departamento.codigo_departamento,
          codigo_linea: codigoLinea,
          estado: 'A',
        } as LineaDepartamento);
      }
      
      // Desactivar asignaciones eliminadas (con usuario_modificacion y fecha_modificacion)
      for (const asignacion of asignacionesEliminar) {
        await lineaDepartamentoService.save({
          codigo_linea_departamento: asignacion.codigo_linea_departamento,
          codigo_departamento: asignacion.codigo_departamento,
          codigo_linea: asignacion.codigo_linea,
          estado: 'I',
          usuario_modificacion: user?.name || 'admin',
          fecha_modificacion: formatDateForSQLServer(new Date()),
        } as LineaDepartamento);
      }
      
      toast({
        title: "Éxito",
        description: "Líneas asignadas correctamente.",
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
      toast({
        title: "Error al guardar",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar Líneas</DialogTitle>
          <DialogDescription>
            Seleccione las líneas que pertenecen a {departamento?.nombre_departamento}
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-96 overflow-y-auto py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : lineas.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No hay líneas disponibles</p>
          ) : (
            <div className="space-y-3">
              {lineas.map((linea) => (
                <div key={linea.codigo_linea} className="flex items-center space-x-2">
                  <Checkbox
                    id={`linea-${linea.codigo_linea}`}
                    checked={selectedLineas.includes(linea.codigo_linea)}
                    onCheckedChange={() => handleToggleLinea(linea.codigo_linea)}
                  />
                  <label
                    htmlFor={`linea-${linea.codigo_linea}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {linea.nombre_linea}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isLoading || isSaving}
          >
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

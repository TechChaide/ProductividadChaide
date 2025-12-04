

"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { useUser } from '@/context/user-context';
import type { Linea, Estacion, Sesion, Departamento, LineaDepartamento } from '@/types/interfaces';
import { departamentoService } from '@/services/departamento.service';
import { lineaDepartamentoService } from '@/services/lineaDepartamento.service';
import { Skeleton } from '@/components/ui/skeleton';
import type { Operador } from '@/context/user-context';
import { LogOut, RefreshCw } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"


// --- Types ---
interface Workstation {
  id: number;
  name: string;
  status: 'LIBRE' | 'ACTIVO';
  activeUsers: string[];
}

interface ProductionLine {
  id: number;
  name: string;
  workstations: Workstation[];
  color: 'blue' | 'teal';
}


// --- Components ---

const WorkstationCard = ({ workstation }: { workstation: Workstation }) => {
  const { finishSessionsForStation } = useUser();
  const isActive = workstation.status === 'ACTIVO';
  return (
    <div className={cn(
      "p-3 rounded-lg border transition-all duration-300 ease-in-out",
      isActive ? "bg-green-100 border-green-300" : "bg-gray-50 border-gray-200"
    )}>
       <div className="flex justify-between items-start">
            <div>
                <p className="font-semibold text-sm">{workstation.name}</p>
                 {isActive ? (
                    <div className="text-xs text-green-700">
                        <p>Activo(s):</p>
                        <ul className="list-disc list-inside">
                            {workstation.activeUsers.map((userName, index) => (
                                <li key={index} className="font-medium">{userName}</li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <p className="text-xs text-gray-500">Estado: {workstation.status}</p>
                )}
            </div>
             {isActive && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="h-7 text-xs px-2">
                          <LogOut className="mr-1 h-3 w-3" />
                          Finalizar
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Finalizar sesión en {workstation.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción finalizará todas las sesiones de trabajo activas para la estación <strong>{workstation.name}</strong>. Esto debe hacerse si los operadores olvidaron finalizar su turno.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => finishSessionsForStation(workstation.id)}>
                          Sí, finalizar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
       </div>
    </div>
  );
};

const ProductionLineColumn = ({ line }: { line: ProductionLine }) => {
 
  const sortedWorkstations = [...line.workstations].sort((a, b) => {
    if (a.status === 'ACTIVO' && b.status !== 'ACTIVO') return -1;
    if (a.status !== 'ACTIVO' && b.status === 'ACTIVO') return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="bg-white p-4 rounded-lg shadow-md flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className={cn(
            "text-lg font-bold", 
            line.color === 'blue' ? 'text-blue-700' : 'text-teal-700'
        )}>
          {line.name}
        </h2>
      </div>
      <div className="space-y-3 flex-grow">
        {sortedWorkstations.map(ws => (
          <WorkstationCard key={ws.id} workstation={ws} />
        ))}
      </div>
    </div>
  );
};

const PanelSkeleton = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {[...Array(2)].map((_, index) => (
             <div key={index} className="bg-white p-4 rounded-lg shadow-md flex flex-col gap-4">
                <Skeleton className="h-7 w-1/2" />
                <div className="space-y-3 flex-grow">
                    {[...Array(3)].map((_, wsIndex) => (
                        <div key={wsIndex} className="p-3 rounded-lg border border-gray-200">
                             <Skeleton className="h-5 w-3/4 mb-1" />
                             <Skeleton className="h-4 w-1/2" />
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);


export default function SupervisorPanelPage() {
    const { lineas, estaciones, activeSessions, fetchActiveSessions, isLoading: isUserContextLoading, operadores, fetchAllOperatorNames } = useUser();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
    const [lineaDepartamentos, setLineaDepartamentos] = useState<LineaDepartamento[]>([]);
    const [selectedDepartamento, setSelectedDepartamento] = useState<number | null>(null);

    const fetchData = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await fetchActiveSessions();
        } finally {
            setIsRefreshing(false);
        }
    }, [fetchActiveSessions]);
    
    useEffect(() => {
        fetchData();
        const intervalId = setInterval(fetchData, 30000); // Refresh every 30 seconds
        return () => clearInterval(intervalId);
    }, []); // Only run on mount, fetchData has its own deps
    
    // Cargar departamentos y relaciones linea-departamento
    useEffect(() => {
        const fetchDepartamentos = async () => {
            try {
                const [deptResponse, lineaDeptResponse] = await Promise.all([
                    departamentoService.getAll(),
                    lineaDepartamentoService.getAll()
                ]);
                const deptActivos = deptResponse.data?.filter(d => d.estado === 'A') || [];
                const lineaDeptActivos = lineaDeptResponse.data?.filter(ld => ld.estado === 'A') || [];
                
                // Función para normalizar texto (remover tildes y convertir a minúsculas)
                const normalizeText = (text: string): string => {
                    return text
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '');
                };
                
                // Filtrar departamentos según usuario_departamento
                const usuarioDepartamento = sessionStorage.getItem('usuario_departamento');
                const departamentosFiltrados = usuarioDepartamento && usuarioDepartamento.trim()
                    ? deptActivos.filter(dept => 
                        normalizeText(usuarioDepartamento.trim()).includes(normalizeText(dept.nombre_departamento))
                      )
                    : deptActivos;
                
                setDepartamentos(departamentosFiltrados);
                setLineaDepartamentos(lineaDeptActivos);
                
                // Seleccionar automáticamente el primer departamento filtrado
                if (departamentosFiltrados.length > 0) {
                    setSelectedDepartamento(departamentosFiltrados[0].codigo_departamento);
                }
            } catch (error) {
                console.error('Error al cargar departamentos:', error);
            }
        };
        fetchDepartamentos();
    }, []);
    
    useEffect(() => {
        if (activeSessions.length > 0) {
            fetchAllOperatorNames(activeSessions);
        }
    }, [activeSessions, fetchAllOperatorNames]);


    const productionLinesData: ProductionLine[] = useMemo(() => {
        if (isUserContextLoading || !lineas || !estaciones || !operadores) {
            return [];
        }
        
        // Filtrar líneas según departamento seleccionado usando la tabla de relación
        let lineasFiltradas = lineas;
        if (selectedDepartamento) {
            const dept = departamentos.find(d => d.codigo_departamento === selectedDepartamento);
            
            // Si el departamento NO ve todas las líneas (see = false/0), filtrar por departamento
            if (dept && !dept.see) {
                // Obtener los códigos de línea asociados al departamento
                const codigosLineas = lineaDepartamentos
                    .filter(ld => ld.codigo_departamento === selectedDepartamento)
                    .map(ld => ld.codigo_linea);
                
                lineasFiltradas = lineas.filter(l => codigosLineas.includes(l.codigo_linea));
            }
            // Si dept.see = true, mostrar todas las líneas (no filtrar)
        }
        
        const operadorMap = new Map<string, string>(
            operadores.map(op => [op.CODIGO, op.NOMBRE])
        );

        return lineasFiltradas.map((linea, index) => {
            const lineWorkstations = estaciones
                .filter(estacion => estacion.codigo_linea === linea.codigo_linea)
                .map(estacion => {
                    const sessionsForStation = activeSessions.filter(s => s.codigo_estacion === estacion.codigo_estacion);
                    const isActive = sessionsForStation.length > 0;
                    
                    const activeUsers = isActive 
                        ? [...new Set(sessionsForStation.map(s => operadorMap.get(s.codigo_operador) || s.codigo_operador))]
                        : [];

                    return {
                        id: estacion.codigo_estacion,
                        name: estacion.nombre_estacion,
                        status: (isActive ? 'ACTIVO' : 'LIBRE') as 'ACTIVO' | 'LIBRE',
                        activeUsers: activeUsers,
                    };
                });

            return {
                id: linea.codigo_linea,
                name: linea.nombre_linea,
                color: index % 2 === 0 ? 'blue' : 'teal',
                workstations: lineWorkstations,
            };
        });

    }, [lineas, estaciones, activeSessions, operadores, isUserContextLoading, selectedDepartamento, departamentos, lineaDepartamentos]);
    
    const isLoading = isUserContextLoading && !isRefreshing;

  return (
    <div className="bg-gray-100 p-4 sm:p-6 lg:p-8 min-h-full">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-8 gap-4">
          {/* Combo de Departamentos - Filtrado por usuario */}
          <div className="w-72">
            <Select 
              value={selectedDepartamento?.toString()} 
              onValueChange={(value) => setSelectedDepartamento(Number(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione departamento" />
              </SelectTrigger>
              <SelectContent>
                {departamentos.map((dept) => (
                  <SelectItem key={dept.codigo_departamento} value={dept.codigo_departamento.toString()}>
                    {dept.nombre_departamento}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Título Centrado */}
          <div className="flex-1 text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Panel de Supervisor</h1>
            <p className="text-md text-gray-500">Estado en tiempo real de las líneas de producción</p>
          </div>
          
          {/* Botón de Refrescar - Esquina Superior Derecha */}
          <div className="flex items-center">
            <Button
                variant="ghost"
                size="icon"
                onClick={fetchData}
                disabled={isRefreshing}
                title="Recargar"
            >
                <RefreshCw className={cn("h-5 w-5", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
        
        {isLoading && <PanelSkeleton />}

        {!isLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {productionLinesData.map(line => (
                <ProductionLineColumn key={line.id} line={line} />
            ))}
            </div>
        )}
        
         {!isLoading && productionLinesData.length === 0 && (
            <div className="text-center text-gray-500 col-span-1 lg:col-span-2 mt-8">
                <p>No hay líneas de producción configuradas o no se pudieron cargar los datos.</p>
                <p className="text-sm mt-1">Por favor, configure las líneas y estaciones en las secciones correspondientes de Parámetros.</p>
            </div>
        )}
      </div>
    </div>
  );
}

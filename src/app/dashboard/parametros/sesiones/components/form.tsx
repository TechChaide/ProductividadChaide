
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import type { Sesion, Departamento, Linea, Estacion, LineaDepartamento } from '@/types/interfaces';
import { sesionService } from '@/services/sesion.service';
import { departamentoService } from '@/services/departamento.service';
import { lineaDepartamentoService } from '@/services/lineaDepartamento.service';
import { estacionService } from '@/services/estacion.service';
import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/context/user-context';

const formSchema = z.object({
    codigo_sesion: z.number().optional(),
    codigo_departamento: z.number().optional(),
    codigo_linea: z.number().optional(),
    codigo_estacion: z.number().optional(),
    codigo_rcp: z.coerce.number({ required_error: "El código RCP es requerido." }),
    codigo_operador: z.string({ required_error: "El código de operador es requerido." }),
    tipo_evento: z.string().min(1, "El tipo de evento es requerido."),
    estado: z.string({ required_error: "El estado es requerido." }),
    fecha_evento: z.string().optional(),
});

interface SesionFormProps {
    record: Sesion | null;
    onSuccess: () => void;
    onCancel: () => void;
}

export default function SesionForm({ record, onSuccess, onCancel }: SesionFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
    const [lineaDepartamentos, setLineaDepartamentos] = useState<LineaDepartamento[]>([]);
    const [estaciones, setEstaciones] = useState<Estacion[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const { toast } = useToast();
    const { user } = useUser();
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigo_sesion: record?.codigo_sesion ?? 0,
            codigo_departamento: undefined,
            codigo_linea: undefined,
            codigo_estacion: record?.codigo_estacion ?? undefined,
            codigo_rcp: record?.codigo_rcp ?? undefined,
            codigo_operador: record?.codigo_operador ?? undefined,
            tipo_evento: record?.tipo_evento ?? '',
            estado: record?.estado ?? 'A',
        },
    });

    const selectedDepartamento = form.watch('codigo_departamento');
    const selectedLinea = form.watch('codigo_linea');

    // Función para normalizar texto (remover tildes y convertir a minúsculas)
    const normalizeText = (text: string): string => {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    };

    // Filtrar departamentos según usuario_departamento del usuario logueado
    const departamentosFiltrados = useMemo(() => {
        const usuarioDepartamento = sessionStorage.getItem('usuario_departamento');
        
        if (!usuarioDepartamento || !usuarioDepartamento.trim()) {
            return departamentos;
        }
        
        const usuarioNormalizado = normalizeText(usuarioDepartamento.trim());
        
        // Comparar usando includes para que el usuario_departamento pueda contener texto adicional
        return departamentos.filter(dept => 
            usuarioNormalizado.includes(normalizeText(dept.nombre_departamento))
        );
    }, [departamentos]);

    // Cargar datos iniciales
    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                const [deptResponse, lineaDeptResponse, estacionesResponse] = await Promise.all([
                    departamentoService.getAll(),
                    lineaDepartamentoService.getAll(),
                    estacionService.getAll(),
                ]);
                
                setDepartamentos(deptResponse.data?.filter(d => d.estado === 'A') || []);
                setLineaDepartamentos(lineaDeptResponse.data?.filter(ld => ld.estado === 'A') || []);
                setEstaciones(estacionesResponse.data?.filter(e => e.estado === 'A') || []);
            } catch (error) {
                toast({
                    title: "Error",
                    description: "No se pudieron cargar los datos.",
                    variant: "destructive",
                });
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchData();
    }, [toast]);

    // Filtrar líneas según departamento seleccionado usando la tabla de relación
    const lineasFiltradas = useMemo(() => {
        if (!selectedDepartamento) return [];
        
        // Filtrar solo las líneas asignadas al departamento seleccionado
        const lineasDelDept = lineaDepartamentos
            .filter(ld => ld.codigo_departamento === selectedDepartamento)
            .map(ld => ld.linea)
            .filter((linea): linea is Linea => linea !== undefined);
        
        return lineasDelDept;
    }, [selectedDepartamento, lineaDepartamentos]);

    // Filtrar estaciones según línea seleccionada
    const estacionesFiltradas = useMemo(() => {
        if (!selectedLinea) return [];
        return estaciones.filter(e => e.codigo_linea === selectedLinea);
    }, [selectedLinea, estaciones]);

    // Resetear línea cuando cambia departamento
    useEffect(() => {
        form.setValue('codigo_linea', undefined);
        form.setValue('codigo_estacion', undefined);
    }, [selectedDepartamento, form]);

    // Resetear estación cuando cambia línea
    useEffect(() => {
        form.setValue('codigo_estacion', undefined);
    }, [selectedLinea, form]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        
        if (!values.codigo_estacion) {
            toast({
                title: "Error",
                description: "Debe seleccionar una estación.",
                variant: "destructive",
            });
            setIsLoading(false);
            return;
        }
        
        const data: Sesion = {
            codigo_sesion: values.codigo_sesion || 0,
            codigo_estacion: values.codigo_estacion,
            codigo_rcp: values.codigo_rcp,
            codigo_operador: values.codigo_operador as any,
            tipo_evento: values.tipo_evento,
            estado: values.estado,
            fecha_evento: new Date(),
        };

        try {
            await sesionService.save(data);
            toast({
                title: "Éxito",
                description: `Sesión ${record ? 'actualizada' : 'creada'} correctamente.`,
            });
            onSuccess();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
            toast({
                title: "Error al guardar",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{record ? 'Editar Sesión' : 'Nueva Sesión'}</CardTitle>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="grid grid-cols-1 gap-4">
                        <FormField
                            control={form.control}
                            name="codigo_departamento"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Departamento</FormLabel>
                                    <Select 
                                        onValueChange={(value) => field.onChange(Number(value))} 
                                        value={field.value?.toString()}
                                        disabled={isLoadingData}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={isLoadingData ? "Cargando departamentos..." : `Seleccione departamento (${departamentosFiltrados.length})`} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {departamentosFiltrados.map((dept) => (
                                                <SelectItem key={dept.codigo_departamento} value={dept.codigo_departamento.toString()}>
                                                    {dept.nombre_departamento}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="codigo_linea"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Línea</FormLabel>
                                    <Select 
                                        onValueChange={(value) => field.onChange(Number(value))} 
                                        value={field.value?.toString()}
                                        disabled={isLoadingData || !selectedDepartamento}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={
                                                    isLoadingData ? "Cargando..." : 
                                                    !selectedDepartamento ? "Primero seleccione un departamento" :
                                                    "Seleccione una línea"
                                                } />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {lineasFiltradas.length === 0 && selectedDepartamento ? (
                                                <div className="px-2 py-1.5 text-sm text-gray-500">No hay líneas asignadas a este departamento</div>
                                            ) : (
                                                lineasFiltradas.map((linea) => (
                                                    <SelectItem key={linea.codigo_linea} value={linea.codigo_linea.toString()}>
                                                        {linea.nombre_linea}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="codigo_estacion"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Estación</FormLabel>
                                    <Select 
                                        onValueChange={(value) => field.onChange(Number(value))} 
                                        value={field.value?.toString()}
                                        disabled={isLoadingData || !selectedLinea}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={
                                                    isLoadingData ? "Cargando..." : 
                                                    !selectedLinea ? "Primero seleccione una línea" :
                                                    "Seleccione una estación"
                                                } />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {estacionesFiltradas.map((estacion) => (
                                                <SelectItem key={estacion.codigo_estacion} value={estacion.codigo_estacion.toString()}>
                                                    {estacion.nombre_estacion}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="codigo_rcp"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Código RCP</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="Código RCP" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="codigo_operador"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Código Operador</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Código del operador" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="tipo_evento"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Evento</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: INICIO_SESION" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="estado"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Estado</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione un estado" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="A">
                                                <div className="flex items-center">
                                                    Activo
                                                    <span className="ml-2 h-2 w-2 rounded-full bg-green-500"></span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="I">
                                                <div className="flex items-center">
                                                    Inactivo
                                                    <span className="ml-2 h-2 w-2 rounded-full bg-red-500"></span>
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? (record ? 'Actualizando...' : 'Guardando...') : (record ? 'Actualizar' : 'Guardar')}
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}

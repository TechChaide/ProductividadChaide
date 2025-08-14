
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
import type { Estacion, Linea } from '@/types/interfaces';
import { estacionService } from '@/services/estacion.service';
import { lineaService } from '@/services/linea.service';
import { useState, useEffect } from 'react';
import { useUser } from '@/context/user-context';
import { Skeleton } from '@/components/ui/skeleton';

const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;


const formSchema = z.object({
    codigo_estacion: z.number().optional(),
    nombre_estacion: z.string().min(1, "El nombre es requerido."),
    estado: z.string({ required_error: "El estado es requerido." }),
    codigo_linea: z.coerce.number({ required_error: "El código de línea es requerido." }),
    direccion_ip: z.string().regex(ipRegex, "La dirección IP no es válida."),
    usuario_modificacion: z.string().optional(),
    fecha_modificacion: z.date().optional(),
});

interface EstacionFormProps {
    record: Estacion | null;
    onSuccess: () => void;
    onCancel: () => void;
}

export default function EstacionForm({ record, onSuccess, onCancel }: EstacionFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [lineas, setLineas] = useState<Linea[]>([]);
    const [isLoadingLineas, setIsLoadingLineas] = useState(true);
    const { toast } = useToast();
    const { user } = useUser();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigo_estacion: record?.codigo_estacion ?? 0,
            nombre_estacion: record?.nombre_estacion ?? '',
            estado: record?.estado ?? 'A',
            codigo_linea: record?.codigo_linea ?? undefined,
            direccion_ip: record?.direccion_ip ?? '',
        },
    });

    useEffect(() => {
        const fetchLineas = async () => {
            setIsLoadingLineas(true);
            try {
                const response = await lineaService.getAll();
                setLineas(response.data || []);
            } catch (error) {
                toast({
                    title: "Error al cargar líneas",
                    description: "No se pudieron obtener las líneas de producción.",
                    variant: "destructive",
                });
            } finally {
                setIsLoadingLineas(false);
            }
        };
        fetchLineas();
    }, [toast]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        const data: Estacion = {
            ...values,
            codigo_estacion: values.codigo_estacion || 0,
            usuario_modificacion: user?.name || 'admin',
            fecha_modificacion: new Date(),
        };

        try {
            await estacionService.save(data);
            toast({
                title: "Éxito",
                description: `Estación ${record ? 'actualizada' : 'creada'} correctamente.`,
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
                <CardTitle>{record ? 'Editar Estación' : 'Nueva Estación'}</CardTitle>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="grid grid-cols-1 gap-4">
                        <FormField
                            control={form.control}
                            name="nombre_estacion"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre de la Estación</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Acolchadora Principal" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="codigo_linea"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Línea de Producción</FormLabel>
                                    {isLoadingLineas ? (
                                        <Skeleton className="h-10 w-full" />
                                    ) : (
                                        <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione una línea" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {lineas.map(linea => (
                                                    <SelectItem key={linea.codigo_linea} value={linea.codigo_linea.toString()}>
                                                        {linea.codigo_linea}: {linea.nombre_linea}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="direccion_ip"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Dirección IP</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: 192.168.1.10" {...field} />
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
                        <Button type="submit" disabled={isLoading || isLoadingLineas}>
                            {isLoading ? (record ? 'Actualizando...' : 'Guardando...') : (record ? 'Actualizar' : 'Guardar')}
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}

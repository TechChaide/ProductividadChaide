
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
import type { Sesion } from '@/types/interfaces';
import { sesionService } from '@/services/sesion.service';
import { useState } from 'react';

const formSchema = z.object({
    codigo_sesion: z.number().optional(),
    codigo_rcp: z.coerce.number({ required_error: "El código RCP es requerido." }),
    codigo_operador: z.coerce.number({ required_error: "El código de operador es requerido." }),
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
    const { toast } = useToast();
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigo_sesion: record?.codigo_sesion ?? 0,
            codigo_rcp: record?.codigo_rcp ?? undefined,
            codigo_operador: record?.codigo_operador ?? undefined,
            tipo_evento: record?.tipo_evento ?? '',
            estado: record?.estado ?? 'A',
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        const data: Sesion = {
            ...values,
            codigo_sesion: values.codigo_sesion || 0,
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
                                        <Input type="number" placeholder="Código del operador" {...field} />
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

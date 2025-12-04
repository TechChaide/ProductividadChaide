
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import type { Departamento } from '@/types/interfaces';
import { departamentoService } from '@/services/departamento.service';
import { useState } from 'react';
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

const formSchema = z.object({
    codigo_departamento: z.number().optional(),
    nombre_departamento: z.string().min(1, "El nombre del departamento es requerido."),
    see: z.number({ required_error: "Este campo es requerido." }),
    estado: z.string({ required_error: "El estado es requerido." }),
    usuario_modificacion: z.string().optional(),
    fecha_modificacion: z.date().optional(),
});

interface DepartamentoFormProps {
    record: Departamento | null;
    onSuccess: () => void;
    onCancel: () => void;
}

export default function DepartamentoForm({ record, onSuccess, onCancel }: DepartamentoFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const { user } = useUser();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigo_departamento: record?.codigo_departamento ?? 0,
            nombre_departamento: record?.nombre_departamento ?? '',
            see: record?.see ? 1 : 0,
            estado: record?.estado ?? 'A',
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        
        // Construir el objeto según si es creación o edición
        const data: any = {
            codigo_departamento: values.codigo_departamento || 0,
            nombre_departamento: values.nombre_departamento,
            see: values.see,
            estado: values.estado,
        };
        
        // Solo agregar campos de modificación si es una edición
        if (record) {
            data.usuario_modificacion = user?.name || 'admin';
            data.fecha_modificacion = formatDateForSQLServer(new Date());
        }

        try {
            await departamentoService.save(data);
            toast({
                title: "Éxito",
                description: `Departamento ${record ? 'actualizado' : 'creado'} correctamente.`,
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
                <CardTitle>{record ? 'Editar Departamento' : 'Nuevo Departamento'}</CardTitle>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="grid grid-cols-1 gap-4">
                        <FormField
                            control={form.control}
                            name="nombre_departamento"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre del Departamento</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Recursos Humanos" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="see"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Ve todas las Líneas?</FormLabel>
                                    <Select 
                                        onValueChange={(value) => field.onChange(Number(value))} 
                                        value={field.value?.toString()}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione una opción" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="1">Sí</SelectItem>
                                            <SelectItem value="0">No</SelectItem>
                                        </SelectContent>
                                    </Select>
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

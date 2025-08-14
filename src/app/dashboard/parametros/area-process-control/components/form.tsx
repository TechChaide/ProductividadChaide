
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
import type { AreaProcessControl } from '@/types/interfaces';
import { areaProcessControlService } from '@/services/areaProcessControl.service';
import { useState } from 'react';

const formSchema = z.object({
    codigo_rcp: z.number().optional(),
    resp_ctrl_prod: z.string().min(1, "El responsable es requerido."),
    estado: z.string({ required_error: "El estado es requerido." }),
    maquina: z.string().min(1, "La máquina es requerida."),
    direccion_ip: z.string().min(1, "La dirección IP es requerida."),
});

interface AreaProcessControlFormProps {
    record: AreaProcessControl | null;
    onSuccess: () => void;
    onCancel: () => void;
}

export default function AreaProcessControlForm({ record, onSuccess, onCancel }: AreaProcessControlFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigo_rcp: record?.codigo_rcp ?? 0,
            resp_ctrl_prod: record?.resp_ctrl_prod ?? undefined,
            estado: record?.estado ?? 'A',
            maquina: record?.maquina ?? '',
            direccion_ip: record?.direccion_ip ?? '',
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        const data: AreaProcessControl = {
            ...values,
            codigo_rcp: values.codigo_rcp || 0,
        };

        try {
            await areaProcessControlService.save(data);
            toast({
                title: "Éxito",
                description: `Registro ${record ? 'actualizado' : 'creado'} correctamente.`,
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
                <CardTitle>{record ? 'Editar Registro' : 'Nuevo Registro'}</CardTitle>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="grid grid-cols-1 gap-4">
                        <FormField
                            control={form.control}
                            name="resp_ctrl_prod"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Responsable Control Producción</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Código del responsable" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="maquina"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Máquina</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Nombre de la máquina" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="direccion_ip"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>direccion_ip</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: 88:F4:DA:A2:67:C3" {...field} />
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

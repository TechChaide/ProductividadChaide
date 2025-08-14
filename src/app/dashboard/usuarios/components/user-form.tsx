
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
import type { Usuario } from '@/types/interfaces';
import { usuarioService } from '@/services/usuario.service';
import { useState } from 'react';

const formSchema = z.object({
    codigo_usuario: z.number().optional(),
    nombres_usuario: z.string().min(1, "El nombre es requerido.").max(150),
    correo_usuario: z.string().min(1, "El usuario es requerido.").max(50),
    estado: z.string({ required_error: "El estado es requerido." }),
});

interface UserFormProps {
    user: Usuario | null;
    onSuccess: () => void;
    onCancel: () => void;
}

export default function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigo_usuario: user?.codigo_usuario ?? 0,
            nombres_usuario: user?.nombres_usuario ?? '',
            correo_usuario: user?.correo_usuario ?? '',
            estado: user?.estado ?? 'A',
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        const userData: Usuario = {
            ...values,
            codigo_usuario: values.codigo_usuario || 0,
        };

        try {
            await usuarioService.guardarUsuario(userData);
            toast({
                title: "Éxito",
                description: `Usuario ${user ? 'actualizado' : 'creado'} correctamente.`,
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
                <CardTitle>{user ? 'Editar Usuario' : 'Nuevo Usuario'}</CardTitle>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="nombres_usuario"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombres del Usuario</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Juan Alberto Pérez" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="correo_usuario"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Usuario (Login)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: jperez" {...field} />
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
                                            <SelectItem value="A">Activo</SelectItem>
                                            <SelectItem value="I">Inactivo</SelectItem>
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
                            {isLoading ? (user ? 'Actualizando...' : 'Guardando...') : (user ? 'Actualizar' : 'Guardar')}
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}

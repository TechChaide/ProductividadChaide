
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { Usuario } from '@/types/interfaces';
import { usuarioService } from '@/services/usuario.service';
import UserForm from './components/user-form';
import UsersTable from './components/users-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle } from 'lucide-react';

export default function UsuariosPage() {
    const [users, setUsers] = useState<Usuario[]>([]);
    const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const { toast } = useToast();

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await usuarioService.getUsuarios();
            setUsers(response.data);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "No se pudo cargar los usuarios.";
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleEdit = (user: Usuario) => {
        setSelectedUser(user);
        setIsFormOpen(true);
    };

    const handleAddNew = () => {
        setSelectedUser(null);
        setIsFormOpen(true);
    };
    
    const handleAssignPermissions = (user: Usuario) => {
        toast({
            title: "Función no implementada",
            description: `La asignación de permisos para ${user.nombres_usuario} aún no está disponible.`,
        });
    };

    const handleAssignDepartment = (user: Usuario) => {
        toast({
            title: "Función no implementada",
            description: `La asignación de área para ${user.nombres_usuario} aún no está disponible.`,
        });
    };

    const handleSuccess = () => {
        fetchUsers();
        setIsFormOpen(false);
        setSelectedUser(null);
    }

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle>Administración de Usuarios</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Crea, edita y gestiona los usuarios administradores del sistema.</p>
                </CardContent>
            </Card>

            {isFormOpen ? (
                <UserForm
                    user={selectedUser}
                    onSuccess={handleSuccess}
                    onCancel={() => setIsFormOpen(false)}
                />
            ) : (
                <UsersTable
                    users={users}
                    isLoading={isLoading}
                    onEdit={handleEdit}
                    onAssignPermissions={handleAssignPermissions}
                    onAssignDepartment={handleAssignDepartment}
                    onAddNew={handleAddNew}
                />
            )}
        </div>
    );
}

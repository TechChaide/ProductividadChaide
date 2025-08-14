
"use client";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, UserPlus, KeyRound, Building } from 'lucide-react';
import type { Usuario } from '@/types/interfaces';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface UsersTableProps {
  users: Usuario[];
  isLoading: boolean;
  onEdit: (user: Usuario) => void;
  onAssignPermissions: (user: Usuario) => void;
  onAssignDepartment: (user: Usuario) => void;
  onAddNew: () => void;
}

export default function UsersTable({ users, isLoading, onEdit, onAssignPermissions, onAssignDepartment, onAddNew }: UsersTableProps) {

  const renderSkeleton = () => (
    [...Array(5)].map((_, i) => (
        <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-10" /></TableCell>
            <TableCell><Skeleton className="h-4 w-[250px]" /></TableCell>
            <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
            <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
        </TableRow>
    ))
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Listado de Usuarios</CardTitle>
            <CardDescription>Usuarios con acceso al panel de administración.</CardDescription>
        </div>
        <Button onClick={onAddNew}>
            <UserPlus className="mr-2 h-4 w-4" />
            Añadir Usuario
        </Button>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? renderSkeleton() : users.map((user) => (
                    <TableRow key={user.codigo_usuario}>
                    <TableCell className="font-medium">{user.codigo_usuario}</TableCell>
                    <TableCell>{user.nombres_usuario}</TableCell>
                    <TableCell>{user.correo_usuario}</TableCell>
                    <TableCell>
                        <Badge variant={user.estado === 'A' ? 'default' : 'destructive'} className={user.estado === 'A' ? 'bg-green-600' : ''}>
                        {user.estado === 'A' ? 'Activo' : 'Inactivo'}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(user)}>
                                <KeyRound className="mr-2 h-4 w-4" />
                                Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onAssignPermissions(user)}>
                                <KeyRound className="mr-2 h-4 w-4" />
                                Asignar Permisos
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onAssignDepartment(user)}>
                                <Building className="mr-2 h-4 w-4" />
                                Asignar Área
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                    </TableRow>
                ))}
                 {!isLoading && users.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                            No se encontraron usuarios.
                        </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
        </div>
      </CardContent>
    </Card>
  );
}

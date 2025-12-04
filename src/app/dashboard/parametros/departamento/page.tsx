"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { Departamento } from '@/types/interfaces';
import { departamentoService } from '@/services/departamento.service';
import DepartamentoForm from './components/form';
import DepartamentoTable from './components/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DepartamentosPage() {
    const [records, setRecords] = useState<Departamento[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<Departamento | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const { toast } = useToast();

    const fetchRecords = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await departamentoService.getAll();
            const data = response.data || [];
            setRecords(data);
             if (data.length === 0) {
                setIsFormOpen(true);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "No se pudo cargar los departamentos.";
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
            });
            setIsFormOpen(true);
        } finally {
            setIsLoading(false);
            setHasFetched(true);
        }
    }, [toast]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    const handleEdit = (record: Departamento) => {
        setSelectedRecord(record);
        setIsFormOpen(true);
    };

    const handleAddNew = () => {
        setSelectedRecord(null);
        setIsFormOpen(true);
    };

    const handleSuccess = () => {
        fetchRecords();
        setIsFormOpen(false);
        setSelectedRecord(null);
    }

    const handleCancel = () => {
        if (records.length > 0) {
            setIsFormOpen(false);
            setSelectedRecord(null);
        }
    }

    const showTable = hasFetched && !isFormOpen && records.length > 0;

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle>Gestión de Departamentos</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Crea, edita y gestiona los departamentos de la organización.</p>
                </CardContent>
            </Card>

            {isFormOpen ? (
                <DepartamentoForm
                    record={selectedRecord}
                    onSuccess={handleSuccess}
                    onCancel={handleCancel}
                />
            ) : showTable ? (
                <DepartamentoTable
                    records={records}
                    isLoading={isLoading}
                    onEdit={handleEdit}
                    onAddNew={handleAddNew}
                    onRefresh={fetchRecords}
                />
            ) : null}
        </div>
    );
}

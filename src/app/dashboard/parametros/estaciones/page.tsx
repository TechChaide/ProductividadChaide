
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { Estacion, Linea } from '@/types/interfaces';
import { estacionService } from '@/services/estacion.service';
import { lineaService } from '@/services/linea.service';
import EstacionForm from './components/form';
import EstacionTable from './components/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function EstacionesPage() {
    const [records, setRecords] = useState<Estacion[]>([]);
    const [lineas, setLineas] = useState<Linea[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<Estacion | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const { toast } = useToast();

    const fetchRecords = useCallback(async () => {
        setIsLoading(true);
        try {
            const [estacionesResponse, lineasResponse] = await Promise.all([
                estacionService.getAll(),
                lineaService.getAll()
            ]);
            
            const estacionesData = estacionesResponse.data || [];
            const lineasData = lineasResponse.data || [];
            
            setRecords(estacionesData);
            setLineas(lineasData);

            if (estacionesData.length === 0) {
                setIsFormOpen(true);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "No se pudo cargar los datos.";
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

    const handleEdit = (record: Estacion) => {
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
                    <CardTitle>Gestión de Estaciones</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Crea, edita y gestiona las estaciones de trabajo.</p>
                </CardContent>
            </Card>

            {isFormOpen ? (
                <EstacionForm
                    record={selectedRecord}
                    onSuccess={handleSuccess}
                    onCancel={handleCancel}
                />
            ) : showTable ? (
                <EstacionTable
                    records={records}
                    lineas={lineas}
                    isLoading={isLoading}
                    onEdit={handleEdit}
                    onAddNew={handleAddNew}
                />
            ) : null}
        </div>
    );
}

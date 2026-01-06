"use client";

import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle, X, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UploadResult {
    orden: string;
    success: boolean;
    message: string;
}

export default function CargaOrdenesContent() {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);

    // Results Dialog State
    const [resultsOpen, setResultsOpen] = useState(false);
    const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
    const [summaryStats, setSummaryStats] = useState({ success: 0, failed: 0 });

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const validateExcelStructure = async (file: File): Promise<boolean> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: "binary" });

                    // 1. Validar que tenga solo 1 hoja
                    if (workbook.SheetNames.length !== 1) {
                        toast({
                            title: "Estructura inválida",
                            description: "El archivo debe contener exactamente una hoja.",
                            variant: "destructive",
                        });
                        resolve(false);
                        return;
                    }

                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    if (jsonData.length === 0) {
                        toast({
                            title: "Archivo vacío",
                            description: "El archivo no contiene datos.",
                            variant: "destructive",
                        });
                        resolve(false);
                        return;
                    }

                    // 2. Validar cabeceras
                    const headers = jsonData[0] as string[];
                    if (
                        !headers ||
                        headers.length < 3 ||
                        headers[0] !== "Orden" ||
                        headers[1] !== "Descripcion" ||
                        headers[2] !== "Almacen"
                    ) {
                        toast({
                            title: "Cabeceras incorrectas",
                            description:
                                "Las primeras columnas deben ser: Orden, Descripcion, Almacen.",
                            variant: "destructive",
                        });
                        resolve(false);
                        return;
                    }

                    resolve(true);
                } catch (error) {
                    console.error("Error al leer el archivo Excel:", error);
                    toast({
                        title: "Error de lectura",
                        description: "No se pudo leer el archivo Excel.",
                        variant: "destructive",
                    });
                    resolve(false);
                }
            };
            reader.onerror = () => {
                toast({
                    title: "Error de lectura",
                    description: "Error al leer el archivo.",
                    variant: "destructive",
                });
                resolve(false);
            };
            reader.readAsBinaryString(file);
        });
    };

    const validateAndSetFile = async (selectedFile: File) => {
        const validTypes = [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
        ];

        // Check extension as fallback
        const isExcelExtension = /\.(xlsx|xls)$/i.test(selectedFile.name);

        if (!validTypes.includes(selectedFile.type) && !isExcelExtension) {
            toast({
                title: "Formato inválido",
                description: "Por favor seleccione un archivo Excel (.xlsx, .xls)",
                variant: "destructive",
            });
            return;
        }

        const isValidStructure = await validateExcelStructure(selectedFile);
        if (isValidStructure) {
            setFile(selectedFile);
            toast({
                title: "Archivo cargado",
                description: `Se ha seleccionado: ${selectedFile.name}`,
            });
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            validateAndSetFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            validateAndSetFile(e.target.files[0]);
        }
    };

    const handleRemoveFile = () => {
        setFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        setProcessing(false);
        setProgress(0);
        setResultsOpen(false);
    };

    const handleUpload = async () => {
        if (!file) return;

        setProcessing(true);
        setProgress(0);
        setUploadResults([]);

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            let successCount = 0;
            let errorCount = 0;
            const tempResults: UploadResult[] = [];

            for (let i = 0; i < jsonData.length; i++) {
                const row: any = jsonData[i];
                // Ensure data is treated as text
                const payload = {
                    orden: String(row.Orden || "").trim(),
                    descripcion: String(row.Descripcion || "").trim(),
                    almacen: String(row.Almacen || "").trim(),
                };

                if (!payload.orden) continue; // Skip empty rows

                try {
                    // Dynamic import
                    const { servicioService } = await import("@/services/servicio.service");
                    await servicioService.cargarOrdenes(payload);
                    successCount++;
                    tempResults.push({
                        orden: payload.orden,
                        success: true,
                        message: "Exitosa",
                    });
                } catch (error: any) {
                    errorCount++;
                    const msg = error.message || "Error desconocido";
                    tempResults.push({
                        orden: payload.orden,
                        success: false,
                        message: msg,
                    });
                }

                // Update progress
                setProgress(Math.round(((i + 1) / jsonData.length) * 100));
            }

            setUploadResults(tempResults);
            setSummaryStats({ success: successCount, failed: errorCount });
            setResultsOpen(true);

            if (errorCount === 0) {
                toast({
                    title: "Proceso Completado",
                    description: `Se procesaron ${jsonData.length} registros correctamente.`,
                    className: "bg-green-100 dark:bg-green-900 border-green-500",
                });
            } else {
                toast({
                    title: "Proceso Completado con Observaciones",
                    description: "Revise el resumen de resultados.",
                    variant: "default",
                });
            }

        } catch (error) {
            console.error("Error procesando archivo:", error);
            toast({
                title: "Error Fatal",
                description: "Ocurrió un error al procesar el archivo.",
                variant: "destructive",
            });
        } finally {
            setProcessing(false);
            setProgress(0);
        }
    };

    return (
        <>
            <Card>
                <CardContent className="p-6">
                    <div
                        className={cn(
                            "flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg transition-colors duration-200",
                            isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/25",
                            file ? "border-green-500 bg-green-50/50 dark:bg-green-900/10" : ""
                        )}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        {file ? (
                            <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                                <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full">
                                    <FileSpreadsheet className="w-12 h-12 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-medium text-green-700 dark:text-green-300">
                                        Archivo listo para cargar
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {file.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground/70 mt-1">
                                        {(file.size / 1024).toFixed(2)} KB
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleRemoveFile}
                                    disabled={processing}
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Remover archivo
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-center">
                                <div className="bg-muted p-4 rounded-full">
                                    <Upload className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="text-lg font-medium">
                                        Arrastra tu archivo Excel aquí
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        o haz clic para seleccionar
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    Seleccionar Archivo
                                </Button>
                            </div>
                        )}

                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".xlsx,.xls"
                            onChange={handleFileSelect}
                        />
                    </div>

                    {processing && (
                        <div className="mt-4">
                            <div className="flex justify-between text-sm mb-1">
                                <span>Procesando...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                <div
                                    className="bg-primary h-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex justify-end">
                        <Button
                            onClick={handleUpload}
                            disabled={!file || processing}
                            className={cn(
                                "w-full sm:w-auto transition-all duration-300",
                                file ? "bg-green-600 hover:bg-green-700 text-white" : ""
                            )}
                        >
                            {processing ? (
                                "Procesando..."
                            ) : file ? (
                                <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Cargar Órdenes
                                </>
                            ) : (
                                "Cargar Órdenes"
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={resultsOpen} onOpenChange={setResultsOpen}>
                <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Resumen de Carga</DialogTitle>
                        <DialogDescription>
                            Detalle de los resultados del procesamiento del archivo.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden border rounded-md">
                        <ScrollArea className="h-full">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Orden</TableHead>
                                        <TableHead className="w-[100px]">Estado</TableHead>
                                        <TableHead>Mensaje</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {uploadResults.map((result, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="font-medium">{result.orden}</TableCell>
                                            <TableCell>
                                                {result.success ? (
                                                    <div className="flex items-center text-green-600">
                                                        <CheckCircle className="w-4 h-4 mr-2" />
                                                        <span className="text-xs font-semibold">OK</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center text-red-600">
                                                        <AlertCircle className="w-4 h-4 mr-2" />
                                                        <span className="text-xs font-semibold">Error</span>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className={cn("text-sm", !result.success && "text-red-500")}>
                                                {result.message}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-4 border-t pt-4">
                        <div className="flex gap-4 text-sm w-full font-medium">
                            <div className="text-green-600">
                                Total Exitosos: {summaryStats.success}
                            </div>
                            <div className="text-red-600">
                                Total Fallidos: {summaryStats.failed}
                            </div>
                        </div>
                        <Button onClick={handleRemoveFile}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

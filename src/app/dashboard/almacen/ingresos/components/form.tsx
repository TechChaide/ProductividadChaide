"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ArrowDownToLine,
  Eraser,
  Package,
  ScanLine,
  Warehouse,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/user-context";
import { ingresosService } from "@/services/ingresos.service";
import { servicioService } from "@/services/servicio.service";
import { formatDateForSQLServer } from "@/lib/integrations/muestreos-ddpp/datetime2";
import type {
  Ingreso,
  InformacionMaterial,
  InformacionQR,
} from "@/types/interfaces";
import CatalogSelect, {
  type CatalogOption,
} from "@/components/integrations/muestreos-ddpp/shared/catalog-select";
import QRCodeComponent from "@/components/ui/qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const BODEGA_ORIGEN_DEFAULT = "1004 - Bod.Mat.Prima";
const CENTRO_DEFAULT = "1000";
const SCAN_IDLE_MS = 450;

const formSchema = z.object({
  bodega_origen: z.string().min(1, "La bodega origen es requerida."),
  bodega_destino: z.string().min(1, "La bodega destino es requerida."),
  qr_bmp: z.string().min(1, "Pistolea o ingresa el código QR."),
  codigo_material: z.string().min(1, "El código de material es requerido."),
  cantidad: z.string().min(1, "La cantidad es requerida."),
  unidades: z.string().min(1, "La unidad es requerida."),
});

type FormValues = z.infer<typeof formSchema>;

function extractCodigoPrefijo(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.split(" - ")[0]?.trim() || raw;
}

interface IngresoFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  /** Si hay registros, se permite volver al listado. */
  canCancel: boolean;
  /** Si viene, el formulario edita ese ingreso. */
  initialData?: Ingreso | null;
}

export default function IngresoForm({
  onSuccess,
  onCancel,
  canCancel,
  initialData = null,
}: IngresoFormProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const scanInputRef = useRef<HTMLInputElement>(null);
  const autoEnterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEdit = !!initialData?.codigo_ingreso;

  const [bodegaOptions, setBodegaOptions] = useState<CatalogOption[]>([]);
  const [centroByAlmacen, setCentroByAlmacen] = useState<Record<string, string>>(
    {}
  );
  const [isLoadingBodegas, setIsLoadingBodegas] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [scanBuffer, setScanBuffer] = useState("");
  const [isResolvingQr, setIsResolvingQr] = useState(false);
  const [infoQr, setInfoQr] = useState<InformacionQR | null>(null);
  const [infoMaterial, setInfoMaterial] = useState<InformacionMaterial | null>(
    null
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bodega_origen: BODEGA_ORIGEN_DEFAULT,
      bodega_destino: "",
      qr_bmp: "",
      codigo_material: "",
      cantidad: "",
      unidades: "",
    },
  });

  useEffect(() => {
    if (!initialData) return;
    form.reset({
      bodega_origen: initialData.bodega_origen || BODEGA_ORIGEN_DEFAULT,
      bodega_destino: initialData.bodega_destino || "",
      qr_bmp: initialData.qr_bmp || "",
      codigo_material: initialData.codigo_material || "",
      cantidad: String(initialData.cantidad ?? ""),
      unidades: initialData.unidades || "",
    });
    setScanBuffer(initialData.qr_bmp || "");
  }, [initialData, form]);

  const bodegaOrigen = form.watch("bodega_origen");
  const bodegaDestino = form.watch("bodega_destino");

  const resolverCentro = useCallback(() => {
    const fromDestino = centroByAlmacen[bodegaDestino];
    if (fromDestino) return extractCodigoPrefijo(fromDestino);
    const fromOrigen = centroByAlmacen[bodegaOrigen];
    if (fromOrigen) return extractCodigoPrefijo(fromOrigen);
    return CENTRO_DEFAULT;
  }, [bodegaDestino, bodegaOrigen, centroByAlmacen]);

  useEffect(() => {
    const cargarBodegas = async () => {
      setIsLoadingBodegas(true);
      try {
        const response = await servicioService.getBodegasPorCentro();
        const rows = response.data || [];

        const unique = new Map<string, CatalogOption>();
        const centros: Record<string, string> = {};

        for (const row of rows) {
          const almacen = String(row.Almacen ?? "").trim();
          const centro = String(row.Centro ?? "").trim();
          if (!almacen) continue;
          if (!unique.has(almacen)) {
            unique.set(almacen, {
              value: almacen,
              label: almacen,
              subtitle: centro || undefined,
            });
          }
          if (centro) centros[almacen] = centro;
        }

        const options = Array.from(unique.values()).sort((a, b) =>
          a.label.localeCompare(b.label, "es")
        );
        setBodegaOptions(options);
        setCentroByAlmacen(centros);

        if (options.some((o) => o.value === BODEGA_ORIGEN_DEFAULT)) {
          form.setValue("bodega_origen", BODEGA_ORIGEN_DEFAULT, {
            shouldValidate: true,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las bodegas.";
        toast({
          title: "Error al cargar bodegas",
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsLoadingBodegas(false);
      }
    };

    void cargarBodegas();
  }, [form, toast]);

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  const limpiarEscaneo = useCallback(() => {
    setInfoQr(null);
    setInfoMaterial(null);
    setScanBuffer("");
    form.setValue("qr_bmp", "");
    form.setValue("codigo_material", "");
    form.setValue("cantidad", "");
    form.setValue("unidades", "");
    scanInputRef.current?.focus();
  }, [form]);

  const resolverCodigoQr = useCallback(
    async (codigoRaw: string) => {
      const codigo = codigoRaw.trim();
      if (!codigo) return;

      if (autoEnterTimerRef.current) {
        clearTimeout(autoEnterTimerRef.current);
        autoEnterTimerRef.current = null;
      }

      setIsResolvingQr(true);
      try {
        // 1) Validar si el QR ya fue ingresado
        const existenteRes = await ingresosService.getByQR(codigo);
        const existente = existenteRes.data?.[0];

        if (existente) {
          setInfoQr(null);
          setInfoMaterial(null);
          form.setValue("qr_bmp", "");
          form.setValue("codigo_material", "");
          form.setValue("cantidad", "");
          form.setValue("unidades", "");
          toast({
            title: "QR ya registrado",
            description: `Este código ya ingresó (#${existente.codigo_ingreso}) — material ${existente.codigo_material}, destino ${existente.bodega_destino}.`,
            variant: "destructive",
          });
          return;
        }

        // 2) Consultar información del QR en SAP / ZMP
        const qrRes = await servicioService.getInformacionQR(codigo);
        const qr = qrRes.data?.[0];

        if (!qr) {
          setInfoQr(null);
          setInfoMaterial(null);
          toast({
            title: "QR no encontrado",
            description: "No hay información para el código pistoleado.",
            variant: "destructive",
          });
          return;
        }

        // Revalidar con el código canónico por si difiere del escaneado
        const codigoCanonico = String(qr.ZMP_CODBARRAS || codigo).trim();
        if (codigoCanonico && codigoCanonico !== codigo) {
          const existenteCanonicoRes = await ingresosService.getByQR(codigoCanonico);
          const existenteCanonico = existenteCanonicoRes.data?.[0];
          if (existenteCanonico) {
            setInfoQr(null);
            setInfoMaterial(null);
            toast({
              title: "QR ya registrado",
              description: `Este código ya ingresó (#${existenteCanonico.codigo_ingreso}) — material ${existenteCanonico.codigo_material}.`,
              variant: "destructive",
            });
            return;
          }
        }

        setInfoQr(qr);
        form.setValue("qr_bmp", codigoCanonico, {
          shouldValidate: true,
        });
        form.setValue("codigo_material", qr.ZMP_MATERIAL || "", {
          shouldValidate: true,
        });
        form.setValue("cantidad", String(qr.ZMP_CANTIDAD ?? ""), {
          shouldValidate: true,
        });

        const centro = resolverCentro();
        const materialRes = await servicioService.getInformacionMaterial(
          qr.ZMP_MATERIAL,
          centro
        );
        const material = materialRes.data?.[0] ?? null;
        setInfoMaterial(material);

        if (material?.Unidad) {
          form.setValue("unidades", material.Unidad, { shouldValidate: true });
        }

        toast({
          title: "Material identificado",
          description: material?.DESCRIPCION || qr.ZMP_MATERIAL,
          className: "bg-green-100 dark:bg-green-900 border-green-500",
        });
      } catch (error) {
        setInfoQr(null);
        setInfoMaterial(null);
        const message =
          error instanceof Error ? error.message : "No se pudo consultar el QR.";
        toast({
          title: "Error al consultar QR",
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsResolvingQr(false);
        setScanBuffer("");
        scanInputRef.current?.focus();
      }
    },
    [form, resolverCentro, toast]
  );

  useEffect(() => {
    if (autoEnterTimerRef.current) {
      clearTimeout(autoEnterTimerRef.current);
      autoEnterTimerRef.current = null;
    }

    const codigo = scanBuffer.trim();
    if (!codigo || isResolvingQr || isSubmitting) return;

    autoEnterTimerRef.current = setTimeout(() => {
      autoEnterTimerRef.current = null;
      void resolverCodigoQr(codigo);
    }, SCAN_IDLE_MS);

    return () => {
      if (autoEnterTimerRef.current) {
        clearTimeout(autoEnterTimerRef.current);
        autoEnterTimerRef.current = null;
      }
    };
  }, [scanBuffer, isResolvingQr, isSubmitting, resolverCodigoQr]);

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const now = formatDateForSQLServer(new Date());
      const payload: Ingreso = {
        codigo_ingreso: initialData?.codigo_ingreso ?? 0,
        bodega_origen: values.bodega_origen.trim(),
        bodega_destino: values.bodega_destino.trim(),
        qr_bmp: values.qr_bmp.trim(),
        codigo_material: values.codigo_material.trim(),
        cantidad: values.cantidad.trim(),
        unidades: values.unidades.trim(),
        fecha_ingreso: isEdit
          ? initialData?.fecha_ingreso || now
          : now,
        usuario_ingreso: isEdit
          ? initialData?.usuario_ingreso || user?.name || ""
          : user?.name ?? "",
        estado: "A",
        fecha_modificacion: now,
        usuario_modificacion: user?.name ?? "",
      };

      await ingresosService.save(payload);

      toast({
        title: isEdit ? "Ingreso actualizado" : "Ingreso registrado",
        description: isEdit
          ? "Los datos del material se actualizaron correctamente."
          : "El material se registró correctamente en la bodega.",
        className: "bg-green-100 dark:bg-green-900 border-green-500",
      });

      onSuccess();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isEdit
            ? "No se pudo actualizar el ingreso."
            : "No se pudo registrar el ingreso.";
      toast({
        title: isEdit ? "Error al actualizar" : "Error al registrar",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const qrValue = infoQr?.ZMP_CODBARRAS || form.watch("qr_bmp") || "";

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden border-primary/25 shadow-sm">
        <div className="bg-gradient-to-r from-[#0055b8] via-[#0a66c9] to-[#1a7ae0] px-4 py-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white/15 p-2">
                <Warehouse className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold leading-tight">
                  {isEdit
                    ? `Editar ingreso #${initialData?.codigo_ingreso}`
                    : "Nuevo ingreso de material"}
                </h1>
                <p className="text-xs text-white/80">
                  {isEdit
                    ? "Actualiza las propiedades del material ingresado."
                    : "Pistolea el QR del material y confirma destino de bodega."}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="bg-white/15 text-white hover:bg-white/25 border-0"
                onClick={limpiarEscaneo}
                disabled={isResolvingQr || isSubmitting}
              >
                <Eraser className="mr-2 h-4 w-4" />
                Limpiar escaneo
              </Button>
              {canCancel && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="bg-white text-primary hover:bg-white/90 border-0"
                  onClick={onCancel}
                  disabled={isResolvingQr || isSubmitting}
                >
                  Volver al listado
                </Button>
              )}
            </div>
          </div>
        </div>
        <CardContent className="pt-4">
          <Label htmlFor="scan-qr" className="text-xs font-semibold text-primary">
            Pistolear / escanear QR
          </Label>
          <div className="mt-1.5 flex gap-2">
            <div className="relative flex-1">
              <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <Input
                id="scan-qr"
                ref={scanInputRef}
                value={scanBuffer}
                onChange={(e) => setScanBuffer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void resolverCodigoQr(scanBuffer);
                  }
                }}
                placeholder="Apunta el lector aquí y dispara (Enter)..."
                className="h-11 pl-9 font-mono text-sm border-primary/40 focus-visible:ring-primary"
                disabled={isResolvingQr || isSubmitting}
                autoComplete="off"
              />
            </div>
            <Button
              type="button"
              onClick={() => void resolverCodigoQr(scanBuffer)}
              disabled={!scanBuffer.trim() || isResolvingQr || isSubmitting}
              className="h-11 px-5"
            >
              {isResolvingQr ? "Consultando..." : "Buscar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="contents">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
            <Card className="shadow-sm">
              <CardHeader className="py-3 border-b bg-muted/30">
                <CardTitle className="text-base text-primary flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Datos del ingreso
                </CardTitle>
                <CardDescription>
                  Las bodegas y el material se confirman antes de registrar.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="bodega_origen"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <CatalogSelect
                            id="bodega_origen"
                            label="Bodega origen"
                            value={field.value}
                            onChange={field.onChange}
                            options={bodegaOptions}
                            isLoading={isLoadingBodegas}
                            placeholder="Selecciona origen..."
                            searchPlaceholder="Escribe para buscar..."
                            emptyMessage="Sin bodegas."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bodega_destino"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <CatalogSelect
                            id="bodega_destino"
                            label="Bodega destino"
                            value={field.value}
                            onChange={field.onChange}
                            options={bodegaOptions}
                            isLoading={isLoadingBodegas}
                            placeholder="Selecciona destino..."
                            searchPlaceholder="Escribe para buscar..."
                            emptyMessage="Sin bodegas."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="codigo_material"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Material</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            readOnly
                            className="bg-muted/40 font-mono text-xs"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cantidad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cantidad</FormLabel>
                        <FormControl>
                          <Input {...field} inputMode="decimal" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="unidades"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidad</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly className="bg-muted/40" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="qr_bmp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código QR / BMP</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          readOnly
                          className="bg-muted/40 font-mono text-xs"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-1">
                  {canCancel && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onCancel}
                      disabled={isSubmitting || isResolvingQr}
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      isResolvingQr ||
                      (!isEdit && !infoQr)
                    }
                    className="min-w-[160px]"
                  >
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    {isSubmitting
                      ? "Guardando..."
                      : isEdit
                        ? "Guardar cambios"
                        : "Registrar ingreso"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="py-3 border-b bg-gradient-to-r from-primary/10 to-transparent">
                <CardTitle className="text-base text-primary">
                  Material identificado
                </CardTitle>
                <CardDescription>
                  Vista del QR y detalle SAP del pistoleo.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {isResolvingQr ? (
                  <div className="space-y-3">
                    <Skeleton className="mx-auto h-[160px] w-[160px]" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : !infoQr ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                    <div className="rounded-full bg-muted p-4">
                      <ScanLine className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground max-w-[240px]">
                      Escanea un código QR para ver el material, la cantidad y el
                      QR generado.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="mx-auto rounded-xl border bg-white p-3 shadow-sm">
                      {qrValue ? (
                        <QRCodeComponent value={qrValue} size={168} />
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Descripción
                        </p>
                        <p className="text-sm font-semibold leading-snug">
                          {infoMaterial?.DESCRIPCION || "Sin descripción"}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-md bg-muted/50 p-2">
                          <p className="text-[11px] text-muted-foreground">
                            Material
                          </p>
                          <p className="font-mono text-xs break-all">
                            {infoQr.ZMP_MATERIAL}
                          </p>
                        </div>
                        <div className="rounded-md bg-muted/50 p-2">
                          <p className="text-[11px] text-muted-foreground">
                            Cantidad
                          </p>
                          <p className="font-semibold">
                            {infoQr.ZMP_CANTIDAD}{" "}
                            <span className="text-muted-foreground font-normal">
                              {infoMaterial?.Unidad || ""}
                            </span>
                          </p>
                        </div>
                        <div className="rounded-md bg-muted/50 p-2">
                          <p className="text-[11px] text-muted-foreground">
                            Doc. MIGO
                          </p>
                          <p className="font-mono text-xs">
                            {infoQr.ZMP_DOC_MIGO || "—"}
                          </p>
                        </div>
                        <div className="rounded-md bg-muted/50 p-2">
                          <p className="text-[11px] text-muted-foreground">
                            Estado
                          </p>
                          <Badge
                            variant={
                              infoQr.ZMP_STATUS === "X" ? "default" : "secondary"
                            }
                            className="mt-0.5"
                          >
                            {infoQr.ZMP_STATUS || "—"}
                          </Badge>
                        </div>
                      </div>

                      <div className="rounded-md border border-dashed p-2">
                        <p className="text-[11px] text-muted-foreground mb-1">
                          Código de barras
                        </p>
                        <p className="font-mono text-[11px] break-all leading-relaxed">
                          {infoQr.ZMP_CODBARRAS}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </form>
      </Form>
    </div>
  );
}

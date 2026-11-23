"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eraser, Loader2, Recycle, ScanBarcode, Send, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  desperdicioService,
  ESTADO_DESPERDICIO_INGRESADO,
  IngresoDesperdicioError,
} from "@/services/desperdicio.service";
import type { DesperdicioArea } from "@/types/interfaces";

/**
 * pendiente y error se envían al presionar "Ingresar desperdicio". revisar: SAP pudo haber
 * creado el documento aunque falló, así que no se reenvía para no duplicar la salida.
 */
type ResultadoDesperdicio = "pendiente" | "enviando" | "ingresado" | "error" | "revisar";

interface DesperdicioLeido extends DesperdicioArea {
  resultado: ResultadoDesperdicio;
  /** Documento de SAP o motivo por el que no se ingresó. */
  mensaje: string | null;
}

const RESULTADOS: Record<ResultadoDesperdicio, { label: string; chip: string }> = {
  pendiente: { label: "Pendiente", chip: "bg-secondary text-secondary-foreground" },
  enviando: { label: "Enviando...", chip: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" },
  ingresado: { label: "Ingresado", chip: "bg-green-600 text-white" },
  error: { label: "Error", chip: "bg-destructive text-destructive-foreground" },
  revisar: { label: "Revisar en SAP", chip: "bg-amber-500 text-white" },
};

/** Anchos en % con table-fixed: la tabla siempre ocupa el ancho de la pantalla, sin scroll horizontal. */
const COLUMNAS: { label: string; className: string }[] = [
  { label: "Regional", className: "w-[6%]" },
  { label: "Departamento", className: "w-[9%]" },
  { label: "Tara", className: "w-[7%]" },
  { label: "Componente", className: "w-[9.5%]" },
  { label: "Desp. neto", className: "w-[5.5%] text-right" },
  { label: "Desp. bruto", className: "w-[5.5%] text-right" },
  { label: "Tipo desperdicio", className: "w-[7.5%]" },
  { label: "Responsable", className: "w-[8.5%]" },
  { label: "Máquina", className: "w-[8%]" },
  { label: "Fecha", className: "w-[7%]" },
  { label: "Cód. barras", className: "w-[9.5%]" },
  { label: "Estado", className: "w-[12%]" },
];

const sePuedeEnviar = (d: DesperdicioLeido) => d.resultado === "pendiente" || d.resultado === "error";

const formatoPeso = (valor: number) =>
  Number(valor ?? 0).toLocaleString("es-EC", { maximumFractionDigits: 3 });

export default function LecturaDesperdiciosContent() {
  const { toast } = useToast();

  // El lector escribe el código de barras y envía Enter.
  const [codigo, setCodigo] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  // El último leído queda arriba, como en el sistema de escritorio.
  const [desperdicios, setDesperdicios] = useState<DesperdicioLeido[]>([]);
  const [ingresando, setIngresando] = useState(false);
  const [avance, setAvance] = useState<{ actual: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // El cursor queda listo en el campo para la siguiente lectura.
  useEffect(() => {
    if (!leyendo && !ingresando) inputRef.current?.focus();
  }, [leyendo, ingresando]);

  const porEnviar = useMemo(() => desperdicios.filter(sePuedeEnviar), [desperdicios]);
  const netoPorEnviar = useMemo(
    () => porEnviar.reduce((total, d) => total + Number(d.DESPERDICIO_NETO || 0), 0),
    [porEnviar]
  );

  const actualizar = (codbarras: string, cambios: Partial<DesperdicioLeido>) =>
    setDesperdicios((prev) => prev.map((d) => (d.CODBARRAS === codbarras ? { ...d, ...cambios } : d)));

  const quitar = (codbarras: string) =>
    setDesperdicios((prev) => prev.filter((d) => d.CODBARRAS !== codbarras));

  const limpiar = () => {
    setCodigo("");
    setDesperdicios([]);
    inputRef.current?.focus();
  };

  const leerCodigo = async () => {
    const codbarras = codigo.trim();
    if (!codbarras || leyendo || ingresando) return;
    if (desperdicios.some((d) => d.CODBARRAS === codbarras)) {
      toast({
        title: "Código repetido",
        description: `El desperdicio ${codbarras} ya está en la lista.`,
      });
      setCodigo("");
      return;
    }

    setLeyendo(true);
    try {
      const resp = await desperdicioService.buscarDesperdicioXCodBarras(codbarras);
      const desperdicio = Array.isArray(resp?.data) ? resp.data[0] : undefined;
      if (!desperdicio) {
        toast({
          title: "Desperdicio no encontrado",
          description: `No existe un desperdicio con el código ${codbarras}.`,
          variant: "destructive",
        });
        return;
      }

      const yaIngresado = Number(desperdicio.ESTADO) === ESTADO_DESPERDICIO_INGRESADO;
      setDesperdicios((prev) =>
        prev.some((d) => d.CODBARRAS === desperdicio.CODBARRAS)
          ? prev
          : [
              {
                ...desperdicio,
                resultado: yaIngresado ? "ingresado" : "pendiente",
                mensaje: yaIngresado ? desperdicio.DOCUMENTO || null : null,
              },
              ...prev,
            ]
      );
      if (yaIngresado) {
        toast({
          title: "Desperdicio ya ingresado",
          description: "Este desperdicio ya fue ingresado anteriormente.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error al leer el código",
        description: err instanceof Error ? err.message : "No se pudo consultar el desperdicio.",
        variant: "destructive",
      });
    } finally {
      setCodigo("");
      setLeyendo(false);
    }
  };

  /** Cada desperdicio se envía a SAP por separado (un documento por desperdicio), uno tras otro. */
  const ingresarDesperdicios = async () => {
    const lote = porEnviar;
    if (lote.length === 0 || ingresando) return;

    setIngresando(true);
    const documentos: string[] = [];
    try {
      for (let i = 0; i < lote.length; i++) {
        const { CODBARRAS } = lote[i];
        setAvance({ actual: i + 1, total: lote.length });
        actualizar(CODBARRAS, { resultado: "enviando", mensaje: null });
        try {
          const resp = await desperdicioService.ingresarDesperdicio(CODBARRAS);
          const documento = resp.documento || resp.msg;
          documentos.push(documento);
          actualizar(CODBARRAS, {
            resultado: "ingresado",
            ESTADO: ESTADO_DESPERDICIO_INGRESADO,
            mensaje: documento,
          });
        } catch (err) {
          const mensaje = err instanceof Error ? err.message : "No se pudo ingresar el desperdicio.";
          if (err instanceof IngresoDesperdicioError && err.status === 409) {
            actualizar(CODBARRAS, { resultado: "ingresado", ESTADO: ESTADO_DESPERDICIO_INGRESADO, mensaje });
          } else {
            const reintentable = !(err instanceof IngresoDesperdicioError) || err.reintentable;
            actualizar(CODBARRAS, { resultado: reintentable ? "error" : "revisar", mensaje });
          }
        }
      }
    } finally {
      setAvance(null);
      setIngresando(false);
    }

    if (documentos.length === lote.length) {
      toast({
        title: "Desperdicios ingresados correctamente.",
        description:
          documentos.length === 1 ? documentos[0] : `Se ingresaron ${documentos.length} desperdicios.`,
      });
      setDesperdicios([]);
    } else {
      toast({
        title: "No se ingresaron todos los desperdicios",
        description: `Ingresados: ${documentos.length} de ${lote.length}. Revise el estado de cada uno en la tabla.`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="shadow-lg w-full">
        <CardHeader className="py-3">
          <CardTitle className="text-base font-bold text-primary flex items-center">
            <Recycle className="mr-2 h-4 w-4" /> Lectura de Desperdicios
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <form
              className="flex-1 min-w-[260px] max-w-xl"
              onSubmit={(e) => {
                e.preventDefault();
                leerCodigo();
              }}
            >
              <label htmlFor="codbarras-desperdicio" className="text-xs text-muted-foreground">
                Código de barras
              </label>
              <div className="relative">
                <ScanBarcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="codbarras-desperdicio"
                  ref={inputRef}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Escanee el código de barras del desperdicio..."
                  className="h-11 pl-10 pr-10 text-base"
                  autoComplete="off"
                  disabled={leyendo || ingresando}
                />
                {leyendo && (
                  <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
            </form>
            <div className="flex items-center gap-3 rounded-md border bg-card px-4 py-2">
              <div className="leading-tight">
                <p className="text-xs text-muted-foreground">Por ingresar</p>
                <p className="text-2xl font-bold text-primary">{porEnviar.length}</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="leading-tight">
                <p className="text-xs text-muted-foreground">Desperdicio neto</p>
                <p className="text-2xl font-bold text-primary">{formatoPeso(netoPorEnviar)}</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            {desperdicios.length > 0 ? (
              <div className="rounded-md border">
                <Table lang="es" className="table-fixed text-xs hyphens-auto break-words">
                  <TableHeader>
                    <TableRow>
                      {COLUMNAS.map((col) => (
                        <TableHead key={col.label} className={cn("h-auto px-2 py-2 leading-tight", col.className)}>
                          {col.label}
                        </TableHead>
                      ))}
                      <TableHead className="h-auto w-11 px-2 py-2" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {desperdicios.map((d) => {
                      const resultado = RESULTADOS[d.resultado];
                      const [fecha, hora] = (d.FECHA ?? "").split(" ");
                      return (
                        <Fragment key={d.CODBARRAS}>
                          <TableRow className={cn(d.mensaje && "border-b-0")}>
                            <TableCell className="px-2 py-2">{d.REGIONAL}</TableCell>
                            <TableCell className="px-2 py-2">{d.DEPARTAMENTO}</TableCell>
                            <TableCell className="px-2 py-2">{d.TARA}</TableCell>
                            <TableCell className="px-2 py-2">{d.COMPONENTE}</TableCell>
                            <TableCell className="px-2 py-2 text-right font-semibold whitespace-nowrap">
                              {formatoPeso(d.DESPERDICIO_NETO)}
                            </TableCell>
                            <TableCell className="px-2 py-2 text-right whitespace-nowrap">
                              {formatoPeso(d.DESPERDICIO_BRUTO)}
                            </TableCell>
                            <TableCell className="px-2 py-2">{d.TIPO_DESPERDICIO}</TableCell>
                            <TableCell className="px-2 py-2">{d.RESPONSABLE}</TableCell>
                            <TableCell className="px-2 py-2">{d.MAQUINA}</TableCell>
                            <TableCell className="px-2 py-2 leading-tight whitespace-nowrap">
                              <span className="block">{fecha}</span>
                              <span className="block text-muted-foreground">{hora}</span>
                            </TableCell>
                            <TableCell className="px-2 py-2 font-mono text-[11px] break-all">{d.CODBARRAS}</TableCell>
                            <TableCell className="px-2 py-2">
                              <Badge className={cn("pointer-events-none gap-1", resultado.chip)}>
                                {d.resultado === "enviando" && <Loader2 className="h-3 w-3 animate-spin" />}
                                {resultado.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-2 py-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Quitar de la lista"
                                onClick={() => quitar(d.CODBARRAS)}
                                disabled={ingresando}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          {d.mensaje && (
                            <TableRow className="hover:bg-transparent">
                              <TableCell
                                colSpan={COLUMNAS.length + 1}
                                className={cn(
                                  "px-2 pb-2 pt-0 text-[11px] leading-tight",
                                  d.resultado === "error" || d.resultado === "revisar"
                                    ? "text-red-700 dark:text-red-300"
                                    : "text-muted-foreground"
                                )}
                              >
                                {d.mensaje}
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex justify-center items-center h-[120px] rounded-md border border-dashed">
                <p className="text-muted-foreground text-sm">
                  {leyendo
                    ? "Consultando desperdicio..."
                    : "Escanee un código de barras para agregar el desperdicio."}
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button
              size="lg"
              className="gap-2"
              onClick={ingresarDesperdicios}
              disabled={ingresando || leyendo || porEnviar.length === 0}
            >
              {ingresando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {ingresando && avance
                ? `Ingresando ${avance.actual} de ${avance.total}...`
                : "Ingresar desperdicio"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2"
              onClick={limpiar}
              disabled={ingresando || (desperdicios.length === 0 && !codigo)}
            >
              <Eraser className="h-4 w-4" /> Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

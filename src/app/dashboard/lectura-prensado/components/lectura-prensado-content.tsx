"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  Loader2,
  LogOut,
  QrCode,
  ScanLine,
  UserCog,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/user-context";
import { cn } from "@/lib/utils";
import {
  MESA_PRENSADO,
  planchaEspumaPrensadoService,
} from "@/services/planchaEspumaPrensado.service";
import type {
  EtiquetaImpresaPrensado,
  EtiquetaQRPrensado,
  OperadorPrensado,
} from "@/types/interfaces";
import AsignarOperadoresPrensadoDialog from "./asignar-operadores-prensado-dialog";
import HistorialLecturasPrensado, {
  MAX_HISTORIAL_LECTURAS,
  type LecturaPrensado,
} from "./historial-lecturas-prensado";
import { getRolOperadorPrensado, ROLES_OPERADOR_PRENSADO } from "./roles-operador-prensado";
import {
  cerrarSesionesPrensado,
  iniciarSesionesPrensado,
  operadoresConSesionEn,
} from "./sesiones-prensado";
import { turnoPrensadoActual, type TurnoPrensado } from "./turno-prensado";
import { enfocarSinTeclado, liberarSoloLectura } from "./enfocar-sin-teclado";

// El equipo (con sus roles) se guarda en el navegador para no perderlo al recargar mientras
// las sesiones siguen abiertas en BDD. El logout limpia el localStorage.
const STORAGE_KEY = "equipoLecturaPrensado";

// Texto por defecto si el endpoint devuelve la etiqueta sin `msg`.
const MENSAJE_LECTURA_EXITOSA = "Lectura exitosa";

interface ConteoOrden {
  orden: string;
  leidas: number;
  /** null si no se pudo consultar cuántas se imprimieron. */
  impresas: number | null;
}

interface TotalTurno {
  turno: TurnoPrensado;
  total: number;
}

/**
 * Etiquetas distintas (por código de barras) de una lista del log. El log guarda una fila por
 * operador, así que una etiqueta leída por un equipo de dos aparece dos veces. Las anuladas
 * (netiqueta 0, por reimpresión) no cuentan.
 */
function contarEtiquetas(filas: EtiquetaImpresaPrensado[]): number {
  return new Set(filas.filter((f) => Number(f.netiqueta) > 0).map((f) => f.codbarras)).size;
}

function leerEquipoGuardado(codigoUsuario: string): OperadorPrensado[] {
  try {
    const guardado = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return guardado?.usuario === codigoUsuario && Array.isArray(guardado.operadores)
      ? guardado.operadores
      : [];
  } catch {
    return [];
  }
}

function guardarEquipo(codigoUsuario: string, operadores: OperadorPrensado[]) {
  try {
    if (operadores.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify({ usuario: codigoUsuario, operadores }));
  } catch {
    // Sin almacenamiento disponible el equipo solo vive en memoria.
  }
}

export default function LecturaPrensadoContent() {
  const { toast } = useToast();
  const {
    user,
    isLoading: isUserLoading,
    estaciones,
    areaProcessControls,
    fetchActiveSessions,
  } = useUser();

  // Equipo en turno, con sesión iniciada en la estación.
  const [operadores, setOperadores] = useState<OperadorPrensado[]>([]);
  const [asignarOpen, setAsignarOpen] = useState(false);
  const [finalizarOpen, setFinalizarOpen] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [equipoCargado, setEquipoCargado] = useState(false);

  // Lectura de QR: el escáner escribe el código y envía Enter.
  const [qr, setQr] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [ultimoQr, setUltimoQr] = useState<string | null>(null);
  const [etiquetasLeidas, setEtiquetasLeidas] = useState<EtiquetaQRPrensado[]>([]);
  // Motivo por el que la última lectura no se registró; se muestra en lugar de la tabla.
  const [errorLectura, setErrorLectura] = useState<string | null>(null);
  // `msg` del endpoint cuando la lectura es válida (p. ej. "Lectura exitosa").
  const [mensajeLectura, setMensajeLectura] = useState(MENSAJE_LECTURA_EXITOSA);
  const [historial, setHistorial] = useState<LecturaPrensado[]>([]);
  // Avance de la orden de la última etiqueta registrada: leídas en esta estación e impresas.
  const [conteoOrden, setConteoOrden] = useState<ConteoOrden | null>(null);
  const ultimoConteoId = useRef(0);
  // Total de etiquetas leídas en la estación durante el turno actual (Día / Noche).
  const [totalTurno, setTotalTurno] = useState<TotalTurno | null>(null);
  const ultimoTotalTurnoId = useRef(0);
  const qrInputRef = useRef<HTMLInputElement>(null);

  const estacion = useMemo(
    () => estaciones.find((e) => e.direccion_ip === user?.ip_address) ?? null,
    [estaciones, user?.ip_address]
  );

  // Área de control de la estación: la primera activa con la misma IP (puede haber varias).
  const areaControl = useMemo(() => {
    const ip = estacion?.direccion_ip?.trim();
    if (!ip) return null;
    return (
      areaProcessControls.find((a) => a.estado === "A" && a.direccion_ip?.trim() === ip) ?? null
    );
  }, [areaProcessControls, estacion?.direccion_ip]);

  // Al ingresar se recupera el equipo en curso; si no hay, se abre el modal de asignación.
  useEffect(() => {
    if (isUserLoading || equipoCargado || !user?.code) return;
    const guardado = leerEquipoGuardado(user.code);
    setOperadores(guardado);
    if (guardado.length === 0) setAsignarOpen(true);
    setEquipoCargado(true);
  }, [isUserLoading, equipoCargado, user?.code]);

  const actualizarEquipo = (nuevo: OperadorPrensado[]) => {
    setOperadores(nuevo);
    if (user?.code) guardarEquipo(user.code, nuevo);
  };

  const requerirEstacion = () => {
    if (!estacion) {
      throw new Error(
        `No se pudo identificar la estación de trabajo de este equipo (IP ${user?.ip_address || "desconocida"}).`
      );
    }
    return estacion;
  };

  /**
   * Aplica el equipo confirmado en el modal: inicia sesión a quienes entran y la cierra a
   * quienes salen. A quienes siguen solo se les actualiza el rol (su sesión continúa).
   */
  const confirmarEquipo = async (nuevo: OperadorPrensado[]) => {
    const { codigo_estacion, nombre_estacion, direccion_ip } = requerirEstacion();
    if (!areaControl) {
      throw new Error(
        `No hay un Area Process Control activo configurado para la estación ${nombre_estacion} (IP ${direccion_ip}).`
      );
    }
    const entran = nuevo.filter((n) => !operadores.some((o) => o.codigo === n.codigo));
    const salen = operadores.filter((o) => !nuevo.some((n) => n.codigo === o.codigo));
    const trasladados = entran.filter((o) => o.trasladoDesde && o.trasladoDesde.length > 0);

    try {
      // Traslados: primero se cierra la sesión en la estación de origen (con su 'fh'), igual
      // que un cierre normal allá. Esa estación lo retira del equipo en su siguiente lectura.
      for (const o of trasladados) {
        for (const estacionOrigen of o.trasladoDesde!) {
          await cerrarSesionesPrensado([o.codigo], estacionOrigen);
        }
      }
      await cerrarSesionesPrensado(salen.map((o) => o.codigo), codigo_estacion);
      await iniciarSesionesPrensado(
        entran.map((o) => o.codigo),
        codigo_estacion,
        areaControl.codigo_rcp
      );
    } finally {
      await fetchActiveSessions();
    }

    // `trasladoDesde` solo sirve para este paso: no se guarda con el equipo.
    actualizarEquipo(nuevo.map(({ trasladoDesde: _, ...o }) => o));
    // Al asignar el primer equipo el efecto del total del turno ya lo consulta.
    if (operadores.length > 0) actualizarTotalTurno(nombre_estacion);
    const partes = [
      entran.length > 0 && `sesión iniciada para ${entran.length} persona(s)`,
      trasladados.length > 0 && `${trasladados.length} trasladada(s) desde otra estación`,
      salen.length > 0 && `sesión cerrada para ${salen.length} persona(s)`,
    ].filter(Boolean);
    toast({
      title: "Equipo confirmado",
      description:
        partes.length > 0
          ? `En la estación ${nombre_estacion}: ${partes.join(" y ")}.`
          : "Se actualizaron los roles del equipo.",
    });
  };

  const finalizarSesion = async () => {
    setFinalizando(true);
    try {
      const { codigo_estacion } = requerirEstacion();
      await cerrarSesionesPrensado(operadores.map((o) => o.codigo), codigo_estacion);
      actualizarEquipo([]);
      setFinalizarOpen(false);
      toast({
        title: "Sesión finalizada",
        description: `Se cerró la sesión de ${operadores.length} persona(s).`,
      });
    } catch (err) {
      toast({
        title: "Error al finalizar sesión",
        description: err instanceof Error ? err.message : "No se pudo cerrar la sesión del equipo.",
        variant: "destructive",
      });
    } finally {
      await fetchActiveSessions();
      setFinalizando(false);
    }
  };

  const hayEquipo = operadores.length > 0;

  // Con el equipo asignado el cursor queda listo en el textbox para la siguiente lectura.
  useEffect(() => {
    if (hayEquipo && !leyendo && !asignarOpen && !finalizarOpen) enfocarSinTeclado(qrInputRef.current);
  }, [hayEquipo, leyendo, asignarOpen, finalizarOpen]);

  /**
   * Refresca el avance de la orden: etiquetas leídas en esta estación y las impresas. No se
   * espera desde la lectura (no la frena) y si falla se deja el conteo anterior. Con lecturas
   * seguidas solo se aplica la respuesta de la última.
   */
  const actualizarConteo = async (orden: string, nombreEstacion: string) => {
    const id = ++ultimoConteoId.current;
    const [leidas, impresas] = await Promise.allSettled([
      planchaEspumaPrensadoService.buscarEtiquetasXOrdenPrensado(orden, nombreEstacion),
      planchaEspumaPrensadoService.buscarEtiquetasXOrdenPrensado(orden, MESA_PRENSADO),
    ]);
    if (id !== ultimoConteoId.current) return;
    if (leidas.status === "rejected") {
      console.warn("[LECTURA-PRENSADO] No se pudo consultar el conteo de la orden:", leidas.reason);
      return;
    }
    setConteoOrden({
      orden,
      leidas: contarEtiquetas(leidas.value.data || []),
      impresas: impresas.status === "fulfilled" ? contarEtiquetas(impresas.value.data || []) : null,
    });
  };

  /**
   * Refresca el total de etiquetas leídas en la estación durante el turno actual. Igual que el
   * conteo de la orden: no frena la lectura, si falla se deja el valor anterior y con llamadas
   * seguidas solo se aplica la última.
   */
  const actualizarTotalTurno = async (nombreEstacion: string) => {
    const id = ++ultimoTotalTurnoId.current;
    const turno = turnoPrensadoActual();
    try {
      const total = await planchaEspumaPrensadoService.buscarCantQRxEstacionRangoPrensado(
        turno.fechaInicio,
        turno.fechaFin,
        nombreEstacion
      );
      if (id === ultimoTotalTurnoId.current) setTotalTurno({ turno, total });
    } catch (err) {
      console.warn("[LECTURA-PRENSADO] No se pudo consultar el total del turno:", err);
    }
  };

  // Primera consulta al tener equipo (asignado o recuperado al recargar) y estación.
  const nombreEstacion = estacion?.nombre_estacion;
  useEffect(() => {
    if (hayEquipo && nombreEstacion) actualizarTotalTurno(nombreEstacion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayEquipo, nombreEstacion]);

  // Si cambia el turno sin lecturas de por medio (p. ej. a las 20:00), se consulta el nuevo.
  const claveTurno = totalTurno?.turno.clave;
  useEffect(() => {
    if (!hayEquipo || !nombreEstacion || !claveTurno) return;
    const timer = setInterval(() => {
      if (turnoPrensadoActual().clave !== claveTurno) actualizarTotalTurno(nombreEstacion);
    }, 60_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayEquipo, nombreEstacion, claveTurno]);

  const leerQr = async () => {
    const codigo = qr.trim();
    if (!codigo || leyendo) return;
    if (!estacion) {
      toast({
        title: "Estación no identificada",
        description: `No se pudo identificar la estación de trabajo de este equipo (IP ${user?.ip_address || "desconocida"}).`,
        variant: "destructive",
      });
      return;
    }

    const agregarAlHistorial = (lectura: Omit<LecturaPrensado, "id" | "hora">) =>
      setHistorial((prev) =>
        [
          {
            ...lectura,
            id: `${Date.now()}-${Math.random()}`,
            hora: new Date().toLocaleTimeString("es-EC", { hour12: false }),
          },
          ...prev,
        ].slice(0, MAX_HISTORIAL_LECTURAS)
      );
    const fallar = (orden: string, titulo: string, mensaje: string) => {
      agregarAlHistorial({ codbarras: codigo, orden, ok: false, mensaje });
      setErrorLectura(mensaje);
      toast({ title: titulo, description: mensaje, variant: "destructive" });
    };

    setLeyendo(true);
    setUltimoQr(codigo);
    setEtiquetasLeidas([]);
    setErrorLectura(null);
    // Las sesiones del equipo se validan en paralelo con la consulta del QR. Nunca lanza.
    const validacionEquipo = operadoresConSesionEn(
      operadores.map((o) => o.codigo),
      estacion.codigo_estacion
    );
    try {
      let filas: EtiquetaQRPrensado[];
      let msg: string;
      try {
        const resp = await planchaEspumaPrensadoService.buscarEtiquetasXQRPrensado(
          codigo,
          estacion.nombre_estacion
        );
        filas = Array.isArray(resp?.data) ? resp.data : [];
        msg = String(resp?.msg ?? "").trim();
      } catch (err) {
        fallar("", "Error al leer el QR", err instanceof Error ? err.message : "No se pudo consultar el código QR.");
        return;
      }

      // Solo se registra si el endpoint devolvió la etiqueta; si no, `msg` dice por qué
      // (no encontrada o ya procesada en esta estación).
      const etiqueta = filas[0];
      if (!etiqueta) {
        fallar("", "Etiqueta no registrada", msg || `No se encontró la etiqueta ${codigo}.`);
        return;
      }
      // Quien fue trasladado a otra estación ya no tiene su sesión aquí: se lo retira del
      // equipo y no se le registra la lectura. Si la validación falla, se sigue con el equipo
      // actual para no detener el proceso.
      const conSesion = await validacionEquipo;
      const trasladados = conSesion ? operadores.filter((o) => !conSesion.has(o.codigo)) : [];
      const vigentes = operadores.filter((o) => !trasladados.includes(o));
      const avisoTraslado =
        trasladados.length > 0
          ? `${trasladados.map((o) => o.nombre).join(", ")} ya no ${
              trasladados.length === 1 ? "tiene" : "tienen"
            } sesión en esta estación (${
              trasladados.length === 1 ? "fue trasladado" : "fueron trasladados"
            }) y se ${trasladados.length === 1 ? "retiró" : "retiraron"} del equipo.`
          : null;
      if (trasladados.length > 0) actualizarEquipo(vigentes);
      if (vigentes.length === 0) {
        fallar(String(etiqueta.orden ?? ""), "Equipo sin sesión activa", `${avisoTraslado} Asigne el equipo de nuevo.`);
        setAsignarOpen(true);
        return;
      }

      const mensajeOk = msg || MENSAJE_LECTURA_EXITOSA;
      setMensajeLectura(mensajeOk);
      setEtiquetasLeidas(filas);

      // Un registro por cada operador en turno; tipoOpe es la inicial de su rol (A / P).
      const resultados = await Promise.allSettled(
        vigentes.map((o) =>
          planchaEspumaPrensadoService.guardarLogPrensado({
            codbarras: etiqueta.codbarras,
            orden: String(etiqueta.orden ?? ""),
            operador: o.codigo,
            secuencial: etiqueta.secuencial,
            producto: String(etiqueta.producto ?? ""),
            netiqueta: etiqueta.netiqueta,
            mesa: estacion.nombre_estacion,
            codPedido: String(etiqueta.CodPedido ?? "").trim(),
            tipoOpe: o.rol.charAt(0),
          })
        )
      );
      // Aunque algún insert fallara, los demás pudieron quedar: se refresca igual.
      if (etiqueta.orden) actualizarConteo(String(etiqueta.orden), estacion.nombre_estacion);
      actualizarTotalTurno(estacion.nombre_estacion);
      const fallidos = resultados.flatMap((r, i) =>
        r.status === "rejected"
          ? [`${vigentes[i].nombre}: ${r.reason instanceof Error ? r.reason.message : "error desconocido"}`]
          : []
      );

      if (fallidos.length > 0) {
        fallar(
          String(etiqueta.orden ?? ""),
          "Error al registrar la lectura",
          `No se registró ${fallidos.length} de ${vigentes.length} operador(es). ${fallidos.join(" | ")}` +
            (avisoTraslado ? ` ${avisoTraslado}` : "")
        );
        return;
      }
      agregarAlHistorial({
        codbarras: etiqueta.codbarras || codigo,
        orden: String(etiqueta.orden ?? ""),
        ok: true,
        mensaje: `${mensajeOk}. Registrada para ${vigentes.length} operador(es).`,
      });
      if (avisoTraslado) {
        toast({ title: "Equipo actualizado", description: avisoTraslado });
      }
    } finally {
      setQr("");
      setLeyendo(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="shadow-lg w-full">
        <CardHeader className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base font-bold text-primary flex items-center">
              <ScanLine className="mr-2 h-4 w-4" /> Lectura Etiquetas Prensado
            </CardTitle>
            {hayEquipo && totalTurno && (
              <div className="ml-auto flex items-center gap-3 rounded-md border bg-card px-4 py-1.5">
                <div className="leading-tight">
                  <p className="text-xs text-muted-foreground">
                    Total Etiquetas {totalTurno.turno.nombre}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{totalTurno.turno.rango}</p>
                </div>
                <p className="text-2xl font-bold text-primary">{totalTurno.total}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant={hayEquipo ? "outline" : "default"}
                size="sm"
                className="gap-2"
                onClick={() => setAsignarOpen(true)}
                disabled={!equipoCargado || finalizando}
              >
                {hayEquipo ? <UserCog className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                {hayEquipo ? "Modificar equipo" : "Asignar colaboradores"}
              </Button>
              {hayEquipo && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                  onClick={() => setFinalizarOpen(true)}
                  disabled={finalizando}
                >
                  <LogOut className="h-4 w-4" />
                  Finalizar sesión
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {hayEquipo ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="font-medium">Operadores en turno: {operadores.length}</span>
                {ROLES_OPERADOR_PRENSADO.map((r) => (
                  <span key={r.valor}>
                    {r.label}: {operadores.filter((o) => o.rol === r.valor).length}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {operadores.map((o) => {
                  const rol = getRolOperadorPrensado(o.rol);
                  return (
                    <div
                      key={o.id}
                      className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
                    >
                      <div className="leading-tight">
                        <p className="text-sm font-medium">{o.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {o.codigo}
                          {o.principal && <span className="font-medium text-primary"> · Principal</span>}
                        </p>
                      </div>
                      <Badge className={cn("pointer-events-none", rol.chip)}>{rol.label}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex justify-center items-center h-[80px] p-4">
              <p className="text-muted-foreground text-sm">
                No hay colaboradores asignados. Asigne el equipo para comenzar la lectura.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Área de trabajo: aquí irán los siguientes componentes de lectura de prensado. */}
      {hayEquipo && (
        <Card className="shadow-lg w-full">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <form
                className="flex-1 min-w-[260px] max-w-xl"
                onSubmit={(e) => {
                  e.preventDefault();
                  leerQr();
                }}
              >
                <label htmlFor="qr-prensado" className="text-xs text-muted-foreground">
                  Código QR
                </label>
                <div className="relative">
                  <QrCode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="qr-prensado"
                    ref={qrInputRef}
                    value={qr}
                    onChange={(e) => setQr(e.target.value)}
                    placeholder="Escanee el código QR de la etiqueta..."
                    className="h-11 pl-10 pr-10 text-base"
                    autoComplete="off"
                    // Si el operador toca el campo tampoco se abre el teclado (ver enfocarSinTeclado).
                    onPointerDown={(e) => {
                      e.currentTarget.readOnly = true;
                    }}
                    onPointerUp={(e) => liberarSoloLectura(e.currentTarget)}
                    onPointerCancel={(e) => liberarSoloLectura(e.currentTarget)}
                    disabled={leyendo || !estacion}
                  />
                  {leyendo && (
                    <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
              </form>
              {conteoOrden && (
                <div className="flex items-center gap-3 rounded-md border bg-card px-4 py-2">
                  <div className="leading-tight">
                    <p className="text-xs text-muted-foreground">Orden</p>
                    <p className="font-mono text-sm font-semibold">{conteoOrden.orden}</p>
                  </div>
                  <div className="h-10 w-px bg-border" />
                  <div className="leading-tight">
                    <p className="text-xs text-muted-foreground">Leídas en esta estación</p>
                    <p className="text-2xl font-bold text-primary">
                      {conteoOrden.leidas}
                      {conteoOrden.impresas !== null && (
                        <span className="text-base font-medium text-muted-foreground">
                          {" "}
                          de {conteoOrden.impresas}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
              <div className="text-right leading-tight">
                <p className="text-xs text-muted-foreground">Estación</p>
                <p
                  className={cn(
                    "text-lg font-bold",
                    estacion ? "text-primary" : "text-destructive"
                  )}
                >
                  {estacion?.nombre_estacion ?? "Estación no encontrada para esta IP."}
                </p>
              </div>
            </div>

            <div className="mt-4">
              {etiquetasLeidas.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1 text-sm font-semibold text-green-700 dark:text-green-300">
                      <CheckCircle2 className="h-4 w-4" />
                      {mensajeLectura}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      QR leído: <span className="font-medium text-foreground">{ultimoQr}</span> ·{" "}
                      {etiquetasLeidas.length} etiqueta(s)
                    </p>
                  </div>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cód. barras</TableHead>
                          <TableHead>Orden</TableHead>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Secuencial</TableHead>
                          <TableHead className="text-right">N° etiqueta</TableHead>
                          <TableHead>Operador</TableHead>
                          <TableHead>Fecha</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {etiquetasLeidas.map((e, i) => (
                          <TableRow key={`${e.codbarras}-${i}`}>
                            <TableCell className="font-mono text-xs">{e.codbarras}</TableCell>
                            <TableCell>{e.orden}</TableCell>
                            <TableCell>{e.CodPedido}</TableCell>
                            <TableCell>{e.producto}</TableCell>
                            <TableCell className="text-right">{e.secuencial}</TableCell>
                            <TableCell className="text-right">{e.netiqueta}</TableCell>
                            <TableCell>{e.operador}</TableCell>
                            <TableCell className="whitespace-nowrap">{e.fecha}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "flex flex-col justify-center items-center gap-1 h-[120px] rounded-md text-center",
                    errorLectura && "border-2 border-red-600 bg-red-50 dark:bg-red-950/40"
                  )}
                >
                  {errorLectura ? (
                    <>
                      <p className="flex items-center gap-2 text-base font-semibold text-red-700 dark:text-red-300">
                        <XCircle className="h-5 w-5" /> {errorLectura}
                      </p>
                      <p className="font-mono text-xs text-red-700/80 dark:text-red-300/80">{ultimoQr}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      {leyendo ? "Consultando etiqueta..." : "Escanee un código QR para consultar la etiqueta."}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4">
              <HistorialLecturasPrensado lecturas={historial} />
            </div>
          </CardContent>
        </Card>
      )}

      <AsignarOperadoresPrensadoDialog
        open={asignarOpen}
        onOpenChange={setAsignarOpen}
        operadores={operadores}
        onConfirmar={confirmarEquipo}
      />

      <AlertDialog open={finalizarOpen} onOpenChange={(v) => !finalizando && setFinalizarOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Finalizar la sesión del equipo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se cerrará la sesión de los {operadores.length} operador(es) en turno en esta estación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Se cierra solo al terminar, para mostrar el error si falla.
                e.preventDefault();
                finalizarSesion();
              }}
              disabled={finalizando}
            >
              {finalizando ? "Finalizando..." : "Finalizar sesión"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

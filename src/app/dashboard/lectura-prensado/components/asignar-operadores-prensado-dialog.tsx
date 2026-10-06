"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRightLeft, Loader2, ScanLine, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/user-context";
import { cn } from "@/lib/utils";
import { authService } from "@/services/authService";
import type { Ficha, OperadorPrensado, RolOperadorPrensado } from "@/types/interfaces";
import { ROLES_OPERADOR_PRENSADO } from "./roles-operador-prensado";
import { sesionesActivas } from "./sesiones-prensado";
import { enfocarSinTeclado } from "./enfocar-sin-teclado";

/** Operador en la lista temporal del modal: el rol puede faltar hasta que se elija. */
type OperadorEnEdicion = Omit<OperadorPrensado, "rol"> & { rol: RolOperadorPrensado | null };

/** Colaborador escaneado que tiene sesión activa en otra estación, a la espera de confirmar el traslado. */
interface TrasladoPendiente {
  ficha: Ficha;
  estaciones: number[];
}

interface AsignarOperadoresPrensadoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Equipo actual; el modal trabaja sobre una copia y solo lo reemplaza al confirmar. */
  operadores: OperadorPrensado[];
  /** Aplica el equipo (inicia/cierra sesiones). Si lanza, el modal queda abierto con el error. */
  onConfirmar: (operadores: OperadorPrensado[]) => Promise<void>;
}

export default function AsignarOperadoresPrensadoDialog({
  open,
  onOpenChange,
  operadores,
  onConfirmar,
}: AsignarOperadoresPrensadoDialogProps) {
  const { toast } = useToast();
  const { user, estaciones } = useUser();
  const [codigo, setCodigo] = useState("");
  const [lista, setLista] = useState<OperadorEnEdicion[]>([]);
  const [buscando, setBuscando] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [traslado, setTraslado] = useState<TrasladoPendiente | null>(null);

  const nombreEstacion = (codigoEstacion: number) =>
    estaciones.find((e) => e.codigo_estacion === codigoEstacion)?.nombre_estacion ??
    `estación ${codigoEstacion}`;
  const inputRef = useRef<HTMLInputElement>(null);

  // El input nunca se bloquea para no perder lecturas en ráfaga; estas refs permiten
  // validar duplicados contra la lista más reciente y contra códigos aún en consulta.
  const listaRef = useRef<OperadorEnEdicion[]>([]);
  const enConsulta = useRef<Set<string>>(new Set());

  const actualizarLista = (fn: (prev: OperadorEnEdicion[]) => OperadorEnEdicion[]) => {
    setLista((prev) => {
      const next = fn(prev);
      listaRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    const copia = operadores.map((o) => ({ ...o }));
    listaRef.current = copia;
    setLista(copia);
    setCodigo("");
  }, [open, operadores]);

  // El operador principal (usuario logueado) entra directo a la lista, sin consultar su
  // código: ya inició sesión al ingresar. Solo falta que elija su rol.
  useEffect(() => {
    if (!open || !user?.code || listaRef.current.some((o) => o.codigo === user.code)) return;
    actualizarLista((prev) => [
      {
        id: user.code,
        codigo: user.code,
        nombre: user.name,
        departamento: user.department ?? "",
        rol: null,
        principal: true,
      },
      ...prev,
    ]);
  }, [open, user?.code, user?.name, user?.department]);

  // Tras tocar un botón (rol, quitar, traslado) el foco vuelve al campo sin abrir el teclado
  // virtual. Si el operador toca el campo para digitar el código, el teclado sí se abre.
  const enfocarInput = () => enfocarSinTeclado(inputRef.current);

  const agregarPorCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    const leido = codigo.trim();
    setCodigo("");
    if (!leido) return;

    if (user?.code === leido) {
      toast({
        title: "Operador principal",
        description: `${user.name} ya está en el equipo por haber iniciado sesión.`,
      });
      return;
    }

    if (enConsulta.current.has(leido) || listaRef.current.some((o) => o.codigo === leido)) {
      toast({
        title: "Colaborador duplicado",
        description: `El código ${leido} ya está en la lista.`,
        variant: "destructive",
      });
      return;
    }

    enConsulta.current.add(leido);
    setBuscando((n) => n + 1);
    try {
      const response = await authService.loginColaborador(leido);
      const ficha: Ficha | undefined = response?.user?.ficha;
      if (!ficha?.CODIGO || !ficha?.NOMBRE) {
        toast({
          title: "Colaborador no válido",
          description: response?.message || `El código ${leido} no está registrado o está inactivo.`,
          variant: "destructive",
        });
        return;
      }

      // El código que devuelve la ficha puede diferir del leído (ceros a la izquierda, etc.).
      if (listaRef.current.some((o) => o.codigo === ficha.CODIGO)) {
        toast({
          title: "Colaborador duplicado",
          description: `${ficha.NOMBRE} ya está en la lista.`,
          variant: "destructive",
        });
        return;
      }

      // Solo en Prensado: si tiene sesión activa en otra estación se ofrece trasladarlo; la
      // sesión anterior se cierra recién al confirmar el equipo. Se omite para quien ya es del
      // equipo confirmado (su sesión activa es la de este puesto).
      const yaEnEquipo = operadores.some((o) => o.codigo === ficha.CODIGO);
      const sesiones = yaEnEquipo ? [] : await sesionesActivas(ficha.CODIGO);
      if (sesiones.length > 0) {
        setTraslado({
          ficha,
          estaciones: Array.from(new Set(sesiones.map((s) => s.codigo_estacion))),
        });
        return;
      }

      agregarALista(ficha);
    } catch (err) {
      toast({
        title: "Error al buscar colaborador",
        description: err instanceof Error ? err.message : "No se pudo conectar con el servidor.",
        variant: "destructive",
      });
    } finally {
      enConsulta.current.delete(leido);
      setBuscando((n) => n - 1);
    }
  };

  const agregarALista = (ficha: Ficha, trasladoDesde?: number[]) => {
    // Pudo escanearse de nuevo mientras se confirmaba el traslado.
    if (listaRef.current.some((o) => o.codigo === ficha.CODIGO)) return;
    actualizarLista((prev) => [
      ...prev,
      {
        id: ficha.CODIGO,
        codigo: ficha.CODIGO,
        nombre: ficha.NOMBRE,
        departamento: ficha.DEPARTAMENTO ?? "",
        rol: null,
        principal: false,
        ...(trasladoDesde && trasladoDesde.length > 0 ? { trasladoDesde } : {}),
      },
    ]);
  };

  const aceptarTraslado = () => {
    if (traslado) agregarALista(traslado.ficha, traslado.estaciones);
    setTraslado(null);
    enfocarInput();
  };

  const asignarRol = (id: string, rol: RolOperadorPrensado) => {
    actualizarLista((prev) => prev.map((o) => (o.id === id ? { ...o, rol } : o)));
    // Devolver el foco al lector para seguir escaneando sin tocar el mouse.
    enfocarInput();
  };

  const quitar = (id: string) => {
    actualizarLista((prev) => prev.filter((o) => o.id !== id || o.principal));
    enfocarInput();
  };

  const sinRol = lista.filter((o) => o.rol === null).length;
  const puedeConfirmar = lista.length > 0 && sinRol === 0 && buscando === 0 && !guardando;

  const confirmar = async () => {
    if (!puedeConfirmar) return;
    setGuardando(true);
    try {
      await onConfirmar(lista.map((o) => ({ ...o, rol: o.rol as RolOperadorPrensado })));
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Error al iniciar las sesiones",
        description: err instanceof Error ? err.message : "No se pudo registrar el equipo.",
        variant: "destructive",
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !guardando && onOpenChange(v)}>
      <DialogContent
        className="sm:max-w-[600px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          enfocarInput();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Equipo de Lectura Prensado
          </DialogTitle>
          <DialogDescription>
            Usted ya forma parte del equipo como operador principal. Escanee el código de cada
            colaborador y asigne a todos su rol en el puesto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={agregarPorCodigo} className="flex flex-col gap-1">
          <Label htmlFor="codigoOperadorPrensado">Código de empleado</Label>
          <div className="relative">
            <ScanLine className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="codigoOperadorPrensado"
              ref={inputRef}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Escanee o digite el código y presione Enter"
              autoComplete="off"
              className="pl-8 pr-8"
            />
            {buscando > 0 && (
              <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </form>

        <div className="border rounded-md">
          {lista.length === 0 ? (
            <div className="flex justify-center items-center h-[120px] p-4">
              <p className="text-muted-foreground text-sm">Aún no hay colaboradores en la lista.</p>
            </div>
          ) : (
            <div className="max-h-[45vh] overflow-y-auto">
              <ul className="divide-y">
                {lista.map((o) => (
                  <li
                    key={o.id}
                    className={cn(
                      "flex flex-wrap items-center gap-3 px-3 py-2",
                      o.rol === null && "bg-destructive/5"
                    )}
                  >
                    <div className="flex-1 min-w-[160px]">
                      <p className="text-sm font-medium leading-tight">{o.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.codigo}
                        {o.principal && <span className="font-medium text-primary"> · Principal</span>}
                        {o.trasladoDesde && (
                          <span className="font-medium text-amber-600">
                            {" "}
                            · Viene de {o.trasladoDesde.map(nombreEstacion).join(", ")}
                          </span>
                        )}
                      </p>
                    </div>
                    <div
                      role="radiogroup"
                      aria-label={`Rol de ${o.nombre}`}
                      className="flex gap-1"
                    >
                      {ROLES_OPERADOR_PRENSADO.map((r) => {
                        const activo = o.rol === r.valor;
                        return (
                          <Button
                            key={r.valor}
                            type="button"
                            size="sm"
                            variant="outline"
                            role="radio"
                            aria-checked={activo}
                            onClick={() => asignarRol(o.id, r.valor)}
                            className={cn("h-8 min-w-[96px]", activo && r.activo)}
                          >
                            {r.label}
                          </Button>
                        );
                      })}
                    </div>
                    {o.principal ? (
                      // Mismo ancho que el botón de quitar, para que los roles queden alineados.
                      <span className="h-8 w-8" aria-hidden />
                    ) : (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => quitar(o.id)}
                        aria-label={`Quitar a ${o.nombre}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {lista.length} colaborador{lista.length === 1 ? "" : "es"}
            {sinRol > 0 && (
              <span className="text-destructive"> · {sinRol} sin rol asignado</span>
            )}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={confirmar} disabled={!puedeConfirmar} className="gap-2">
              {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
              {guardando ? "Iniciando sesiones..." : "Confirmar e iniciar sesión"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog
        open={traslado !== null}
        onOpenChange={(v) => {
          if (!v) {
            setTraslado(null);
            enfocarInput();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" /> Colaborador con sesión activa
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{traslado?.ficha.NOMBRE}</span> tiene una
              sesión activa en{" "}
              <span className="font-medium text-foreground">
                {traslado?.estaciones.map(nombreEstacion).join(", ")}
              </span>
              . ¿Desea cerrar esa sesión e iniciarla en esta estación? La sesión anterior se cierra
              al confirmar el equipo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={aceptarTraslado}>Trasladar a esta estación</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

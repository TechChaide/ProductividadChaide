"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, ChevronDown, Loader2, ScanLine, Warehouse } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/user-context";
import { cn } from "@/lib/utils";
import { ingresosService } from "@/services/ingresos.service";
import { servicioService } from "@/services/servicio.service";
import type {
  Ingreso,
  OrdenProduccion,
  MaterialPivoteado,
} from "@/types/interfaces";
import type { Order } from "@/types/order";
import OrdersTable from "@/components/orders-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SCAN_IDLE_MS = 450;

function stripLeadingZeros(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.replace(/^0+/, "") || "0";
}

/** Omite filas pivote cuyo texto incluya PTBO (p.ej. descripción FERT). */
function incluyePtbo(p: MaterialPivoteado): boolean {
  const campos = [
    p.FERT_PRINCIPAL,
    p.DESCRIPCION_FERT,
    p.MATERIAL_PADRE,
    p.DESCRIPCION_PADRE,
    p.COMPONENTE,
    p.DESCRIPCION_COMPONENTE,
  ];
  return campos.some((c) =>
    String(c ?? "")
      .toUpperCase()
      .includes("PTBO")
  );
}

function filtrarSinPtbo(list: MaterialPivoteado[]): MaterialPivoteado[] {
  return list.filter((p) => !incluyePtbo(p));
}

type ArbolNodo = {
  codigo: string;
  descripcion: string;
  nivel: number | null;
  esFert: boolean;
  esMaterialPistoleado: boolean;
  /** Hijo colateral (no está en la ruta al material). */
  esHermano?: boolean;
  children: ArbolNodo[];
};

type PasoSubida = {
  codigo: string;
  descripcion: string;
  /** NIVEL de la fila donde este código aparece como COMPONENTE. */
  nivel: number | null;
  padre: string | null;
  descripcionPadre: string;
};

/**
 * Recorrido del cubo:
 * 1) Busca el material como COMPONENTE (usa NIVEL de esa fila).
 * 2) Toma MATERIAL_PADRE.
 * 3) Busca ese padre como COMPONENTE en otra fila.
 * 4) Si al consultar el padre la respuesta es vacía → preguntar si el
 *    componente actual coincide con FERT_PRINCIPAL (llegamos a la raíz).
 * 5) Repite hasta llegar al FERT.
 */
function subirHastaFert(
  rows: MaterialPivoteado[],
  materialInicio: string,
  fert: string
): { pasos: PasoSubida[]; completa: boolean } {
  const start = stripLeadingZeros(materialInicio);
  const fertKey = stripLeadingZeros(fert);
  const pasos: PasoSubida[] = [];
  const vistos = new Set<string>();

  let actual = start;

  const descFert = () =>
    String(rows[0]?.DESCRIPCION_FERT ?? "").trim();

  const cerrarEnFert = (completa: boolean) => {
    if (pasos.length === 0 || pasos[pasos.length - 1]?.codigo !== fertKey) {
      pasos.push({
        codigo: fertKey,
        descripcion: descFert(),
        nivel: 0,
        padre: null,
        descripcionPadre: "",
      });
    }
    return { pasos, completa };
  };

  while (actual && !vistos.has(actual)) {
    vistos.add(actual);

    // ¿El nodo actual ya es el FERT?
    if (actual === fertKey) {
      pasos.push({
        codigo: actual,
        descripcion: descFert(),
        nivel: 0,
        padre: null,
        descripcionPadre: "",
      });
      return { pasos, completa: true };
    }

    // Busca la fila donde ESTE código es el COMPONENTE
    const fila = rows.find(
      (r) => stripLeadingZeros(String(r.COMPONENTE ?? "")) === actual
    );

    // Respuesta vacía al consultar el componente como hijo
    if (!fila) {
      // Condición extra: ¿el componente que consultamos coincide con FERT?
      if (actual === fertKey) {
        return cerrarEnFert(true);
      }
      // No es FERT y no hay fila → no se puede seguir subiendo
      return cerrarEnFert(false);
    }

    const padreRaw = String(fila.MATERIAL_PADRE ?? "").trim();
    const padre = stripLeadingZeros(padreRaw);
    const nivel = Number(fila.NIVEL) || null;

    pasos.push({
      codigo: actual,
      descripcion: String(fila.DESCRIPCION_COMPONENTE ?? "").trim(),
      nivel,
      padre: padre || null,
      descripcionPadre: String(fila.DESCRIPCION_PADRE ?? "").trim(),
    });

    // Padre vacío → preguntar si el componente actual es el FERT
    if (!padreRaw || !padre) {
      if (actual === fertKey) {
        return { pasos, completa: true };
      }
      // El padre vacío a veces significa que el padre lógico es el FERT
      // (MATERIAL_PADRE en blanco pero FERT_PRINCIPAL de la fila = fert)
      const fertDeFila = stripLeadingZeros(String(fila.FERT_PRINCIPAL ?? ""));
      if (fertDeFila === fertKey || actual === fertKey) {
        return cerrarEnFert(true);
      }
      return cerrarEnFert(false);
    }

    // El padre es directamente el FERT
    if (padre === fertKey) {
      return cerrarEnFert(true);
    }

    // Siguiente eslabón: buscar este padre como COMPONENTE
    actual = padre;
  }

  return cerrarEnFert(pasos.some((p) => p.codigo === fertKey));
}

/** Hermanos = otros COMPONENTE del mismo MATERIAL_PADRE en el mismo NIVEL. */
function hermanosDelNodo(
  rows: MaterialPivoteado[],
  codigo: string,
  padre: string | null,
  nivel: number | null,
  excluir: Set<string>
): ArbolNodo[] {
  if (!padre) return [];
  const out: ArbolNodo[] = [];
  const seen = new Set<string>();

  for (const r of rows) {
    const p = stripLeadingZeros(String(r.MATERIAL_PADRE ?? ""));
    const c = stripLeadingZeros(String(r.COMPONENTE ?? ""));
    const n = Number(r.NIVEL) || null;
    if (p !== padre) continue;
    if (nivel != null && n != null && n !== nivel) continue;
    if (!c || c === codigo || excluir.has(c) || seen.has(c)) continue;
    seen.add(c);
    out.push({
      codigo: c,
      descripcion: String(r.DESCRIPCION_COMPONENTE ?? "").trim(),
      nivel: n,
      esFert: false,
      esMaterialPistoleado: false,
      esHermano: true,
      children: [],
    });
  }

  return out.sort((a, b) => a.codigo.localeCompare(b.codigo));
}

/**
 * Árbol visual armado SUBIENDO desde la tela:
 * tela → padre (nivel N) → padre (nivel N-1) → … → FERT
 * Luego se invierte para dibujar FERT arriba.
 */
function construirArbolesBom(
  pivotes: MaterialPivoteado[],
  materialInicio: string
): ArbolNodo[] {
  const start = stripLeadingZeros(materialInicio);
  if (!start || pivotes.length === 0) return [];

  const byFert = new Map<string, MaterialPivoteado[]>();
  for (const p of pivotes) {
    const fert = stripLeadingZeros(String(p.FERT_PRINCIPAL ?? ""));
    if (!fert) continue;
    const list = byFert.get(fert) ?? [];
    list.push(p);
    byFert.set(fert, list);
  }

  const arboles: ArbolNodo[] = [];

  for (const [fert, rows] of byFert) {
    // ¿La tela aparece como COMPONENTE en alguna fila de este FERT?
    const apareceComoComponente = rows.some(
      (r) => stripLeadingZeros(String(r.COMPONENTE ?? "")) === start
    );
    if (!apareceComoComponente && start !== fert) {
      continue;
    }

    const { pasos } = subirHastaFert(rows, start, fert);
    if (pasos.length === 0) continue;

    // pasos: [tela, ..., FERT] → invertir para dibujar FERT arriba
    const haciaAbajo = [...pasos].reverse();
    const enRuta = new Set(haciaAbajo.map((p) => p.codigo));

    let root: ArbolNodo | null = null;
    let cursor: ArbolNodo | null = null;

    for (let i = 0; i < haciaAbajo.length; i++) {
      const paso = haciaAbajo[i];
      const esFert = paso.codigo === fert;
      const esMaterial = paso.codigo === start;

      const nodo: ArbolNodo = {
        codigo: paso.codigo,
        descripcion:
          paso.descripcion ||
          (esFert
            ? String(rows[0]?.DESCRIPCION_FERT ?? "").trim()
            : esMaterial
              ? "Material pistoleado"
              : ""),
        nivel: paso.nivel,
        esFert,
        esMaterialPistoleado: esMaterial,
        children: [],
      };

      if (!root) {
        root = nodo;
        cursor = nodo;
        continue;
      }

      if (!cursor) break;

      // Hermanos = otros COMPONENTE del mismo padre (cursor) en ese nivel
      const hermanosDelHijo = hermanosDelNodo(
        rows,
        nodo.codigo,
        cursor.codigo,
        nodo.nivel,
        enRuta
      ).slice(0, 12);

      cursor.children = [nodo, ...hermanosDelHijo].sort((a, b) => {
        if (a.esMaterialPistoleado !== b.esMaterialPistoleado) {
          return a.esMaterialPistoleado ? 1 : -1;
        }
        if (!!a.esHermano !== !!b.esHermano) return a.esHermano ? 1 : -1;
        return a.codigo.localeCompare(b.codigo);
      });
      cursor = nodo;
    }

    if (root) arboles.push(root);
  }

  return arboles.sort((a, b) => a.codigo.localeCompare(b.codigo));
}

function NodoBomCard({ nodo }: { nodo: ArbolNodo }) {
  return (
    <div
      className={cn(
        "relative z-[1] min-w-[140px] max-w-[200px] rounded-lg border-2 bg-card px-3 py-2 shadow-md text-center",
        nodo.esFert &&
          "border-green-500 bg-green-50 dark:bg-green-950/40 shadow-green-500/10",
        nodo.esMaterialPistoleado &&
          "border-primary bg-primary/5 shadow-primary/15 ring-2 ring-primary/30",
        nodo.esHermano && "border-dashed border-muted-foreground/40 opacity-70 shadow-sm",
        !nodo.esFert &&
          !nodo.esMaterialPistoleado &&
          !nodo.esHermano &&
          "border-border"
      )}
    >
      <div className="flex flex-wrap items-center justify-center gap-1 mb-1">
        {nodo.esFert && (
          <Badge className="h-4 text-[9px] px-1 bg-green-600 hover:bg-green-600">
            FERT
          </Badge>
        )}
        {nodo.esMaterialPistoleado && (
          <Badge className="h-4 text-[9px] px-1">Pistoleado</Badge>
        )}
        {nodo.esHermano && (
          <Badge variant="outline" className="h-4 text-[9px] px-1">
            colateral
          </Badge>
        )}
        {nodo.nivel != null && nodo.nivel > 0 && (
          <span className="text-[9px] text-muted-foreground">N{nodo.nivel}</span>
        )}
      </div>
      <p
        className={cn(
          "font-mono text-xs font-bold break-all",
          nodo.esFert && "text-green-700 dark:text-green-400",
          nodo.esMaterialPistoleado && "text-primary"
        )}
      >
        {nodo.codigo}
      </p>
      {nodo.descripcion ? (
        <p
          className="mt-1 text-[10px] leading-snug text-muted-foreground line-clamp-2"
          title={nodo.descripcion}
        >
          {nodo.descripcion}
        </p>
      ) : null}
    </div>
  );
}

/** Árbol visual real: cajas-nodo + líneas (FERT arriba → material abajo). */
function ArbolBomNodoView({ nodo }: { nodo: ArbolNodo }) {
  const hijos = nodo.children;
  const tieneHijos = hijos.length > 0;

  return (
    <div className="flex flex-col items-center">
      <NodoBomCard nodo={nodo} />

      {tieneHijos && (
        <>
          <div className="w-0.5 h-4 bg-slate-400 dark:bg-slate-500 shrink-0" />
          <div className="flex flex-row items-start">
            {hijos.map((child, idx) => {
              const esPrimero = idx === 0;
              const esUltimo = idx === hijos.length - 1;
              const varios = hijos.length > 1;

              return (
                <div
                  key={`${nodo.codigo}-${child.codigo}-${idx}`}
                  className="flex flex-col items-center relative px-3"
                >
                  {/* Tramo horizontal + bajada al hijo */}
                  <div className="relative h-4 w-full flex justify-center">
                    {varios && !esPrimero && (
                      <div className="absolute top-0 left-0 right-1/2 h-0.5 bg-slate-400 dark:bg-slate-500" />
                    )}
                    {varios && !esUltimo && (
                      <div className="absolute top-0 left-1/2 right-0 h-0.5 bg-slate-400 dark:bg-slate-500" />
                    )}
                    <div className="w-0.5 h-4 bg-slate-400 dark:bg-slate-500" />
                  </div>
                  <ArbolBomNodoView nodo={child} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function extraerLetraYNombre(estacion: string) {
  const sinPrefijo = estacion.replace(/^EST-/, "");
  const letraMatch = sinPrefijo.match(/^([A-Z])-(.+)$/);
  let letra: string | null = null;
  let nombreLimpio = sinPrefijo;
  if (letraMatch) {
    letra = letraMatch[1];
    nombreLimpio = letraMatch[2];
  }
  return { letra, nombreLimpio };
}

function formatNumber(num: number) {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function mapOrdenProduccion(item: OrdenProduccion): Order {
  return {
    id: item.Orden,
    material: item.Material,
    orden: item.Orden,
    fecha: item.Fecha,
    descripcionMaterial: item.Nombre,
    cantProgramada: item.CantProgramada,
    cantNotificada: item.CantNotificada,
    cantPendiente: item.CantProgramada - item.CantNotificada,
    acolchadora: item.Estacion,
    resp_ctrl_prod: item.RespCtrlProd,
    maquina: item.Maquina,
  };
}

export default function AsociacionOrdenes2Content() {
  const { toast } = useToast();
  const {
    user,
    estaciones,
    isLoading: isUserContextLoading,
  } = useUser();

  const scanInputRef = useRef<HTMLInputElement>(null);
  const autoEnterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedOrdersRef = useRef<Order[]>([]);

  const [scanBuffer, setScanBuffer] = useState("");
  const [isResolvingQr, setIsResolvingQr] = useState(false);
  const [scanPanelOpen, setScanPanelOpen] = useState(true);
  const [selectedIngreso, setSelectedIngreso] = useState<Ingreso | null>(null);
  const [pivotesMaterial, setPivotesMaterial] = useState<MaterialPivoteado[]>(
    []
  );
  const [fertPermitidos, setFertPermitidos] = useState<Set<string>>(new Set());

  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isLoadingOrdenes, setIsLoadingOrdenes] = useState(true);
  const [errorOrdenes, setErrorOrdenes] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Order[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>("all");

  const [cantidadEstimada, setCantidadEstimada] = useState("");
  const [cantidadUtilizada, setCantidadUtilizada] = useState("");
  const [cantidadDesperdicio, setCantidadDesperdicio] = useState("");

  useEffect(() => {
    selectedOrdersRef.current = selectedOrders;
  }, [selectedOrders]);

  const userStation = useMemo(() => {
    if (
      isUserContextLoading ||
      !user?.ip_address ||
      !estaciones ||
      estaciones.length === 0
    ) {
      return null;
    }
    return estaciones.find((e) => e.direccion_ip === user.ip_address) ?? null;
  }, [user?.ip_address, estaciones, isUserContextLoading]);

  const stationLetter = useMemo(() => {
    if (userStation?.nombre_estacion?.includes("EST-")) {
      const { letra } = extraerLetraYNombre(userStation.nombre_estacion);
      return letra || null;
    }
    return null;
  }, [userStation]);

  const userMachines = useMemo(() => {
    if (!user?.machine) return [];
    const machines = user.machine
      .split("&")
      .map((m) => m.trim())
      .filter(Boolean);
    return [...new Set(machines)];
  }, [user?.machine]);

  const NOTIFICA_SAP = !!userStation?.notifica;

  const userStationNameText = useMemo(() => {
    if (isUserContextLoading) return "Cargando Estación...";
    if (userStation?.nombre_estacion?.includes("EST-")) {
      return extraerLetraYNombre(userStation.nombre_estacion).nombreLimpio;
    }
    if (userStation) return userStation.nombre_estacion;
    return "Estación no encontrada para esta IP.";
  }, [userStation, isUserContextLoading]);

  const filtrarPorEstacion = useCallback(
    (list: Order[]): Order[] => {
      let filtered = list;

      if (stationLetter) {
        const letter = stationLetter.toUpperCase();
        filtered = filtered.filter((order) => {
          const acol = (order.acolchadora || "").toString().toUpperCase();
          const maq = (order.maquina || "").toString().toUpperCase();
          return (
            acol === letter ||
            maq === letter ||
            acol.includes(letter) ||
            maq.includes(letter)
          );
        });
      }

      return filtered.filter(
        (order, idx, self) =>
          idx === self.findIndex((o) => o.orden === order.orden)
      );
    },
    [stationLetter]
  );

  const cargarOrdenes = useCallback(
    async (isInitialFetch = false) => {
      if (isUserContextLoading) return;

      if (isInitialFetch) setIsLoadingOrdenes(true);
      setErrorOrdenes(null);

      if (!user || !user.resp_ctrl_prod) {
        setAllOrders([]);
        setErrorOrdenes("Falta información del usuario o responsable.");
        if (isInitialFetch) setIsLoadingOrdenes(false);
        return;
      }

      if (user.code === "admin") {
        setAllOrders([]);
        if (isInitialFetch) setIsLoadingOrdenes(false);
        return;
      }

      try {
        const machineToFetch =
          selectedMachine === "all" ? user.machine || "" : selectedMachine;

        const response = await servicioService.getOrdenes({
          maquinas: machineToFetch,
          usuarios: user.resp_ctrl_prod || "",
        });

        const mapped = (response.data || []).map(mapOrdenProduccion);
        const filtered = filtrarPorEstacion(mapped);
        setAllOrders(filtered);

        setSelectedOrders((prev) =>
          prev.filter((sel) => filtered.some((o) => o.orden === sel.orden))
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las órdenes.";
        setErrorOrdenes(message);
        setAllOrders([]);
        if (isInitialFetch) {
          toast({
            title: "Error al cargar órdenes",
            description: message,
            variant: "destructive",
          });
        }
      } finally {
        if (isInitialFetch) setIsLoadingOrdenes(false);
      }
    },
    [filtrarPorEstacion, isUserContextLoading, selectedMachine, toast, user]
  );

  useEffect(() => {
    if (isUserContextLoading) return;
    void cargarOrdenes(true);
  }, [cargarOrdenes, isUserContextLoading]);

  /** Órdenes cuyo material coincide con algún FERT_PRINCIPAL del pivote (sin ceros). */
  const orders = useMemo(() => {
    if (!selectedIngreso || fertPermitidos.size === 0) return [];
    return allOrders.filter((o) =>
      fertPermitidos.has(stripLeadingZeros(String(o.material ?? "")))
    );
  }, [allOrders, fertPermitidos, selectedIngreso]);

  useEffect(() => {
    setSelectedOrders((prev) =>
      prev.filter((sel) => orders.some((o) => o.orden === sel.orden))
    );
  }, [orders]);

  const selectedOrderIds = useMemo(
    () => selectedOrders.map((o) => o.orden),
    [selectedOrders]
  );

  const filasDetalleSeleccion = useMemo(() => {
    const rows: Array<{
      orden: string;
      materialPadre: string;
      descripcionPadre: string;
      componente: string;
      descripcionComponente: string;
      cantidadAcumulada: number;
      cantidadNecesaria: number;
      fertPrincipal: string;
      descripcionFert: string;
    }> = [];

    for (const order of selectedOrders) {
      const matOrden = stripLeadingZeros(String(order.material ?? ""));
      const matches = pivotesMaterial.filter(
        (p) => stripLeadingZeros(String(p.FERT_PRINCIPAL ?? "")) === matOrden
      );
      const seen = new Set<string>();
      const pendiente = Number(order.cantPendiente) || 0;

      for (const m of matches) {
        const key =
          stripLeadingZeros(String(m.COMPONENTE ?? "")) ||
          stripLeadingZeros(String(m.MATERIAL_PADRE ?? "")) ||
          `${m.NIVEL}-${m.FERT_PRINCIPAL}`;
        if (!key || seen.has(key)) continue;
        seen.add(key);

        const cantidadAcumulada = Number(m.CANTIDAD_ACUMULADA) || 0;
        rows.push({
          orden: order.orden,
          materialPadre: String(m.MATERIAL_PADRE ?? ""),
          descripcionPadre: String(m.DESCRIPCION_PADRE ?? ""),
          componente: String(m.COMPONENTE ?? ""),
          descripcionComponente: String(m.DESCRIPCION_COMPONENTE ?? ""),
          cantidadAcumulada,
          cantidadNecesaria: pendiente * cantidadAcumulada,
          fertPrincipal: String(m.FERT_PRINCIPAL ?? ""),
          descripcionFert: String(m.DESCRIPCION_FERT ?? ""),
        });
      }

      // Si no hay fila pivote concreta, al menos muestra la orden con factor 0
      if (matches.length === 0) {
        rows.push({
          orden: order.orden,
          materialPadre: String(order.material ?? ""),
          descripcionPadre: String(order.descripcionMaterial ?? ""),
          componente: selectedIngreso?.codigo_material ?? "",
          descripcionComponente: "—",
          cantidadAcumulada: 0,
          cantidadNecesaria: 0,
          fertPrincipal: String(order.material ?? ""),
          descripcionFert: String(order.descripcionMaterial ?? ""),
        });
      }
    }

    return rows;
  }, [selectedOrders, pivotesMaterial, selectedIngreso]);

  const cantidadNecesaria = useMemo(
    () =>
      filasDetalleSeleccion.reduce((acc, row) => acc + row.cantidadNecesaria, 0),
    [filasDetalleSeleccion]
  );

  useEffect(() => {
    if (cantidadNecesaria > 0) {
      setCantidadUtilizada(String(Number(cantidadNecesaria.toFixed(4))));
    } else if (!selectedOrders.length) {
      setCantidadUtilizada("");
    }
  }, [cantidadNecesaria, selectedOrders.length]);

  const cabeceraMovimiento = useMemo(
    () => ({
      cantidad_estimada: Number(cantidadEstimada) || 0,
      cantidad_desperdicio: Number(cantidadDesperdicio) || 0,
      cantidad_movimiento: String(Number(cantidadUtilizada) || 0),
    }),
    [cantidadEstimada, cantidadDesperdicio, cantidadUtilizada]
  );

  const detallesConsumoPorOrden = useMemo(() => {
    const porOrden = new Map<string, { orden: string; factorBom: number }>();

    for (const row of filasDetalleSeleccion) {
      const prev = porOrden.get(row.orden);
      if (prev) {
        prev.factorBom += row.cantidadNecesaria;
      } else {
        porOrden.set(row.orden, {
          orden: row.orden,
          factorBom: row.cantidadNecesaria,
        });
      }
    }

    const utilizadaTotal = Number(cantidadUtilizada) || 0;
    const bomTotal = cantidadNecesaria;
    const n = Math.max(porOrden.size, 1);

    return Array.from(porOrden.values()).map((item) => {
      const peso = bomTotal > 0 ? item.factorBom / bomTotal : 1 / n;
      return {
        orden: item.orden,
        cantidad_utilizada: utilizadaTotal * peso,
      };
    });
  }, [filasDetalleSeleccion, cantidadUtilizada, cantidadNecesaria]);

  const parseDecimalInput = (val: string, setter: (v: string) => void) => {
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setter(val);
    }
  };

  /** Pivotes agrupados por NIVEL para subcards (sin PTBO). */
  const pivotesPorNivel = useMemo(() => {
    const map = new Map<number, MaterialPivoteado[]>();
    for (const p of filtrarSinPtbo(pivotesMaterial)) {
      const nivel = Number(p.NIVEL) || 0;
      const list = map.get(nivel) ?? [];
      list.push(p);
      map.set(nivel, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [pivotesMaterial]);

  /** Árboles FERT → … → material pistoleado. */
  const arbolesBom = useMemo(() => {
    if (!selectedIngreso?.codigo_material) return [];
    return construirArbolesBom(
      filtrarSinPtbo(pivotesMaterial),
      selectedIngreso.codigo_material
    );
  }, [pivotesMaterial, selectedIngreso]);

  const resetSeleccionMaterial = useCallback(() => {
    setSelectedIngreso(null);
    setPivotesMaterial([]);
    setFertPermitidos(new Set());
    setSelectedOrders([]);
    selectedOrdersRef.current = [];
    setCantidadEstimada("");
    setCantidadUtilizada("");
    setCantidadDesperdicio("");
    setScanPanelOpen(true);
  }, []);

  const resolverQr = useCallback(
    async (rawCodigo: string) => {
      const codigo = String(rawCodigo ?? "").trim();
      if (!codigo || isResolvingQr) return;

      setIsResolvingQr(true);
      try {
        const ingresoRes = await ingresosService.getByQR(codigo);
        const ingreso = (ingresoRes.data || [])[0];

        if (!ingreso) {
          resetSeleccionMaterial();
          toast({
            title: "QR no registrado",
            description:
              "No hay un ingreso activo con ese QR. Regístralo primero en Ingresos.",
            variant: "destructive",
          });
          return;
        }

        const codigoMaterial = String(ingreso.codigo_material ?? "").trim();
        if (!codigoMaterial) {
          resetSeleccionMaterial();
          toast({
            title: "Sin material",
            description: "El ingreso no tiene código de material.",
            variant: "destructive",
          });
          return;
        }

        const pivotRes =
          await servicioService.getMaterialesPivotPorMaterial(codigoMaterial);
        const pivotes = filtrarSinPtbo(pivotRes.data || []);

        if (pivotes.length === 0) {
          resetSeleccionMaterial();
          setSelectedIngreso(ingreso);
          toast({
            title: "Sin FERT asociados",
            description: `El material ${codigoMaterial} no tiene FERT válidos (se omitieron PTBO).`,
            variant: "destructive",
          });
          return;
        }

        const ferts = new Set<string>();
        for (const p of pivotes) {
          const fert = stripLeadingZeros(String(p.FERT_PRINCIPAL ?? ""));
          if (fert) ferts.add(fert);
        }

        setSelectedIngreso(ingreso);
        setPivotesMaterial(pivotes);
        setFertPermitidos(ferts);
        setSelectedOrders([]);
        selectedOrdersRef.current = [];
        setScanBuffer("");
        setScanPanelOpen(true);

        toast({
          title: "Material listo",
          description: `${codigoMaterial} · ${ferts.size} FERT · filtra órdenes compatibles.`,
        });
      } catch (error) {
        resetSeleccionMaterial();
        toast({
          title: "Error al resolver QR",
          description:
            error instanceof Error ? error.message : "No se pudo procesar el QR.",
          variant: "destructive",
        });
      } finally {
        setIsResolvingQr(false);
        scanInputRef.current?.focus();
      }
    },
    [isResolvingQr, resetSeleccionMaterial, toast]
  );

  const scheduleAutoEnter = useCallback(
    (value: string) => {
      if (autoEnterTimerRef.current) {
        clearTimeout(autoEnterTimerRef.current);
      }
      autoEnterTimerRef.current = setTimeout(() => {
        const codigo = value.trim();
        if (codigo.length >= 4) {
          void resolverQr(codigo);
        }
      }, SCAN_IDLE_MS);
    },
    [resolverQr]
  );

  useEffect(() => {
    return () => {
      if (autoEnterTimerRef.current) clearTimeout(autoEnterTimerRef.current);
    };
  }, []);

  const handleOrderToggle = useCallback((order: Order) => {
    const already = selectedOrdersRef.current.some(
      (o) => o.orden === order.orden
    );

    if (already) {
      selectedOrdersRef.current = selectedOrdersRef.current.filter(
        (o) => o.orden !== order.orden
      );
      setSelectedOrders((prev) => prev.filter((o) => o.orden !== order.orden));
      return;
    }

    selectedOrdersRef.current = [...selectedOrdersRef.current, order];
    setSelectedOrders((prev) =>
      prev.some((o) => o.orden === order.orden) ? prev : [...prev, order]
    );
  }, []);

  const canAsociar =
    selectedOrders.length > 0 &&
    !!selectedIngreso &&
    cantidadEstimada.trim() !== "" &&
    !Number.isNaN(Number(cantidadEstimada)) &&
    cantidadUtilizada.trim() !== "" &&
    !Number.isNaN(Number(cantidadUtilizada)) &&
    cantidadDesperdicio.trim() !== "" &&
    !Number.isNaN(Number(cantidadDesperdicio));

  const handleAsociar = () => {
    if (!canAsociar || !selectedIngreso || selectedOrders.length === 0) return;

    toast({
      title: "Asociación lista (pendiente de guardar)",
      description: `QR ${selectedIngreso.qr_bmp} · mat. ${selectedIngreso.codigo_material} · est. ${cabeceraMovimiento.cantidad_estimada} · util. ${cabeceraMovimiento.cantidad_movimiento} · desp. ${cabeceraMovimiento.cantidad_desperdicio} · ${detallesConsumoPorOrden.length} detalle(s).`,
    });
  };

  const ordersError =
    errorOrdenes ||
    (!selectedIngreso
      ? "Pistolea el QR del material para ver las órdenes compatibles."
      : fertPermitidos.size === 0
        ? "El material no tiene FERT en el pivote."
        : orders.length === 0 && !isLoadingOrdenes
          ? "No hay órdenes de estación cuyo material coincida con los FERT de esta tela."
          : null);

  return (
    <div className="flex flex-col h-full gap-4 m-px">
      {/* 1. Pistoleo QR + pivotes por nivel (expandible) */}
      <Collapsible open={scanPanelOpen} onOpenChange={setScanPanelOpen}>
        <Card className="shadow-lg border-primary/30">
          <CardHeader className="py-3 px-4">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left rounded-md hover:bg-muted/40 -mx-1 px-1 py-1"
              >
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base font-bold text-primary flex items-center gap-2">
                    <ScanLine className="h-4 w-4 shrink-0" />
                    Material / QR
                    {selectedIngreso && (
                      <span className="text-sm font-normal text-muted-foreground truncate">
                        · {selectedIngreso.codigo_material} ·{" "}
                        {fertPermitidos.size} FERT · {pivotesPorNivel.length}{" "}
                        nivel(es)
                      </span>
                    )}
                  </CardTitle>
                  {!selectedIngreso && (
                    <CardDescription className="mt-0.5">
                      Pistolea el QR para cargar los FERT por nivel.
                    </CardDescription>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
                    scanPanelOpen && "rotate-180"
                  )}
                />
              </button>
            </CollapsibleTrigger>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[240px] space-y-1.5">
                  <Label
                    htmlFor="scanQrMaterial"
                    className="flex items-center gap-2 text-primary font-semibold"
                  >
                    Pistolear QR del material
                  </Label>
                  <Input
                    ref={scanInputRef}
                    id="scanQrMaterial"
                    value={scanBuffer}
                    onChange={(e) => {
                      const val = e.target.value;
                      setScanBuffer(val);
                      scheduleAutoEnter(val);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (autoEnterTimerRef.current) {
                          clearTimeout(autoEnterTimerRef.current);
                        }
                        void resolverQr(scanBuffer);
                      }
                    }}
                    placeholder="Escanea o pega el código QR..."
                    className="h-12 text-lg font-mono"
                    disabled={isResolvingQr}
                    autoFocus
                  />
                </div>
                <Button
                  type="button"
                  className="h-12"
                  onClick={() => void resolverQr(scanBuffer)}
                  disabled={isResolvingQr || !scanBuffer.trim()}
                >
                  {isResolvingQr ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    "Buscar"
                  )}
                </Button>
                {selectedIngreso && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12"
                    onClick={resetSeleccionMaterial}
                  >
                    Limpiar
                  </Button>
                )}
              </div>

              {selectedIngreso && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="secondary" className="font-mono">
                    Ingreso #{selectedIngreso.codigo_ingreso}
                  </Badge>
                  <Badge variant="outline" className="font-mono">
                    Mat. {selectedIngreso.codigo_material}
                  </Badge>
                  <span className="text-muted-foreground">
                    {selectedIngreso.cantidad} {selectedIngreso.unidades}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-medium text-primary">
                    {fertPermitidos.size} FERT · {pivotesMaterial.length} filas
                  </span>
                </div>
              )}

              {arbolesBom.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-primary">
                        Árbol de nodos ({arbolesBom.length} FERT)
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Sube por el cubo: tela (COMPONENTE) → MATERIAL_PADRE →
                        buscar ese padre como COMPONENTE → … → FERT. Scroll ↕ ↔
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      ↕ ↔ scroll
                    </span>
                  </div>
                  <div
                    className="h-[480px] w-full overflow-auto rounded-md border bg-slate-50/80 dark:bg-slate-950/40"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    <div className="inline-block min-w-full p-8 space-y-12">
                      {arbolesBom.map((arbol) => (
                        <div
                          key={arbol.codigo}
                          className="flex flex-col items-center min-w-max mx-auto"
                        >
                          <ArbolBomNodoView nodo={arbol} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {pivotesPorNivel.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-primary">
                    Estructura pivote por nivel
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {pivotesPorNivel.map(([nivel, filas]) => {
                      const fertUnicos = new Set(
                        filas.map((f) =>
                          stripLeadingZeros(String(f.FERT_PRINCIPAL ?? ""))
                        )
                      );
                      return (
                        <Card
                          key={nivel}
                          className="border border-border/80 shadow-sm"
                        >
                          <CardHeader className="py-3 px-3 space-y-1">
                            <CardTitle className="text-sm font-bold flex items-center justify-between gap-2">
                              <span>Nivel {nivel}</span>
                              <Badge variant="outline" className="font-normal">
                                {filas.length} fila
                                {filas.length === 1 ? "" : "s"} ·{" "}
                                {fertUnicos.size} FERT
                              </Badge>
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {filas[0]?.DESCRIPCION_PADRE ||
                                filas[0]?.DESCRIPCION_COMPONENTE ||
                                "—"}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="px-3 pb-3 pt-0">
                            <ScrollArea className="h-[160px] w-full rounded-md border">
                              <Table>
                                <TableHeader className="sticky top-0 bg-card z-10">
                                  <TableRow>
                                    <TableHead className="text-xs">
                                      FERT
                                    </TableHead>
                                    <TableHead className="text-xs">
                                      Descripción
                                    </TableHead>
                                    <TableHead className="text-xs text-right">
                                      Acum.
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {filas.map((fila, idx) => (
                                    <TableRow
                                      key={`${nivel}-${fila.FERT_PRINCIPAL}-${fila.COMPONENTE}-${idx}`}
                                    >
                                      <TableCell className="font-mono text-[11px] whitespace-nowrap py-1.5">
                                        {stripLeadingZeros(
                                          String(fila.FERT_PRINCIPAL ?? "")
                                        )}
                                      </TableCell>
                                      <TableCell className="text-xs max-w-[140px] truncate py-1.5">
                                        {fila.DESCRIPCION_FERT}
                                      </TableCell>
                                      <TableCell className="text-right font-mono text-[11px] py-1.5">
                                        {formatNumber(
                                          Number(fila.CANTIDAD_ACUMULADA) || 0
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 2. Órdenes filtradas por FERT */}
      <div className="flex flex-col gap-4">
        <OrdersTable
          orders={orders}
          isLoading={
            isLoadingOrdenes || isUserContextLoading || isResolvingQr
          }
          error={orders.length === 0 ? ordersError : errorOrdenes}
          multiSelect
          selectedOrderIds={selectedOrderIds}
          onOrderToggle={handleOrderToggle}
          onRefresh={() => cargarOrdenes(false)}
          machines={userMachines}
          selectedMachine={selectedMachine}
          onMachineChange={setSelectedMachine}
          notificaSAP={NOTIFICA_SAP}
        />

        {selectedOrders.length === 0 ? (
          <Card className="shadow-lg w-full flex-1">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-primary flex items-center">
                <FileText className="mr-2 h-5 w-5" /> Detalle de Selección
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-[150px] text-muted-foreground text-center px-4">
                <p>
                  {!selectedIngreso
                    ? "Primero pistolea el QR del material."
                    : "Seleccione una o más órdenes compatibles con esta tela."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-lg w-full transition-all duration-300 ease-in-out flex-1">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-primary flex items-center">
                <FileText className="mr-2 h-5 w-5" /> Órdenes seleccionadas (
                {selectedOrders.length})
              </CardTitle>
              <CardDescription>
                Material pistoleado: {selectedIngreso?.codigo_material} · FERT
                coincidentes sin ceros a la izquierda.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-primary mb-2">
                  Detalle pivote / consumo ({filasDetalleSeleccion.length})
                </h3>
                <ScrollArea className="h-[220px] w-full border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead>Orden</TableHead>
                        <TableHead>FERT</TableHead>
                        <TableHead>Descripción FERT</TableHead>
                        <TableHead>Componente</TableHead>
                        <TableHead className="text-right">
                          Cant. acumulada
                        </TableHead>
                        <TableHead className="text-right">
                          Cantidad necesaria
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filasDetalleSeleccion.map((row, idx) => (
                        <TableRow
                          key={`${row.orden}-${row.componente}-${idx}`}
                        >
                          <TableCell className="font-semibold whitespace-nowrap">
                            {row.orden}
                          </TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {stripLeadingZeros(row.fertPrincipal)}
                          </TableCell>
                          <TableCell className="max-w-[220px]">
                            {row.descripcionFert}
                          </TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {stripLeadingZeros(row.componente)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {formatNumber(row.cantidadAcumulada)}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums text-primary">
                            {formatNumber(row.cantidadNecesaria)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
                <div className="flex items-center justify-end gap-2 pt-3 text-sm text-muted-foreground">
                  <span>Utilizada (BOM) sugerida:</span>
                  <span className="font-bold text-primary tabular-nums">
                    {formatNumber(cantidadNecesaria)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 3. Barra estación + cantidades */}
      <Card className="shadow-lg">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="font-bold text-lg text-foreground">
              {userStationNameText}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {selectedIngreso && (
                <span className="text-xs text-muted-foreground font-medium max-w-[220px] truncate flex items-center gap-1">
                  <Warehouse className="h-3.5 w-3.5" />
                  #{selectedIngreso.codigo_ingreso} ·{" "}
                  {selectedIngreso.codigo_material}
                </span>
              )}
              <div className="flex items-center gap-2 bg-[#0055b8] rounded-sm">
                <Label
                  htmlFor="cantidadEstimada"
                  className="font-semibold text-white px-[5px]"
                >
                  Estimada
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  id="cantidadEstimada"
                  value={cantidadEstimada}
                  onChange={(e) =>
                    parseDecimalInput(e.target.value, setCantidadEstimada)
                  }
                  className="w-24 h-12 text-center text-lg font-bold"
                  placeholder="0"
                  disabled={selectedOrders.length === 0}
                />
              </div>
              <div className="flex items-center gap-2 bg-[#0055b8] rounded-sm">
                <Label
                  htmlFor="cantidadUtilizada"
                  className="font-semibold text-white px-[5px]"
                >
                  Utilizada
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  id="cantidadUtilizada"
                  value={cantidadUtilizada}
                  onChange={(e) =>
                    parseDecimalInput(e.target.value, setCantidadUtilizada)
                  }
                  className="w-24 h-12 text-center text-lg font-bold"
                  placeholder="0"
                  disabled={selectedOrders.length === 0}
                />
              </div>
              <div className="flex items-center gap-2 bg-[#0055b8] rounded-sm">
                <Label
                  htmlFor="cantidadDesperdicio"
                  className="font-semibold text-white px-[5px]"
                >
                  Desperdicio
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  id="cantidadDesperdicio"
                  value={cantidadDesperdicio}
                  onChange={(e) =>
                    parseDecimalInput(e.target.value, setCantidadDesperdicio)
                  }
                  className="w-24 h-12 text-center text-lg font-bold"
                  placeholder="0"
                  disabled={selectedOrders.length === 0}
                />
              </div>
              <Button
                onClick={handleAsociar}
                disabled={!canAsociar}
                className="h-12 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
              >
                Asociar consumo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

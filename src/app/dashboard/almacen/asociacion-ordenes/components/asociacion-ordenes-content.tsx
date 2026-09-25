"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Loader2, ScanLine, Warehouse, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/user-context";
import { cn } from "@/lib/utils";
import { ingresosService } from "@/services/ingresos.service";
import { servicioService } from "@/services/servicio.service";
import { configuracionService } from "@/services/configuracion.service";
import { movimientoService } from "@/services/movimiento.service";
import { detalleMovimientoService } from "@/services/detalleMovimiento.service";
import { formatDateForSQLServer } from "@/lib/integrations/muestreos-ddpp/datetime2";
import type {
  Ingreso,
  OrdenProduccion,
  MaterialPivoteado,
  ElementoTrazableArea,
  Movimiento,
} from "@/types/interfaces";
import type { Order } from "@/types/order";
import OrdersTable from "@/components/orders-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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

/** Sin ceros: componentes tipo tela `400…` (LIKE '400%'). */
function esComponenteTipo400(componente: string): boolean {
  return stripLeadingZeros(componente).startsWith("400");
}

type MatchPivoteTela = {
  ok: boolean;
  filas: MaterialPivoteado[];
  motivo: string;
};

/**
 * 1 registro → COMPONENTE (sin ceros) debe = tela.
 * N registros → filtra componentes 400*, alguno debe = tela.
 */
function matchPivoteConTela(
  pivotes: MaterialPivoteado[],
  tela: string
): MatchPivoteTela {
  const telaKey = stripLeadingZeros(tela);
  if (!telaKey) {
    return { ok: false, filas: [], motivo: "Sin código de tela" };
  }
  if (!pivotes.length) {
    return { ok: false, filas: [], motivo: "SP sin registros" };
  }

  if (pivotes.length === 1) {
    const comp = stripLeadingZeros(String(pivotes[0].COMPONENTE ?? ""));
    if (comp === telaKey) {
      return { ok: true, filas: pivotes, motivo: "Match único" };
    }
    return {
      ok: false,
      filas: [],
      motivo: `Único componente ${comp || "(vacío)"} ≠ tela ${telaKey}`,
    };
  }

  const candidatos = pivotes.filter((p) =>
    esComponenteTipo400(String(p.COMPONENTE ?? ""))
  );
  const match = candidatos.filter(
    (p) => stripLeadingZeros(String(p.COMPONENTE ?? "")) === telaKey
  );

  if (match.length > 0) {
    return {
      ok: true,
      filas: match,
      motivo: `Match entre ${candidatos.length} componente(s) 400*`,
    };
  }

  return {
    ok: false,
    filas: [],
    motivo: candidatos.length
      ? `Ningún componente 400* coincide con tela ${telaKey}`
      : `Sin componentes 400* (${pivotes.length} registros)`,
  };
}

function dedupePorComponente(
  materiales: MaterialPivoteado[]
): MaterialPivoteado[] {
  const seen = new Set<string>();
  const out: MaterialPivoteado[] = [];
  for (const m of materiales) {
    const key =
      stripLeadingZeros(String(m.COMPONENTE ?? "")) ||
      String(m.COMPONENTE ?? "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function filtrarPorCards(
  materiales: MaterialPivoteado[],
  cards: string[]
): MaterialPivoteado[] {
  if (!cards.length) return [];
  const cardsNorm = cards.map(normalizeKey).filter(Boolean);
  return materiales.filter((m) => {
    const desc = normalizeKey(String(m.DESCRIPCION_COMPONENTE ?? ""));
    return cardsNorm.some((card) => desc.includes(card));
  });
}

/** Firma estable de componentes (sin ceros a la izquierda) para comparar órdenes. */
function firmaComponentes(materiales: MaterialPivoteado[]): string {
  return materiales
    .map((m) => {
      const raw = String(m.COMPONENTE ?? "").trim();
      return raw.replace(/^0+/, "") || raw;
    })
    .filter(Boolean)
    .sort()
    .join("|");
}

function cardsParaAreaUsuario(
  elementos: ElementoTrazableArea[],
  departamento?: string
): { area: string | null; cards: string[] } {
  const depto = normalizeKey(departamento ?? "");
  if (!depto || elementos.length === 0) {
    return { area: null, cards: [] };
  }

  const exacto = elementos.find((e) => normalizeKey(e.Area) === depto);
  if (exacto) {
    return { area: exacto.Area, cards: exacto.CARDS ?? [] };
  }

  // Coincidencia parcial (p.ej. "TALLER DE CORTE QUITO" ↔ "TALLER DE CORTE")
  const parcial = elementos.find((e) => {
    const area = normalizeKey(e.Area);
    return depto.includes(area) || area.includes(depto);
  });
  if (parcial) {
    return { area: parcial.Area, cards: parcial.CARDS ?? [] };
  }

  return { area: null, cards: [] };
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

/** Redondeo a 2 decimales (evita basura de punto flotante). */
function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
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

export default function AsociacionOrdenesContent() {
  const { toast } = useToast();
  const {
    user,
    estaciones,
    isLoading: isUserContextLoading,
  } = useUser();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrdenes, setIsLoadingOrdenes] = useState(true);
  const [errorOrdenes, setErrorOrdenes] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Order[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>("all");
  /** Materiales pivoteados por número de orden. */
  const [materialesPorOrden, setMaterialesPorOrden] = useState<
    Record<string, MaterialPivoteado[]>
  >({});
  const [loadingMaterialesOrden, setLoadingMaterialesOrden] = useState<
    Record<string, boolean>
  >({});
  const [elementosTrazables, setElementosTrazables] = useState<
    ElementoTrazableArea[]
  >([]);
  const [firmaComponentesActiva, setFirmaComponentesActiva] = useState<
    string | null
  >(null);
  const firmaComponentesRef = useRef<string | null>(null);
  const loadingOrdenesRef = useRef<Set<string>>(new Set());
  const selectedOrdersRef = useRef<Order[]>([]);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const autoEnterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    firmaComponentesRef.current = firmaComponentesActiva;
  }, [firmaComponentesActiva]);

  useEffect(() => {
    selectedOrdersRef.current = selectedOrders;
  }, [selectedOrders]);

  /** Rollos pistoleados (mismo material). Solo vía QR. */
  const [selectedIngresos, setSelectedIngresos] = useState<Ingreso[]>([]);
  const selectedIngresosRef = useRef<Ingreso[]>([]);
  const [searchIngreso, setSearchIngreso] = useState("");
  const [disponibleRollos, setDisponibleRollos] = useState<number | null>(null);
  /** Disponible por código de ingreso (rollo). */
  const [disponiblePorIngreso, setDisponiblePorIngreso] = useState<
    Record<number, number>
  >({});
  /**
   * Cantidad de material (tela) ya asociada en CONSUMO por orden,
   * sumando los rollos pickeados.
   */
  const [consumoMaterialPorOrden, setConsumoMaterialPorOrden] = useState<
    Record<string, number>
  >({});
  const [isLoadingDisponible, setIsLoadingDisponible] = useState(false);
  const [refreshMovimientosKey, setRefreshMovimientosKey] = useState(0);
  const [isAsociando, setIsAsociando] = useState(false);
  /** Estimada: ingresada por el usuario. */
  const [cantidadEstimada, setCantidadEstimada] = useState("");
  /** Utilizada: prellenada con el cálculo BOM (cantPendiente × CANTIDAD_ACUMULADA). */
  const [cantidadUtilizada, setCantidadUtilizada] = useState("");
  /** Desperdicio: ingresado por el usuario. */
  const [cantidadDesperdicio, setCantidadDesperdicio] = useState("");
  /** Cantidad a fabricar por orden (default = cantPendiente). */
  const [cantidadFabricarPorOrden, setCantidadFabricarPorOrden] = useState<
    Record<string, string>
  >({});

  const [scanBuffer, setScanBuffer] = useState("");
  const [isResolvingQr, setIsResolvingQr] = useState(false);

  /** Primer rollo / material común (todos deben ser el mismo código). */
  const selectedIngreso = selectedIngresos[0] ?? null;

  useEffect(() => {
    selectedIngresosRef.current = selectedIngresos;
  }, [selectedIngresos]);

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

  const { area: areaTrazable, cards: cardsTrazables } = useMemo(
    () => cardsParaAreaUsuario(elementosTrazables, user?.department),
    [elementosTrazables, user?.department]
  );

  useEffect(() => {
    const cargarElementosTrazables = async () => {
      try {
        const res =
          await configuracionService.getConfigrucacionesByCodigoAplicacion();
        const row = (res.data || []).find(
          (c) =>
            String(c.nombre_configuracion ?? "").trim().toUpperCase() ===
            "ELEMENTOS_TRAZABLES"
        );
        if (!row?.valor_configuracion) {
          setElementosTrazables([]);
          return;
        }
        const parsed = JSON.parse(row.valor_configuracion) as ElementoTrazableArea[];
        setElementosTrazables(Array.isArray(parsed) ? parsed : []);
        console.log("[Asociación] ELEMENTOS_TRAZABLES:", parsed);
      } catch (error) {
        console.error("[Asociación] Error cargando ELEMENTOS_TRAZABLES:", error);
        setElementosTrazables([]);
        toast({
          title: "Configuración no disponible",
          description: "No se pudo cargar ELEMENTOS_TRAZABLES.",
          variant: "destructive",
        });
      }
    };
    void cargarElementosTrazables();
  }, [toast]);

  useEffect(() => {
    if (isUserContextLoading) return;
    console.log("[Asociación] IP del usuario:", user?.ip_address ?? "(sin IP)");
    console.log(
      "[Asociación] Estación detectada:",
      userStation?.nombre_estacion ?? "(ninguna)"
    );
    console.log("[Asociación] Departamento usuario:", user?.department ?? "(sin depto)");
    console.log("[Asociación] Área trazable:", areaTrazable ?? "(sin match)");
    console.log("[Asociación] CARDS permitidos:", cardsTrazables);
  }, [
    isUserContextLoading,
    user?.ip_address,
    user?.department,
    userStation?.nombre_estacion,
    areaTrazable,
    cardsTrazables,
  ]);

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
        setOrders([]);
        setErrorOrdenes("Falta información del usuario o responsable.");
        if (isInitialFetch) setIsLoadingOrdenes(false);
        return;
      }

      if (user.code === "admin") {
        setOrders([]);
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
        setOrders(filtered);

        setSelectedOrders((prev) => {
          const next = prev.filter((sel) =>
            filtered.some((o) => o.orden === sel.orden)
          );
          if (next.length === 0) {
            setFirmaComponentesActiva(null);
            setMaterialesPorOrden({});
            setCantidadFabricarPorOrden({});
          } else {
            const keep = new Set(next.map((o) => o.orden));
            setCantidadFabricarPorOrden((fab) => {
              const copy: Record<string, string> = {};
              for (const [k, v] of Object.entries(fab)) {
                if (keep.has(k)) copy[k] = v;
              }
              return copy;
            });
          }
          return next;
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las órdenes.";
        setErrorOrdenes(message);
        setOrders([]);
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

  /** Solo los rollos pistoleados (opcionalmente filtrados por búsqueda). */
  const filteredIngresos = useMemo(() => {
    if (!searchIngreso.trim()) return selectedIngresos;
    const term = searchIngreso.toLowerCase();
    return selectedIngresos.filter((item) =>
      [item.codigo_ingreso, item.codigo_material, item.bodega_destino, item.qr_bmp]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(term))
    );
  }, [selectedIngresos, searchIngreso]);

  const selectedOrderIds = useMemo(
    () => selectedOrders.map((o) => o.orden),
    [selectedOrders]
  );

  const totalMaterialesCargados = useMemo(
    () =>
      Object.values(materialesPorOrden).reduce(
        (acc, list) => acc + (list?.length || 0),
        0
      ),
    [materialesPorOrden]
  );

  /**
   * Un panel por orden/semielaborado:
   * - header: registro que coincidió con la tela (criterios 1 / N·400*)
   * - cuerpo: resto de materiales consultados (los que no coinciden)
   * - maxFabricar = pendiente − piezas ya cubiertas por CONSUMO previo del material
   */
  const panelesSemielaborado = useMemo(() => {
    type FilaPanel = {
      materialPadre: string;
      descripcionPadre: string;
      componente: string;
      descripcionComponente: string;
      cantidadAcumulada: number;
      cantidadNecesaria: number;
    };

    const tela = String(selectedIngreso?.codigo_material ?? "").trim();

    return selectedOrders
      .map((order) => {
        const crudos = materialesPorOrden[order.orden];
        if (!crudos?.length) return null;

        const list = dedupePorComponente(crudos);
        const pendiente = Number(order.cantPendiente) || 0;
        const consumoMaterial =
          Number(consumoMaterialPorOrden[order.orden]) || 0;

        let matchOk = true;
        let motivo = "";
        let matchFilas: MaterialPivoteado[] = [];
        if (tela) {
          const match = matchPivoteConTela(list, tela);
          matchOk = match.ok;
          motivo = match.motivo;
          matchFilas = match.filas;
        }

        const acumMatch =
          matchFilas.length > 0
            ? Number(matchFilas[0].CANTIDAD_ACUMULADA) || 0
            : 0;
        const piezasYaAsociadas =
          acumMatch > 0 ? round2(consumoMaterial / acumMatch) : 0;
        const maxFabricar = Math.max(0, round2(pendiente - piezasYaAsociadas));

        const rawFab = cantidadFabricarPorOrden[order.orden];
        let fabricar = maxFabricar;
        if (rawFab !== undefined && rawFab !== "") {
          const n = Number(rawFab);
          if (!Number.isNaN(n)) {
            fabricar = Math.min(Math.max(0, n), maxFabricar);
          }
        }

        const toFila = (m: MaterialPivoteado): FilaPanel => {
          const cantidadAcumulada = Number(m.CANTIDAD_ACUMULADA) || 0;
          return {
            materialPadre: String(m.MATERIAL_PADRE ?? ""),
            descripcionPadre: String(m.DESCRIPCION_PADRE ?? ""),
            componente: String(m.COMPONENTE ?? ""),
            descripcionComponente: String(m.DESCRIPCION_COMPONENTE ?? ""),
            cantidadAcumulada,
            /** Exacta: fabricar × CANTIDAD_ACUMULADA (se redondea al guardar). */
            cantidadNecesaria: fabricar * cantidadAcumulada,
          };
        };

        const todos = list.map(toFila);
        let coincidencia: FilaPanel | null = null;
        let resto = todos;

        if (tela) {
          const matchKeys = new Set(
            matchFilas.map((m) =>
              stripLeadingZeros(String(m.COMPONENTE ?? ""))
            )
          );
          coincidencia =
            todos.find((f) =>
              matchKeys.has(stripLeadingZeros(f.componente))
            ) ?? null;
          resto = todos.filter(
            (f) => !matchKeys.has(stripLeadingZeros(f.componente))
          );
          if (!matchOk) {
            resto = todos;
            coincidencia = null;
          }
        }

        return {
          orden: order.orden,
          material: order.material,
          descripcionMaterial: order.descripcionMaterial || "",
          cantPendiente: pendiente,
          maxFabricar,
          cantidadFabricar: fabricar,
          consumoMaterial,
          piezasYaAsociadas,
          coincidencia,
          resto,
          todos,
          matchOk,
          motivo,
          totalConsultados: todos.length,
        };
      })
      .filter(Boolean) as Array<{
      orden: string;
      material: string;
      descripcionMaterial: string;
      cantPendiente: number;
      maxFabricar: number;
      cantidadFabricar: number;
      consumoMaterial: number;
      piezasYaAsociadas: number;
      coincidencia: {
        materialPadre: string;
        descripcionPadre: string;
        componente: string;
        descripcionComponente: string;
        cantidadAcumulada: number;
        cantidadNecesaria: number;
      } | null;
      resto: Array<{
        materialPadre: string;
        descripcionPadre: string;
        componente: string;
        descripcionComponente: string;
        cantidadAcumulada: number;
        cantidadNecesaria: number;
      }>;
      todos: Array<{
        materialPadre: string;
        descripcionPadre: string;
        componente: string;
        descripcionComponente: string;
        cantidadAcumulada: number;
        cantidadNecesaria: number;
      }>;
      matchOk: boolean;
      motivo: string;
      totalConsultados: number;
    }>;
  }, [
    selectedOrders,
    materialesPorOrden,
    selectedIngreso,
    cantidadFabricarPorOrden,
    consumoMaterialPorOrden,
  ]);

  /** Filas que alimentan BOM / prorrateo: match si hay tela, si no todos. */
  const filasDetalleSeleccion = useMemo(() => {
    const tela = String(selectedIngreso?.codigo_material ?? "").trim();
    const rows: Array<{
      orden: string;
      cantPendiente: number;
      cantidadFabricar: number;
      materialPadre: string;
      descripcionPadre: string;
      componente: string;
      descripcionComponente: string;
      cantidadAcumulada: number;
      cantidadNecesaria: number;
    }> = [];

    for (const panel of panelesSemielaborado) {
      const fuente =
        tela && panel.coincidencia
          ? [panel.coincidencia]
          : tela
            ? []
            : panel.todos;
      for (const f of fuente) {
        rows.push({
          orden: panel.orden,
          cantPendiente: panel.cantPendiente,
          cantidadFabricar: panel.cantidadFabricar,
          ...f,
        });
      }
    }
    return rows;
  }, [panelesSemielaborado, selectedIngreso]);

  /** Total BOM = Σ (cantFabricar × CANTIDAD_ACUMULADA) → prellena Utilizada. */
  const cantidadNecesaria = useMemo(
    () =>
      round2(
        filasDetalleSeleccion.reduce(
          (acc, row) => acc + row.cantidadNecesaria,
          0
        )
      ),
    [filasDetalleSeleccion]
  );

  /**
   * Con tela pistoleada: órdenes seleccionadas sin match (criterios 1 / N·400*).
   * Esas filas van en rojo hasta que el usuario las desmarque.
   */
  const warningOrderIds = useMemo(() => {
    const tela = String(selectedIngreso?.codigo_material ?? "").trim();
    if (!tela) return [] as string[];
    return panelesSemielaborado
      .filter((p) => !p.matchOk)
      .map((p) => p.orden);
  }, [selectedIngreso, panelesSemielaborado]);

  const telaEnListaSeleccion = useMemo(() => {
    const tela = String(selectedIngreso?.codigo_material ?? "").trim();
    if (!tela || selectedOrders.length === 0) return null as boolean | null;
    if (selectedOrders.some((o) => !materialesPorOrden[o.orden])) return null;
    if (panelesSemielaborado.length === 0) return null;
    return panelesSemielaborado.every((p) => p.matchOk);
  }, [
    selectedIngreso,
    selectedOrders,
    materialesPorOrden,
    panelesSemielaborado,
  ]);

  useEffect(() => {
    if (cantidadNecesaria > 0) {
      setCantidadUtilizada(round2(cantidadNecesaria).toFixed(2));
    } else {
      setCantidadUtilizada("");
    }
  }, [cantidadNecesaria]);

  /** Desperdicio por defecto en 0 al tener órdenes (el placeholder no cuenta como valor). */
  useEffect(() => {
    if (selectedOrders.length > 0 && cantidadDesperdicio.trim() === "") {
      setCantidadDesperdicio("0");
    }
  }, [selectedOrders.length, cantidadDesperdicio]);

  /**
   * Cabecera `movimiento`: estimada + desperdicio + utilizada (totales).
   * Detalles: cantidad neta por orden = fabricar × CANTIDAD_ACUMULADA (exacta;
   * se redondea a 2 decimales solo al persistir).
   */
  const cabeceraMovimiento = useMemo(
    () => ({
      cantidad_estimada: round2(Number(cantidadEstimada) || 0),
      cantidad_desperdicio: round2(Number(cantidadDesperdicio) || 0),
      cantidad_movimiento: String(round2(Number(cantidadUtilizada) || 0)),
    }),
    [cantidadEstimada, cantidadDesperdicio, cantidadUtilizada]
  );

  const detallesConsumoPorOrden = useMemo(() => {
    const porOrden = new Map<string, number>();

    for (const row of filasDetalleSeleccion) {
      const prev = porOrden.get(row.orden) || 0;
      porOrden.set(row.orden, prev + row.cantidadNecesaria);
    }

    return Array.from(porOrden.entries()).map(([orden, netaExacta]) => ({
      orden,
      /** Valor exacto por multiplicadores; redondear solo al guardar. */
      cantidad_utilizada: netaExacta,
    }));
  }, [filasDetalleSeleccion]);

  const parseDecimalInput = (val: string, setter: (v: string) => void) => {
    if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
      setter(val);
    }
  };

  const roundDecimalInputOnBlur = (
    val: string,
    setter: (v: string) => void
  ) => {
    if (val.trim() === "" || val === ".") {
      setter("");
      return;
    }
    const n = Number(val);
    if (Number.isNaN(n)) {
      setter("");
      return;
    }
    setter(round2(n).toFixed(2));
  };

  const resetPistoleo = useCallback(() => {
    selectedIngresosRef.current = [];
    setSelectedIngresos([]);
    setDisponibleRollos(null);
    setDisponiblePorIngreso({});
    setConsumoMaterialPorOrden({});
    setSelectedOrders([]);
    selectedOrdersRef.current = [];
    setMaterialesPorOrden({});
    setCantidadFabricarPorOrden({});
    firmaComponentesRef.current = null;
    setFirmaComponentesActiva(null);
    setCantidadEstimada("");
    setCantidadUtilizada("");
    setCantidadDesperdicio("");
    setScanBuffer("");
  }, []);

  const agregarIngresoRollo = useCallback(
    (ingreso: Ingreso) => {
      const tela = stripLeadingZeros(String(ingreso.codigo_material ?? ""));
      if (!tela) {
        toast({
          title: "Sin material",
          description: "El ingreso no tiene código de material (tela).",
          variant: "destructive",
        });
        return;
      }

      const prev = selectedIngresosRef.current;

      if (prev.some((p) => p.codigo_ingreso === ingreso.codigo_ingreso)) {
        toast({
          title: "Rollo ya agregado",
          description: `El ingreso #${ingreso.codigo_ingreso} ya está en la selección.`,
        });
        return;
      }

      if (prev.length > 0) {
        const telaActual = stripLeadingZeros(
          String(prev[0].codigo_material ?? "")
        );
        if (telaActual !== tela) {
          toast({
            title: "Material distinto",
            description:
              "Los rollos pistoleados deben ser del mismo material. Limpia la selección para cambiar de tela.",
            variant: "destructive",
          });
          return;
        }
      }

      const next = [...prev, ingreso];
      selectedIngresosRef.current = next;
      setSelectedIngresos(next);
      toast({
        title: "Rollo agregado",
        description: `${ingreso.codigo_material} · ingreso #${ingreso.codigo_ingreso} (${ingreso.cantidad} ${ingreso.unidades}).`,
      });
    },
    [toast]
  );

  const resolverQr = useCallback(
    async (rawCodigo: string) => {
      const codigo = String(rawCodigo ?? "").trim();
      if (!codigo || isResolvingQr) return;

      setIsResolvingQr(true);
      try {
        const ingresoRes = await ingresosService.getByQR(codigo);
        const ingreso = (ingresoRes.data || [])[0];
        if (!ingreso) {
          toast({
            title: "QR no registrado",
            description:
              "No hay un ingreso activo con ese QR. Regístralo primero en Ingresos.",
            variant: "destructive",
          });
          return;
        }

        const tela = String(ingreso.codigo_material ?? "").trim();
        if (!tela) {
          toast({
            title: "Sin material",
            description: "El ingreso no tiene código de material (tela).",
            variant: "destructive",
          });
          return;
        }

        agregarIngresoRollo(ingreso);
        setScanBuffer("");
      } catch (error) {
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
    [agregarIngresoRollo, isResolvingQr, toast]
  );

  const scheduleAutoEnter = useCallback(
    (value: string) => {
      if (autoEnterTimerRef.current) clearTimeout(autoEnterTimerRef.current);
      autoEnterTimerRef.current = setTimeout(() => {
        const codigo = value.trim();
        if (codigo.length >= 4) void resolverQr(codigo);
      }, SCAN_IDLE_MS);
    },
    [resolverQr]
  );

  useEffect(() => {
    return () => {
      if (autoEnterTimerRef.current) clearTimeout(autoEnterTimerRef.current);
    };
  }, []);

  const cargarMaterialesPivoteados = useCallback(
    async (order: Order): Promise<boolean> => {
      const codigo = String(order.material || "").trim();
      if (!codigo) {
        toast({
          title: "Sin material",
          description: `La orden ${order.orden} no tiene código de material.`,
          variant: "destructive",
        });
        return false;
      }

      if (cardsTrazables.length === 0) {
        toast({
          title: "Sin elementos trazables",
          description: areaTrazable
            ? `El área "${areaTrazable}" no tiene CARDS configurados.`
            : `No hay ELEMENTOS_TRAZABLES para el departamento "${user?.department ?? ""}".`,
          variant: "destructive",
        });
        return false;
      }

      if (loadingOrdenesRef.current.has(order.orden)) {
        return true;
      }
      loadingOrdenesRef.current.add(order.orden);
      setLoadingMaterialesOrden((prev) => ({ ...prev, [order.orden]: true }));

      try {
        const res = await servicioService.getMaterialesPivotFertPrincipal(
          codigo,
          order.descripcionMaterial
        );
        const crudos = res.data || [];
        const filtrados = filtrarPorCards(crudos, cardsTrazables);

        if (filtrados.length === 0) {
          toast({
            title: "Sin componentes trazables",
            description: `La orden ${order.orden} no tiene componentes cuya descripción incluya: ${cardsTrazables.join(", ")}.`,
            variant: "destructive",
          });
          return false;
        }

        const firmaNueva = firmaComponentes(filtrados);
        const firmaActual = firmaComponentesRef.current;

        if (firmaActual && firmaNueva !== firmaActual) {
          toast({
            title: "Componentes distintos",
            description:
              "Las órdenes seleccionadas deben compartir los mismos subcomponentes trazables. Esta orden tiene materiales distintos.",
            variant: "destructive",
          });
          return false;
        }

        setMaterialesPorOrden((prev) => ({ ...prev, [order.orden]: filtrados }));
        if (!firmaActual) {
          firmaComponentesRef.current = firmaNueva;
          setFirmaComponentesActiva(firmaNueva);
        }
        return true;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los materiales pivoteados.";
        toast({
          title: `Error materiales · orden ${order.orden}`,
          description: message,
          variant: "destructive",
        });
        return false;
      } finally {
        loadingOrdenesRef.current.delete(order.orden);
        setLoadingMaterialesOrden((prev) => {
          const next = { ...prev };
          delete next[order.orden];
          return next;
        });
      }
    },
    [areaTrazable, cardsTrazables, toast, user?.department]
  );

  const quitarOrdenSeleccionada = useCallback((ordenId: string) => {
    setSelectedOrders((prev) => {
      const next = prev.filter((o) => o.orden !== ordenId);
      if (next.length === 0) {
        firmaComponentesRef.current = null;
        setFirmaComponentesActiva(null);
      }
      return next;
    });
    setMaterialesPorOrden((mats) => {
      const copy = { ...mats };
      delete copy[ordenId];
      return copy;
    });
    setCantidadFabricarPorOrden((prev) => {
      const next = { ...prev };
      delete next[ordenId];
      return next;
    });
  }, []);

  /** Suma disponible + consumos previos por orden de los rollos pickeados. */
  useEffect(() => {
    if (selectedIngresos.length === 0) {
      setDisponibleRollos(null);
      setDisponiblePorIngreso({});
      setConsumoMaterialPorOrden({});
      setIsLoadingDisponible(false);
      return;
    }

    let cancelled = false;
    setIsLoadingDisponible(true);

    void (async () => {
      try {
        const results = await Promise.all(
          selectedIngresos.map((ing) =>
            servicioService.getMovimientosPorIngreso(ing.codigo_ingreso)
          )
        );
        if (cancelled) return;

        const dispMap: Record<number, number> = {};
        let totalDisp = 0;
        const consumoMap: Record<string, number> = {};

        results.forEach((res, idx) => {
          const ing = selectedIngresos[idx];
          const rows = res.data || [];
          const d = Number(rows[0]?.disponible);
          const disponible = Number.isFinite(d)
            ? round2(d)
            : round2(Number(ing?.cantidad) || 0);
          dispMap[ing.codigo_ingreso] = disponible;
          totalDisp = round2(totalDisp + disponible);

          for (const m of rows) {
            const tipo = String(m.tipo_movimiento ?? "")
              .trim()
              .toUpperCase();
            if (tipo !== "CONSUMO") continue;
            const orden = String(m.orden ?? "").trim();
            if (!orden) continue;
            const qty = Number(m.cantidad_utilizada) || 0;
            consumoMap[orden] = round2((consumoMap[orden] || 0) + qty);
          }
        });

        setDisponiblePorIngreso(dispMap);
        setDisponibleRollos(totalDisp);
        setConsumoMaterialPorOrden(consumoMap);
      } catch {
        if (!cancelled) {
          setDisponibleRollos(null);
          setDisponiblePorIngreso({});
          setConsumoMaterialPorOrden({});
        }
      } finally {
        if (!cancelled) setIsLoadingDisponible(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedIngresos, refreshMovimientosKey]);

  /** Ajusta "A fabricar" al nuevo tope (pendiente − ya asociado) cuando llega el consumo. */
  useEffect(() => {
    if (panelesSemielaborado.length === 0) return;
    setCantidadFabricarPorOrden((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const panel of panelesSemielaborado) {
        const raw = next[panel.orden];
        const max = panel.maxFabricar;
        if (raw === undefined) {
          next[panel.orden] = String(max);
          changed = true;
          continue;
        }
        if (raw === "" || raw === ".") continue;
        const n = Number(raw);
        if (!Number.isNaN(n) && n > max) {
          next[panel.orden] = String(max);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [panelesSemielaborado]);

  const handleCantidadFabricarChange = useCallback(
    (orden: string, maxFabricar: number, raw: string) => {
      if (raw !== "" && !/^\d*\.?\d{0,2}$/.test(raw)) return;

      if (raw === "" || raw === ".") {
        setCantidadFabricarPorOrden((prev) => ({ ...prev, [orden]: raw }));
        return;
      }

      let n = Number(raw);
      if (Number.isNaN(n)) return;
      if (n < 0) n = 0;
      if (n > maxFabricar) n = maxFabricar;

      setCantidadFabricarPorOrden((prev) => ({
        ...prev,
        [orden]: String(n),
      }));
    },
    []
  );

  const handleCantidadFabricarBlur = useCallback(
    (orden: string, maxFabricar: number) => {
      const raw = cantidadFabricarPorOrden[orden];
      let n =
        raw === undefined || raw === "" || raw === "."
          ? maxFabricar
          : Number(raw);
      if (Number.isNaN(n)) n = maxFabricar;
      n = Math.min(Math.max(0, n), maxFabricar);
      setCantidadFabricarPorOrden((prev) => ({
        ...prev,
        [orden]: round2(n).toFixed(2).replace(/\.00$/, ""),
      }));
    },
    [cantidadFabricarPorOrden]
  );

  const handleOrderToggle = useCallback(
    (order: Order) => {
      const already = selectedOrdersRef.current.some(
        (o) => o.orden === order.orden
      );

      if (already) {
        selectedOrdersRef.current = selectedOrdersRef.current.filter(
          (o) => o.orden !== order.orden
        );
        quitarOrdenSeleccionada(order.orden);
        return;
      }

      selectedOrdersRef.current = [...selectedOrdersRef.current, order];
      setSelectedOrders((prev) =>
        prev.some((o) => o.orden === order.orden) ? prev : [...prev, order]
      );
      setCantidadFabricarPorOrden((prev) => ({
        ...prev,
        [order.orden]: String(Number(order.cantPendiente) || 0),
      }));

      if (loadingOrdenesRef.current.has(order.orden)) {
        return;
      }

      void (async () => {
        const ok = await cargarMaterialesPivoteados(order);
        if (!ok) {
          selectedOrdersRef.current = selectedOrdersRef.current.filter(
            (o) => o.orden !== order.orden
          );
          quitarOrdenSeleccionada(order.orden);
        }
      })();
    },
    [cargarMaterialesPivoteados, quitarOrdenSeleccionada]
  );

  const estimadaNum = Number(cantidadEstimada);
  const utilizadaNum = Number(cantidadUtilizada);
  const estimadaLlena =
    cantidadEstimada.trim() !== "" && !Number.isNaN(estimadaNum);
  const utilizadaLlena =
    cantidadUtilizada.trim() !== "" && !Number.isNaN(utilizadaNum);

  const estimadaVsUtilizadaOk =
    estimadaLlena && utilizadaLlena && estimadaNum >= utilizadaNum;

  /** Referencias a cubrir: solo utilizada (estimada no bloquea). */
  const refsCantidadACubrir: number[] = [];
  if (utilizadaLlena) refsCantidadACubrir.push(utilizadaNum);

  const cantidadACubrir =
    refsCantidadACubrir.length > 0
      ? Math.max(...refsCantidadACubrir)
      : null;

  const stockInsuficiente =
    selectedIngresos.length > 0 &&
    disponibleRollos != null &&
    !isLoadingDisponible &&
    cantidadACubrir != null &&
    disponibleRollos < cantidadACubrir;

  const stockSuficiente =
    utilizadaLlena &&
    disponibleRollos != null &&
    !isLoadingDisponible &&
    disponibleRollos >= utilizadaNum;

  /** Desperdicio vacío se trata como 0. */
  const desperdicioOk =
    cantidadDesperdicio.trim() === "" ||
    !Number.isNaN(Number(cantidadDesperdicio));

  const canAsociar =
    selectedOrders.length > 0 &&
    selectedIngresos.length > 0 &&
    warningOrderIds.length === 0 &&
    estimadaVsUtilizadaOk &&
    stockSuficiente &&
    !stockInsuficiente &&
    desperdicioOk &&
    !isAsociando &&
    detallesConsumoPorOrden.length > 0;

  const handleAsociar = async () => {
    if (selectedIngresos.length === 0 || selectedOrders.length === 0) return;

    if (!estimadaVsUtilizadaOk) {
      toast({
        title: "Cantidades inválidas",
        description:
          "La cantidad estimada debe ser mayor o igual a la utilizada.",
        variant: "destructive",
      });
      return;
    }

    if (stockInsuficiente || !stockSuficiente) {
      toast({
        title: "Cantidad insuficiente",
        description: `Disponible en rollos: ${formatNumber(disponibleRollos ?? 0)}. Debe cubrir la cantidad utilizada.`,
        variant: "destructive",
      });
      return;
    }

    if (!canAsociar) return;

    const utilizadaTotal = round2(Number(cantidadUtilizada) || 0);
    const estimadaTotal = round2(Number(cantidadEstimada) || 0);
    const desperdicioTotal = round2(Number(cantidadDesperdicio) || 0);
    if (utilizadaTotal <= 0) {
      toast({
        title: "Utilizada inválida",
        description: "La cantidad utilizada debe ser mayor a 0.",
        variant: "destructive",
      });
      return;
    }

    /** Reparte la utilizada entre rollos según disponible (FIFO). */
    const asignaciones: Array<{ ingreso: Ingreso; cantidad: number }> = [];
    let restante = utilizadaTotal;
    for (const ing of selectedIngresos) {
      if (restante <= 0) break;
      const disp =
        disponiblePorIngreso[ing.codigo_ingreso] ??
        round2(Number(ing.cantidad) || 0);
      const tomar = round2(Math.min(disp, restante));
      if (tomar > 0) {
        asignaciones.push({ ingreso: ing, cantidad: tomar });
        restante = round2(restante - tomar);
      }
    }

    if (restante > 0.009 || asignaciones.length === 0) {
      toast({
        title: "Cantidad insuficiente",
        description: "Los rollos pickeados no cubren la utilizada.",
        variant: "destructive",
      });
      return;
    }

    setIsAsociando(true);
    try {
      const now = formatDateForSQLServer(new Date());
      const usuario = user?.name ?? "";
      let movimientosCreados = 0;

      for (let i = 0; i < asignaciones.length; i++) {
        const { ingreso, cantidad } = asignaciones[i];
        const peso = utilizadaTotal > 0 ? cantidad / utilizadaTotal : 0;
        const esUltimo = i === asignaciones.length - 1;

        let estimadaParte = round2(estimadaTotal * peso);
        let desperdicioParte = round2(desperdicioTotal * peso);
        if (esUltimo) {
          const sumEst = asignaciones.slice(0, -1).reduce(
            (acc, a) =>
              acc + round2(estimadaTotal * (a.cantidad / utilizadaTotal)),
            0
          );
          const sumDesp = asignaciones.slice(0, -1).reduce(
            (acc, a) =>
              acc + round2(desperdicioTotal * (a.cantidad / utilizadaTotal)),
            0
          );
          estimadaParte = round2(estimadaTotal - sumEst);
          desperdicioParte = round2(desperdicioTotal - sumDesp);
        }

        const movPayload: Movimiento = {
          codigo_movimiento: 0,
          tipo_movimiento: "CONSUMO",
          cantidad_movimiento: String(cantidad),
          cantidad_estimada: estimadaParte,
          cantidad_desperdicio: desperdicioParte,
          fecha_movimiento: now,
          usuario_movimiento: usuario,
          estado: "A",
          fecha_modificacion: now,
          usuario_modificacion: usuario,
          codigo_ingreso: ingreso.codigo_ingreso,
        };

        const movRes = await movimientoService.save(movPayload);
        const codigoMovimiento = movRes.data?.codigo_movimiento;
        if (!codigoMovimiento) {
          throw new Error(
            `No se obtuvo el código del movimiento para el ingreso #${ingreso.codigo_ingreso}.`
          );
        }

        for (let d = 0; d < detallesConsumoPorOrden.length; d++) {
          const det = detallesConsumoPorOrden[d];
          /** Neta exacta = fabricar × CANTIDAD_ACUMULADA; redondeo solo al persistir. */
          const netaExacta = Number(det.cantidad_utilizada) || 0;
          let qtyExacta = netaExacta * peso;

          if (esUltimo && asignaciones.length > 1) {
            const yaEnOtros = asignaciones.slice(0, -1).reduce((acc, a) => {
              const p = a.cantidad / utilizadaTotal;
              return acc + netaExacta * p;
            }, 0);
            qtyExacta = netaExacta - yaEnOtros;
          }

          const qtyRedondeada = round2(qtyExacta);
          if (qtyRedondeada <= 0) continue;

          await detalleMovimientoService.save({
            codigo_detalle_movimiento: 0,
            codigo_movimiento: codigoMovimiento,
            orden: det.orden,
            cantidad_utilizada: qtyRedondeada,
            estado: "A",
            fecha_modificacion: now,
            usuario_modificacion: usuario,
          });
        }

        movimientosCreados += 1;
      }

      toast({
        title: "Consumo asociado",
        description: `Se guardó ${movimientosCreados} movimiento(s) CONSUMO · util. ${formatNumber(utilizadaTotal)} ${selectedIngreso?.unidades ?? ""} · ${detallesConsumoPorOrden.length} orden(es).`,
      });

      setRefreshMovimientosKey((k) => k + 1);
    } catch (error) {
      toast({
        title: "Error al guardar consumo",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo registrar el movimiento de consumo.",
        variant: "destructive",
      });
    } finally {
      setIsAsociando(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 m-px">
      {/* Pistoleo QR tela */}
      <Card className="shadow-lg border-primary/30">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[240px] space-y-1.5">
              <Label
                htmlFor="scanQrTela"
                className="flex items-center gap-2 text-primary font-semibold"
              >
                <ScanLine className="h-4 w-4" />
                Pistolear QR de la tela
              </Label>
              <Input
                ref={scanInputRef}
                id="scanQrTela"
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
            {selectedIngresos.length > 0 && (
              <Button
                type="button"
                variant="outline"
                className="h-12"
                onClick={resetPistoleo}
              >
                Limpiar
              </Button>
            )}
          </div>
          {selectedIngresos.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {selectedIngresos.map((ing) => (
                <Badge
                  key={ing.codigo_ingreso}
                  variant="secondary"
                  className="font-mono"
                >
                  #{ing.codigo_ingreso} · {ing.cantidad} {ing.unidades}
                </Badge>
              ))}
              <Badge variant="outline" className="font-mono">
                Tela {selectedIngreso?.codigo_material}
              </Badge>
              {disponibleRollos != null && !isLoadingDisponible && (
                <span
                  className={cn(
                    "font-semibold",
                    stockInsuficiente
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                >
                  Disponible total: {formatNumber(disponibleRollos)}{" "}
                  {selectedIngreso?.unidades}
                </span>
              )}
              {stockInsuficiente && (
                <span className="text-destructive font-bold">
                  · Cantidad insuficiente (necesita{" "}
                  {formatNumber(cantidadACubrir ?? 0)}
                  {selectedIngreso?.unidades
                    ? ` ${selectedIngreso.unidades}`
                    : ""}
                  )
                </span>
              )}
              {isLoadingDisponible && (
                <span className="text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Consultando disponible...
                </span>
              )}
              {selectedOrders.length > 0 && telaEnListaSeleccion === false && (
                <span className="text-destructive font-medium">
                  · No está en los componentes de la selección
                </span>
              )}
              {selectedOrders.length > 0 && telaEnListaSeleccion === true && (
                <span className="font-medium text-primary">
                  · Encontrada en la selección
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Órdenes disponibles (todas las de estación) */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="w-full flex flex-col gap-4">
          <OrdersTable
            orders={orders}
            isLoading={isLoadingOrdenes || isUserContextLoading}
            error={errorOrdenes}
            multiSelect
            selectedOrderIds={selectedOrderIds}
            warningOrderIds={warningOrderIds}
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
                <div className="flex items-center justify-center h-[150px] text-muted-foreground">
                  <p>Seleccione una o más órdenes para ver los detalles.</p>
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
                  Área: {areaTrazable ?? "sin match"} · CARDS:{" "}
                  {cardsTrazables.length > 0
                    ? cardsTrazables.join(", ")
                    : "ninguno"}
                  {selectedIngreso
                    ? ` · Tela: ${selectedIngreso.codigo_material}`
                    : ""}
                  . Componentes cargados: {totalMaterialesCargados}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-2">
                    Semielaborados seleccionados ({panelesSemielaborado.length})
                  </h3>
                  {Object.values(loadingMaterialesOrden).some(Boolean) ? (
                    <div className="flex items-center gap-2 text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando componentes...
                    </div>
                  ) : panelesSemielaborado.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4">
                      No hay componentes trazables para mostrar.
                    </p>
                  ) : (
                    <>
                      <Accordion
                        key={panelesSemielaborado.map((p) => p.orden).join("|")}
                        type="multiple"
                        defaultValue={[]}
                        className="w-full space-y-2"
                      >
                        {panelesSemielaborado.map((panel) => {
                          const sinMatch =
                            !!selectedIngreso && !panel.matchOk;
                          return (
                            <AccordionItem
                              key={panel.orden}
                              value={panel.orden}
                              className={cn(
                                "rounded-md border px-3",
                                sinMatch
                                  ? "border-destructive/50 bg-destructive/5"
                                  : "border-border"
                              )}
                            >
                              <AccordionTrigger
                                className={cn(
                                  "py-3 hover:no-underline text-left items-start gap-3",
                                  sinMatch && "text-destructive"
                                )}
                              >
                                <div className="flex-1 min-w-0 space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold tabular-nums">
                                      Orden {panel.orden}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="font-mono text-[10px]"
                                    >
                                      {panel.material}
                                    </Badge>
                                    {sinMatch ? (
                                      <Badge
                                        variant="destructive"
                                        className="gap-1"
                                      >
                                        <AlertTriangle className="h-3 w-3" />
                                        Sin coincidencia
                                      </Badge>
                                    ) : selectedIngreso && panel.coincidencia ? (
                                      <Badge variant="secondary">
                                        Match tela
                                      </Badge>
                                    ) : null}
                                    <div
                                      className="flex items-center gap-1.5 ml-auto mr-2"
                                      onClick={(e) => e.stopPropagation()}
                                      onPointerDown={(e) => e.stopPropagation()}
                                      onKeyDown={(e) => e.stopPropagation()}
                                    >
                                      <Label
                                        htmlFor={`fab-${panel.orden}`}
                                        className="text-[11px] text-muted-foreground whitespace-nowrap font-medium"
                                      >
                                        A fabricar
                                      </Label>
                                      <Input
                                        id={`fab-${panel.orden}`}
                                        type="text"
                                        inputMode="decimal"
                                        value={
                                          cantidadFabricarPorOrden[
                                            panel.orden
                                          ] ?? String(panel.maxFabricar)
                                        }
                                        onChange={(e) =>
                                          handleCantidadFabricarChange(
                                            panel.orden,
                                            panel.maxFabricar,
                                            e.target.value
                                          )
                                        }
                                        onBlur={() =>
                                          handleCantidadFabricarBlur(
                                            panel.orden,
                                            panel.maxFabricar
                                          )
                                        }
                                        className="h-8 w-20 text-center text-sm font-bold tabular-nums"
                                        disabled={panel.maxFabricar <= 0}
                                      />
                                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                        / {formatNumber(panel.maxFabricar)} máx
                                        {panel.piezasYaAsociadas > 0
                                          ? ` (${formatNumber(panel.cantPendiente)} pend.)`
                                          : " pend."}
                                      </span>
                                    </div>
                                  </div>

                                  {panel.consumoMaterial > 0 && (
                                    <p className="text-xs text-amber-700 dark:text-amber-500 font-medium">
                                      Ya asociada:{" "}
                                      {formatNumber(panel.consumoMaterial)}{" "}
                                      {selectedIngreso?.unidades || "M"} del
                                      material
                                      {panel.piezasYaAsociadas > 0
                                        ? ` (≈ ${formatNumber(panel.piezasYaAsociadas)} a fabricar)`
                                        : ""}
                                    </p>
                                  )}

                                  {panel.coincidencia ? (
                                    <div className="grid gap-0.5 text-sm text-foreground">
                                      <p className="font-mono text-xs font-semibold">
                                        {panel.coincidencia.componente}
                                      </p>
                                      <p className="font-medium leading-snug">
                                        {
                                          panel.coincidencia
                                            .descripcionComponente
                                        }
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Padre:{" "}
                                        <span className="font-mono">
                                          {panel.coincidencia.materialPadre}
                                        </span>{" "}
                                        · Necesaria:{" "}
                                        <span className="font-semibold text-primary tabular-nums">
                                          {formatNumber(
                                            panel.coincidencia.cantidadNecesaria
                                          )}
                                        </span>
                                        {" · "}
                                        Fabricar:{" "}
                                        <span className="font-semibold tabular-nums">
                                          {formatNumber(panel.cantidadFabricar)}
                                        </span>
                                      </p>
                                    </div>
                                  ) : selectedIngreso ? (
                                    <div className="grid gap-0.5 text-sm">
                                      <p className="font-mono text-xs font-bold text-destructive">
                                        {selectedIngreso.codigo_material}
                                      </p>
                                      <p className="text-xs text-destructive">
                                        No encontrado en la lista interna (
                                        {panel.totalConsultados} consultados).{" "}
                                        {panel.motivo}
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">
                                      {panel.descripcionMaterial ||
                                        "Semielaborado"}{" "}
                                      · {panel.totalConsultados} componente(s)
                                    </p>
                                  )}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                {panel.resto.length === 0 ? (
                                  <p className="text-xs text-muted-foreground py-2">
                                    No hay otros materiales consultados para
                                    este semielaborado.
                                  </p>
                                ) : (
                                  <div className="rounded-md border overflow-hidden">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Material padre</TableHead>
                                          <TableHead>
                                            Descripción padre
                                          </TableHead>
                                          <TableHead>Componente</TableHead>
                                          <TableHead>
                                            Descripción componente
                                          </TableHead>
                                          <TableHead className="text-right">
                                            Cant. acum.
                                          </TableHead>
                                          <TableHead className="text-right">
                                            Cant. necesaria
                                          </TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {panel.resto.map((row, idx) => (
                                          <TableRow
                                            key={`${panel.orden}-${row.componente}-${idx}`}
                                            className="text-muted-foreground"
                                          >
                                            <TableCell className="font-mono text-xs whitespace-nowrap">
                                              {row.materialPadre}
                                            </TableCell>
                                            <TableCell className="max-w-[180px] text-xs">
                                              {row.descripcionPadre}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs whitespace-nowrap">
                                              {row.componente}
                                            </TableCell>
                                            <TableCell className="max-w-[220px] text-xs">
                                              {row.descripcionComponente}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">
                                              {formatNumber(
                                                row.cantidadAcumulada
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-xs">
                                              {formatNumber(
                                                row.cantidadNecesaria
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                      <div className="flex items-center justify-end gap-2 pt-3 text-sm text-muted-foreground">
                        <span>Utilizada (BOM) sugerida:</span>
                        <span className="font-bold text-primary tabular-nums">
                          {formatNumber(cantidadNecesaria)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Barra estación + cantidad (como en Órdenes Producción) */}
      <Card className="shadow-lg">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="font-bold text-lg text-foreground">
              {userStationNameText}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {selectedIngresos.length > 0 && (
                <span className="text-xs text-muted-foreground font-medium max-w-[280px] truncate">
                  {selectedIngresos.length === 1
                    ? `Ingreso #${selectedIngresos[0].codigo_ingreso}`
                    : `${selectedIngresos.length} rollos`}{" "}
                  · {selectedIngreso?.codigo_material}
                  {disponibleRollos != null && !isLoadingDisponible
                    ? ` · disp. ${formatNumber(disponibleRollos)}`
                    : ""}
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
                  onBlur={() =>
                    roundDecimalInputOnBlur(
                      cantidadEstimada,
                      setCantidadEstimada
                    )
                  }
                  className={cn(
                    "w-24 h-12 text-center text-lg font-bold",
                    cantidadEstimada.trim() !== "" &&
                      cantidadUtilizada.trim() !== "" &&
                      !estimadaVsUtilizadaOk &&
                      "border-2 border-destructive ring-2 ring-destructive/30"
                  )}
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
                  onBlur={() =>
                    roundDecimalInputOnBlur(
                      cantidadUtilizada,
                      setCantidadUtilizada
                    )
                  }
                  className={cn(
                    "w-24 h-12 text-center text-lg font-bold",
                    ((cantidadEstimada.trim() !== "" &&
                      cantidadUtilizada.trim() !== "" &&
                      !estimadaVsUtilizadaOk) ||
                      stockInsuficiente) &&
                      "border-2 border-destructive ring-2 ring-destructive/30"
                  )}
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
                  onBlur={() =>
                    roundDecimalInputOnBlur(
                      cantidadDesperdicio,
                      setCantidadDesperdicio
                    )
                  }
                  className="w-24 h-12 text-center text-lg font-bold"
                  placeholder="0"
                  disabled={selectedOrders.length === 0}
                />
              </div>
              <Button
                onClick={() => void handleAsociar()}
                disabled={!canAsociar}
                className="h-12 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
              >
                {isAsociando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Asociar consumo"
                )}
              </Button>
            </div>
          </div>
          {cantidadEstimada.trim() !== "" &&
            cantidadUtilizada.trim() !== "" &&
            !estimadaVsUtilizadaOk && (
              <p className="mt-2 text-sm text-destructive font-medium text-right">
                La estimada debe ser ≥ a la utilizada (
                {formatNumber(utilizadaNum)}).
              </p>
            )}
          {stockInsuficiente && (
            <p className="mt-2 text-sm text-destructive font-bold text-right">
              Cantidad insuficiente: disponible{" "}
              {formatNumber(disponibleRollos ?? 0)}
              {selectedIngreso?.unidades
                ? ` ${selectedIngreso.unidades}`
                : ""}{" "}
              no cubre la necesidad de{" "}
              {formatNumber(cantidadACubrir ?? 0)}
              {selectedIngreso?.unidades
                ? ` ${selectedIngreso.unidades}`
                : ""}
              .
            </p>
          )}
        </CardContent>
      </Card>

      {/* Materiales pickeados (solo vía pistoleo QR) */}
      <Card className="shadow-lg w-full">
        <CardHeader className="relative">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg font-bold text-primary flex items-center">
                <Warehouse className="mr-2 h-5 w-5" /> Materiales pickeados (
                {selectedIngresos.length})
              </CardTitle>
              <input
                type="text"
                placeholder="Buscar por código, material o destino..."
                value={searchIngreso}
                onChange={(e) => setSearchIngreso(e.target.value)}
                className="w-80 rounded px-3 py-2 shadow focus:outline-none"
                style={{
                  minWidth: "220px",
                  border: "2px solid rgba(0, 85, 184, 0.5)",
                  boxShadow: "0 0 0 2px rgba(0, 85, 184, 0.08)",
                }}
              />
              <span
                className="ml-2 text-xs text-muted-foreground font-semibold align-middle"
                style={{ minWidth: "40px" }}
              >
                {filteredIngresos.length} mostrados
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredIngresos.length === 0 ? (
            <div className="flex justify-center items-center h-[200px] p-4">
              <p className="text-muted-foreground">
                {selectedIngresos.length === 0
                  ? "Pistolea el QR de la tela para agregar rollos."
                  : "Ningún rollo coincide con la búsqueda."}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[250px] w-full">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Disponible</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>QR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIngresos.map((item) => {
                    const disp = disponiblePorIngreso[item.codigo_ingreso];
                    return (
                      <TableRow
                        key={item.codigo_ingreso}
                        className="bg-secondary/40"
                      >
                        <TableCell>{item.codigo_ingreso}</TableCell>
                        <TableCell className="font-medium">
                          {item.codigo_material}
                        </TableCell>
                        <TableCell className="font-bold">
                          {item.cantidad} {item.unidades}
                        </TableCell>
                        <TableCell className="font-bold tabular-nums text-primary">
                          {disp != null
                            ? `${formatNumber(disp)} ${item.unidades || ""}`
                            : isLoadingDisponible
                              ? "…"
                              : "—"}
                        </TableCell>
                        <TableCell>{item.bodega_origen}</TableCell>
                        <TableCell>{item.bodega_destino}</TableCell>
                        <TableCell
                          className="max-w-[180px] truncate font-mono text-xs"
                          title={item.qr_bmp}
                        >
                          {item.qr_bmp || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

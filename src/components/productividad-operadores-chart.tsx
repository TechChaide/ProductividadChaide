"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { servicioService } from "@/services/servicioDashboard.service";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  Activity,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarDays,
  Clock,
  Package,
  X,
} from "lucide-react";

type ProductividadDia = {
  CodEmpleado: number | string;
  Fecha: string;
  // Nuevos campos del backend
  HorasTotalesFacturables?: number;
  CantidadDia?: number;
  HorasDescontar?: number;
  TiempoSTDTotal?: number;
  // Campos de compatibilidad
  UNIDADES_PROD?: number;
  CantidadDefectos?: number;
  HorasTrabajadasDia?: number;
  ProductividadDiaria?: number;
  ProductividadDiariaTurno?: number;
  PuestoTrabajoReal?: string;
};

type CantidadDia = {
  CodEmpleado: number | string;
  "Año": number;
  Mes: number;
  "Día": number;
  TotalCantidad: number;
  TotalTiempoSTD?: number;
};

type Operador = { codigo: string; nombre: string };

interface BaseProps {
  departamento: string;
  cargo: string;
  consultarKey?: number;
  numDias: number;
  fechaInicio: Date;
  fechaFin: Date;
}

interface MultipleProps extends BaseProps {
  mode: "multiple";
  operadores: Operador[];
}

interface SingleProps extends BaseProps {
  mode: "single";
  operador: Operador;
}

type Props = MultipleProps | SingleProps;

const COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#f59e0b",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#0ea5e9",
  "#8b5cf6",
  "#10b981",
];

function formatearFechaCorta(iso: string): string {
  // iso esperado tipo "2026-05-21" o similar
  if (!iso) return "";
  const partes = iso.substring(0, 10).split("-");
  if (partes.length !== 3) return iso;
  return `${partes[2]}/${partes[1]}`;
}

function formatearNumero(n: number, decimales = 1): string {
  return n.toLocaleString("es-EC", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

function formatearFechaISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function linearRegression(points: Array<{ x: number; y: number }>): {
  slope: number;
  intercept: number;
} | null {
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

type MiniKpiColor = "default" | "green" | "yellow" | "red" | "blue";

function MiniKpi({
  icon,
  label,
  value,
  sub,
  color = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: MiniKpiColor;
}) {
  const colores: Record<MiniKpiColor, string> = {
    default: "bg-white",
    green: "bg-green-50 border-green-200",
    yellow: "bg-yellow-50 border-yellow-200",
    red: "bg-red-50 border-red-200",
    blue: "bg-blue-50 border-blue-200",
  };
  return (
    <div className={`rounded-xl border border-border p-3 shadow-sm ${colores[color]}`}>
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SectionHeader({
  numero,
  titulo,
  descripcion,
}: {
  numero: number;
  titulo: string;
  descripcion: string;
}) {
  return (
    <div className="flex items-start gap-3 border-l-4 border-blue-500 bg-blue-50/50 px-3 py-2 rounded-r-md">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
        {numero}
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">{titulo}</p>
        <p className="text-xs text-muted-foreground">{descripcion}</p>
      </div>
    </div>
  );
}

export function ProductividadOperadoresChart(props: Props) {
  const { departamento, cargo, consultarKey = 0, numDias, fechaInicio, fechaFin } = props;
  const [rows, setRows] = useState<ProductividadDia[]>([]);
  const [cantidadesPorDia, setCantidadesPorDia] = useState<CantidadDia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operadorSeleccionado, setOperadorSeleccionado] = useState<string | null>(null);

  const codigosKey = useMemo(() => {
    if (props.mode === "single") return String(props.operador.codigo);
    return props.operadores
      .map((o) => String(o.codigo))
      .filter((c) => c && c !== "-")
      .sort()
      .join("&");
  }, [props]);

  // Refs para capturar los valores actuales sin re-triggear el effect de modo múltiple
  const codigosKeyRef = useRef(codigosKey);
  codigosKeyRef.current = codigosKey;
  const fechaInicioRef = useRef(fechaInicio);
  fechaInicioRef.current = fechaInicio;
  const fechaFinRef = useRef(fechaFin);
  fechaFinRef.current = fechaFin;
  const departamentoRef = useRef(departamento);
  departamentoRef.current = departamento;
  const cargoRef = useRef(cargo);
  cargoRef.current = cargo;

  // Effect para modo MÚLTIPLE: consulta operador por operador, renderiza a medida que llegan datos
  useEffect(() => {
    if (props.mode !== "multiple") return;
    if (!consultarKey) {
      setRows([]);
      setCantidadesPorDia([]);
      return;
    }

    const operadoresActuales = props.mode === "multiple" ? props.operadores : [];
    if (operadoresActuales.length === 0) return;

    let cancelado = false;
    const cargar = async () => {
      try {
        setLoading(true);
        setError(null);
        setRows([]);
        setCantidadesPorDia([]);

        const fi = formatearFechaISO(fechaInicioRef.current);
        const ff = formatearFechaISO(fechaFinRef.current);

        let rowsAcumulados: ProductividadDia[] = [];
        let fechasAcumulados: CantidadDia[] = [];

        // Dos llamadas por persona, renderizado progresivo
        for (const operador of operadoresActuales) {
          if (cancelado) break;
          try {
            const codigo = String(operador.codigo);
            const [resDias, resFechas] = await Promise.all([
              servicioService.getProductividadSegmentoDiasPersona(codigo, fi, ff, departamentoRef.current, cargoRef.current),
              servicioService.getProductividadSegmentoFechasPersona(codigo, fi, ff, departamentoRef.current, cargoRef.current),
            ]);
            if (cancelado) break;

            rowsAcumulados = [...rowsAcumulados, ...((resDias.data as ProductividadDia[]) ?? [])];
            fechasAcumulados = [...fechasAcumulados, ...((resFechas.data as CantidadDia[]) ?? [])];

            // Renderizar inmediatamente con los datos acumulados
            setRows([...rowsAcumulados]);
            setCantidadesPorDia([...fechasAcumulados]);
          } catch {
            // Continuar con el siguiente operador si falla uno
          }
        }
      } catch {
        if (cancelado) return;
        setRows([]);
        setCantidadesPorDia([]);
        setError("No se pudo cargar la productividad por dias.");
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    cargar();
    return () => { cancelado = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultarKey]);

  // Effect para modo SINGLE: auto-fetch al cambiar operador o fechas
  useEffect(() => {
    if (props.mode !== "single") return;
    const currentCodigosKey = codigosKey;
    if (!currentCodigosKey) {
      setRows([]);
      setCantidadesPorDia([]);
      return;
    }
    let cancelado = false;
    const cargar = async () => {
      try {
        setLoading(true);
        setError(null);
        const fi = formatearFechaISO(fechaInicio);
        const ff = formatearFechaISO(fechaFin);
        const [resDias, resFechas] = await Promise.all([
          servicioService.getProductividadSegmentoDiasPersona(currentCodigosKey, fi, ff, departamento, cargo),
          servicioService.getProductividadSegmentoFechasPersona(currentCodigosKey, fi, ff, departamento, cargo),
        ]);
        if (cancelado) return;
        setRows((resDias.data as ProductividadDia[]) ?? []);
        setCantidadesPorDia((resFechas.data as CantidadDia[]) ?? []);
      } catch {
        if (cancelado) return;
        setRows([]);
        setCantidadesPorDia([]);
        setError("No se pudo cargar la productividad por dias.");
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    cargar();
    return () => { cancelado = true; };
  }, [codigosKey, fechaInicio, fechaFin]);

  // --- Vista MULTIPLE ----------------------------------------------------
  if (props.mode === "multiple") {
    const { operadores } = props;

    const nombrePorCodigo = useMemo(() => {
      const m = new Map<string, string>();
      operadores.forEach((o) => m.set(String(o.codigo), o.nombre));
      return m;
    }, [operadores]);

    const { chartData, codigosActivos, rankingPromedios, totalDiasConProductividad, kpiDepartamento } = useMemo(() => {
      const porFecha = new Map<string, Record<string, number>>();
      const porOperador = new Map<string, {
        horasSTD: number;
        horasFacturables: number;
        horasDescontar: number;
        fechas: Set<string>;
      }>();

      // Desde getProductividadSegmentoDiasPersona: horas y productividad por día
      for (const r of rows) {
        const fecha = (r.Fecha ?? "").substring(0, 10);
        const codigo = String(r.CodEmpleado ?? "");
        if (!fecha || !codigo) continue;

        const horasSTD = Number(r.TiempoSTDTotal) || 0;
        const horasFacturables = Number(r.HorasTotalesFacturables) || 0;
        const horasDescontar = Number(r.HorasDescontar) || 0;

        // Productividad del día para el gráfico de líneas
        const horasEfectivas = horasFacturables * 0.87 - horasDescontar;
        const productividadDia = horasEfectivas > 0 ? (horasSTD / horasEfectivas) * 100 : 0;

        if (!porFecha.has(fecha)) porFecha.set(fecha, {});
        if (porFecha.get(fecha)![codigo] === undefined) {
          porFecha.get(fecha)![codigo] = productividadDia;
        }

        if (!porOperador.has(codigo)) {
          porOperador.set(codigo, { horasSTD: 0, horasFacturables: 0, horasDescontar: 0, fechas: new Set() });
        }
        const op = porOperador.get(codigo)!;
        op.horasSTD += horasSTD;
        op.horasFacturables += horasFacturables;
        op.horasDescontar += horasDescontar;
        op.fechas.add(fecha);
      }

      // Desde getProductividadSegmentoFechasPersona: cantidad y defectos por día
      const cantidadPorOperador = new Map<string, { totalCantidad: number; totalDefectos: number }>();
      for (const r of cantidadesPorDia) {
        const codigo = String(r.CodEmpleado ?? "");
        if (!codigo) continue;
        if (!cantidadPorOperador.has(codigo)) {
          cantidadPorOperador.set(codigo, { totalCantidad: 0, totalDefectos: 0 });
        }
        const op = cantidadPorOperador.get(codigo)!;
        op.totalCantidad += Number(r.TotalCantidad) || 0;
        op.totalDefectos += Number(r.TotalDefectos) || 0;
      }

      const fechasOrdenadas = Array.from(porFecha.keys()).sort();
      const chartData = fechasOrdenadas.map((fecha) => ({
        fecha,
        fechaCorta: formatearFechaCorta(fecha),
        ...porFecha.get(fecha)!,
      }));

      const codigosActivos = Array.from(porOperador.keys());

      // Ranking: productividad desde días, calidad/EGO desde fechas
      const rankingPromedios = codigosActivos
        .map((cod) => {
          const op = porOperador.get(cod)!;
          const horasEfectivas = op.horasFacturables * 0.87 - op.horasDescontar;
          const productividad = horasEfectivas > 0 ? (op.horasSTD / horasEfectivas) * 100 : 0;
          const cOp = cantidadPorOperador.get(cod) ?? { totalCantidad: 0, totalDefectos: 0 };
          const ratioDefectos = cOp.totalCantidad > 0 ? cOp.totalDefectos / cOp.totalCantidad : 0;
          const calidad = (1 - ratioDefectos) * 100;
          const ego = ratioDefectos * productividad;
          return {
            codigo: cod,
            nombre: nombrePorCodigo.get(cod) ?? `Op. ${cod}`,
            promedio: productividad,
            dias: op.fechas.size,
            unidades: cOp.totalCantidad,
            defectos: cOp.totalDefectos,
            calidad,
            ego,
          };
        })
        .sort((a, b) => b.promedio - a.promedio);

      // KPIs departamento
      let dtoHorasSTD = 0, dtoHorasFacturables = 0, dtoHorasDescontar = 0, dtoCantidad = 0, dtoDefectos = 0;
      for (const op of porOperador.values()) {
        dtoHorasSTD += op.horasSTD;
        dtoHorasFacturables += op.horasFacturables;
        dtoHorasDescontar += op.horasDescontar;
      }
      for (const c of cantidadPorOperador.values()) {
        dtoCantidad += c.totalCantidad;
        dtoDefectos += c.totalDefectos;
      }
      const dtoHorasEfectivas = dtoHorasFacturables * 0.87 - dtoHorasDescontar;
      const dtoProductividad = dtoHorasEfectivas > 0 ? (dtoHorasSTD / dtoHorasEfectivas) * 100 : 0;
      const dtoRatioDefectos = dtoCantidad > 0 ? dtoDefectos / dtoCantidad : 0;
      const dtoCalidad = (1 - dtoRatioDefectos) * 100;
      const dtoEGO = dtoRatioDefectos * dtoProductividad;

      return {
        chartData,
        codigosActivos,
        rankingPromedios,
        totalDiasConProductividad: porFecha.size,
        kpiDepartamento: { productividad: dtoProductividad, calidad: dtoCalidad, ego: dtoEGO, totalCantidad: dtoCantidad, totalDefectos: dtoDefectos },
      };
    }, [rows, nombrePorCodigo]);

    const promedioGeneral = useMemo(() => {
      if (rankingPromedios.length === 0) return 0;
      return (
        rankingPromedios.reduce((a, b) => a + b.promedio, 0) /
        rankingPromedios.length
      );
    }, [rankingPromedios]);

    const mejor = rankingPromedios[0];
    const peor = rankingPromedios[rankingPromedios.length - 1];
    
    // Calcular escala dinámica para el eje Y del ranking
    const maxPromedio = rankingPromedios.length > 0 ? Math.max(...rankingPromedios.map(r => r.promedio)) : 100;
    const yAxisMax = maxPromedio > 150 ? Math.ceil(maxPromedio * 0.9) : Math.max(150, Math.ceil(maxPromedio * 1.2));

    // Calcular datos del operador seleccionado para el popover
    const datosOperadorSeleccionado = useMemo(() => {
      if (!operadorSeleccionado) return null;

      const productividadPorDia: Array<{ fechaISO: string; fechaCorta: string; productividad: number }> = [];
      let horasSTDTotal = 0;
      let horasFacturablesTotal = 0;
      let horasDescontarTotal = 0;
      const fechasUnicas = new Set<string>();

      // Acumular desde datos diarios (rows)
      for (const r of rows) {
        if (String(r.CodEmpleado) !== operadorSeleccionado) continue;
        const fecha = (r.Fecha ?? "").substring(0, 10);
        if (!fecha) continue;

        const horasSTD = Number(r.TiempoSTDTotal) || 0;
        const horasFacturables = Number(r.HorasTotalesFacturables) || 0;
        const horasDescontar = Number(r.HorasDescontar) || 0;

        horasSTDTotal += horasSTD;
        horasFacturablesTotal += horasFacturables;
        horasDescontarTotal += horasDescontar;
        fechasUnicas.add(fecha);

        if (!productividadPorDia.find(p => p.fechaISO === fecha)) {
          const horasEfectivas = horasFacturables * 0.87 - horasDescontar;
          const productividad = horasEfectivas > 0 ? (horasSTD / horasEfectivas) * 100 : 0;
          productividadPorDia.push({ fechaISO: fecha, fechaCorta: formatearFechaCorta(fecha), productividad });
        }
      }

      // Totales desde getProductividadSegmentoFechasPersona (cantidadesPorDia)
      let totalCantidad = 0;
      let totalDefectos = 0;
      for (const r of cantidadesPorDia) {
        if (String(r.CodEmpleado) !== operadorSeleccionado) continue;
        totalCantidad += Number(r.TotalCantidad) || 0;
        totalDefectos += Number(r.TotalDefectos) || 0;
      }

      // KPIs
      const horasEfectivasTotal = horasFacturablesTotal * 0.87 - horasDescontarTotal;
      const productividad = horasEfectivasTotal > 0 ? (horasSTDTotal / horasEfectivasTotal) * 100 : 0;
      const ratioDefectos = totalCantidad > 0 ? totalDefectos / totalCantidad : 0;
      const calidad = (1 - ratioDefectos) * 100;
      const ego = ratioDefectos * productividad;

      return {
        productividadPorDia: productividadPorDia.sort((a, b) => a.fechaISO.localeCompare(b.fechaISO)),
        horasSTDTotal,
        totalCantidad,
        totalDefectos,
        diasTrabajados: fechasUnicas.size,
        productividad,
        calidad,
        ego,
      };
    }, [operadorSeleccionado, rows, cantidadesPorDia]);

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Analisis de productividad por operador
              </p>
              <p className="text-xs text-muted-foreground">
                Periodo seleccionado ({numDias} dias) • {codigosActivos.length} operadores con datos
              </p>
            </div>
            {loading && (
              <p className="text-xs text-muted-foreground">Cargando datos...</p>
            )}
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : !loading && rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-sm text-muted-foreground">
              No se encontraron registros de productividad para los operadores en el rango seleccionado.
            </p>
          </div>
        ) : (
          <>
            <SectionHeader
              numero={1}
              titulo="Resumen general del departamento"
              descripcion="Indicadores clave de productividad, defectos y producción acumulada del rango seleccionado"
            />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              <MiniKpi
                icon={<Activity className="h-4 w-4" />}
                label="Productividad dpto."
                value={`${formatearNumero(kpiDepartamento.productividad)}%`}
                sub="STD / Horas efectivas"
                color={kpiDepartamento.productividad >= 90 ? "green" : kpiDepartamento.productividad >= 70 ? "yellow" : "red"}
              />
              <MiniKpi
                icon={<Award className="h-4 w-4" />}
                label="Calidad producción"
                value={`${formatearNumero(kpiDepartamento.calidad)}%`}
                sub="1 - (Defectos / Producido)"
                color={kpiDepartamento.calidad >= 95 ? "green" : kpiDepartamento.calidad >= 85 ? "yellow" : "red"}
              />
              <MiniKpi
                icon={<TrendingUp className="h-4 w-4" />}
                label="EGO"
                value={`${formatearNumero(kpiDepartamento.ego)}%`}
                sub="Ratio defectos × Productividad"
                color={kpiDepartamento.ego <= 5 ? "green" : kpiDepartamento.ego <= 15 ? "yellow" : "red"}
              />
              <MiniKpi
                icon={<Award className="h-4 w-4" />}
                label="Mejor operador"
                value={mejor ? `${formatearNumero(mejor.promedio)}%` : "—"}
                sub={mejor ? mejor.nombre : undefined}
                color="green"
              />
              <MiniKpi
                icon={<TrendingDown className="h-4 w-4" />}
                label="Menor operador"
                value={peor ? `${formatearNumero(peor.promedio)}%` : "—"}
                sub={peor ? peor.nombre : undefined}
                color="red"
              />
              <MiniKpi
                icon={<CalendarDays className="h-4 w-4" />}
                label="Dias con datos"
                value={chartData.length}
                sub={`${totalDiasConProductividad} días con registros`}
              />
            </div>

            <SectionHeader
              numero={2}
              titulo="Evolución diaria por operador"
              descripcion="Línea de productividad día a día por cada operador del rango"
            />
            <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground">
                Productividad diaria por operador
              </p>
              <p className="text-xs text-muted-foreground">
                % de productividad por dia trabajado
              </p>

              <div className="mt-3 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="fechaCorta" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      domain={[0, (max: number) => Math.max(100, Math.ceil(max / 10) * 10)]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => {
                        const nombre = nombrePorCodigo.get(String(name)) ?? String(name);
                        return [`${formatearNumero(Number(value))}%`, nombre];
                      }}
                      labelFormatter={(label) => `Fecha: ${label}`}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11 }}
                      formatter={(value) =>
                        nombrePorCodigo.get(String(value)) ?? String(value)
                      }
                    />
                    <ReferenceLine
                      y={100}
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                      label={{ value: "Meta 100%", fontSize: 10, fill: "#64748b" }}
                    />
                    {codigosActivos.map((cod, idx) => (
                      <Line
                        key={cod}
                        type="monotone"
                        dataKey={cod}
                        stroke={COLORS[idx % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <SectionHeader
              numero={3}
              titulo="Ranking de operadores"
              descripcion="Comparativo del promedio de productividad por operador"
            />
            <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground">
                Ranking promedio por operador
              </p>
              <p className="text-xs text-muted-foreground">
                Promedio de productividad diaria en el rango
              </p>

              <div className="mt-3 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={rankingPromedios.map((r) => ({
                      ...r,
                      etiqueta: r.nombre.length > 18 ? `${r.nombre.slice(0, 16)}…` : r.nombre,
                    }))}
                    margin={{ top: 10, right: 20, left: 0, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="etiqueta"
                      tick={{ fontSize: 10 }}
                      angle={-30}
                      textAnchor="end"
                      interval={0}
                      height={70}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, yAxisMax]}
                    />
                    <Tooltip
                      formatter={(value: any) => [`${formatearNumero(Number(value))}%`, "Promedio"]}
                    />
                    <ReferenceLine
                      y={promedioGeneral}
                      stroke="#0ea5e9"
                      strokeDasharray="4 4"
                      label={{
                        value: `Prom. dpto. ${formatearNumero(promedioGeneral)}%`,
                        fontSize: 10,
                        fill: "#0369a1",
                        position: "insideTopRight",
                      }}
                    />
                    <Bar dataKey="promedio" radius={[6, 6, 0, 0]} onClick={(data: any) => setOperadorSeleccionado(data.codigo)}>
                      {rankingPromedios.map((r, idx) => {
                        const color =
                          r.promedio >= 90
                            ? "#16a34a"
                            : r.promedio >= 70
                              ? "#f59e0b"
                              : "#dc2626";
                        const isSelected = operadorSeleccionado === r.codigo;
                        return <Cell key={r.codigo} fill={isSelected ? "#0ea5e9" : color} opacity={isSelected ? 1 : 0.8} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {maxPromedio > yAxisMax && (
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-semibold">Nota:</span> El máximo operador alcanza {formatearNumero(maxPromedio)}%, el gráfico está escalado para mejor visualización.
                </p>
              )}

              {/* Detalle del operador seleccionado */}
              {operadorSeleccionado && datosOperadorSeleccionado && (
                <div className="mt-4 border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-foreground">
                      {nombrePorCodigo.get(operadorSeleccionado) || `Op. ${operadorSeleccionado}`}
                    </p>
                    <button
                      onClick={() => setOperadorSeleccionado(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* KPIs del operador */}
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4 mb-4">
                    <MiniKpi
                      icon={<Activity className="h-4 w-4" />}
                      label="Productividad"
                      value={`${formatearNumero(datosOperadorSeleccionado.productividad)}%`}
                      sub="STD / Horas efectivas"
                      color={datosOperadorSeleccionado.productividad >= 90 ? "green" : datosOperadorSeleccionado.productividad >= 70 ? "yellow" : "red"}
                    />
                    <MiniKpi
                      icon={<Award className="h-4 w-4" />}
                      label="Calidad"
                      value={`${formatearNumero(datosOperadorSeleccionado.calidad)}%`}
                      sub="1 - (Defectos / Producido)"
                      color={datosOperadorSeleccionado.calidad >= 95 ? "green" : datosOperadorSeleccionado.calidad >= 85 ? "yellow" : "red"}
                    />
                    <MiniKpi
                      icon={<TrendingDown className="h-4 w-4" />}
                      label="EGO"
                      value={`${formatearNumero(datosOperadorSeleccionado.ego)}%`}
                      sub="Ratio defectos × Productividad"
                      color={datosOperadorSeleccionado.ego <= 5 ? "green" : datosOperadorSeleccionado.ego <= 15 ? "yellow" : "red"}
                    />
                    <MiniKpi
                      icon={<Package className="h-4 w-4" />}
                      label="Total producido"
                      value={formatearNumero(datosOperadorSeleccionado.totalCantidad, 0)}
                      sub="Unidades en el rango"
                      color="blue"
                    />
                    <MiniKpi
                      icon={<TrendingDown className="h-4 w-4" />}
                      label="Defectos"
                      value={formatearNumero(datosOperadorSeleccionado.totalDefectos, 0)}
                      sub="Total defectos registrados"
                      color={datosOperadorSeleccionado.totalDefectos === 0 ? "green" : "red"}
                    />
                    <MiniKpi
                      icon={<Clock className="h-4 w-4" />}
                      label="Horas STD"
                      value={formatearNumero(datosOperadorSeleccionado.horasSTDTotal, 2)}
                      sub="Suma TiempoSTDTotal"
                      color="yellow"
                    />
                    <MiniKpi
                      icon={<CalendarDays className="h-4 w-4" />}
                      label="Días trabajados"
                      value={datosOperadorSeleccionado.diasTrabajados}
                      sub="Días con registros"
                    />
                  </div>

                  {/* Evolución de productividad diaria */}
                  <div className="rounded-lg border border-border bg-white p-3">
                    <p className="text-xs font-semibold text-foreground mb-1">Productividad diaria</p>
                    <p className="text-xs text-muted-foreground mb-2">% calculado día a día</p>
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={datosOperadorSeleccionado.productividadPorDia} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="fechaCorta" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[0, (max: number) => Math.max(100, Math.ceil(max / 10) * 10)]} />
                          <Tooltip formatter={(v: any) => [`${formatearNumero(Number(v))}%`, "Productividad"]} labelFormatter={(l) => `Fecha: ${l}`} />
                          <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "Meta 100%", fontSize: 9, fill: "#64748b" }} />
                          <Line type="monotone" dataKey="productividad" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // --- Vista SINGLE ------------------------------------------------------
  const { operador } = props;

  const datosOperador = useMemo(() => {
    const diarios = new Map<
      string,
      {
        fecha: string;
        productividad: number;
        productividadTurno: number;
        unidades: number;
        defectos: number;
      }
    >();

    for (const r of rows) {
      if (String(r.CodEmpleado) !== String(operador.codigo)) continue;
      const fecha = (r.Fecha ?? "").substring(0, 10);
      if (!fecha) continue;

      if (!diarios.has(fecha)) {
        const horasSTD = Number(r.TiempoSTDTotal) || 0;
        const horasFacturables = Number(r.HorasTotalesFacturables) || 0;
        const horasDescontar = Number(r.HorasDescontar) || 0;
        const horasEfectivas = horasFacturables * 0.87 - horasDescontar;
        const productividad = horasEfectivas > 0 ? (horasSTD / horasEfectivas) * 100 : 0;
        diarios.set(fecha, {
          fecha,
          productividad,
          productividadTurno: 0,
          unidades: 0,
          defectos: Number(r.CantidadDefectos) || 0,
        });
      }

      const actual = diarios.get(fecha)!;
      actual.unidades += Number(r.CantidadDia) || Number(r.UNIDADES_PROD) || 0;
    }

    return Array.from(diarios.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [rows, operador.codigo]);

  const resumenPuestos = useMemo(() => {
    const mapa = new Map<
      string,
      {
        puesto: string;
        prodPorDia: Map<string, number>;
        unidades: number;
        defectos: number;
      }
    >();

    for (const r of rows) {
      if (String(r.CodEmpleado) !== String(operador.codigo)) continue;
      const puesto = (r.PuestoTrabajoReal ?? "").trim();
      if (!puesto) continue;
      const fecha = (r.Fecha ?? "").substring(0, 10);
      if (!fecha) continue;

      if (!mapa.has(puesto)) {
        mapa.set(puesto, {
          puesto,
          prodPorDia: new Map<string, number>(),
          unidades: 0,
          defectos: 0,
        });
      }
      const actual = mapa.get(puesto)!;
      actual.unidades += Number(r.CantidadDia) || Number(r.UNIDADES_PROD) || 0;

      if (!actual.prodPorDia.has(fecha)) {
        const horasSTD = Number(r.TiempoSTDTotal) || 0;
        const horasFacturables = Number(r.HorasTotalesFacturables) || 0;
        const horasDescontar = Number(r.HorasDescontar) || 0;
        const horasEfectivas = horasFacturables * 0.87 - horasDescontar;
        const valor = horasEfectivas > 0 ? (horasSTD / horasEfectivas) * 100 : 0;
        if (valor > 0) actual.prodPorDia.set(fecha, valor);
        actual.defectos += Number(r.CantidadDefectos) || 0;
      }
    }

    const lista = Array.from(mapa.values()).map((p) => {
      const vals = Array.from(p.prodPorDia.values());
      const dias = vals.length;
      const promedio = dias > 0 ? vals.reduce((a, b) => a + b, 0) / dias : 0;
      const maximo = dias > 0 ? Math.max(...vals) : 0;
      const minimo = dias > 0 ? Math.min(...vals) : 0;
      return {
        puesto: p.puesto,
        promedio,
        maximo,
        minimo,
        dias,
        unidades: p.unidades,
        defectos: p.defectos,
        unidadesPorDia: dias > 0 ? p.unidades / dias : 0,
      };
    });

    lista.sort((a, b) => b.promedio - a.promedio);
    return lista;
  }, [rows, operador.codigo]);

  const analisis = useMemo(() => {
    if (datosOperador.length === 0) {
      return {
        promedio: 0,
        maximo: 0,
        minimo: 0,
        dias: 0,
        slope: 0,
        totalUnidades: 0,
        totalCantidad: 0,
        chartData: [] as Array<{
          fechaCorta: string;
          productividad: number;
          productividadTurno: number;
          tendencia: number;
        }>,
        cantidadChartData: [] as Array<{
          fechaCorta: string;
          cantidad: number;
        }>,
      };
    }

    const valores = datosOperador.map((d) => d.productividad);
    const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
    const maximo = Math.max(...valores);
    const minimo = Math.min(...valores);

    const puntos = datosOperador.map((d, idx) => ({ x: idx, y: d.productividad }));
    const reg = linearRegression(puntos);
    const slope = reg?.slope ?? 0;
    const intercept = reg?.intercept ?? promedio;

    const chartData = datosOperador.map((d, idx) => ({
      fechaCorta: formatearFechaCorta(d.fecha),
      productividad: d.productividad,
      productividadTurno: d.productividadTurno,
      tendencia: reg ? Number((intercept + slope * idx).toFixed(2)) : promedio,
    }));

    const cantidadChartData = cantidadesPorDia
      .filter((r) => String(r.CodEmpleado) === String(operador.codigo))
      .map((r) => {
        const mes = String(r.Mes).padStart(2, "0");
        const dia = String(r["Día"]).padStart(2, "0");
        const fechaIso = `${r["Año"]}-${mes}-${dia}`;
        return {
          fechaIso,
          fechaCorta: `${dia}/${mes}`,
          cantidad: Number(r.TotalCantidad) || 0,
        };
      })
      .sort((a, b) => a.fechaIso.localeCompare(b.fechaIso))
      .map(({ fechaCorta, cantidad }) => ({ fechaCorta, cantidad }));

    const totalUnidades = datosOperador.reduce((acc, d) => acc + d.unidades, 0);
    const totalCantidad = cantidadesPorDia
      .filter((r) => String(r.CodEmpleado) === String(operador.codigo))
      .reduce((acc, r) => {
        const val = Number(r.TotalCantidad);
        return acc + (Number.isFinite(val) ? val : 0);
      }, 0);

    return {
      promedio,
      maximo,
      minimo,
      dias: valores.length,
      slope,
      totalUnidades,
      totalCantidad,
      chartData,
      cantidadChartData,
    };
  }, [datosOperador, cantidadesPorDia, operador.codigo]);

  const promedioColor: MiniKpiColor =
    analisis.promedio >= 90 ? "green" : analisis.promedio >= 70 ? "yellow" : "red";

  const tendenciaIcon =
    analisis.slope > 0.05 ? (
      <TrendingUp className="h-4 w-4" />
    ) : analisis.slope < -0.05 ? (
      <TrendingDown className="h-4 w-4" />
    ) : (
      <Minus className="h-4 w-4" />
    );

  const tendenciaColor: MiniKpiColor =
    analisis.slope > 0.05 ? "green" : analisis.slope < -0.05 ? "red" : "default";

  const tendenciaTexto =
    analisis.slope > 0.05
      ? "En mejora"
      : analisis.slope < -0.05
        ? "En descenso"
        : "Estable";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Productividad diaria — {operador.nombre}
            </p>
            <p className="text-xs text-muted-foreground">
              Periodo seleccionado ({numDias} dias) • Codigo {operador.codigo}
            </p>
          </div>
          {loading && (
            <p className="text-xs text-muted-foreground">Cargando datos...</p>
          )}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : !loading && datosOperador.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-sm text-muted-foreground">
            No se encontraron registros de productividad para este operador en el rango seleccionado.
          </p>
        </div>
      ) : (
        <>
          <SectionHeader
            numero={1}
            titulo="Resumen general del operador"
            descripcion="Indicadores clave de productividad y producción del rango seleccionado"
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <MiniKpi
              icon={<Activity className="h-4 w-4" />}
              label="Promedio"
              value={`${formatearNumero(analisis.promedio)}%`}
              sub="Productividad diaria"
              color={promedioColor}
            />
            <MiniKpi
              icon={<Award className="h-4 w-4" />}
              label="Maximo"
              value={`${formatearNumero(analisis.maximo)}%`}
              color="green"
            />
            <MiniKpi
              icon={<TrendingDown className="h-4 w-4" />}
              label="Minimo"
              value={`${formatearNumero(analisis.minimo)}%`}
              color="red"
            />
            <MiniKpi
              icon={tendenciaIcon}
              label="Tendencia"
              value={tendenciaTexto}
              sub={`Pendiente ${formatearNumero(analisis.slope, 2)}/dia`}
              color={tendenciaColor}
            />
            <MiniKpi
              icon={<CalendarDays className="h-4 w-4" />}
              label="Dias trabajados"
              value={analisis.dias}
            />
            <MiniKpi
              icon={<Activity className="h-4 w-4" />}
              label="Cantidad total"
              value={formatearNumero(analisis.totalCantidad, 0)}
              sub="Suma diaria TotalCantidad"
              color="yellow"
            />
          </div>

          <SectionHeader
            numero={2}
            titulo="Evolución diaria de productividad"
            descripcion="Comportamiento día a día con productividad por turno y línea de tendencia"
          />
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-foreground">
              Evolucion diaria con linea de tendencia
            </p>
            <p className="text-xs text-muted-foreground">
              Productividad diaria, productividad por turno y tendencia lineal
            </p>

            <div className="mt-3 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analisis.chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="fechaCorta" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    domain={[0, (max: number) => Math.max(100, Math.ceil(max / 10) * 10)]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      const etiqueta =
                        name === "productividad"
                          ? "Productividad diaria"
                          : name === "productividadTurno"
                            ? "Productividad por turno"
                            : "Tendencia";
                      return [`${formatearNumero(Number(value))}%`, etiqueta];
                    }}
                    labelFormatter={(label) => `Fecha: ${label}`}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value) =>
                      value === "productividad"
                        ? "Productividad diaria"
                        : value === "productividadTurno"
                          ? "Productividad por turno"
                          : "Tendencia"
                    }
                  />
                  <ReferenceLine
                    y={analisis.promedio}
                    stroke="#0ea5e9"
                    strokeDasharray="4 4"
                    label={{
                      value: `Prom. ${formatearNumero(analisis.promedio)}%`,
                      fontSize: 10,
                      fill: "#0369a1",
                      position: "insideTopRight",
                    }}
                  />
                  <ReferenceLine
                    y={100}
                    stroke="#94a3b8"
                    strokeDasharray="2 4"
                  />
                  <Line
                    type="monotone"
                    dataKey="productividad"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="productividadTurno"
                    stroke="#a855f7"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                  />
                  <Line
                    type="linear"
                    dataKey="tendencia"
                    stroke="#dc2626"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <SectionHeader
            numero={3}
            titulo="Producción diaria del operador"
            descripcion="Cantidad producida por día (TotalCantidad) en el rango seleccionado"
          />
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-foreground">
              Cantidad producida por día
            </p>
            <p className="text-xs text-muted-foreground">
              TotalCantidad diaria del operador • Total {formatearNumero(analisis.totalCantidad, 0)}
            </p>

            <div className="mt-3 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analisis.cantidadChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="fechaCorta" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: any) => [formatearNumero(Number(value), 0), "Cantidad"]}
                    labelFormatter={(label) => `Fecha: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="cantidad"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {resumenPuestos.length > 0 && (
            <>
            <SectionHeader
              numero={4}
              titulo="Análisis por puesto de trabajo"
              descripcion="Comparativo de rendimiento del operador en cada PuestoTrabajoReal donde trabajó"
            />
            <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground">
                Rendimiento por puesto de trabajo
              </p>
              <p className="text-xs text-muted-foreground">
                Comparativo de productividad promedio por PuestoTrabajoReal • {resumenPuestos.length} puesto(s)
              </p>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {resumenPuestos.map((p, idx) => {
                  const esMejor = idx === 0;
                  const color: MiniKpiColor =
                    p.promedio >= 90 ? "green" : p.promedio >= 70 ? "yellow" : "red";
                  const borderClass = esMejor
                    ? "border-green-300 ring-1 ring-green-200"
                    : "border-border";
                  return (
                    <div
                      key={p.puesto}
                      className={`rounded-lg border ${borderClass} bg-muted/20 p-3`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-semibold text-foreground">{p.puesto}</p>
                        {esMejor && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-700">
                            Mejor
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {p.dias} día(s) trabajado(s)
                      </p>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <MiniKpi
                          icon={<Activity className="h-3.5 w-3.5" />}
                          label="Promedio"
                          value={`${formatearNumero(p.promedio)}%`}
                          color={color}
                        />
                        <MiniKpi
                          icon={<Award className="h-3.5 w-3.5" />}
                          label="Máximo"
                          value={`${formatearNumero(p.maximo)}%`}
                          color="green"
                        />
                        <MiniKpi
                          icon={<TrendingDown className="h-3.5 w-3.5" />}
                          label="Mínimo"
                          value={`${formatearNumero(p.minimo)}%`}
                          color="red"
                        />
                        <MiniKpi
                          icon={<TrendingUp className="h-3.5 w-3.5" />}
                          label="Unid./día"
                          value={formatearNumero(p.unidadesPorDia, 0)}
                          sub={`Total ${formatearNumero(p.unidades, 0)}`}
                          color="blue"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={resumenPuestos.map((p) => ({
                      puesto: p.puesto.length > 14 ? `${p.puesto.slice(0, 12)}…` : p.puesto,
                      promedio: Number(p.promedio.toFixed(2)),
                    }))}
                    margin={{ top: 10, right: 20, left: 0, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="puesto"
                      tick={{ fontSize: 10 }}
                      angle={-20}
                      textAnchor="end"
                      interval={0}
                      height={50}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      formatter={(value: any) => [`${formatearNumero(Number(value))}%`, "Promedio"]}
                    />
                    <Bar dataKey="promedio" radius={[6, 6, 0, 0]}>
                      {resumenPuestos.map((p) => {
                        const fill =
                          p.promedio >= 90
                            ? "#16a34a"
                            : p.promedio >= 70
                              ? "#f59e0b"
                              : "#dc2626";
                        return <Cell key={p.puesto} fill={fill} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

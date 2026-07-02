"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { servicioService } from "@/services/servicioDashboard.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Building2, CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight, Search, Users, X, Check, Package, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type DepartamentoDisponible = {
  id: string;
  nombre: string;
  centro?: string;
};

type OperadorDisponible = {
  codigo: string;
  nombre: string;
  departamento: string;
};

type RangoBusqueda = "3_meses" | "1_mes" | "semana_actual" | "personalizado";

type RegistroProductividad = {
  CodEmpleado: string;
  Año: number;
  Mes: number;
  Día: number;
  TiempoSTD: number;
  TiempoTotalDia: number;
  HORA: string; // "HH:MM"
  UNIDADES_PROD: number;
  PuestoTrabajoReal?: string;
  CargoEmpleado?: string;
  NombreMaterial?: string;
};

type TiempoJustificado = {
  CodEmpleado: string;
  Año: number;
  Mes: number;
  Día: number;
  HorasDescontar: number;
};

type JornadaDia = {
  codEmpleado: string;
  nombreEmpleado: string;
  año: number;
  mes: number;
  dia: number;
  jornada: number;
  fechaHoraInicio: string; // "DD/MM/YYYY HH:MM" - primer registro
  fechaHoraFin: string;    // "DD/MM/YYYY HH:MM" - último registro
  horaInicio: string;
  horaFin: string;
  horasNetas: number;
  horasDescontar: number;
  // Datos de productividad (se agregan después)
  totalCantidad?: number;
  totalDefectos?: number;
  totalTiempoSTD?: number;
};

type ResumenOperador = {
  codEmpleado: string;
  nombre: string;
  totalHorasNetas: number;
  totalA: number;
  totalHorasSTD: number;
  totalHorasDescontar: number;
  totalUnidades: number;
  totalDefectos: number;
  productividad: number;
  calidad: number;
  ego: number;
};

function egoGradientColor(ego: number, minEgo: number, maxEgo: number) {
  if (maxEgo === minEgo) return "hsl(120, 75%, 45%)";
  const ratio = Math.max(0, Math.min(1, (ego - minEgo) / (maxEgo - minEgo)));
  const hue = 0 + 120 * ratio;
  return `hsl(${hue}, 75%, 45%)`;
}

const CENTRO_KEY_PRIORIDAD = [
  "centro",
  "Centro",
  "CENTRO",
  "code_centro",
  "codigoCentro",
  "CodigoCentro",
];

const NOMBRE_KEY_PRIORIDAD = [
  "nombre_departamento",
  "departamento",
  "nombre",
  "name",
  "descripcion",
  "NombreDepartamento",
  "Nombre",
  "DEPARTAMENTO",
  "NOMBRE_DEPARTAMENTO",
];

const ID_KEY_PRIORIDAD = [
  "codigo_departamento",
  "id",
  "codigo",
  "CodigoDepartamento",
  "code",
];

function extraerTextoValido(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio.length > 0 ? limpio : null;
}

function normalizarDepartamento(item: any): DepartamentoDisponible {
  if (typeof item === "string" || typeof item === "number") {
    const texto = String(item).trim();
    return { id: texto, nombre: texto };
  }

  const source = item && typeof item === "object" ? item : {};

  let nombre: string | null = null;

  for (const key of NOMBRE_KEY_PRIORIDAD) {
    nombre = extraerTextoValido(source[key]);
    if (nombre) break;
  }

  if (!nombre) {
    for (const [key, valor] of Object.entries(source)) {
      const esLlaveCandidata =
        /depart|nombre|name|desc/i.test(key) &&
        !/estado|usuario|fecha|rel|activo/i.test(key);

      if (!esLlaveCandidata) continue;

      nombre = extraerTextoValido(valor);
      if (nombre) break;
    }
  }

  if (!nombre) {
    for (const valor of Object.values(source)) {
      nombre = extraerTextoValido(valor);
      if (nombre) break;
    }
  }

  const nombreFinal = nombre ?? "Sin nombre";

  let id: string | null = null;

  for (const key of ID_KEY_PRIORIDAD) {
    const valor = source[key];
    if (typeof valor === "string" || typeof valor === "number") {
      id = String(valor);
      break;
    }
  }

  if (!id) id = nombreFinal;

  return { id: String(id), nombre: nombreFinal };
}

function inicialesDepartamento(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((fragmento) => fragmento[0]?.toUpperCase() ?? "")
    .join("");
}

function normalizarOperador(item: any): OperadorDisponible {
  const source = item && typeof item === "object" ? item : {};

  const nombre =
    extraerTextoValido(source.NOMBRE) ??
    extraerTextoValido(source.nombre) ??
    extraerTextoValido(source.Nombre) ??
    "Sin nombre";

  const codigo =
    extraerTextoValido(source.CODIGO) ??
    extraerTextoValido(source.codigo) ??
    extraerTextoValido(source.Codigo) ??
    "-";

  const departamento =
    extraerTextoValido(source.DEPARTAMENTO) ??
    extraerTextoValido(source.departamento) ??
    extraerTextoValido(source.NombreDepartamento) ??
    "";

  return {
    codigo,
    nombre,
    departamento,
  };
}

function inicioSemanaActual(baseDate: Date): Date {
  const inicio = new Date(baseDate);
  const diaSemana = inicio.getDay();
  const ajuste = diaSemana === 0 ? -6 : 1 - diaSemana;
  inicio.setDate(inicio.getDate() + ajuste);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

function finSemanaActual(baseDate: Date): Date {
  const fin = inicioSemanaActual(baseDate);
  fin.setDate(fin.getDate() + 6);
  fin.setHours(23, 59, 59, 999);
  return fin;
}

function restarMeses(baseDate: Date, meses: number): Date {
  const fecha = new Date(baseDate);
  fecha.setMonth(fecha.getMonth() - meses);
  fecha.setHours(0, 0, 0, 0);
  return fecha;
}

function formatearFecha(date: Date): string {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatearFechaISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calcularRango(rango: RangoBusqueda, baseDate: Date): { desde: Date; hasta: Date } {
  const hoy = new Date(baseDate);
  hoy.setHours(23, 59, 59, 999);

  if (rango === "3_meses") {
    return { desde: restarMeses(baseDate, 3), hasta: hoy };
  }

  if (rango === "1_mes") {
    return { desde: restarMeses(baseDate, 1), hasta: hoy };
  }

  return {
    desde: inicioSemanaActual(baseDate),
    hasta: finSemanaActual(baseDate),
  };
}

function horaAMinutos(hora: string): number {
  const [h, m] = (hora ?? "").split(":").map(Number);
  if (!Number.isFinite(h)) return -1;
  return h * 60 + (m || 0);
}

function minutosAHora(minutos: number): string {
  // Si cruza medianoche (> 24h), ajustar al día siguiente
  const minutosAjustado = minutos % 1440; // 1440 = 24 * 60
  const h = Math.floor(minutosAjustado / 60).toString().padStart(2, "0");
  const m = (minutosAjustado % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function minutosAHoraFin(minutos: number): string {
  // Si cruza medianoche (> 24h), ajustar al día siguiente
  const minutosAjustado = minutos % 1440; // 1440 = 24 * 60
  const h = Math.ceil(minutosAjustado / 60).toString().padStart(2, "0");
  const m = (minutosAjustado % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function formatearFechaHora(timestamp: number): string {
  const fecha = new Date(timestamp);
  const dia = fecha.getDate().toString().padStart(2, "0");
  const mes = (fecha.getMonth() + 1).toString().padStart(2, "0");
  const año = fecha.getFullYear();
  const hora = fecha.getHours().toString().padStart(2, "0");
  const minuto = fecha.getMinutes().toString().padStart(2, "0");
  return `${dia}/${mes}/${año} ${hora}:${minuto}`;
}

function calcularJornadasPorDia(
  registros: RegistroProductividad[],
  nombrePorCodigo: Map<string, string>
): JornadaDia[] {
  const GAP_MINUTOS = 360; // 6 horas

  // PASO 1: Obtener DISTINTOS por (CodEmpleado, Año, Mes, Día, HORA)
  const distintosKey = new Set<string>();
  const notifDistintas: Array<RegistroProductividad & { _ts: number }> = [];

  for (const r of registros) {
    const día = (r as any).Día ?? (r as any).Dia;
    const key = `${r.CodEmpleado}__${r.Año}__${r.Mes}__${día}__${r.HORA}`;
    
    if (!distintosKey.has(key)) {
      distintosKey.add(key);
      
      // Crear timestamp global: Fecha + Hora
      const [h, m] = (r.HORA ?? "00:00").split(":").map(Number);
      const fecha = new Date(r.Año, r.Mes - 1, día);
      fecha.setHours(h, m, 0, 0);
      const ts = fecha.getTime();
      
      notifDistintas.push({
        ...r,
        _ts: ts,
      });
    }
  }

  // PASO 2: Agrupar por empleado y ordenar por TS
  const porEmpleado = new Map<string, typeof notifDistintas>();
  for (const notif of notifDistintas) {
    if (!porEmpleado.has(notif.CodEmpleado)) {
      porEmpleado.set(notif.CodEmpleado, []);
    }
    porEmpleado.get(notif.CodEmpleado)!.push(notif);
  }

  // Ordenar cada empleado por TS
  for (const notifs of porEmpleado.values()) {
    notifs.sort((a, b) => a._ts - b._ts);
  }

  // PASO 3: Calcular gaps y asignar JornadaId TEMPORAL
  type NotifConJornada = typeof notifDistintas[0] & {
    gapMin: number | null;
    jornadaIdTemporal: number;
    fechaJornada: { año: number; mes: number; día: number };
  };

  const notifConJornada: NotifConJornada[] = [];

  for (const [codEmpleado, notifs] of porEmpleado.entries()) {
    let jornadaIdTemporal = 1;

    for (let i = 0; i < notifs.length; i++) {
      const notif = notifs[i];
      let gapMin: number | null = null;

      // Calcular gap con el anterior
      if (i > 0) {
        const prev = notifs[i - 1]._ts;
        const curr = notif._ts;
        gapMin = (curr - prev) / (1000 * 60);
      }

      // Si gap NULL o gap > 360 minutos = nueva jornada
      if (gapMin === null || gapMin > GAP_MINUTOS) {
        if (i > 0) jornadaIdTemporal++;
      }

      // Asignar jornada temporal (sin fechaJornada aún)
      notifConJornada.push({
        ...notif,
        gapMin,
        jornadaIdTemporal,
        fechaJornada: { año: 0, mes: 0, día: 0 }, // Placeholder, se calcula en PASO 4
      });
    }
  }

  // PASO 4: Normalizar fechaJornada para cada jornada temporal
  // Para jornadas que cruzan medianoche, usar el TS más bajo (fecha de INICIO)
  const minTsPorJornada = new Map<string, number>();
  for (const notif of notifConJornada) {
    const key = `${notif.CodEmpleado}__${notif.jornadaIdTemporal}`;
    const tsActual = minTsPorJornada.get(key) ?? Infinity;
    minTsPorJornada.set(key, Math.min(tsActual, notif._ts));
  }

  // Actualizar fechaJornada en todos los notif con la fecha del TS más bajo
  for (const notif of notifConJornada) {
    const key = `${notif.CodEmpleado}__${notif.jornadaIdTemporal}`;
    const minTs = minTsPorJornada.get(key)!;
    const fechaTS = new Date(minTs);
    notif.fechaJornada = {
      año: fechaTS.getFullYear(),
      mes: fechaTS.getMonth() + 1,
      día: fechaTS.getDate(),
    };
  }

  // PASO 5: Re-numerar jornadas por (CodEmpleado + FechaJornada) para que solo haya J1, J2
  const jornadaPorEmpleadoFecha = new Map<string, number>();
  const jornadaIdFinalPorTemporal = new Map<string, number>();

  for (const notif of notifConJornada) {
    const keyTemporal = `${notif.CodEmpleado}__${notif.jornadaIdTemporal}`;
    
    if (!jornadaIdFinalPorTemporal.has(keyTemporal)) {
      // Primera vez que vemos esta jornada temporal
      const keyFecha = `${notif.CodEmpleado}__${notif.fechaJornada.año}__${notif.fechaJornada.mes}__${notif.fechaJornada.día}`;
      const siguienteNum = (jornadaPorEmpleadoFecha.get(keyFecha) ?? 0) + 1;
      jornadaPorEmpleadoFecha.set(keyFecha, siguienteNum);
      jornadaIdFinalPorTemporal.set(keyTemporal, siguienteNum);
    }
  }

  // PASO 6: Para cada empleado + jornadaIdTemporal, obtener FechaJornada (ya normalizada)
  const fechaJornadaPorEmpleadoJornada = new Map<
    string,
    { año: number; mes: number; día: number }
  >();

  for (const notif of notifConJornada) {
    const key = `${notif.CodEmpleado}__${notif.jornadaIdTemporal}`;
    if (!fechaJornadaPorEmpleadoJornada.has(key)) {
      fechaJornadaPorEmpleadoJornada.set(key, notif.fechaJornada);
    }
  }

  // PASO 7: Agrupar registros ORIGINALES con JornadaId FINAL
  const registrosConJornada = registros.map((r) => {
    const día = (r as any).Día ?? (r as any).Dia;
    const [h, m] = (r.HORA ?? "00:00").split(":").map(Number);
    const fecha = new Date(r.Año, r.Mes - 1, día);
    fecha.setHours(h, m, 0, 0);
    const ts = fecha.getTime();

    // Buscar en notifConJornada el jornadaIdTemporal correspondiente
    const notif = notifConJornada.find(
      (n) =>
        n.CodEmpleado === r.CodEmpleado &&
        n.Año === r.Año &&
        n.Mes === r.Mes &&
        ((n as any).Día ?? (n as any).Dia) === día &&
        n.HORA === r.HORA
    );

    const jornadaIdTemporal = notif?.jornadaIdTemporal ?? 1;
    const jornadaIdFinal = jornadaIdFinalPorTemporal.get(
      `${r.CodEmpleado}__${jornadaIdTemporal}`
    ) ?? 1;
    const fechaJornada =
      fechaJornadaPorEmpleadoJornada.get(
        `${r.CodEmpleado}__${jornadaIdTemporal}`
      ) || {
        año: r.Año,
        mes: r.Mes,
        día,
      };

    return { ...r, _ts: ts, _jornadaId: jornadaIdFinal, _fechaJornada: fechaJornada };
  });

  // PASO 8: Agrupar registros por (CodEmpleado, FechaJornada, JornadaId FINAL)
  const gruposJornada = new Map<
    string,
    typeof registrosConJornada
  >();

  for (const r of registrosConJornada) {
    const key = `${r.CodEmpleado}__${r._fechaJornada.año}__${r._fechaJornada.mes}__${r._fechaJornada.día}__${r._jornadaId}`;
    if (!gruposJornada.has(key)) {
      gruposJornada.set(key, []);
    }
    gruposJornada.get(key)!.push(r);
  }

  // PASO 9: Calcular jornadas con horas netas (floor/ceil)
  const resultado: JornadaDia[] = [];

  for (const [key, regs] of gruposJornada.entries()) {
    const parts = key.split("__");
    const codEmpleado = parts[0];
    const año = Number(parts[1]);
    const mes = Number(parts[2]);
    const día = Number(parts[3]);
    const jornadaId = Number(parts[4]);

    const nombreEmpleado = nombrePorCodigo.get(codEmpleado) ?? `Op. ${codEmpleado}`;
    const fechaJornada = regs[0]._fechaJornada;

    // Ordenar registros por timestamp para encontrar primero y último
    const regsOrdenados = [...regs].sort((a, b) => a._ts - b._ts);
    const tsInicio = regsOrdenados[0]._ts;
    const tsFin = regsOrdenados[regsOrdenados.length - 1]._ts;

    // Calcular horas netas usando floor/ceil sobre timestamps reales
    const fechaInicioObj = new Date(tsInicio);
    const fechaFinObj = new Date(tsFin);
    const minutosInicioDelDia = fechaInicioObj.getHours() * 60 + fechaInicioObj.getMinutes();
    const minutosFinDelDia = fechaFinObj.getHours() * 60 + fechaFinObj.getMinutes();

    const horaInicioMinutos = Math.floor(minutosInicioDelDia / 60) * 60; // floor al inicio
    const horaFinMinutos = Math.ceil(minutosFinDelDia / 60) * 60; // ceil al fin
    const horasNetas = (horaFinMinutos - horaInicioMinutos) / 60;

    resultado.push({
      codEmpleado,
      nombreEmpleado,
      año: fechaJornada.año,
      mes: fechaJornada.mes,
      dia: fechaJornada.día,
      jornada: jornadaId,
      fechaHoraInicio: formatearFechaHora(tsInicio),
      fechaHoraFin: formatearFechaHora(tsFin),
      horaInicio: minutosAHora(horaInicioMinutos),
      horaFin: minutosAHoraFin(horaFinMinutos),
      horasNetas: Math.round(horasNetas * 100) / 100,
      horasDescontar: 0, // Se asignará después
    });
  }

  // PASO 10: Ordenar resultado
  resultado.sort((a, b) => {
    if (a.codEmpleado !== b.codEmpleado)
      return a.codEmpleado.localeCompare(b.codEmpleado);
    if (a.año !== b.año) return a.año - b.año;
    if (a.mes !== b.mes) return a.mes - b.mes;
    if (a.dia !== b.dia) return a.dia - b.dia;
    return a.jornada - b.jornada;
  });

  return resultado;
}

function enriquecerJornadasConProductividad(
  jornadas: JornadaDia[],
  datosProductividad: Array<{
    CodEmpleado: string;
    Año: number;
    Mes: number;
    Día: number;
    TotalCantidad: number;
    TotalDefectos: number;
    TotalTiempoSTD: number;
  }>,
  justificados: TiempoJustificado[]
): JornadaDia[] {
  // Índice de horas a descontar por (CodEmpleado, Año, Mes, Día)
  const descontarIdx = new Map<string, number>();
  for (const j of justificados) {
    const día = (j as any).Día ?? (j as any).Dia;
    const key = `${j.CodEmpleado}__${j.Año}__${j.Mes}__${día}`;
    descontarIdx.set(key, (descontarIdx.get(key) ?? 0) + j.HorasDescontar);
  }

  // Índice de datos de productividad por (CodEmpleado, Año, Mes, Día)
  const productividadIdx = new Map<string, typeof datosProductividad[0]>();
  for (const datos of datosProductividad) {
    const día = (datos as any).Día ?? (datos as any).Dia;
    const key = `${datos.CodEmpleado}__${datos.Año}__${datos.Mes}__${día}`;
    productividadIdx.set(key, datos);
  }

  // Enriquecer cada jornada
  return jornadas.map((jornada) => {
    const keyDescontar = `${jornada.codEmpleado}__${jornada.año}__${jornada.mes}__${jornada.dia}`;
    const keyProductividad = `${jornada.codEmpleado}__${jornada.año}__${jornada.mes}__${jornada.dia}`;

    const horasDescontar = jornada.jornada === 1 ? (descontarIdx.get(keyDescontar) ?? 0) : 0;
    const datosProd = productividadIdx.get(keyProductividad);

    return {
      ...jornada,
      horasDescontar,
      totalCantidad: datosProd?.TotalCantidad ?? 0,
      totalDefectos: datosProd?.TotalDefectos ?? 0,
      totalTiempoSTD: datosProd?.TotalTiempoSTD ?? 0,
    };
  });
}

const OPCIONES_RANGO: Array<{ value: Exclude<RangoBusqueda, "personalizado">; label: string }> = [
  // { value: "3_meses", label: "3 meses" },
  // { value: "1_mes", label: "1 mes" },
  { value: "semana_actual", label: "Semana actual" },
];

export function DashboardDshCard() {
  const isMobile = useIsMobile();
  const [departamentos, setDepartamentos] = useState<DepartamentoDisponible[]>([]);
  const [departamentoSeleccionado, setDepartamentoSeleccionado] = useState<string | null>(null);
  const [rangoBusqueda, setRangoBusqueda] = useState<RangoBusqueda>("semana_actual");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operadores, setOperadores] = useState<OperadorDisponible[]>([]);
  const [loadingOperadores, setLoadingOperadores] = useState(false);
  const [errorOperadores, setErrorOperadores] = useState<string | null>(null);
  const [rangoPersonalizado, setRangoPersonalizado] = useState<DateRange | undefined>(undefined);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [filtrosDepartamentos, setFiltrosDepartamentos] = useState<any>(null);
  const [busquedaFiltros, setBusquedaFiltros] = useState("");
  const [filtroIndex, setFiltroIndex] = useState(0);
  const [departamentoIndex, setDepartamentoIndex] = useState(0);
  const [filtrosExpandido, setFiltrosExpandido] = useState(false);
  const [filtrosSeleccionados, setFiltrosSeleccionados] = useState<string[]>([]);

  // Estado para datos de productividad (Paso 2)
  const [jornadasCalculadas, setJornadasCalculadas] = useState<JornadaDia[]>([]);
  const [loadingConsulta, setLoadingConsulta] = useState(false);
  const [operadorCargando, setOperadorCargando] = useState<string | null>(null);
  const [operadoresCargados, setOperadoresCargados] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const resumenOperadores = useMemo(() => {
    const agrupado = new Map<string, JornadaDia[]>();
    jornadasCalculadas.forEach((jornada) => {
      if (!agrupado.has(jornada.codEmpleado)) {
        agrupado.set(jornada.codEmpleado, []);
      }
      agrupado.get(jornada.codEmpleado)!.push(jornada);
    });

    const operadores = Array.from(agrupado.entries()).map(([codEmpleado, jornadas]): ResumenOperador => {
      const nombre = jornadas[0]?.nombreEmpleado ?? `Op. ${codEmpleado}`;
      const totalHorasNetas = jornadas.reduce((sum, j) => sum + j.horasNetas, 0);
      const totalA = totalHorasNetas * 0.13;
      const totalHorasSTD = jornadas.reduce((sum, j) => sum + (j.totalTiempoSTD ?? 0), 0);
      const totalHorasDescontar = jornadas.reduce((sum, j) => sum + (j.horasDescontar || 0), 0);
      const totalUnidades = jornadas.reduce((sum, j) => sum + (j.totalCantidad ?? 0), 0);
      const totalDefectos = jornadas.reduce((sum, j) => sum + (j.totalDefectos ?? 0), 0);
      const horasTeoricasEB = totalHorasNetas - totalA - totalHorasDescontar;
      const productividad = horasTeoricasEB > 0 ? (totalHorasSTD / horasTeoricasEB) * 100 : 0;
      const calidad = totalUnidades > 0 ? (1 - totalDefectos / totalUnidades) * 100 : 0;
      const ego = productividad * calidad / 100;

      return {
        codEmpleado,
        nombre,
        totalHorasNetas,
        totalA,
        totalHorasSTD,
        totalHorasDescontar,
        totalUnidades,
        totalDefectos,
        productividad,
        calidad,
        ego,
      };
    });

    const operadorMejorEgo = operadores.length > 0 ? operadores.reduce(
      (best, current) => (current.ego > best.ego ? current : best),
      operadores[0]
    ) : { codEmpleado: "", nombre: "N/A", totalHorasNetas: 0, totalA: 0, totalHorasSTD: 0, totalHorasDescontar: 0, totalUnidades: 0, productividad: 0, calidad: 0, ego: 0 };

    const operadorPeorEgo = operadores.length > 0 ? operadores.reduce(
      (worst, current) => (current.ego < worst.ego ? current : worst),
      operadores[0]
    ) : { codEmpleado: "", nombre: "N/A", totalHorasNetas: 0, totalA: 0, totalHorasSTD: 0, totalHorasDescontar: 0, totalUnidades: 0, productividad: 0, calidad: 0, ego: 0 };

    const operadoresOrdenados = [...operadores].sort((a, b) => b.ego - a.ego);
    const minEgo = operadoresOrdenados.length > 0 ? operadoresOrdenados[operadoresOrdenados.length - 1].ego : 0;

    const totalDefectosTodos = operadores.reduce((sum, op) => sum + (op.totalDefectos ?? 0), 0);
    const promedioProductividad = operadores.length > 0 ? operadores.reduce((sum, op) => sum + op.productividad, 0) / operadores.length : 0;
    const promedioEgo = operadores.length > 0 ? operadores.reduce((sum, op) => sum + op.ego, 0) / operadores.length : 0;

    return {
      agrupadoPorOperador: agrupado,
      chartData: operadoresOrdenados.map((op) => ({
        name: op.nombre,
        productividad: Number(op.productividad.toFixed(2)),
        ego: Number(op.ego.toFixed(2)),
      })),
      totalUnidadesTodos: operadores.reduce((sum, op) => sum + op.totalUnidades, 0),
      totalDefectosTodos,
      maxEgo: operadoresOrdenados.length > 0 ? operadoresOrdenados[0].ego : 0,
      minEgo,
      maxProductividad: operadores.reduce((max, op) => Math.max(max, op.productividad), 0),
      promedioProductividad,
      promedioEgo,
      operadorMejorEgo,
      operadorPeorEgo,
    };
  }, [jornadasCalculadas]);
  
  useEffect(() => {
    const cargarDepartamentos = async () => {
      try {
        setLoading(true);
        const response = await servicioService.getDepartamentosDisponiblesProduccion();
        const departamentosNormalizados = ((response.data as any[]) ?? [])
          .map(normalizarDepartamento)
          .filter((item) => item.nombre.trim().length > 0);

        setDepartamentos(departamentosNormalizados);
        setDepartamentoSeleccionado(null);
        setError(null);
      } catch {
        setError("No se pudieron cargar los departamentos disponibles.");
      } finally {
        setLoading(false);
      }
    };

    cargarDepartamentos();
  }, []);

  useEffect(() => {
    const cargarFiltrosDepartamentos = async () => {
      try {
        const response = await servicioService.getFiltrosDepartamentos();
        setFiltrosDepartamentos(response.data);
      } catch (err) {
        console.error("Error al cargar filtros de departamentos:", err);
      }
    };

    if (departamentos.length > 0 && !loading) {
      cargarFiltrosDepartamentos();
    }
  }, [departamentos, loading]);

  const seleccionado = useMemo(
    () => departamentos.find((d) => d.id === departamentoSeleccionado) ?? null,
    [departamentos, departamentoSeleccionado]
  );

  const rangoFechas = useMemo(() => {
    if (rangoBusqueda === "personalizado" && rangoPersonalizado?.from) {
      return {
        desde: rangoPersonalizado.from,
        hasta: rangoPersonalizado.to ?? rangoPersonalizado.from,
      };
    }
    return calcularRango(rangoBusqueda as Exclude<RangoBusqueda, "personalizado">, new Date());
  }, [rangoBusqueda, rangoPersonalizado]);

  const numDiasRango = useMemo(() => {
    if (rangoBusqueda === "personalizado" && rangoPersonalizado?.from && rangoPersonalizado?.to) {
      const diff = Math.ceil(
        (rangoPersonalizado.to.getTime() - rangoPersonalizado.from.getTime()) / (1000 * 60 * 60 * 24)
      );
      return Math.max(1, diff + 1);
    }
    if (rangoBusqueda === "3_meses") return 90;
    if (rangoBusqueda === "1_mes") return 30;
    return 7;
  }, [rangoBusqueda, rangoPersonalizado]);
  const operadoresPorVista = isMobile ? 1 : 3;
  
  // Necesario declara primero para usarse en operadoresFiltrados
  const cargosSeleccionados = useMemo(() => {
    const cargosUnicos = new Set<string>();
    const codigosEmpleadoUnicos = new Set<string>();

    // Para cada cargo seleccionado, agregar cargo y códigos de empleado
    filtrosDepartamentos?.forEach((filtro: any) => {
      const id = `${filtro.CargoEmpleado || ""}`;
      if (filtrosSeleccionados.includes(id)) {
        if (filtro.CargoEmpleado) cargosUnicos.add(filtro.CargoEmpleado);
        if (filtro.CodEmpleado) codigosEmpleadoUnicos.add(String(filtro.CodEmpleado));
      }
    });

    console.log("Cargos únicos seleccionados:", Array.from(cargosUnicos));
    console.log("Códigos de empleado para cargos seleccionados:", Array.from(codigosEmpleadoUnicos));

    return {
      cargosString: Array.from(cargosUnicos).join("&"),
      codigosEmpleadoString: Array.from(codigosEmpleadoUnicos).join("&"),
      codigosEmpleadoSet: codigosEmpleadoUnicos,
    };
  }, [filtrosSeleccionados, filtrosDepartamentos]);

  // Filtrar operadores por cargos seleccionados
  const operadoresFiltradosPorCargos = useMemo(() => {
    // Si no hay cargos seleccionados, retornar todos los operadores
    if (cargosSeleccionados.codigosEmpleadoSet.size === 0) {
      return operadores;
    }

    // Filtrar operadores que coincidan con los códigos extraídos de los cargos
    return operadores.filter((operador) => 
      cargosSeleccionados.codigosEmpleadoSet.has(operador.codigo)
    );
  }, [operadores, cargosSeleccionados]);

  const operadoresFiltrados = useMemo(() => {
    return operadoresFiltradosPorCargos;
  }, [operadoresFiltradosPorCargos]);

  const filtrosFiltrados = useMemo(() => {
    if (!filtrosDepartamentos || !Array.isArray(filtrosDepartamentos)) return [];
    
    // Filtrar por departamento y obtener cargos únicos
    const cargosMap = new Map<string, any>();
    
    filtrosDepartamentos.forEach((filtro: any) => {
      const centroMatch = !seleccionado?.centro || filtro.Centro === seleccionado.centro;
      const deptMatch = filtro.Departamento === seleccionado?.nombre;
      
      if (centroMatch && deptMatch && filtro.CargoEmpleado) {
        const cargo = String(filtro.CargoEmpleado).trim();
        if (cargo && !cargosMap.has(cargo)) {
          cargosMap.set(cargo, filtro);
        }
      }
    });
    
    let resultados = Array.from(cargosMap.values());
    
    // Filtrar por búsqueda
    const termino = busquedaFiltros.trim().toLowerCase();
    if (termino) {
      resultados = resultados.filter((filtro: any) => {
        const cargoBusqueda = String(filtro.CargoEmpleado || "").toLowerCase();
        return cargoBusqueda.includes(termino);
      });
    }
    
    // Ordenar alfabéticamente por cargo
    resultados.sort((a: any, b: any) => {
      return (a.CargoEmpleado || "").localeCompare(b.CargoEmpleado || "", "es-EC");
    });
    
    return resultados;
  }, [filtrosDepartamentos, seleccionado, busquedaFiltros]);

  const filtrosPorVista = 3;
  const maxFiltroIndex = Math.max(0, filtrosFiltrados.length - filtrosPorVista);
  const filtrosPaginados = useMemo(() => {
    return filtrosFiltrados.slice(filtroIndex, filtroIndex + filtrosPorVista);
  }, [filtrosFiltrados, filtroIndex, filtrosPorVista]);

  const handlePrevFiltro = () => {
    setFiltroIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextFiltro = () => {
    setFiltroIndex((prev) => Math.min(maxFiltroIndex, prev + 1));
  };

  const generarIdFiltro = (filtro: any): string => {
    return `${filtro.CargoEmpleado || ""}`;
  };

  const agruparFiltrosPorLetra = (filtros: any[]) => {
    const grupos: { [key: string]: any[] } = {};
    
    filtros.forEach((filtro) => {
      const texto = filtro.CargoEmpleado;
      const primera = (texto || "")[0]?.toUpperCase() || "#";
      if (!grupos[primera]) grupos[primera] = [];
      grupos[primera].push(filtro);
    });
    
    // Ordenar claves alfabéticamente
    return Object.keys(grupos).sort().reduce((acc, key) => {
      acc[key] = grupos[key];
      return acc;
    }, {} as { [key: string]: any[] });
  };

  const toggleFiltroSeleccionado = (filtro: any) => {
    const id = generarIdFiltro(filtro);
    setFiltrosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const toggleSeleccionarTodos = () => {
    if (filtrosSeleccionados.length === filtrosFiltrados.length) {
      // Si todos están seleccionados, deseleccionar todos
      setFiltrosSeleccionados([]);
    } else {
      // Seleccionar todos
      const todosLosIds = filtrosFiltrados.map((filtro: any) => generarIdFiltro(filtro));
      setFiltrosSeleccionados(todosLosIds);
    }
  };

  const toggleSeleccionarTodosPorLetra = (filtros: any[]) => {
    const idsDeEstaLetra = filtros.map((filtro: any) => generarIdFiltro(filtro));
    const todosSeleccionadosEnLetra = idsDeEstaLetra.every((id) =>
      filtrosSeleccionados.includes(id)
    );

    if (todosSeleccionadosEnLetra) {
      // Si todos están seleccionados en esta letra, deseleccionar
      setFiltrosSeleccionados((prev) =>
        prev.filter((id) => !idsDeEstaLetra.includes(id))
      );
    } else {
      // Seleccionar todos en esta letra
      setFiltrosSeleccionados((prev) => {
        const nuevoSet = new Set(prev);
        idsDeEstaLetra.forEach((id) => nuevoSet.add(id));
        return Array.from(nuevoSet);
      });
    }
  };

  const isFiltroSeleccionado = (filtro: any): boolean => {
    return filtrosSeleccionados.includes(generarIdFiltro(filtro));
  };

  const filtrosSeleccionadosString = filtrosSeleccionados.join("&");

  const departamentosPorVista = 3;
  const maxDepartamentoIndex = Math.max(0, departamentos.length - departamentosPorVista);
  const departamentosPaginados = useMemo(() => {
    return departamentos.slice(departamentoIndex, departamentoIndex + departamentosPorVista);
  }, [departamentos, departamentoIndex, departamentosPorVista]);

  const handlePrevDepartamento = () => {
    setDepartamentoIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextDepartamento = () => {
    setDepartamentoIndex((prev) => Math.min(maxDepartamentoIndex, prev + 1));
  };

  const maxOperadorIndex = Math.max(0, operadoresFiltrados.length - operadoresPorVista);
  const totalPaginasOperador = Math.max(1, Math.ceil(operadoresFiltrados.length / operadoresPorVista));
  const paginaActualOperador = 0;
  const operadoresPaginados = useMemo(() => {
    return operadoresFiltrados;
  }, [operadoresFiltrados]);

  useEffect(() => {
    const cargarOperadores = async () => {
      if (!seleccionado) {
        setOperadores([]);
        setErrorOperadores(null);
        return;
      }

      try {
        setLoadingOperadores(true);
        setErrorOperadores(null);

        const response = await servicioService.getOperadoresPorNombredeAreaYFechaInicio(
          seleccionado.nombre,
          rangoFechas.desde
        );

        const operadoresNormalizados = ((response.data as any[]) ?? [])
          .map(normalizarOperador)
          .filter((item) => item.nombre !== "Sin nombre");

        setOperadores(operadoresNormalizados);
      } catch {
        setOperadores([]);
        setErrorOperadores("No se pudieron cargar los operadores para el departamento seleccionado.");
      } finally {
        setLoadingOperadores(false);
      }
    };

    cargarOperadores();
  }, [seleccionado]);

  useEffect(() => {
    setFiltroIndex(0);
  }, [busquedaFiltros, filtrosFiltrados.length]);

  useEffect(() => {
    setDepartamentoIndex(0);
    setDepartamentoSeleccionado(null);
    setFiltrosSeleccionados([]);
    setJornadasCalculadas([]);
    setOperadoresCargados(0);
  }, [departamentos.length]);

  // Mapa nombre por código para calcularJornadasPorDia
  const nombrePorCodigoMap = useMemo(() => {
    const m = new Map<string, string>();
    operadores.forEach((o) => m.set(o.codigo, o.nombre));
    return m;
  }, [operadores]);

  const cancelarConsulta = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoadingConsulta(false);
    setOperadorCargando(null);
  };

  const consultarProductividad = async () => {
    if (!operadoresFiltradosPorCargos.length || !seleccionado) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setOperadoresCargados(0);
    setLoadingConsulta(true);

    const fi = formatearFechaISO(rangoFechas.desde);
    const ff = formatearFechaISO(rangoFechas.hasta);

    let resultadoFinal: JornadaDia[] = [...jornadasCalculadas];

    for (const operador of operadoresFiltradosPorCargos) {
      const codigo = String(operador.codigo);
      setOperadorCargando(codigo);
      if (controller.signal.aborted) break;

      try {
        const [resRegistros, resJustificados, resProductividad] = await Promise.all([
          servicioService.getRegistrosProductividadPersonas(
            codigo, fi, ff, seleccionado.nombre, cargosSeleccionados.cargosString
          ),
          servicioService.getTiemposJustificadosOperadores(codigo, fi, ff),
          servicioService.getProductividadSegmentoFechasPersona(
            codigo, fi, ff, seleccionado.nombre, cargosSeleccionados.cargosString
          ),
        ]);

        if (controller.signal.aborted) break;

        let registrosCopia = ((resRegistros.data as RegistroProductividad[]) ?? []).map((item) => ({ ...item }));
        const justificadosCopia = ((resJustificados.data as TiempoJustificado[]) ?? []).map((item) => ({ ...item }));
        const productividadCopia = ((resProductividad.data as any[]) ?? []).map((item) => ({ ...item })) as Array<{
          CodEmpleado: string;
          Año: number;
          Mes: number;
          Día: number;
          TotalCantidad: number;
          TotalDefectos: number;
          TotalTiempoSTD: number;
        }>;

        const jornadas = calcularJornadasPorDia(registrosCopia, nombrePorCodigoMap);
        const jornadasEnriquecidas = enriquecerJornadasConProductividad(jornadas, productividadCopia, justificadosCopia);

        // Limpiar la copia de datos una vez procesado
        registrosCopia = [];
        productividadCopia.length = 0;
        justificadosCopia.length = 0;

        resultadoFinal = [...resultadoFinal, ...jornadasEnriquecidas];
        setJornadasCalculadas(resultadoFinal);
        setOperadoresCargados((n) => n + 1);
      } catch {
        if (controller.signal.aborted) break;
        setOperadoresCargados((n) => n + 1);
      }
    }

    abortControllerRef.current = null;
    setOperadorCargando(null);
    setLoadingConsulta(false);
  };

  const etiquetasResumen = [
    {
      label: "Departamentos",
      value: String(departamentos.length).padStart(2, "0"),
      detail: seleccionado ? `Activo: ${seleccionado.nombre}` : "Elige una vista de trabajo",
      icon: Building2,
      accent: "text-emerald-600",
    },
    {
      label: "Operadores",
      value: String(operadoresFiltradosPorCargos.length).padStart(2, "0"),
      detail: loadingOperadores ? "Actualizando listado..." : cargosSeleccionados.codigosEmpleadoSet.size > 0 ? `Filtrados por ${cargosSeleccionados.cargosString.split("&").length} cargo(s)` : "Disponibles con el filtro actual",
      icon: Users,
      accent: "text-sky-600",
    },
    {
      label: "Rango",
      value: `${numDiasRango}`,
      detail: `${formatearFecha(rangoFechas.desde)} - ${formatearFecha(rangoFechas.hasta)}`,
      icon: CalendarIcon,
      accent: "text-amber-600",
    },
  ];

  return (
    <Card className="overflow-hidden border-border/60 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.96))] shadow-sm">
      <CardHeader className="border-b border-border/60 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_24%),radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_22%)] px-6 py-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,420px)] xl:items-start">
          <div className="space-y-5">
            <div className="space-y-3">
              <div>
                <CardTitle className="text-2xl font-semibold tracking-tight">Panel de exploración operacional</CardTitle>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Selecciona un departamento, define el rango y navega entre la lectura global y el detalle por operador desde una misma superficie.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {etiquetasResumen.map((item) => {
                const Icono = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border/60 bg-white/80 p-4 shadow-sm backdrop-blur"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{item.value}</p>
                      </div>
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/60">
                        <Icono className={`h-5 w-5 ${item.accent}`} />
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-border/60 bg-white/85 p-5 shadow-sm backdrop-blur">

            <div className="mt-4 flex flex-wrap gap-2">
              {OPCIONES_RANGO.map((opcion) => (
                <Button
                  key={opcion.value}
                  type="button"
                  size="sm"
                  variant={rangoBusqueda === opcion.value ? "default" : "outline"}
                  className={rangoBusqueda === opcion.value ? "shadow-sm" : "bg-white"}
                  onClick={() => setRangoBusqueda(opcion.value)}
                >
                  {opcion.label}
                </Button>
              ))}

              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant={rangoBusqueda === "personalizado" ? "default" : "outline"}
                    className="gap-1.5"
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Personalizado
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={rangoPersonalizado}
                    onSelect={(range) => {
                      setRangoPersonalizado(range);
                      setRangoBusqueda("personalizado");
                      if (range?.from && range?.to) {
                        setPopoverOpen(false);
                      }
                    }}
                    numberOfMonths={2}
                    disabled={{ after: new Date() }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Rango activo
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                Desde {formatearFecha(rangoFechas.desde)} hasta {formatearFecha(rangoFechas.hasta)}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {numDiasRango} día(s) considerados en la comparación actual.
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-1 py-1">
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-[132px] rounded-2xl border border-border bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : departamentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay departamentos disponibles.</p>
        ) : (
          <div className="space-y-1">
            <section className="rounded-3xl border border-border/60 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Paso 1
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">Selecciona el departamento base</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Mantengo la lógica original: el departamento define los operadores y habilita el análisis posterior.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit bg-white">
                  {seleccionado ? `Activo: ${seleccionado.nombre}` : "Pendiente de selección"}
                </Badge>
              </div>

              <div className="mt-4 flex items-center gap-3">
                {departamentos.length > departamentosPorVista && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    disabled={departamentoIndex === 0}
                    onClick={handlePrevDepartamento}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}

                <div className={isMobile ? "grid grid-cols-1 gap-3 flex-1" : "grid grid-cols-1 gap-3 md:grid-cols-3 flex-1"}>
                {departamentosPaginados.map((departamento) => {
                const isSelected = departamento.id === departamentoSeleccionado;

                return (
                  <button
                    key={departamento.id}
                    type="button"
                    onClick={() => setDepartamentoSeleccionado(departamento.id)}
                    aria-pressed={isSelected}
                    className={[
                      "group relative min-h-[100px] rounded-2xl border px-4 py-3 text-left",
                      "transition-all duration-200",
                      isSelected
                        ? "border-primary bg-primary/[0.04] shadow-md ring-1 ring-primary/25"
                        : "border-border bg-white shadow-sm hover:-translate-y-0.5 hover:border-primary/40 hover:shadow",
                    ].join(" ")}
                  >
                    <div className="flex h-full flex-col justify-between gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                          Departamento
                          </p>
                          <p className="mt-1 text-sm font-semibold leading-tight text-foreground truncate">
                            {departamento.nombre}
                          </p>
                        </div>
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60 text-xs font-semibold text-foreground flex-shrink-0">
                          {inicialesDepartamento(departamento.nombre)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/30">
                        <span className="text-[11px] text-muted-foreground">
                          {isSelected ? "Activo" : "Seleccionar"}
                        </span>
                        {isSelected ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <span className="text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">→</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
                </div>

                {departamentos.length > departamentosPorVista && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    disabled={departamentoIndex >= maxDepartamentoIndex}
                    onClick={handleNextDepartamento}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {departamentos.length > departamentosPorVista && (
                <div className="mt-3 flex justify-center gap-2 border-t border-border/60 pt-3">
                  {Array.from({ length: Math.ceil(departamentos.length / departamentosPorVista) }).map((_, pagina) => (
                    <button
                      key={pagina}
                      type="button"
                      onClick={() => setDepartamentoIndex(pagina * departamentosPorVista)}
                      className={[
                        "h-2 rounded-full transition-all",
                        Math.floor(departamentoIndex / departamentosPorVista) === pagina ? "w-6 bg-primary" : "w-2 bg-muted-foreground/35",
                      ].join(" ")}
                      aria-label={`Ir a la página ${pagina + 1}`}
                    />
                  ))}
                </div>
              )}
            </section>

            {seleccionado && filtrosDepartamentos && (
              <section className="rounded-3xl border border-border/60 bg-white p-5 shadow-sm">

                {!filtrosExpandido ? (
                  // MODO CARRUSEL COMPACTO
                  <div className="space-y-4 rounded-2xl border border-border/80 bg-muted/20 p-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Cargos de empleados disponibles
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Busca directamente o navega por páginas para explorar las opciones disponibles.
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-xs text-muted-foreground">
                            {busquedaFiltros
                              ? `${filtrosFiltrados.length} de ${filtrosDepartamentos.filter((f: any) => f.Departamento === seleccionado?.nombre && (!seleccionado?.centro || f.Centro === seleccionado.centro)).length} resultados`
                              : `Página ${Math.floor(filtroIndex / filtrosPorVista) + 1} de ${Math.ceil(filtrosFiltrados.length / filtrosPorVista)}`}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setFiltrosExpandido(true)}
                            className="text-xs"
                          >
                            Ver todos ({filtrosFiltrados.length})
                          </Button>
                        </div>
                      </div>
                    </div>

                    {filtrosFiltrados.length === 0 && !busquedaFiltros ? (
                      <p className="text-sm text-muted-foreground">No hay cargos disponibles para este departamento.</p>
                    ) : (
                      <>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="text"
                            value={busquedaFiltros}
                            onChange={(e) => setBusquedaFiltros(e.target.value)}
                            placeholder="Buscar por grupo de puesto o cargo..."
                            className="h-10 border-border/70 bg-white pl-9 pr-9"
                          />
                          {busquedaFiltros && (
                            <button
                              type="button"
                              onClick={() => setBusquedaFiltros("")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label="Limpiar búsqueda"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          {!busquedaFiltros && filtrosFiltrados.length > filtrosPorVista && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              disabled={filtroIndex === 0}
                              onClick={handlePrevFiltro}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                          )}

                          {filtrosPaginados.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-border/70 bg-white px-2 py-6 text-center text-sm text-muted-foreground flex-1">
                              No hay puestos que coincidan con &quot;{busquedaFiltros}&quot;.
                            </p>
                          ) : (
                            <div className={isMobile ? "grid grid-cols-1 gap-3 flex-1" : "grid grid-cols-1 gap-3 md:grid-cols-3 flex-1"}>
                              {filtrosPaginados.map((filtro: any, index: number) => {
                                const isSelected = isFiltroSeleccionado(filtro);
                                return (
                                  <button
                                    key={index}
                                    type="button"
                                    onClick={() => toggleFiltroSeleccionado(filtro)}
                                    className={[
                                      "flex h-full min-h-[100px] w-full flex-col justify-between rounded-2xl border px-3 py-3 text-left shadow-sm transition-all",
                                      isSelected
                                        ? "border-primary bg-primary/[0.04] ring-1 ring-primary/25 shadow-md"
                                        : "border-border bg-white hover:-translate-y-0.5 hover:border-primary/40 hover:shadow",
                                    ].join(" ")}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-foreground">{filtro.CargoEmpleado}</p>
                                      </div>
                                      <div className={[
                                        "inline-flex h-5 w-5 items-center justify-center rounded border-2 transition-all flex-shrink-0",
                                        isSelected
                                          ? "border-primary bg-primary"
                                          : "border-border bg-white"
                                      ].join(" ")}>
                                        {isSelected && <Check className="h-3 w-3 text-white" />}
                                      </div>
                                    </div>

                                    <div className="mt-2 border-t border-border/30 pt-2">
                                      <p className="text-[11px] text-muted-foreground truncate">{filtro.Centro || "Centro"}</p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {!busquedaFiltros && filtrosFiltrados.length > filtrosPorVista && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              disabled={filtroIndex >= maxFiltroIndex}
                              onClick={handleNextFiltro}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {!busquedaFiltros && filtrosFiltrados.length > filtrosPorVista && (
                          <div className="flex justify-center gap-2 border-t border-border/60 pt-3">
                            {Array.from({ length: Math.ceil(filtrosFiltrados.length / filtrosPorVista) }).map((_, pagina) => (
                              <button
                                key={pagina}
                                type="button"
                                onClick={() => setFiltroIndex(pagina * filtrosPorVista)}
                                className={[
                                  "h-2 rounded-full transition-all",
                                  Math.floor(filtroIndex / filtrosPorVista) === pagina ? "w-6 bg-primary" : "w-2 bg-muted-foreground/35",
                                ].join(" ")}
                                aria-label={`Ir a la página ${pagina + 1}`}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  // MODO EXPANDIDO - VER TODOS
                  <div className="space-y-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Todos los cargos de empleados disponibles
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Visualización completa de {filtrosFiltrados.length} elementos disponibles.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setFiltrosExpandido(false);
                            setBusquedaFiltros("");
                            setFiltroIndex(0);
                          }}
                          className="text-xs"
                        >
                          Cerrar vista completa
                        </Button>
                      </div>

                    </div>

                    {filtrosFiltrados.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                        No hay cargos disponibles para este departamento.
                      </p>
                    ) : (
                      <div className="space-y-6">
                        {Object.entries(agruparFiltrosPorLetra(filtrosFiltrados)).map(([letra, filtros]) => {
                          const idsDeEstaLetra = filtros.map((filtro: any) => generarIdFiltro(filtro));
                          const todosSeleccionadosEnLetra = idsDeEstaLetra.every((id) =>
                            filtrosSeleccionados.includes(id)
                          );

                          return (
                            <div key={letra} className="space-y-3">
                              <div className="flex items-center gap-3">
                                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
                                  {letra}
                                </div>
                                <div className="flex-1 border-t border-border/40" />
                                <span className="text-xs font-medium text-muted-foreground">{filtros.length} elemento(s)</span>
                                <button
                                  type="button"
                                  onClick={() => toggleSeleccionarTodosPorLetra(filtros)}
                                  className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                                >
                                  {todosSeleccionadosEnLetra ? "Deseleccionar" : "Seleccionar"}
                                </button>
                              </div>
                            
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                              {filtros.map((filtro: any, index: number) => {
                                const isSelected = isFiltroSeleccionado(filtro);
                                return (
                                  <button
                                    key={`${letra}-${index}`}
                                    type="button"
                                    onClick={() => toggleFiltroSeleccionado(filtro)}
                                    className={[
                                      "flex h-full min-h-[100px] w-full flex-col justify-between rounded-2xl border px-3 py-3 text-left shadow-sm transition-all",
                                      isSelected
                                        ? "border-primary bg-primary/[0.04] ring-1 ring-primary/25 shadow-md"
                                        : "border-border bg-white hover:-translate-y-0.5 hover:border-primary/40 hover:shadow",
                                    ].join(" ")}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-foreground">{filtro.CargoEmpleado}</p>
                                      </div>
                                      <div className={[
                                        "inline-flex h-5 w-5 items-center justify-center rounded border-2 transition-all flex-shrink-0",
                                        isSelected
                                          ? "border-primary bg-primary"
                                          : "border-border bg-white"
                                      ].join(" ")}>
                                        {isSelected && <Check className="h-3 w-3 text-white" />}
                                      </div>
                                    </div>

                                    <div className="mt-2 border-t border-border/30 pt-2">
                                      <p className="text-[11px] text-muted-foreground truncate">{filtro.Centro || "Centro"}</p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {seleccionado && filtrosSeleccionados.length > 0 && operadoresFiltradosPorCargos.length > 0 && (
              <section className="rounded-3xl border border-border/60 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Paso 2</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">Productividad por jornada</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {operadoresFiltradosPorCargos.length} operador(es) · {formatearFecha(rangoFechas.desde)} – {formatearFecha(rangoFechas.hasta)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {loadingConsulta && (
                      <span className="text-xs text-muted-foreground">
                        Cargando {operadorCargando ?? "..."} ({operadoresCargados}/{operadoresFiltradosPorCargos.length})
                      </span>
                    )}
                    {loadingConsulta && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={cancelarConsulta}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Cancelar
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={consultarProductividad}
                      disabled={loadingConsulta}
                      className="gap-2"
                    >
                      {loadingConsulta ? (
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      Consultar
                    </Button>
                  </div>
                </div>

                {jornadasCalculadas.length > 0 && (
                  <>
                    <div className="mt-4 space-y-4">
                      <Card className="rounded-3xl border border-border bg-white p-3 shadow-sm">
                        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-emerald-50 p-2 shadow-sm">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                              <ArrowUpRight className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Promedio EGO</p>
                              <p className="mt-1 text-2xl font-semibold text-foreground">{resumenOperadores.promedioEgo.toFixed(2)}%</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-sky-50 p-2 shadow-sm">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                              <TrendingUp className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Promedio productividad</p>
                              <p className="mt-1 text-2xl font-semibold text-foreground">{resumenOperadores.promedioProductividad.toFixed(2)}%</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-violet-50 p-2 shadow-sm">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                              <Package className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Unidades producidas</p>
                              <p className="mt-1 text-2xl font-semibold text-foreground">{resumenOperadores.totalUnidadesTodos}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-amber-50 p-2 shadow-sm">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                              <Activity className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Defectos totales</p>
                              <p className="mt-1 text-2xl font-semibold text-foreground">{resumenOperadores.totalDefectosTodos}</p>
                            </div>
                          </div>
                        </div>
                      </Card>

                      <Card className="rounded-3xl border border-border bg-white p-3 shadow-sm">
                        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-blue-50 p-2 shadow-sm">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Mejor EGO</p>
                              <p className="mt-1 text-base font-semibold text-foreground">{resumenOperadores.operadorMejorEgo.nombre}</p>
                              <p className="text-sm text-muted-foreground">{resumenOperadores.operadorMejorEgo.ego.toFixed(2)}%</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-red-50 p-2 shadow-sm">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-red-100 text-red-700">
                              <ArrowDownRight className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Peor EGO</p>
                              <p className="mt-1 text-base font-semibold text-foreground">{resumenOperadores.operadorPeorEgo.nombre}</p>
                              <p className="text-sm text-muted-foreground">{resumenOperadores.operadorPeorEgo.ego.toFixed(2)}%</p>
                            </div>
                          </div>
                        </div>
                      </Card>

                      <Card className="rounded-3xl border border-border bg-white p-3 shadow-sm">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">EGO y Productividad</p>
                          <p className="mt-2 text-sm text-muted-foreground">Operadores ordenados de mayor a menor EGO</p>
                        </div>
                        <div className="mt-4 h-[320px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={resumenOperadores.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={70} />
                              <YAxis tickFormatter={(value) => `${value}%`} />
                              <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                              <Legend />
                              <Bar dataKey="productividad" name="Productividad" radius={[6, 6, 0, 0]} fill="#2563EB" barSize={18} />
                              <Bar dataKey="ego" name="EGO" radius={[6, 6, 0, 0]} fill="#10B981" barSize={18} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>
                    </div>

                    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-left">
                          <th className="px-3 py-2 font-semibold text-muted-foreground">Operador</th>
                          <th className="px-3 py-2 font-semibold text-muted-foreground">Fecha</th>
                          <th className="px-3 py-2 font-semibold text-muted-foreground text-center">Jornada</th>
                          <th className="px-3 py-2 font-semibold text-muted-foreground">Inicio (F-H)</th>
                          <th className="px-3 py-2 font-semibold text-muted-foreground">Fin (F-H)</th>
                          <th className="px-3 py-2 font-semibold text-muted-foreground text-center">Inicio</th>
                          <th className="px-3 py-2 font-semibold text-muted-foreground text-center">Fin</th>
                          <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Hrs Brutas</th>
                          <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Σ TiempoSTD</th>
                          <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Hrs Descontar</th>
                          <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Unidades</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const agrupadoPorOperador = new Map<string, JornadaDia[]>();
                          jornadasCalculadas.forEach((j) => {
                            if (!agrupadoPorOperador.has(j.codEmpleado)) {
                              agrupadoPorOperador.set(j.codEmpleado, []);
                            }
                            agrupadoPorOperador.get(j.codEmpleado)!.push(j);
                          });

                          const elementos: JSX.Element[] = [];
                          let counterFila = 0;

                          agrupadoPorOperador.forEach((jornadas, codEmpleado) => {
                            const operadorNombre = jornadas[0]?.nombreEmpleado ?? `Op. ${codEmpleado}`;
                            const totalJornadas = jornadas.length;
                            const totalUnidades = jornadas.reduce((sum, j) => sum + (j.totalCantidad ?? 0), 0);
                            const totalHorasNetas = jornadas.reduce((sum, j) => sum + j.horasNetas, 0);
                            const totalA = jornadas.reduce((sum, j) => sum + j.horasNetas * 0.13, 0);
                            const totalHorasSTD = jornadas.reduce((sum, j) => sum + (j.totalTiempoSTD ?? 0), 0);
                            const totalHorasDescontar = jornadas.reduce((sum, j) => sum + (j.horasDescontar || 0), 0);
                            const horasTeoricasEB = totalHorasNetas - totalA - totalHorasDescontar;
                            const productividad = horasTeoricasEB > 0 ? (totalHorasSTD / horasTeoricasEB) * 100 : 0;
                            const totalDefectos = jornadas.reduce((sum, j) => sum + (j.totalDefectos ?? 0), 0);
                            const calidad = totalUnidades > 0 ? (1 - totalDefectos / totalUnidades) * 100 : 0;
                            const ego = productividad * calidad / 100;

                            // Header de agrupación por operador
                            elementos.push(
                              <tr key={`header-${codEmpleado}`} className="border-t-2 border-t-primary/30 bg-primary/5">
                                <td colSpan={11} className="px-3 py-2">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-semibold text-foreground">{operadorNombre}</p>
                                      <p className="text-[11px] text-muted-foreground">Código: {codEmpleado}</p>
                                    </div>
                                    <div className="flex gap-6">
                                      <div className="text-right">
                                        <p className="text-[11px] text-muted-foreground">Jornadas</p>
                                        <p className="font-semibold text-foreground">{totalJornadas}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-[11px] text-muted-foreground">Hrs Netas</p>
                                        <p className="font-semibold text-foreground">{totalHorasNetas.toFixed(2)}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-[11px] text-muted-foreground">Unidades</p>
                                        <p className="font-semibold text-foreground">{totalUnidades}</p>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );

                            elementos.push(
                              <tr key={`card-${codEmpleado}`}>
                                <td colSpan={11} className="px-3 py-3">
                                  <div className="space-y-4">
                                    <Card className="rounded-3xl border border-border bg-white p-0 shadow-sm">
                                      <Accordion type="single" collapsible>
                                        <AccordionItem value={`operator-${codEmpleado}`}>
                                          <AccordionTrigger className="px-4 py-4 sm:px-6">
                                            <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto_auto] items-center">
                                              <div>
                                                <p className="text-sm font-semibold text-foreground">Totales de la tabla</p>
                                                <p className="text-xs text-muted-foreground">Haz clic para expandir y ver todos los registros</p>
                                              </div>
                                              <div className="text-right">
                                                <p className="text-[11px] uppercase text-muted-foreground">Hrs Netas</p>
                                                <p className="text-sm font-semibold text-foreground">{totalHorasNetas.toFixed(2)}</p>
                                              </div>
                                              <div className="text-right">
                                                <p className="text-[11px] uppercase text-muted-foreground">Paros Planeados</p>
                                                <p className="text-sm font-semibold text-foreground">{totalA.toFixed(2)}</p>
                                              </div>
                                              <div className="text-right">
                                                <p className="text-[11px] uppercase text-muted-foreground">Unidades</p>
                                                <p className="text-sm font-semibold text-foreground">{totalUnidades}</p>
                                              </div>
                                            </div>
                                          </AccordionTrigger>
                                          <AccordionContent className="p-0">
                                            <div className="overflow-x-auto overflow-y-auto max-h-[420px] min-w-[960px] p-3">
                                              <table className="w-full text-xs">
                                                <thead>
                                                  <tr className="border-b border-border bg-muted/40 text-left">
                                                    <th className="px-3 py-2 font-semibold text-muted-foreground">Fecha</th>
                                                    <th className="px-3 py-2 font-semibold text-muted-foreground text-center">Jornada</th>
                                                    <th className="px-3 py-2 font-semibold text-muted-foreground">Inicio (F-H)</th>
                                                    <th className="px-3 py-2 font-semibold text-muted-foreground">Fin (F-H)</th>
                                                    <th className="px-3 py-2 font-semibold text-muted-foreground text-center">Inicio</th>
                                                    <th className="px-3 py-2 font-semibold text-muted-foreground text-center">Fin</th>
                                                    <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Hrs Brutas</th>
                                                    <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Paros Planeados</th>
                                                    <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Σ TiempoSTD</th>
                                                    <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Hrs Descontar</th>
                                                    <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Unidades</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {jornadas.map((j, idx) => {
                                                    const valorA = j.horasNetas * 0.13;
                                                    return (
                                                      <tr key={`${codEmpleado}-${idx}`} className={idx % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                                                        <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{j.dia.toString().padStart(2, "0")}/{j.mes.toString().padStart(2, "0")}/{j.año}</td>
                                                        <td className="px-3 py-1.5 text-center">
                                                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${j.jornada === 1 ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                                                            J{j.jornada}
                                                          </span>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap font-mono text-[10px]">{j.fechaHoraInicio}</td>
                                                        <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap font-mono text-[10px]">{j.fechaHoraFin}</td>
                                                        <td className="px-3 py-1.5 text-center font-mono text-muted-foreground">{j.horaInicio}</td>
                                                        <td className="px-3 py-1.5 text-center font-mono text-muted-foreground">{j.horaFin}</td>
                                                        <td className="px-3 py-1.5 text-right font-mono">{j.horasNetas.toFixed(2)}</td>
                                                        <td className="px-3 py-1.5 text-right font-mono">{valorA.toFixed(2)}</td>
                                                        <td className="px-3 py-1.5 text-right font-mono">{(j.totalTiempoSTD ?? 0).toFixed(3)}</td>
                                                        <td className="px-3 py-1.5 text-right font-mono text-orange-600">{j.horasDescontar > 0 ? j.horasDescontar.toFixed(3) : "—"}</td>
                                                        <td className="px-3 py-1.5 text-right font-mono">{j.totalCantidad ?? 0}</td>
                                                      </tr>
                                                    );
                                                  })}
                                                </tbody>
                                                <tfoot>
                                                  <tr className="border-t border-border bg-muted/10 font-semibold">
                                                    <td colSpan={6} className="px-3 py-2 text-right text-sm">Totales</td>
                                                    <td className="px-3 py-2 text-right text-sm">{totalHorasNetas.toFixed(2)}</td>
                                                    <td className="px-3 py-2 text-right text-sm">{totalA.toFixed(2)}</td>
                                                    <td className="px-3 py-2 text-right text-sm">{totalHorasSTD.toFixed(3)}</td>
                                                    <td className="px-3 py-2 text-right text-sm">{totalHorasDescontar.toFixed(3)}</td>
                                                    <td className="px-3 py-2 text-right text-sm">{totalUnidades}</td>
                                                  </tr>
                                                </tfoot>
                                              </table>
                                            </div>
                                          </AccordionContent>
                                        </AccordionItem>
                                      </Accordion>
                                    </Card>

                                    <Card className="overflow-hidden rounded-3xl border border-border bg-white p-4 shadow-sm">
                                      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
                                          <div className="rounded-2xl border border-border/80 bg-muted/50 p-3">
                                            <p className="text-[11px] uppercase text-muted-foreground">B) Horas STD</p>
                                            <p className="mt-2 text-lg font-semibold text-foreground">{totalHorasSTD.toFixed(2)}</p>
                                          </div>
                                          <div className="rounded-2xl border border-border/80 bg-muted/50 p-3">
                                            <p className="text-[11px] uppercase text-muted-foreground">C) Horas Teóricas Efectivas</p>
                                            <p className="mt-2 text-lg font-semibold text-foreground">{horasTeoricasEB.toFixed(2)}</p>
                                          </div>
                                          <div className="rounded-2xl border border-border/80 bg-muted/50 p-3">
                                            <p className="text-[11px] uppercase text-muted-foreground">D) Productividad</p>
                                            <p className="mt-2 text-lg font-semibold text-foreground">{productividad.toFixed(2)}%</p>
                                          </div>
                                          <div className="rounded-2xl border border-border/80 bg-muted/50 p-3">
                                            <p className="text-[11px] uppercase text-muted-foreground">E) Calidad</p>
                                            <p className="mt-2 text-lg font-semibold text-foreground">{calidad.toFixed(2)}%</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-end">
                                          <div className="relative flex h-28 w-28 flex-col items-center justify-center rounded-full border-2 border-primary/30 bg-primary/5 text-center shadow-sm shadow-primary/10">
                                            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">EGO</span>
                                            <span className="mt-2 text-3xl font-semibold text-foreground">{ego.toFixed(2)}%</span>
                                            <span className="mt-1 text-[10px] text-muted-foreground">Meta</span>
                                            <div className="absolute bottom-2 left-1/2 h-1.5 w-20 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-400 via-yellow-400 to-rose-500" />
                                          </div>
                                        </div>
                                      </div>
                                    </Card>
                                  </div>
                                </td>
                              </tr>
                            );
                          });

                          return elementos;
                        })()}
                      </tbody>
                    </table>
                  </div>
                    </>
                )}

                {!loadingConsulta && jornadasCalculadas.length === 0 && (
                  <p className="mt-4 text-sm text-muted-foreground">Presiona Consultar para cargar los datos.</p>
                )}
              </section>
            )}
          </div>
        )}
      </CardContent>


    </Card>
  );
}
